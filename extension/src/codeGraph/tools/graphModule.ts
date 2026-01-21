/**
 * Graph Module Tool
 * LM Tool for getting detailed information about a specific module
 * 
 * Enhanced with LSP integration for symbol-level details
 */

import * as vscode from 'vscode';
import { z } from 'zod';
import type { CodeGraphManager } from '../CodeGraphManager';
import type { ModuleResult } from '../core/types';
import { createLogger } from '../../utils/logger';
import {
    createSuccessEnvelope,
    createErrorEnvelope,
    envelopeToResult,
    getWorkspaceContext,
} from './envelope';
import { TOOLS } from '../../constants';
import { getSymbolService, type SymbolInfo } from '../lsp';

const logger = createLogger('GraphModuleTool');

/**
 * Sections that can be included in module response
 */
const MODULE_SECTIONS = ['imports', 'importedBy', 'exports', 'reexports', 'entrypoints', 'symbols'] as const;
type ModuleSection = typeof MODULE_SECTIONS[number];

export const GraphModuleInputSchema = z.object({
    target: z
        .string()
        .describe('File path or module name to analyze (e.g., "src/utils/helpers.ts")'),
    includeTransitive: z
        .boolean()
        .optional()
        .describe('Include transitive dependencies (default: false)'),
    include: z
        .array(z.enum(MODULE_SECTIONS))
        .optional()
        .describe('Sections to include: imports, importedBy, exports, reexports, entrypoints, symbols. Default: all except symbols'),
    includeSymbols: z
        .boolean()
        .optional()
        .describe('Include LSP symbols (classes, functions, etc.) - requires active language server'),
    importLimit: z
        .number()
        .min(1)
        .max(50)
        .optional()
        .describe('Max imports to return (1-50, default: all)'),
    importedByLimit: z
        .number()
        .min(1)
        .max(50)
        .optional()
        .describe('Max importedBy to return (1-50, default: all)'),
    symbolKindFilter: z
        .array(z.string())
        .optional()
        .describe('Filter symbols by kind: class, function, interface, method, property'),
});

export type GraphModuleInput = z.infer<typeof GraphModuleInputSchema>;

// Extended result type with symbols
interface EnhancedModuleResult extends Record<string, unknown> {
    symbols?: Array<{
        name: string;
        kind: string;
        line: number;
        children?: Array<{ name: string; kind: string; line: number }>;
    }>;
    symbolStats?: {
        total: number;
        byKind: Record<string, number>;
    };
}

export function createGraphModuleTool(
    manager: CodeGraphManager
): vscode.LanguageModelTool<GraphModuleInput> {
    return {
        async invoke(
            options: vscode.LanguageModelToolInvocationOptions<GraphModuleInput>,
            _token: vscode.CancellationToken
        ): Promise<vscode.LanguageModelToolResult> {
            const input = options.input;
            const workspace = getWorkspaceContext();

            logger.info('Graph module requested', input);

            try {
                // Validate input
                const parsed = GraphModuleInputSchema.safeParse(input);
                if (!parsed.success) {
                    const envelope = createErrorEnvelope(
                        TOOLS.GRAPH_MODULE,
                        'INVALID_INPUT',
                        'Invalid input: ' + parsed.error.message,
                        workspace,
                        { errors: parsed.error.errors }
                    );
                    return envelopeToResult(envelope);
                }

                const {
                    target,
                    includeTransitive,
                    include,
                    includeSymbols,
                    importLimit,
                    importedByLimit,
                    symbolKindFilter,
                } = parsed.data;

                const query = manager.getQuery();

                if (!query) {
                    const emptyResult: ModuleResult = {
                        id: `file:${target}`,
                        path: target,
                        name: target.split('/').pop() ?? target,
                        kind: 'file',
                        imports: [],
                        importedBy: [],
                        exports: [],
                        reexports: [],
                        entrypoints: [],
                        isBarrel: false,
                        meta: {
                            tokensEstimate: 100,
                        },
                    };
                    const envelope = createSuccessEnvelope(
                        TOOLS.GRAPH_MODULE,
                        emptyResult,
                        workspace,
                        { truncated: false, limits: {} }
                    );
                    return envelopeToResult(envelope);
                }

                const fullResult = query.module(target, {
                    includeTransitive,
                });

                // Default sections (exclude symbols by default for backwards compatibility)
                const defaultSections: ModuleSection[] = ['imports', 'importedBy', 'exports', 'reexports', 'entrypoints'];
                const sections = new Set<ModuleSection>(include ?? defaultSections);

                // Add symbols if explicitly requested
                if (includeSymbols) {
                    sections.add('symbols');
                }

                // Build filtered result
                const filteredResult: EnhancedModuleResult = {
                    id: fullResult.id,
                    path: fullResult.path,
                    name: fullResult.name,
                    kind: fullResult.kind,
                    isBarrel: fullResult.isBarrel,
                    meta: fullResult.meta,
                };

                if (sections.has('imports')) {
                    const limit = importLimit;
                    filteredResult.imports = limit
                        ? fullResult.imports.slice(0, limit)
                        : fullResult.imports;
                    if (limit && fullResult.imports.length > limit) {
                        filteredResult.importsTotal = fullResult.imports.length;
                    }
                }

                if (sections.has('importedBy')) {
                    const limit = importedByLimit;
                    filteredResult.importedBy = limit
                        ? fullResult.importedBy.slice(0, limit)
                        : fullResult.importedBy;
                    if (limit && fullResult.importedBy.length > limit) {
                        filteredResult.importedByTotal = fullResult.importedBy.length;
                    }
                }

                if (sections.has('exports')) {
                    filteredResult.exports = fullResult.exports;
                }

                if (sections.has('reexports')) {
                    filteredResult.reexports = fullResult.reexports;
                }

                if (sections.has('entrypoints')) {
                    filteredResult.entrypoints = fullResult.entrypoints;
                }

                // Get LSP symbols if requested
                if (sections.has('symbols') && fullResult.path) {
                    try {
                        const symbolService = getSymbolService();
                        const modulePath = fullResult.path;
                        const resolvedPath = modulePath.startsWith('/')
                            ? modulePath
                            : `${vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? ''}/${modulePath}`;

                        let symbols = await symbolService.getDocumentSymbols(resolvedPath);

                        // Apply kind filter if specified
                        if (symbolKindFilter && symbolKindFilter.length > 0) {
                            const filterSet = new Set(symbolKindFilter.map(k => k.toLowerCase()));
                            symbols = filterSymbolsByKind(symbols, filterSet);
                        }

                        // Convert to simplified format
                        filteredResult.symbols = convertSymbolsToSimple(symbols);
                        filteredResult.symbolStats = {
                            total: countTotalSymbols(symbols),
                            byKind: countSymbolsByKind(symbols),
                        };

                        logger.debug('LSP symbols retrieved', {
                            target,
                            symbolCount: filteredResult.symbolStats.total,
                        });
                    } catch (error) {
                        // LSP not available - add a note but don't fail
                        logger.warn('Failed to get LSP symbols', { target, error });
                        filteredResult.symbolsError = 'LSP not available - open file in editor first';
                    }
                }

                // Recalculate token estimate
                const tokensEstimate = Math.ceil(JSON.stringify(filteredResult).length / 4);
                (filteredResult.meta as Record<string, unknown>).tokensEstimate = tokensEstimate;

                logger.debug('Module result', {
                    target,
                    sections: Array.from(sections),
                    tokensEstimate,
                });

                // Construct next query suggestions
                const suggestions = [];

                if (fullResult.importedBy.length > 5) {
                    suggestions.push({
                        tool: TOOLS.GRAPH_IMPACT,
                        args: { target, depth: 2 },
                        reason: `High importer count (${fullResult.importedBy.length}) - analyze impact`,
                    });
                }

                if (filteredResult.symbols && (filteredResult.symbols as unknown[]).length > 0) {
                    suggestions.push({
                        tool: TOOLS.GRAPH_REFERENCES,
                        args: {
                            path: fullResult.path,
                            line: (filteredResult.symbols[0] as { line: number }).line
                        },
                        reason: 'Find references to first symbol',
                    });
                } else if (fullResult.isBarrel && fullResult.imports.length > 0) {
                    suggestions.push({
                        tool: TOOLS.GRAPH_PATH,
                        args: { from: fullResult.imports[0]?.path, to: target },
                        reason: 'Barrel file detected - trace re-export chain',
                    });
                }

                const envelope = createSuccessEnvelope(
                    TOOLS.GRAPH_MODULE,
                    filteredResult,
                    workspace,
                    {
                        truncated: false,
                        limits: {
                            importLimit,
                            importedByLimit,
                        },
                        nextQuerySuggestion: suggestions.length > 0 ? suggestions : undefined,
                    }
                );
                return envelopeToResult(envelope);
            } catch (error) {
                logger.error('Graph module error:', error);
                const envelope = createErrorEnvelope(
                    TOOLS.GRAPH_MODULE,
                    'INTERNAL_ERROR',
                    error instanceof Error ? error.message : 'Unknown error',
                    workspace
                );
                return envelopeToResult(envelope);
            }
        },
    };
}

// ============================================
// Helper Functions
// ============================================

function filterSymbolsByKind(symbols: SymbolInfo[], kindFilter: Set<string>): SymbolInfo[] {
    const result: SymbolInfo[] = [];

    for (const symbol of symbols) {
        const matchesFilter = kindFilter.has(symbol.kind.toLowerCase());

        if (matchesFilter) {
            const filteredChildren = symbol.children
                ? filterSymbolsByKind(symbol.children, kindFilter)
                : undefined;

            result.push({
                ...symbol,
                children: filteredChildren && filteredChildren.length > 0 ? filteredChildren : undefined,
            });
        } else if (symbol.children) {
            const filteredChildren = filterSymbolsByKind(symbol.children, kindFilter);
            result.push(...filteredChildren);
        }
    }

    return result;
}

function convertSymbolsToSimple(symbols: SymbolInfo[]): Array<{
    name: string;
    kind: string;
    line: number;
    children?: Array<{ name: string; kind: string; line: number }>;
}> {
    return symbols.map(s => ({
        name: s.name,
        kind: s.kind,
        line: s.selectionRange.startLine,
        children: s.children ? convertSymbolsToSimple(s.children) : undefined,
    }));
}

function countTotalSymbols(symbols: SymbolInfo[]): number {
    let count = 0;
    for (const s of symbols) {
        count++;
        if (s.children) {
            count += countTotalSymbols(s.children);
        }
    }
    return count;
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

