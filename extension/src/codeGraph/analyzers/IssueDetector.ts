/**
 * Issue Detector
 * Detects code graph issues (missing links, unreachable code, broken exports)
 * 
 * Enhanced with:
 * - ESM extension mapping support to reduce false positives
 * - LSP validation to verify issues with semantic analysis
 */

import type { GraphStore } from '../core/GraphStore';
import type { GraphIssue, IssueSeverity, GraphNode } from '../core/types';
import { ReachabilityAnalyzer } from './ReachabilityAnalyzer';
import { 
    getPossibleSourcePaths, 
} from '../core/ExtensionMapper';
import { getLspEnhancer } from '../lsp';
import { createLogger } from '../../utils/logger';

const logger = createLogger('IssueDetector');

export interface LspValidationResult {
    validated: boolean;
    confidence: 'high' | 'medium' | 'low';
    evidence?: string[];
    isFalsePositive?: boolean;
}

export class IssueDetector {
    private reachabilityAnalyzer: ReachabilityAnalyzer;
    private lspValidationEnabled = true;

    constructor(private store: GraphStore) {
        this.reachabilityAnalyzer = new ReachabilityAnalyzer(store);
    }

    /**
     * Enable or disable LSP validation
     */
    setLspValidation(enabled: boolean): void {
        this.lspValidationEnabled = enabled;
    }

    /**
     * Detect all issues in the graph
     */
    detectAll(): GraphIssue[] {
        const issues: GraphIssue[] = [];

        issues.push(...this.detectUnreachableHandlers());
        issues.push(...this.detectDynamicEdges());
        issues.push(...this.detectBrokenExports());

        return issues;
    }

    /**
     * Detect all issues with LSP validation (async)
     * This filters out false positives using LSP semantic analysis
     */
    async detectAllWithLspValidation(): Promise<GraphIssue[]> {
        const issues = this.detectAll();
        
        if (!this.lspValidationEnabled) {
            return issues;
        }

        const lspEnhancer = getLspEnhancer();
        if (!lspEnhancer) {
            logger.debug('LSP Enhancer not available, skipping validation');
            return issues;
        }

        const validatedIssues: GraphIssue[] = [];
        
        for (const issue of issues) {
            const validation = await this.validateIssueWithLsp(issue);
            
            if (validation.isFalsePositive) {
                logger.debug('LSP validation filtered false positive', {
                    issueId: issue.id,
                    kind: issue.kind,
                    evidence: validation.evidence,
                });
                continue;
            }

            // Add LSP validation info to issue meta
            if (validation.evidence && validation.evidence.length > 0) {
                issue.meta = {
                    ...issue.meta,
                    lspValidated: true,
                    lspConfidence: validation.confidence,
                    lspEvidence: validation.evidence,
                };
            }

            validatedIssues.push(issue);
        }

        logger.info(`LSP validation: ${issues.length} issues → ${validatedIssues.length} validated (${issues.length - validatedIssues.length} false positives filtered)`);
        
        return validatedIssues;
    }

    /**
     * Validate a single issue using LSP
     */
    private async validateIssueWithLsp(issue: GraphIssue): Promise<LspValidationResult> {
        const lspEnhancer = getLspEnhancer();
        if (!lspEnhancer) {
            return { validated: true, confidence: 'low' };
        }

        const filePath = issue.meta?.filePath as string | undefined;
        if (!filePath) {
            return { validated: true, confidence: 'low' };
        }

        try {
            switch (issue.kind) {
                case 'HANDLER_UNREACHABLE':
                    return await this.validateUnreachableWithLsp(issue, filePath);
                
                case 'BROKEN_EXPORT_CHAIN':
                    return await this.validateBrokenExportWithLsp(issue, filePath);
                
                default:
                    return { validated: true, confidence: 'medium' };
            }
        } catch (error) {
            logger.debug('LSP validation error', { issueId: issue.id, error });
            return { validated: true, confidence: 'low' };
        }
    }

    /**
     * Validate HANDLER_UNREACHABLE using LSP references
     * If LSP finds external references, the file is actually used
     */
    private async validateUnreachableWithLsp(
        issue: GraphIssue,
        filePath: string
    ): Promise<LspValidationResult> {
        const lspEnhancer = getLspEnhancer();
        if (!lspEnhancer) {
            return { validated: true, confidence: 'low' };
        }

        try {
            // Get export references for the file
            const exportRefs = await lspEnhancer.getExportReferences(filePath);
            
            // Check if any exported symbol has external references
            const usedExports = exportRefs.filter(ref => ref.isExported && !ref.isUnused);
            
            if (usedExports.length > 0) {
                // LSP found references - this is a false positive
                return {
                    validated: false,
                    confidence: 'high',
                    evidence: [
                        `LSP found ${usedExports.length} exported symbols with external references`,
                        `Used exports: ${usedExports.slice(0, 3).map(e => e.symbol.name).join(', ')}`,
                    ],
                    isFalsePositive: true,
                };
            }

            // No external references found - issue is valid
            return {
                validated: true,
                confidence: 'high',
                evidence: ['LSP confirmed no external references to exported symbols'],
            };
        } catch {
            return { validated: true, confidence: 'low' };
        }
    }

    /**
     * Validate BROKEN_EXPORT_CHAIN using LSP definition lookup
     * If LSP can find the definition, the export chain is not broken
     */
    private async validateBrokenExportWithLsp(
        issue: GraphIssue,
        filePath: string
    ): Promise<LspValidationResult> {
        const lspEnhancer = getLspEnhancer();
        if (!lspEnhancer) {
            return { validated: true, confidence: 'low' };
        }

        const symbolName = issue.meta?.symbol as string | undefined;
        if (!symbolName) {
            return { validated: true, confidence: 'medium' };
        }

        try {
            // Check if LSP is available for this file
            const isAvailable = await lspEnhancer.isLspAvailable(filePath);
            if (!isAvailable) {
                return { validated: true, confidence: 'low' };
            }

            // Get enhanced node info to check symbols
            const nodeInfo = await lspEnhancer.getEnhancedNodeInfo(filePath);
            
            if (nodeInfo.lsp.available && nodeInfo.lsp.symbols.length > 0) {
                // Check if the symbol exists in the file
                const symbolExists = nodeInfo.lsp.symbols.some(
                    s => s.name === symbolName || 
                         s.children?.some(c => c.name === symbolName)
                );
                
                if (symbolExists) {
                    return {
                        validated: false,
                        confidence: 'high',
                        evidence: [`LSP found symbol '${symbolName}' in file`],
                        isFalsePositive: true,
                    };
                }
            }

            return {
                validated: true,
                confidence: 'high',
                evidence: [`LSP confirmed symbol '${symbolName}' not found`],
            };
        } catch {
            return { validated: true, confidence: 'low' };
        }
    }

    /**
     * Detect unreachable handlers (HANDLER_UNREACHABLE)
     * Files that exist but are not reachable from any entrypoint
     */
    detectUnreachableHandlers(): GraphIssue[] {
        const issues: GraphIssue[] = [];
        const result = this.reachabilityAnalyzer.analyze();

        for (const nodeId of result.unreachable) {
            const node = this.store.getNode(nodeId);
            if (!node || node.kind !== 'file') continue;

            // Skip test files, config files, etc.
            if (this.shouldSkipFile(node.path ?? '')) continue;

            // Skip barrel files - they are reached via re-exports, not direct imports
            if (node.meta?.isBarrel) continue;

            // Check if this file is re-exported by a reachable barrel file
            if (this.isReexportedByReachableBarrel(nodeId, result.reachable)) continue;

            // Check if file has exports (potential handler)
            const exports = node.meta?.exports as string[] | undefined;
            if (!exports || exports.length === 0) continue;

            issues.push({
                id: `issue:unreachable:${nodeId}`,
                kind: 'HANDLER_UNREACHABLE',
                severity: this.calculateSeverity(exports.length),
                nodeId,
                title: `Unreachable file: ${node.name}`,
                evidence: [
                    `File exports ${exports.length} symbol(s): ${exports.slice(0, 3).join(', ')}${exports.length > 3 ? '...' : ''}`,
                    'Not imported by any file reachable from entrypoints',
                ],
                suggestedFix: [
                    'Import this file from a reachable module',
                    'Add as an entrypoint if it should be directly accessible',
                    'Remove if no longer needed',
                ],
                meta: {
                    filePath: node.path,
                    affectedCount: exports.length,
                },
            });
        }

        return issues;
    }

    /**
     * Check if a file is re-exported by a reachable barrel file
     * This handles the case where files are exported via `export * from './file'`
     */
    private isReexportedByReachableBarrel(nodeId: string, reachableNodes: Set<string>): boolean {
        // Get all edges pointing TO this node (incoming edges)
        const incomingEdges = this.store.getEdgesTo(nodeId);
        
        for (const edge of incomingEdges) {
            // Check if this is a re-export edge
            if (edge.kind === 'reexports') {
                // Check if the source of the re-export is reachable
                if (reachableNodes.has(edge.from)) {
                    return true;
                }
                // Recursively check if the source is re-exported by a reachable barrel
                if (this.isReexportedByReachableBarrel(edge.from, reachableNodes)) {
                    return true;
                }
            }
        }
        
        return false;
    }

    /**
     * Detect dynamic edges (DYNAMIC_EDGE_UNKNOWN)
     * Imports that cannot be statically resolved
     * Note: Dynamic imports are often intentional (code splitting, lazy loading)
     * so we report them as 'info' severity, not 'warning'
     */
    detectDynamicEdges(): GraphIssue[] {
        const issues: GraphIssue[] = [];
        const edges = this.store.getAllEdges();

        for (const edge of edges) {
            if (edge.confidence === 'unknown' || edge.meta?.isDynamic) {
                const fromNode = this.store.getNode(edge.from);
                
                // Dynamic imports are often intentional patterns:
                // - Code splitting for performance
                // - Lazy loading for faster initial load
                // - Conditional loading based on environment
                // Report as 'info' rather than 'warning'
                issues.push({
                    id: `issue:dynamic:${edge.id}`,
                    kind: 'DYNAMIC_EDGE_UNKNOWN',
                    severity: 'info', // Changed from 'warning' to 'info'
                    nodeId: edge.from,
                    title: `Dynamic import in ${fromNode?.name ?? edge.from}`,
                    evidence: [
                        `Dynamic import detected: ${edge.reason ?? 'unknown reason'}`,
                        `Target: ${edge.to}`,
                        'This is often intentional for code splitting or lazy loading',
                    ],
                    suggestedFix: [
                        'No action needed if this is intentional',
                        'Add @graph-ignore annotation to suppress this notice',
                    ],
                    meta: {
                        filePath: fromNode?.path,
                        line: edge.meta?.loc?.line,
                        isIntentional: true, // Mark as likely intentional
                    },
                });
            }
        }

        return issues;
    }

    /**
     * Detect broken export chains (BROKEN_EXPORT_CHAIN)
     * Re-exports that point to non-existent files or symbols
     */
    detectBrokenExports(): GraphIssue[] {
        const issues: GraphIssue[] = [];
        const edges = this.store.getAllEdges();

        for (const edge of edges) {
            if (edge.kind === 'reexports' || edge.kind === 'exports') {
                const toNode = this.store.getNode(edge.to);
                
                // Check if target exists
                if (!toNode) {
                    // Skip workspace package references - they are resolved at runtime
                    if (edge.to.startsWith('workspace:') || edge.to.startsWith('module:')) {
                        continue;
                    }
                    
                    // Try to find the node with alternative extensions
                    // This handles ESM-style .js imports that map to .ts source files
                    const alternativeNode = this.findNodeWithAlternativeExtension(edge.to);
                    if (alternativeNode) {
                        // Not broken, just using ESM-style extension
                        continue;
                    }
                    
                    // Check if this is a workspace package import (@org/package)
                    if (this.isWorkspacePackageImport(edge.to)) {
                        continue;
                    }
                    
                    const fromNode = this.store.getNode(edge.from);
                    
                    issues.push({
                        id: `issue:broken:${edge.id}`,
                        kind: 'BROKEN_EXPORT_CHAIN',
                        severity: 'error',
                        nodeId: edge.from,
                        title: `Broken export in ${fromNode?.name ?? edge.from}`,
                        evidence: [
                            `Export target not found: ${edge.to}`,
                            'This may cause runtime errors',
                        ],
                        suggestedFix: [
                            'Verify the export path is correct',
                            'Ensure the target file exists',
                            'Check for typos in the import path',
                        ],
                        meta: {
                            filePath: fromNode?.path,
                            symbol: edge.to,
                        },
                    });
                }
            }
        }

        return issues;
    }

    /**
     * Check if the import path is a workspace package (monorepo internal dependency)
     */
    private isWorkspacePackageImport(nodeId: string): boolean {
        // Extract path from node ID
        let importPath = nodeId;
        if (nodeId.startsWith('file:')) {
            importPath = nodeId.slice(5);
        }
        
        // Check for scoped package pattern: @org/package
        if (importPath.startsWith('@') && importPath.includes('/')) {
            const parts = importPath.split('/');
            // @scope/package or @scope/package/subpath
            if (parts.length >= 2 && parts[0].startsWith('@')) {
                // This looks like a scoped package - could be workspace or external
                // We can't definitively know without checking package.json/pnpm-workspace.yaml
                // But we should not report it as broken since it might be a valid workspace package
                return true;
            }
        }
        
        return false;
    }

    /**
     * Find a node with alternative file extension
     * Handles ESM-style .js imports that should resolve to .ts files
     * 
     * Enhanced to use the centralized ExtensionMapper for consistent behavior
     */
    private findNodeWithAlternativeExtension(nodeId: string): GraphNode | undefined {
        // Extract path from node ID (format: "file:path/to/file.js")
        if (!nodeId.startsWith('file:')) {
            return undefined;
        }
        
        const filePath = nodeId.slice(5); // Remove "file:" prefix
        
        // Use centralized extension mapping
        const possiblePaths = getPossibleSourcePaths(filePath);
        
        for (const possiblePath of possiblePaths) {
            // Skip the original path (already checked)
            if (possiblePath === filePath) continue;
            
            const altNode = this.store.getNode(`file:${possiblePath}`);
            if (altNode) {
                return altNode;
            }
        }
        
        return undefined;
    }

    /**
     * Calculate severity based on impact
     */
    private calculateSeverity(exportCount: number): IssueSeverity {
        if (exportCount > 5) return 'error';
        if (exportCount > 2) return 'warning';
        return 'info';
    }

    /**
     * Check if file should be skipped for unreachable detection
     */
    private shouldSkipFile(filePath: string): boolean {
        const skipPatterns = [
            /\.test\./,
            /\.spec\./,
            /__tests__/,
            /\.config\./,
            /\.d\.ts$/,
            /node_modules/,
        ];

        return skipPatterns.some((pattern) => pattern.test(filePath));
    }
}
