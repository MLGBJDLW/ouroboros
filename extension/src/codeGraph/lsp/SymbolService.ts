/**
 * Symbol Service
 * LSP-based symbol resolution and navigation
 * 
 * Provides semantic code intelligence using VS Code's Language Server Protocol:
 * - Document symbols (classes, functions, interfaces, etc.)
 * - Workspace symbol search
 * - Find all references
 * - Go to definition
 * - Call hierarchy (callers/callees)
 */

import * as vscode from 'vscode';
import { createLogger } from '../../utils/logger';

const logger = createLogger('SymbolService');

// ============================================
// Types
// ============================================

export interface SymbolInfo {
    name: string;
    kind: string;
    kindValue: vscode.SymbolKind;
    range: {
        startLine: number;
        startColumn: number;
        endLine: number;
        endColumn: number;
    };
    selectionRange: {
        startLine: number;
        startColumn: number;
        endLine: number;
        endColumn: number;
    };
    detail?: string;
    children?: SymbolInfo[];
}

export interface WorkspaceSymbolInfo {
    name: string;
    kind: string;
    kindValue: vscode.SymbolKind;
    containerName?: string;
    path: string;
    line: number;
    column: number;
}

export interface ReferenceInfo {
    path: string;
    line: number;
    column: number;
    lineText: string;
    isDefinition?: boolean;
}

export interface DefinitionInfo {
    path: string;
    line: number;
    column: number;
    endLine: number;
    endColumn: number;
    lineText?: string;
}

export interface CallHierarchyInfo {
    name: string;
    kind: string;
    path: string;
    line: number;
    detail?: string;
}

export interface CallHierarchyResult {
    item: CallHierarchyInfo;
    callers: Array<{
        from: CallHierarchyInfo;
        callSites: Array<{ line: number; column: number }>;
    }>;
    callees: Array<{
        to: CallHierarchyInfo;
        callSites: Array<{ line: number; column: number }>;
    }>;
}

export interface HoverInfo {
    contents: string[];
    range?: {
        startLine: number;
        startColumn: number;
        endLine: number;
        endColumn: number;
    };
}

// Symbol kind name mapping
const SYMBOL_KIND_NAMES: Record<vscode.SymbolKind, string> = {
    [vscode.SymbolKind.File]: 'file',
    [vscode.SymbolKind.Module]: 'module',
    [vscode.SymbolKind.Namespace]: 'namespace',
    [vscode.SymbolKind.Package]: 'package',
    [vscode.SymbolKind.Class]: 'class',
    [vscode.SymbolKind.Method]: 'method',
    [vscode.SymbolKind.Property]: 'property',
    [vscode.SymbolKind.Field]: 'field',
    [vscode.SymbolKind.Constructor]: 'constructor',
    [vscode.SymbolKind.Enum]: 'enum',
    [vscode.SymbolKind.Interface]: 'interface',
    [vscode.SymbolKind.Function]: 'function',
    [vscode.SymbolKind.Variable]: 'variable',
    [vscode.SymbolKind.Constant]: 'constant',
    [vscode.SymbolKind.String]: 'string',
    [vscode.SymbolKind.Number]: 'number',
    [vscode.SymbolKind.Boolean]: 'boolean',
    [vscode.SymbolKind.Array]: 'array',
    [vscode.SymbolKind.Object]: 'object',
    [vscode.SymbolKind.Key]: 'key',
    [vscode.SymbolKind.Null]: 'null',
    [vscode.SymbolKind.EnumMember]: 'enumMember',
    [vscode.SymbolKind.Struct]: 'struct',
    [vscode.SymbolKind.Event]: 'event',
    [vscode.SymbolKind.Operator]: 'operator',
    [vscode.SymbolKind.TypeParameter]: 'typeParameter',
};

// ============================================
// Symbol Service
// ============================================

export class SymbolService {
    private cache: Map<string, { symbols: SymbolInfo[]; timestamp: number }> = new Map();
    private cacheTimeout = 30000; // 30 seconds

    /**
     * Get document symbols for a file
     * Uses LSP DocumentSymbolProvider
     */
    async getDocumentSymbols(filePath: string): Promise<SymbolInfo[]> {
        // Check cache
        const cached = this.cache.get(filePath);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.symbols;
        }

        try {
            const uri = vscode.Uri.file(filePath);

            // Ensure document is open for LSP to work
            await vscode.workspace.openTextDocument(uri);

            const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                'vscode.executeDocumentSymbolProvider',
                uri
            );

            if (!symbols || symbols.length === 0) {
                logger.debug('No symbols found', { filePath });
                return [];
            }

            const result = this.convertDocumentSymbols(symbols);

            // Update cache
            this.cache.set(filePath, { symbols: result, timestamp: Date.now() });

            logger.debug('Document symbols retrieved', {
                filePath,
                count: result.length
            });

            return result;
        } catch (error) {
            logger.error('Failed to get document symbols', { filePath, error });
            throw error;
        }
    }

    /**
     * Search for symbols across the workspace
     * Uses LSP WorkspaceSymbolProvider
     */
    async searchWorkspaceSymbols(
        query: string,
        options?: { limit?: number; kindFilter?: string[] }
    ): Promise<WorkspaceSymbolInfo[]> {
        const limit = options?.limit ?? 50;
        const kindFilter = options?.kindFilter;

        try {
            const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
                'vscode.executeWorkspaceSymbolProvider',
                query
            );

            if (!symbols || symbols.length === 0) {
                logger.debug('No workspace symbols found', { query });
                return [];
            }

            let result = symbols.map(s => this.convertSymbolInformation(s));

            // Apply kind filter if specified
            if (kindFilter && kindFilter.length > 0) {
                const filterSet = new Set(kindFilter.map(k => k.toLowerCase()));
                result = result.filter(s => filterSet.has(s.kind.toLowerCase()));
            }

            // Apply limit
            result = result.slice(0, limit);

            logger.debug('Workspace symbols found', {
                query,
                total: symbols.length,
                returned: result.length
            });

            return result;
        } catch (error) {
            logger.error('Failed to search workspace symbols', { query, error });
            throw error;
        }
    }

    /**
     * Find all references to a symbol at the given position
     * Uses LSP ReferenceProvider
     */
    async findReferences(
        filePath: string,
        line: number,
        column: number,
        options?: { includeDeclaration?: boolean; limit?: number }
    ): Promise<ReferenceInfo[]> {
        const limit = options?.limit ?? 100;
        const includeDeclaration = options?.includeDeclaration ?? true;

        try {
            const uri = vscode.Uri.file(filePath);
            const position = new vscode.Position(line - 1, column - 1); // Convert to 0-indexed

            // Ensure document is open
            await vscode.workspace.openTextDocument(uri);

            const locations = await vscode.commands.executeCommand<vscode.Location[]>(
                'vscode.executeReferenceProvider',
                uri,
                position
            );

            if (!locations || locations.length === 0) {
                logger.debug('No references found', { filePath, line, column });
                return [];
            }

            // Convert locations to ReferenceInfo
            const results: ReferenceInfo[] = [];
            for (const loc of locations.slice(0, limit)) {
                try {
                    const refDoc = await vscode.workspace.openTextDocument(loc.uri);
                    const lineText = refDoc.lineAt(loc.range.start.line).text.trim();

                    // Determine if this is the definition
                    const isDefinition = loc.uri.fsPath === filePath &&
                        loc.range.start.line === line - 1;

                    if (!includeDeclaration && isDefinition) {
                        continue;
                    }

                    results.push({
                        path: loc.uri.fsPath,
                        line: loc.range.start.line + 1,
                        column: loc.range.start.character + 1,
                        lineText,
                        isDefinition,
                    });
                } catch {
                    // Skip files that can't be opened
                    continue;
                }
            }

            logger.debug('References found', {
                filePath,
                line,
                column,
                count: results.length
            });

            return results;
        } catch (error) {
            logger.error('Failed to find references', { filePath, line, column, error });
            throw error;
        }
    }

    /**
     * Get definition location for a symbol
     * Uses LSP DefinitionProvider
     */
    async getDefinition(
        filePath: string,
        line: number,
        column: number
    ): Promise<DefinitionInfo[]> {
        try {
            const uri = vscode.Uri.file(filePath);
            const position = new vscode.Position(line - 1, column - 1);

            // Ensure document is open
            await vscode.workspace.openTextDocument(uri);

            const definitions = await vscode.commands.executeCommand<vscode.Location[] | vscode.LocationLink[]>(
                'vscode.executeDefinitionProvider',
                uri,
                position
            );

            if (!definitions || definitions.length === 0) {
                logger.debug('No definition found', { filePath, line, column });
                return [];
            }

            const results: DefinitionInfo[] = [];
            for (const def of definitions) {
                try {
                    // Handle both Location and LocationLink
                    const targetUri = 'targetUri' in def ? def.targetUri : def.uri;
                    const targetRange = 'targetRange' in def ? def.targetRange : def.range;

                    const defDoc = await vscode.workspace.openTextDocument(targetUri);
                    const lineText = defDoc.lineAt(targetRange.start.line).text.trim();

                    results.push({
                        path: targetUri.fsPath,
                        line: targetRange.start.line + 1,
                        column: targetRange.start.character + 1,
                        endLine: targetRange.end.line + 1,
                        endColumn: targetRange.end.character + 1,
                        lineText,
                    });
                } catch {
                    continue;
                }
            }

            logger.debug('Definition found', {
                filePath,
                line,
                column,
                count: results.length
            });

            return results;
        } catch (error) {
            logger.error('Failed to get definition', { filePath, line, column, error });
            throw error;
        }
    }

    /**
     * Get call hierarchy for a function/method
     * Uses LSP CallHierarchyProvider
     */
    async getCallHierarchy(
        filePath: string,
        line: number,
        column: number,
        options?: { direction?: 'incoming' | 'outgoing' | 'both'; depth?: number }
    ): Promise<CallHierarchyResult | null> {
        const direction = options?.direction ?? 'both';

        try {
            const uri = vscode.Uri.file(filePath);
            const position = new vscode.Position(line - 1, column - 1);

            // Ensure document is open
            await vscode.workspace.openTextDocument(uri);

            // Prepare call hierarchy
            const items = await vscode.commands.executeCommand<vscode.CallHierarchyItem[]>(
                'vscode.prepareCallHierarchy',
                uri,
                position
            );

            if (!items || items.length === 0) {
                logger.debug('Call hierarchy not available', { filePath, line, column });
                return null;
            }

            const item = items[0];
            const result: CallHierarchyResult = {
                item: this.convertCallHierarchyItem(item),
                callers: [],
                callees: [],
            };

            // Get incoming calls (who calls this function)
            if (direction === 'incoming' || direction === 'both') {
                const incomingCalls = await vscode.commands.executeCommand<vscode.CallHierarchyIncomingCall[]>(
                    'vscode.provideIncomingCalls',
                    item
                );

                if (incomingCalls) {
                    result.callers = incomingCalls.map(call => ({
                        from: this.convertCallHierarchyItem(call.from),
                        callSites: call.fromRanges.map(r => ({
                            line: r.start.line + 1,
                            column: r.start.character + 1,
                        })),
                    }));
                }
            }

            // Get outgoing calls (what this function calls)
            if (direction === 'outgoing' || direction === 'both') {
                const outgoingCalls = await vscode.commands.executeCommand<vscode.CallHierarchyOutgoingCall[]>(
                    'vscode.provideOutgoingCalls',
                    item
                );

                if (outgoingCalls) {
                    result.callees = outgoingCalls.map(call => ({
                        to: this.convertCallHierarchyItem(call.to),
                        callSites: call.fromRanges.map(r => ({
                            line: r.start.line + 1,
                            column: r.start.character + 1,
                        })),
                    }));
                }
            }

            logger.debug('Call hierarchy retrieved', {
                filePath,
                line,
                column,
                callers: result.callers.length,
                callees: result.callees.length,
            });

            return result;
        } catch (error) {
            logger.error('Failed to get call hierarchy', { filePath, line, column, error });
            throw error;
        }
    }

    /**
     * Get hover information for a symbol
     * Uses LSP HoverProvider
     */
    async getHover(
        filePath: string,
        line: number,
        column: number
    ): Promise<HoverInfo | null> {
        try {
            const uri = vscode.Uri.file(filePath);
            const position = new vscode.Position(line - 1, column - 1);

            // Ensure document is open
            await vscode.workspace.openTextDocument(uri);

            const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
                'vscode.executeHoverProvider',
                uri,
                position
            );

            if (!hovers || hovers.length === 0) {
                return null;
            }

            const contents: string[] = [];
            for (const hover of hovers) {
                for (const content of hover.contents) {
                    if (typeof content === 'string') {
                        contents.push(content);
                    } else if ('value' in content) {
                        contents.push(content.value);
                    }
                }
            }

            const firstHover = hovers[0];
            return {
                contents,
                range: firstHover.range ? {
                    startLine: firstHover.range.start.line + 1,
                    startColumn: firstHover.range.start.character + 1,
                    endLine: firstHover.range.end.line + 1,
                    endColumn: firstHover.range.end.character + 1,
                } : undefined,
            };
        } catch (error) {
            logger.error('Failed to get hover', { filePath, line, column, error });
            throw error;
        }
    }

    /**
     * Check if LSP is available for a file
     */
    async isLspAvailable(filePath: string): Promise<boolean> {
        try {
            const uri = vscode.Uri.file(filePath);
            await vscode.workspace.openTextDocument(uri);

            // Try to get symbols - if it works, LSP is available
            const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                'vscode.executeDocumentSymbolProvider',
                uri
            );

            return symbols !== undefined;
        } catch {
            return false;
        }
    }

    /**
     * Clear symbol cache
     */
    clearCache(): void {
        this.cache.clear();
    }

    /**
     * Clear cache for a specific file
     */
    clearFileCache(filePath: string): void {
        this.cache.delete(filePath);
    }

    // ============================================
    // Private Helpers
    // ============================================

    private convertDocumentSymbols(symbols: vscode.DocumentSymbol[]): SymbolInfo[] {
        return symbols.map(s => ({
            name: s.name,
            kind: SYMBOL_KIND_NAMES[s.kind] ?? 'unknown',
            kindValue: s.kind,
            range: {
                startLine: s.range.start.line + 1,
                startColumn: s.range.start.character + 1,
                endLine: s.range.end.line + 1,
                endColumn: s.range.end.character + 1,
            },
            selectionRange: {
                startLine: s.selectionRange.start.line + 1,
                startColumn: s.selectionRange.start.character + 1,
                endLine: s.selectionRange.end.line + 1,
                endColumn: s.selectionRange.end.character + 1,
            },
            detail: s.detail,
            children: s.children && s.children.length > 0
                ? this.convertDocumentSymbols(s.children)
                : undefined,
        }));
    }

    private convertSymbolInformation(symbol: vscode.SymbolInformation): WorkspaceSymbolInfo {
        return {
            name: symbol.name,
            kind: SYMBOL_KIND_NAMES[symbol.kind] ?? 'unknown',
            kindValue: symbol.kind,
            containerName: symbol.containerName,
            path: symbol.location.uri.fsPath,
            line: symbol.location.range.start.line + 1,
            column: symbol.location.range.start.character + 1,
        };
    }

    private convertCallHierarchyItem(item: vscode.CallHierarchyItem): CallHierarchyInfo {
        return {
            name: item.name,
            kind: SYMBOL_KIND_NAMES[item.kind] ?? 'unknown',
            path: item.uri.fsPath,
            line: item.range.start.line + 1,
            detail: item.detail,
        };
    }
}

// ============================================
// Singleton Instance
// ============================================

let symbolServiceInstance: SymbolService | null = null;

export function getSymbolService(): SymbolService {
    if (!symbolServiceInstance) {
        symbolServiceInstance = new SymbolService();
    }
    return symbolServiceInstance;
}

export function resetSymbolService(): void {
    if (symbolServiceInstance) {
        symbolServiceInstance.clearCache();
        symbolServiceInstance = null;
    }
}
