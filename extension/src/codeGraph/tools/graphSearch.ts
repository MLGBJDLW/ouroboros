/**
 * Graph Search Tool
 * LM Tool for searching files, symbols, and features in the codebase
 */

import * as vscode from 'vscode';
import { z } from 'zod';
import type { CodeGraphManager } from '../CodeGraphManager';
import { createLogger } from '../../utils/logger';
import {
    createSuccessEnvelope,
    createErrorEnvelope,
    envelopeToResult,
    getWorkspaceContext,
} from './envelope';
import { TOOLS } from '../../constants';

const logger = createLogger('GraphSearchTool');

export const GraphSearchInputSchema = z.object({
    query: z
        .string()
        .describe('Search query - file name, path pattern, symbol name, or keyword'),
    type: z
        .enum(['file', 'symbol', 'directory', 'all'])
        .optional()
        .describe('Search type: file (paths), symbol (exports/functions), directory (folders), all. Default: all'),
    scope: z
        .string()
        .optional()
        .describe('Directory scope to limit search (e.g., "src/features")'),
    limit: z
        .number()
        .min(1)
        .max(50)
        .optional()
        .describe('Max results to return (1-50, default: 20)'),
    includeImports: z
        .boolean()
        .optional()
        .describe('Include import count for each result (default: true)'),
});

export type GraphSearchInput = z.infer<typeof GraphSearchInputSchema>;

interface SearchResult {
    type: 'file' | 'symbol' | 'directory';
    path: string;
    name: string;
    match: string;
    score: number;
    imports?: number;
    exports?: string[];
    isEntrypoint?: boolean;
    isHotspot?: boolean;
}

export function createGraphSearchTool(
    manager: CodeGraphManager
): vscode.LanguageModelTool<GraphSearchInput> {
    return {
        async invoke(
            options: vscode.LanguageModelToolInvocationOptions<GraphSearchInput>,
            _token: vscode.CancellationToken
        ): Promise<vscode.LanguageModelToolResult> {
            const input = options.input;
            const workspace = getWorkspaceContext();

            logger.info('Graph search requested', input);

            try {
                // Validate input
                const parsed = GraphSearchInputSchema.safeParse(input);
                if (!parsed.success) {
                    const envelope = createErrorEnvelope(
                        TOOLS.GRAPH_SEARCH,
                        'INVALID_INPUT',
                        'Invalid input: ' + parsed.error.message,
                        workspace,
                        { errors: parsed.error.errors }
                    );
                    return envelopeToResult(envelope);
                }

                const { query, type, scope, limit, includeImports } = parsed.data;
                const maxResults = limit ?? 20;
                const searchType = type ?? 'all';
                const withImports = includeImports ?? true;

                const store = manager.getStore();
                if (!store) {
                    const envelope = createSuccessEnvelope(
                        TOOLS.GRAPH_SEARCH,
                        { results: [], total: 0, query },
                        workspace,
                        { truncated: false, limits: { limit: maxResults } }
                    );
                    return envelopeToResult(envelope);
                }

                const results: SearchResult[] = [];
                const queryLower = query.toLowerCase();
                const queryParts = queryLower.split(/[\s/\-_]+/).filter(Boolean);

                // Get all nodes
                const allNodes = store.getAllNodes();
                const edges = store.getAllEdges();

                // Build import count map
                const importCountMap = new Map<string, number>();
                if (withImports) {
                    for (const edge of edges) {
                        if (edge.kind === 'imports' || edge.kind === 'reexports') {
                            const count = importCountMap.get(edge.to) ?? 0;
                            importCountMap.set(edge.to, count + 1);
                        }
                    }
                }

                // Search files
                if (searchType === 'all' || searchType === 'file') {
                    const fileNodes = allNodes.filter(n => n.kind === 'file');
                    for (const node of fileNodes) {
                        if (scope && !node.path?.startsWith(scope)) continue;
                        
                        const path = node.path ?? '';
                        const name = path.split('/').pop() ?? '';
                        const pathLower = path.toLowerCase();
                        const nameLower = name.toLowerCase();

                        // Calculate match score
                        let score = 0;
                        let match = '';

                        // Exact name match
                        if (nameLower === queryLower) {
                            score = 100;
                            match = 'exact name';
                        }
                        // Name contains query
                        else if (nameLower.includes(queryLower)) {
                            score = 80;
                            match = 'name contains';
                        }
                        // Path contains query
                        else if (pathLower.includes(queryLower)) {
                            score = 60;
                            match = 'path contains';
                        }
                        // All query parts match
                        else if (queryParts.every(part => pathLower.includes(part))) {
                            score = 40 + queryParts.length * 5;
                            match = 'fuzzy path';
                        }

                        if (score > 0) {
                            results.push({
                                type: 'file',
                                path,
                                name,
                                match,
                                score,
                                imports: withImports ? (importCountMap.get(node.id) ?? 0) : undefined,
                                isEntrypoint: node.kind === 'entrypoint' || node.meta?.isEntrypoint === true,
                                isHotspot: (importCountMap.get(node.id) ?? 0) > 5,
                            });
                        }
                    }
                }

                // Search symbols (exports)
                if (searchType === 'all' || searchType === 'symbol') {
                    const fileNodes = allNodes.filter(n => n.kind === 'file');
                    for (const node of fileNodes) {
                        if (scope && !node.path?.startsWith(scope)) continue;
                        
                        const exports = node.meta?.exports as string[] | undefined;
                        if (!exports || !Array.isArray(exports)) continue;

                        for (const exp of exports) {
                            const expLower = exp.toLowerCase();
                            let score = 0;
                            let match = '';

                            if (expLower === queryLower) {
                                score = 100;
                                match = 'exact symbol';
                            } else if (expLower.includes(queryLower)) {
                                score = 70;
                                match = 'symbol contains';
                            } else if (queryParts.every(part => expLower.includes(part))) {
                                score = 50;
                                match = 'fuzzy symbol';
                            }

                            if (score > 0) {
                                results.push({
                                    type: 'symbol',
                                    path: node.path ?? '',
                                    name: exp,
                                    match,
                                    score,
                                    exports: [exp],
                                });
                            }
                        }
                    }
                }

                // Search directories
                if (searchType === 'all' || searchType === 'directory') {
                    const directories = new Map<string, { files: number; hasIndex: boolean }>();
                    
                    for (const node of allNodes) {
                        if (node.kind !== 'file' || !node.path) continue;
                        const parts = node.path.split('/');
                        parts.pop(); // Remove filename
                        
                        let currentPath = '';
                        for (const part of parts) {
                            currentPath = currentPath ? `${currentPath}/${part}` : part;
                            const existing = directories.get(currentPath) ?? { files: 0, hasIndex: false };
                            existing.files++;
                            if (node.path.endsWith('/index.ts') || node.path.endsWith('/index.js')) {
                                existing.hasIndex = true;
                            }
                            directories.set(currentPath, existing);
                        }
                    }

                    for (const [dirPath, info] of directories) {
                        if (scope && !dirPath.startsWith(scope)) continue;
                        
                        const dirLower = dirPath.toLowerCase();
                        const dirName = dirPath.split('/').pop() ?? '';
                        const dirNameLower = dirName.toLowerCase();

                        let score = 0;
                        let match = '';

                        if (dirNameLower === queryLower) {
                            score = 90;
                            match = 'exact dir';
                        } else if (dirNameLower.includes(queryLower)) {
                            score = 65;
                            match = 'dir contains';
                        } else if (dirLower.includes(queryLower)) {
                            score = 45;
                            match = 'path contains';
                        } else if (queryParts.every(part => dirLower.includes(part))) {
                            score = 35;
                            match = 'fuzzy dir';
                        }

                        if (score > 0) {
                            results.push({
                                type: 'directory',
                                path: dirPath,
                                name: dirName,
                                match,
                                score,
                                imports: info.files,
                                isEntrypoint: info.hasIndex,
                            });
                        }
                    }
                }

                // Sort by score descending, then by path
                results.sort((a, b) => {
                    if (b.score !== a.score) return b.score - a.score;
                    return a.path.localeCompare(b.path);
                });

                // Deduplicate (same path, keep highest score)
                const seen = new Set<string>();
                const deduped = results.filter(r => {
                    const key = `${r.type}:${r.path}:${r.name}`;
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });

                const total = deduped.length;
                const truncated = total > maxResults;
                const returned = deduped.slice(0, maxResults);

                // Group by type for summary
                const byType = {
                    file: returned.filter(r => r.type === 'file').length,
                    symbol: returned.filter(r => r.type === 'symbol').length,
                    directory: returned.filter(r => r.type === 'directory').length,
                };

                const response = {
                    query,
                    results: returned,
                    stats: {
                        total,
                        returned: returned.length,
                        byType,
                    },
                    meta: {
                        tokensEstimate: Math.ceil(JSON.stringify(returned).length / 4),
                        truncated,
                        scopeApplied: scope ?? null,
                    },
                };

                logger.debug('Search result', {
                    query,
                    total,
                    returned: returned.length,
                });

                const envelope = createSuccessEnvelope(
                    TOOLS.GRAPH_SEARCH,
                    response,
                    workspace,
                    {
                        truncated,
                        limits: { limit: maxResults },
                        nextQuerySuggestion: returned.length > 0
                            ? [{
                                tool: TOOLS.GRAPH_MODULE,
                                args: { target: returned[0].path },
                                reason: `Inspect top result: ${returned[0].path}`,
                            }]
                            : [{
                                tool: TOOLS.GRAPH_DIGEST,
                                args: { include: ['entrypoints', 'hotspots'] },
                                reason: 'No results - try browsing entrypoints/hotspots',
                            }],
                    }
                );
                return envelopeToResult(envelope);
            } catch (error) {
                logger.error('Graph search error:', error);
                const envelope = createErrorEnvelope(
                    TOOLS.GRAPH_SEARCH,
                    'INTERNAL_ERROR',
                    error instanceof Error ? error.message : 'Unknown error',
                    workspace
                );
                return envelopeToResult(envelope);
            }
        },
    };
}
