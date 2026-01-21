/**
 * Graph Symbols Tool
 * LM Tool for getting symbols from a file or searching workspace symbols
 * 
 * Uses VS Code LSP providers for accurate symbol information:
 * - Document symbols: all symbols in a single file with hierarchy
 * - Workspace symbols: search for symbols across the project
 */

import * as vscode from 'vscode';
import { z } from 'zod';
import { createLogger } from '../../utils/logger';
import {
    createSuccessEnvelope,
    createErrorEnvelope,
    envelopeToResult,
    getWorkspaceContext,
} from './envelope';
import { TOOLS } from '../../constants';
import { getSymbolService, type SymbolInfo, type WorkspaceSymbolInfo } from '../lsp';

const logger = createLogger('GraphSymbolsTool');

export const GraphSymbolsInputSchema = z.object({
    target: z
        .string()
        .describe('File path (for document mode) or search query (for workspace mode)'),
    mode: z
        .enum(['document', 'workspace'])
        .optional()
        .describe('document: symbols in file, workspace: search across project. Default: document'),
    kindFilter: z
        .array(z.string())
        .optional()
        .describe('Filter by symbol kind: class, function, interface, method, property, etc.'),
    limit: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe('Max results for workspace search (1-100, default: 50)'),
    includeChildren: z
        .boolean()
        .optional()
        .describe('Include nested symbols in document mode (default: true)'),
});

export type GraphSymbolsInput = z.infer<typeof GraphSymbolsInputSchema>;

interface DocumentSymbolsResult {
    mode: 'document';
    path: string;
    symbols: SymbolInfo[];
    stats: {
        total: number;
        byKind: Record<string, number>;
    };
}

interface WorkspaceSymbolsResult {
    mode: 'workspace';
    query: string;
    symbols: WorkspaceSymbolInfo[];
    stats: {
        total: number;
        returned: number;
        byKind: Record<string, number>;
    };
}

type SymbolsResult = DocumentSymbolsResult | WorkspaceSymbolsResult;

export function createGraphSymbolsTool(): vscode.LanguageModelTool<GraphSymbolsInput> {
    return {
        async invoke(
            options: vscode.LanguageModelToolInvocationOptions<GraphSymbolsInput>,
            _token: vscode.CancellationToken
        ): Promise<vscode.LanguageModelToolResult> {
            const input = options.input;
            const workspace = getWorkspaceContext();

            logger.info('Graph symbols requested', input);

            try {
                // Validate input
                const parsed = GraphSymbolsInputSchema.safeParse(input);
                if (!parsed.success) {
                    const envelope = createErrorEnvelope(
                        TOOLS.GRAPH_SYMBOLS,
                        'INVALID_INPUT',
                        'Invalid input: ' + parsed.error.message,
                        workspace,
                        { errors: parsed.error.errors }
                    );
                    return envelopeToResult(envelope);
                }

                const { target, mode, kindFilter, limit, includeChildren } = parsed.data;
                const symbolService = getSymbolService();
                const searchMode = mode ?? 'document';

                let result: SymbolsResult;

                if (searchMode === 'document') {
                    // Get symbols from a specific file
                    const symbols = await symbolService.getDocumentSymbols(target);

                    // Apply kind filter if specified
                    let filteredSymbols = symbols;
                    if (kindFilter && kindFilter.length > 0) {
                        const filterSet = new Set(kindFilter.map(k => k.toLowerCase()));
                        filteredSymbols = filterSymbolsByKind(symbols, filterSet, includeChildren ?? true);
                    }

                    // Remove children if not requested
                    if (includeChildren === false) {
                        filteredSymbols = filteredSymbols.map(s => ({ ...s, children: undefined }));
                    }

                    // Count by kind
                    const byKind = countSymbolsByKind(filteredSymbols);

                    result = {
                        mode: 'document',
                        path: target,
                        symbols: filteredSymbols,
                        stats: {
                            total: countTotalSymbols(filteredSymbols),
                            byKind,
                        },
                    };

                    logger.debug('Document symbols retrieved', {
                        path: target,
                        total: result.stats.total,
                    });
                } else {
                    // Search workspace symbols
                    const maxResults = limit ?? 50;
                    const symbols = await symbolService.searchWorkspaceSymbols(target, {
                        limit: maxResults,
                        kindFilter,
                    });

                    // Count by kind
                    const byKind: Record<string, number> = {};
                    for (const s of symbols) {
                        byKind[s.kind] = (byKind[s.kind] ?? 0) + 1;
                    }

                    result = {
                        mode: 'workspace',
                        query: target,
                        symbols,
                        stats: {
                            total: symbols.length,
                            returned: symbols.length,
                            byKind,
                        },
                    };

                    logger.debug('Workspace symbols retrieved', {
                        query: target,
                        total: result.stats.total,
                    });
                }

                // Construct next query suggestion based on mode
                let nextQuerySuggestion;
                if (result.stats.total > 0) {
                    if (searchMode === 'document') {
                        const docResult = result as DocumentSymbolsResult;
                        const firstSymbol = docResult.symbols[0];
                        if (firstSymbol) {
                            nextQuerySuggestion = [{
                                tool: TOOLS.GRAPH_REFERENCES,
                                args: {
                                    path: target,
                                    line: firstSymbol.selectionRange?.startLine,
                                },
                                reason: 'Find all references to the first symbol',
                            }];
                        }
                    } else {
                        const wsResult = result as WorkspaceSymbolsResult;
                        const firstSymbol = wsResult.symbols[0];
                        if (firstSymbol) {
                            nextQuerySuggestion = [{
                                tool: TOOLS.GRAPH_REFERENCES,
                                args: {
                                    path: firstSymbol.path,
                                    line: firstSymbol.line,
                                },
                                reason: 'Find all references to the first symbol',
                            }];
                        }
                    }
                }

                // Determine truncation
                const isTruncated = searchMode === 'workspace' &&
                    (result as WorkspaceSymbolsResult).stats.returned >= (limit ?? 50);

                const envelope = createSuccessEnvelope(
                    TOOLS.GRAPH_SYMBOLS,
                    result,
                    workspace,
                    {
                        truncated: isTruncated,
                        limits: { limit: limit ?? 50 },
                        nextQuerySuggestion,
                    }
                );
                return envelopeToResult(envelope);

            } catch (error) {
                logger.error('Graph symbols error:', error);

                // Check for common LSP errors
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                let errorCode = 'INTERNAL_ERROR';

                if (errorMessage.includes('ENOENT') || errorMessage.includes('not found')) {
                    errorCode = 'FILE_NOT_FOUND';
                } else if (errorMessage.includes('language server') || errorMessage.includes('provider')) {
                    errorCode = 'LSP_NOT_AVAILABLE';
                }

                const envelope = createErrorEnvelope(
                    TOOLS.GRAPH_SYMBOLS,
                    errorCode,
                    errorMessage,
                    workspace,
                    {
                        suggestion: errorCode === 'LSP_NOT_AVAILABLE'
                            ? 'Language server may not be active. Try opening the file in the editor first.'
                            : undefined
                    }
                );
                return envelopeToResult(envelope);
            }
        },
    };
}

// ============================================
// Helper Functions
// ============================================

function filterSymbolsByKind(
    symbols: SymbolInfo[],
    kindFilter: Set<string>,
    includeChildren: boolean
): SymbolInfo[] {
    const result: SymbolInfo[] = [];

    for (const symbol of symbols) {
        const matchesFilter = kindFilter.has(symbol.kind.toLowerCase());

        if (matchesFilter) {
            // Symbol matches - include it with filtered children
            const filteredChildren = includeChildren && symbol.children
                ? filterSymbolsByKind(symbol.children, kindFilter, includeChildren)
                : undefined;

            result.push({
                ...symbol,
                children: filteredChildren && filteredChildren.length > 0 ? filteredChildren : undefined,
            });
        } else if (includeChildren && symbol.children) {
            // Symbol doesn't match but check children
            const filteredChildren = filterSymbolsByKind(symbol.children, kindFilter, includeChildren);
            result.push(...filteredChildren);
        }
    }

    return result;
}

function countSymbolsByKind(symbols: SymbolInfo[]): Record<string, number> {
    const counts: Record<string, number> = {};

    function countRecursive(syms: SymbolInfo[]) {
        for (const s of syms) {
            counts[s.kind] = (counts[s.kind] ?? 0) + 1;
            if (s.children) {
                countRecursive(s.children);
            }
        }
    }

    countRecursive(symbols);
    return counts;
}

function countTotalSymbols(symbols: SymbolInfo[]): number {
    let count = 0;

    function countRecursive(syms: SymbolInfo[]) {
        for (const s of syms) {
            count++;
            if (s.children) {
                countRecursive(s.children);
            }
        }
    }

    countRecursive(symbols);
    return count;
}
