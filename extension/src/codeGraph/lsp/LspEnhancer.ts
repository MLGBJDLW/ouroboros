/**
 * LSP Enhancer
 * Integrates LSP capabilities with the Graph system
 * 
 * Provides:
 * - Enhanced node details with LSP symbols
 * - Issue validation using LSP references
 * - Real-time diagnostics sync
 * - Call hierarchy integration
 */

import * as vscode from 'vscode';
import { createLogger } from '../../utils/logger';
import { 
    getSymbolService, 
    type SymbolInfo, 
    type ReferenceInfo, 
    type CallHierarchyResult,
    type DefinitionInfo,
} from './SymbolService';
import type { GraphStore } from '../core/GraphStore';
import type { GraphIssue, IssueKind, IssueSeverity } from '../core/types';

const logger = createLogger('LspEnhancer');

// ============================================
// Types
// ============================================

export interface EnhancedNodeInfo {
    path: string;
    // From Graph (fast, cached)
    graph: {
        imports: string[];
        importedBy: string[];
        exports: string[];
        isEntrypoint: boolean;
        isHotspot: boolean;
        issueCount: number;
    };
    // From LSP (precise, on-demand)
    lsp: {
        available: boolean;
        symbols: SymbolInfo[];
        diagnostics: LspDiagnostic[];
        lastUpdated: number;
    };
}

export interface LspDiagnostic {
    severity: 'error' | 'warning' | 'info' | 'hint';
    message: string;
    line: number;
    column: number;
    endLine: number;
    endColumn: number;
    source?: string;
    code?: string | number;
}

export interface SymbolReferences {
    symbol: SymbolInfo;
    references: ReferenceInfo[];
    isExported: boolean;
    isUnused: boolean;
}

export interface ValidatedIssue {
    issue: GraphIssue;
    validated: boolean;
    lspEvidence?: string[];
    confidence: 'high' | 'medium' | 'low';
}

export interface CallHierarchyNode {
    name: string;
    kind: string;
    path: string;
    line: number;
    detail?: string;
    callers: CallHierarchyNode[];
    callees: CallHierarchyNode[];
}

// ============================================
// LSP Enhancer Class
// ============================================

export class LspEnhancer {
    private store: GraphStore;
    private symbolService = getSymbolService();
    private diagnosticsCache: Map<string, LspDiagnostic[]> = new Map();
    private symbolsCache: Map<string, { symbols: SymbolInfo[]; timestamp: number }> = new Map();
    private disposables: vscode.Disposable[] = [];
    private cacheTimeout = 30000; // 30 seconds

    constructor(store: GraphStore) {
        this.store = store;
        this.setupDiagnosticsListener();
        logger.info('LspEnhancer initialized');
    }

    /**
     * Setup listener for VS Code diagnostics changes
     */
    private setupDiagnosticsListener(): void {
        const listener = vscode.languages.onDidChangeDiagnostics((event) => {
            for (const uri of event.uris) {
                const filePath = this.getRelativePath(uri);
                if (filePath) {
                    this.updateDiagnosticsCache(uri, filePath);
                }
            }
        });
        this.disposables.push(listener);
    }

    /**
     * Update diagnostics cache for a file
     */
    private updateDiagnosticsCache(uri: vscode.Uri, filePath: string): void {
        const diagnostics = vscode.languages.getDiagnostics(uri);
        const converted: LspDiagnostic[] = diagnostics.map(d => ({
            severity: this.convertSeverity(d.severity),
            message: d.message,
            line: d.range.start.line + 1,
            column: d.range.start.character + 1,
            endLine: d.range.end.line + 1,
            endColumn: d.range.end.character + 1,
            source: d.source,
            code: typeof d.code === 'object' ? d.code.value : d.code,
        }));
        this.diagnosticsCache.set(filePath, converted);
    }

    /**
     * Convert VS Code diagnostic severity
     */
    private convertSeverity(severity: vscode.DiagnosticSeverity): LspDiagnostic['severity'] {
        switch (severity) {
            case vscode.DiagnosticSeverity.Error: return 'error';
            case vscode.DiagnosticSeverity.Warning: return 'warning';
            case vscode.DiagnosticSeverity.Information: return 'info';
            case vscode.DiagnosticSeverity.Hint: return 'hint';
            default: return 'info';
        }
    }

    /**
     * Get relative path from URI
     */
    private getRelativePath(uri: vscode.Uri): string | null {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        if (!workspaceFolder) return null;
        
        const fullPath = uri.fsPath.replace(/\\/g, '/');
        const rootPath = workspaceFolder.uri.fsPath.replace(/\\/g, '/');
        
        if (fullPath.startsWith(rootPath)) {
            const relative = fullPath.substring(rootPath.length);
            return relative.startsWith('/') ? relative.substring(1) : relative;
        }
        return null;
    }

    // ============================================
    // Enhanced Node Info
    // ============================================

    /**
     * Get enhanced node information combining Graph and LSP data
     */
    async getEnhancedNodeInfo(filePath: string): Promise<EnhancedNodeInfo> {
        // Get Graph data (fast)
        const graphInfo = this.getGraphInfo(filePath);
        
        // Get LSP data (may be slower, but more precise)
        const lspInfo = await this.getLspInfo(filePath);
        
        return {
            path: filePath,
            graph: graphInfo,
            lsp: lspInfo,
        };
    }

    /**
     * Get graph-based info for a file
     */
    private getGraphInfo(filePath: string): EnhancedNodeInfo['graph'] {
        const nodeId = `file:${filePath}`;
        const node = this.store.getNode(nodeId);
        
        // Get imports (outgoing edges)
        const outgoingEdges = this.store.getEdgesFrom(nodeId);
        const imports = outgoingEdges
            .filter(e => e.kind === 'imports')
            .map(e => e.to.replace('file:', ''));
        
        // Get importedBy (incoming edges)
        const incomingEdges = this.store.getEdgesTo(nodeId);
        const importedBy = incomingEdges
            .filter(e => e.kind === 'imports')
            .map(e => e.from.replace('file:', ''));
        
        // Get exports from node metadata
        const exports = (node?.meta?.exports as string[]) ?? [];
        
        // Check entrypoint status
        const entrypointNodes = this.store.getNodesByKind('entrypoint');
        const isEntrypoint = entrypointNodes.some(n => n.path === filePath);
        
        // Check hotspot status (files with many importers)
        const isHotspot = importedBy.length >= 5;
        
        // Count issues for this file
        const issues = this.store.getIssues();
        const issueCount = issues.filter(i => i.meta?.filePath === filePath).length;
        
        return {
            imports,
            importedBy,
            exports,
            isEntrypoint,
            isHotspot,
            issueCount,
        };
    }

    /**
     * Get LSP-based info for a file
     */
    private async getLspInfo(filePath: string): Promise<EnhancedNodeInfo['lsp']> {
        // Check cache
        const cached = this.symbolsCache.get(filePath);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return {
                available: true,
                symbols: cached.symbols,
                diagnostics: this.diagnosticsCache.get(filePath) ?? [],
                lastUpdated: cached.timestamp,
            };
        }

        try {
            // Get document symbols from LSP
            const symbols = await this.symbolService.getDocumentSymbols(filePath);
            
            // Update cache
            this.symbolsCache.set(filePath, { symbols, timestamp: Date.now() });
            
            // Get diagnostics
            const diagnostics = this.diagnosticsCache.get(filePath) ?? [];
            
            return {
                available: true,
                symbols,
                diagnostics,
                lastUpdated: Date.now(),
            };
        } catch (error) {
            logger.debug('LSP not available for file', { filePath, error });
            return {
                available: false,
                symbols: [],
                diagnostics: this.diagnosticsCache.get(filePath) ?? [],
                lastUpdated: 0,
            };
        }
    }

    // ============================================
    // Symbol References Analysis
    // ============================================

    /**
     * Get references for all exported symbols in a file
     * Useful for finding unused exports
     */
    async getExportReferences(filePath: string): Promise<SymbolReferences[]> {
        const results: SymbolReferences[] = [];
        
        try {
            const symbols = await this.symbolService.getDocumentSymbols(filePath);
            
            // Filter to exported symbols (functions, classes, variables at top level)
            const exportableKinds = ['function', 'class', 'variable', 'constant', 'interface', 'type'];
            const topLevelSymbols = symbols.filter(s => 
                exportableKinds.includes(s.kind) && !s.name.startsWith('_')
            );
            
            for (const symbol of topLevelSymbols) {
                try {
                    const references = await this.symbolService.findReferences(
                        filePath,
                        symbol.selectionRange.startLine,
                        symbol.selectionRange.startColumn,
                        { includeDeclaration: false, limit: 50 }
                    );
                    
                    // Check if symbol is exported (has references from other files)
                    const externalRefs = references.filter(r => r.path !== filePath);
                    const isExported = externalRefs.length > 0;
                    const isUnused = references.length === 0;
                    
                    results.push({
                        symbol,
                        references,
                        isExported,
                        isUnused,
                    });
                } catch {
                    // Skip symbols that can't be analyzed
                    continue;
                }
            }
        } catch (error) {
            logger.error('Failed to get export references', { filePath, error });
        }
        
        return results;
    }

    // ============================================
    // Issue Validation
    // ============================================

    /**
     * Validate Graph-detected issues using LSP
     */
    async validateIssues(issues: GraphIssue[]): Promise<ValidatedIssue[]> {
        const results: ValidatedIssue[] = [];
        
        for (const issue of issues) {
            const validated = await this.validateSingleIssue(issue);
            results.push(validated);
        }
        
        return results;
    }

    /**
     * Validate a single issue using LSP
     */
    private async validateSingleIssue(issue: GraphIssue): Promise<ValidatedIssue> {
        const filePath = issue.meta?.filePath;
        
        if (!filePath) {
            return { issue, validated: false, confidence: 'low' };
        }

        try {
            switch (issue.kind) {
                case 'ORPHAN_EXPORT':
                    return await this.validateOrphanExport(issue, filePath);
                
                case 'CIRCULAR_DEPENDENCY':
                case 'CIRCULAR_REEXPORT':
                    return await this.validateCircularDependency(issue, filePath);
                
                case 'BROKEN_EXPORT_CHAIN':
                    return await this.validateBrokenExportChain(issue, filePath);
                
                default:
                    // For other issues, trust the Graph analysis
                    return { issue, validated: true, confidence: 'medium' };
            }
        } catch (error) {
            logger.debug('Issue validation failed', { issueId: issue.id, error });
            return { issue, validated: false, confidence: 'low' };
        }
    }

    /**
     * Validate ORPHAN_EXPORT using LSP references
     */
    private async validateOrphanExport(issue: GraphIssue, filePath: string): Promise<ValidatedIssue> {
        const symbolName = issue.meta?.symbol;
        if (!symbolName) {
            return { issue, validated: true, confidence: 'medium' };
        }

        try {
            const symbols = await this.symbolService.getDocumentSymbols(filePath);
            const targetSymbol = symbols.find(s => s.name === symbolName);
            
            if (!targetSymbol) {
                return { issue, validated: true, confidence: 'medium' };
            }

            const references = await this.symbolService.findReferences(
                filePath,
                targetSymbol.selectionRange.startLine,
                targetSymbol.selectionRange.startColumn,
                { includeDeclaration: false, limit: 10 }
            );

            const externalRefs = references.filter(r => r.path !== filePath);
            
            if (externalRefs.length > 0) {
                // LSP found references, issue might be false positive
                return {
                    issue,
                    validated: false,
                    lspEvidence: [`LSP found ${externalRefs.length} external references`],
                    confidence: 'high',
                };
            }

            return {
                issue,
                validated: true,
                lspEvidence: ['LSP confirmed no external references'],
                confidence: 'high',
            };
        } catch {
            return { issue, validated: true, confidence: 'low' };
        }
    }

    /**
     * Validate circular dependency issues
     */
    private async validateCircularDependency(issue: GraphIssue, filePath: string): Promise<ValidatedIssue> {
        // Circular dependencies are structural, LSP can't directly validate
        // But we can check if the imports actually exist
        try {
            const symbols = await this.symbolService.getDocumentSymbols(filePath);
            const hasImports = symbols.length > 0;
            
            return {
                issue,
                validated: true,
                lspEvidence: hasImports ? ['File has valid symbols'] : undefined,
                confidence: 'medium',
            };
        } catch {
            return { issue, validated: true, confidence: 'low' };
        }
    }

    /**
     * Validate broken export chain
     */
    private async validateBrokenExportChain(issue: GraphIssue, filePath: string): Promise<ValidatedIssue> {
        const symbolName = issue.meta?.symbol;
        if (!symbolName) {
            return { issue, validated: true, confidence: 'medium' };
        }

        try {
            // Try to find the definition of the symbol
            const symbols = await this.symbolService.getDocumentSymbols(filePath);
            const targetSymbol = symbols.find(s => s.name === symbolName);
            
            if (targetSymbol) {
                // Symbol exists in file, chain might not be broken
                return {
                    issue,
                    validated: false,
                    lspEvidence: [`Symbol '${symbolName}' found in file`],
                    confidence: 'high',
                };
            }

            return {
                issue,
                validated: true,
                lspEvidence: [`Symbol '${symbolName}' not found in file`],
                confidence: 'high',
            };
        } catch {
            return { issue, validated: true, confidence: 'low' };
        }
    }

    // ============================================
    // Call Hierarchy
    // ============================================

    /**
     * Get call hierarchy for a symbol
     */
    async getCallHierarchy(
        filePath: string,
        line: number,
        column: number,
        depth: number = 2
    ): Promise<CallHierarchyNode | null> {
        try {
            const result = await this.symbolService.getCallHierarchy(filePath, line, column, {
                direction: 'both',
            });

            if (!result) return null;

            return this.buildCallHierarchyTree(result, depth);
        } catch (error) {
            logger.error('Failed to get call hierarchy', { filePath, line, column, error });
            return null;
        }
    }

    /**
     * Build call hierarchy tree from LSP result
     */
    private buildCallHierarchyTree(result: CallHierarchyResult, maxDepth: number): CallHierarchyNode {
        const root: CallHierarchyNode = {
            name: result.item.name,
            kind: result.item.kind,
            path: result.item.path,
            line: result.item.line,
            detail: result.item.detail,
            callers: [],
            callees: [],
        };

        // Add callers (limited depth)
        if (maxDepth > 0) {
            root.callers = result.callers.map(caller => ({
                name: caller.from.name,
                kind: caller.from.kind,
                path: caller.from.path,
                line: caller.from.line,
                detail: caller.from.detail,
                callers: [],
                callees: [],
            }));

            root.callees = result.callees.map(callee => ({
                name: callee.to.name,
                kind: callee.to.kind,
                path: callee.to.path,
                line: callee.to.line,
                detail: callee.to.detail,
                callers: [],
                callees: [],
            }));
        }

        return root;
    }

    // ============================================
    // Diagnostics Sync
    // ============================================

    /**
     * Sync LSP diagnostics to Graph issues
     */
    syncDiagnosticsToIssues(): GraphIssue[] {
        const newIssues: GraphIssue[] = [];
        
        for (const [filePath, diagnostics] of this.diagnosticsCache) {
            for (const diag of diagnostics) {
                // Only sync errors and warnings
                if (diag.severity !== 'error' && diag.severity !== 'warning') continue;
                
                const issue: GraphIssue = {
                    id: `lsp:${filePath}:${diag.line}:${diag.column}`,
                    kind: 'DYNAMIC_EDGE_UNKNOWN' as IssueKind, // Use as generic LSP issue
                    severity: diag.severity === 'error' ? 'error' : 'warning' as IssueSeverity,
                    title: `[LSP] ${diag.source ?? 'Diagnostic'}`,
                    message: diag.message,
                    meta: {
                        filePath,
                        line: diag.line,
                        source: diag.source,
                        code: diag.code?.toString(),
                    },
                };
                
                newIssues.push(issue);
            }
        }
        
        return newIssues;
    }

    /**
     * Get all diagnostics for a file
     */
    getDiagnostics(filePath: string): LspDiagnostic[] {
        return this.diagnosticsCache.get(filePath) ?? [];
    }

    /**
     * Get all cached diagnostics
     */
    getAllDiagnostics(): Map<string, LspDiagnostic[]> {
        return new Map(this.diagnosticsCache);
    }

    // ============================================
    // Definition & References
    // ============================================

    /**
     * Get definition for a symbol at position
     */
    async getDefinition(filePath: string, line: number, column: number): Promise<DefinitionInfo[]> {
        return this.symbolService.getDefinition(filePath, line, column);
    }

    /**
     * Find all references for a symbol at position
     */
    async findReferences(
        filePath: string,
        line: number,
        column: number,
        options?: { includeDeclaration?: boolean; limit?: number }
    ): Promise<ReferenceInfo[]> {
        return this.symbolService.findReferences(filePath, line, column, options);
    }

    // ============================================
    // Cache Management
    // ============================================

    /**
     * Clear all caches
     */
    clearCache(): void {
        this.symbolsCache.clear();
        this.diagnosticsCache.clear();
        this.symbolService.clearCache();
    }

    /**
     * Clear cache for a specific file
     */
    clearFileCache(filePath: string): void {
        this.symbolsCache.delete(filePath);
        this.diagnosticsCache.delete(filePath);
        this.symbolService.clearFileCache(filePath);
    }

    /**
     * Check if LSP is available for a file
     */
    async isLspAvailable(filePath: string): Promise<boolean> {
        return this.symbolService.isLspAvailable(filePath);
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables = [];
        this.clearCache();
        logger.info('LspEnhancer disposed');
    }
}

// ============================================
// Singleton Instance
// ============================================

let lspEnhancerInstance: LspEnhancer | null = null;

export function initLspEnhancer(store: GraphStore): LspEnhancer {
    if (!lspEnhancerInstance) {
        lspEnhancerInstance = new LspEnhancer(store);
    }
    return lspEnhancerInstance;
}

export function getLspEnhancer(): LspEnhancer | null {
    return lspEnhancerInstance;
}

export function resetLspEnhancer(): void {
    if (lspEnhancerInstance) {
        lspEnhancerInstance.dispose();
        lspEnhancerInstance = null;
    }
}
