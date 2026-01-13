/**
 * Issue Detector
 * Detects code graph issues (missing links, unreachable code, broken exports)
 * 
 * Enhanced with ESM extension mapping support to reduce false positives
 * in TypeScript projects using moduleResolution: NodeNext
 */

import type { GraphStore } from '../core/GraphStore';
import type { GraphIssue, IssueSeverity, GraphNode } from '../core/types';
import { ReachabilityAnalyzer } from './ReachabilityAnalyzer';
import { 
    getPossibleSourcePaths, 
} from '../core/ExtensionMapper';

export class IssueDetector {
    private reachabilityAnalyzer: ReachabilityAnalyzer;

    constructor(private store: GraphStore) {
        this.reachabilityAnalyzer = new ReachabilityAnalyzer(store);
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
