/**
 * Graph Path Tool
 * LM Tool for finding paths between modules in the code graph
 */

import * as vscode from 'vscode';
import type { GraphQuery } from '../core/GraphQuery';
import type { PathResult } from '../core/types';
import {
    createSuccessEnvelope,
    getWorkspaceContext,
    type ToolEnvelope,
} from './envelope';
import { TOOLS } from '../../constants';

export interface GraphPathInput {
    from: string;
    to: string;
    maxDepth?: number;
    maxPaths?: number;
    includeEdgeDetails?: boolean;
}

export interface GraphPathTool {
    name: string;
    description: string;
    inputSchema: object;
    execute: (input: GraphPathInput) => Promise<ToolEnvelope<PathResult | Record<string, unknown>>>;
}

export function createGraphPathTool(
    manager: { getQuery: () => GraphQuery }
): GraphPathTool {
    return {
        name: 'ouroborosai_graph_path',
        description: `Find dependency paths between two modules in the codebase.
Use this to understand how modules are connected and trace import chains.
Returns shortest paths by default.

Parameters:
- from/to: File paths to trace between
- maxDepth: How deep to search (1-10, default: 5)
- maxPaths: How many paths to return (1-10, default: 3)
- includeEdgeDetails: Include edge IDs in response (default: false)

Examples:
- Quick check: from="src/index.ts", to="src/utils/helpers.ts", maxPaths=1
- Full trace: from="src/api/users.ts", to="src/db/models.ts", maxDepth=8`,

        inputSchema: {
            type: 'object',
            required: ['from', 'to'],
            properties: {
                from: {
                    type: 'string',
                    description: 'Source file path (e.g., "src/index.ts")',
                },
                to: {
                    type: 'string',
                    description: 'Target file path (e.g., "src/utils/helpers.ts")',
                },
                maxDepth: {
                    type: 'number',
                    description: 'Maximum path depth to search (1-10, default: 5)',
                },
                maxPaths: {
                    type: 'number',
                    description: 'Maximum number of paths to return (1-10, default: 3)',
                },
                includeEdgeDetails: {
                    type: 'boolean',
                    description: 'Include edge IDs in response (default: false, saves tokens)',
                },
            },
        },

        async execute(input: GraphPathInput): Promise<ToolEnvelope<PathResult | Record<string, unknown>>> {
            const workspace = getWorkspaceContext();
            const query = manager.getQuery();
            
            if (!query) {
                const emptyResult: PathResult = {
                    from: input.from,
                    to: input.to,
                    paths: [],
                    connected: false,
                    shortestPath: null,
                    meta: {
                        tokensEstimate: 100,
                        truncated: false,
                        maxDepthReached: false,
                    },
                };
                return createSuccessEnvelope(
                    TOOLS.GRAPH_PATH,
                    emptyResult,
                    workspace,
                    { truncated: false, limits: {} }
                );
            }

            const fullResult = query.path(input.from, input.to, {
                maxDepth: input.maxDepth,
                maxPaths: input.maxPaths,
            });

            // Build filtered result
            const filteredResult: Record<string, unknown> = {
                from: fullResult.from,
                to: fullResult.to,
                connected: fullResult.connected,
                shortestPath: fullResult.shortestPath,
                pathCount: fullResult.paths.length,
                meta: fullResult.meta,
            };

            // Include paths with or without edge details
            if (input.includeEdgeDetails) {
                filteredResult.paths = fullResult.paths;
            } else {
                // Omit edge IDs to save tokens
                filteredResult.paths = fullResult.paths.map(p => ({
                    nodes: p.nodes,
                    length: p.length,
                }));
            }

            // Recalculate token estimate
            const tokensEstimate = Math.ceil(JSON.stringify(filteredResult).length / 4);
            (filteredResult.meta as Record<string, unknown>).tokensEstimate = tokensEstimate;

            return createSuccessEnvelope(
                TOOLS.GRAPH_PATH,
                filteredResult,
                workspace,
                {
                    truncated: fullResult.meta.truncated ?? false,
                    limits: {
                        maxDepth: input.maxDepth ?? 5,
                        maxPaths: input.maxPaths ?? 3,
                    },
                    nextQuerySuggestion: fullResult.connected && fullResult.paths.length > 0
                        ? [{
                            tool: TOOLS.GRAPH_IMPACT,
                            args: { target: input.from, depth: 2 },
                            reason: 'Analyze full impact of changes to source',
                        }]
                        : !fullResult.connected
                            ? [{
                                tool: TOOLS.GRAPH_MODULE,
                                args: { target: input.from, include: ['imports'] },
                                reason: 'Modules not connected - inspect source imports',
                            }]
                            : undefined,
                }
            );
        },
    };
}

/**
 * Register the graph path tool with VS Code
 */
export function registerGraphPathTool(
    context: vscode.ExtensionContext,
    getQuery: () => GraphQuery | null
): vscode.Disposable | undefined {
    const vscodeAny = vscode as typeof vscode & {
        lm?: {
            registerTool?: (
                name: string,
                tool: {
                    invoke: (
                        options: { input: GraphPathInput },
                        token: vscode.CancellationToken
                    ) => Promise<vscode.LanguageModelToolResult>;
                }
            ) => vscode.Disposable;
        };
    };

    if (!vscodeAny.lm?.registerTool) {
        return undefined;
    }

    const tool = createGraphPathTool(getQuery as unknown as { getQuery: () => GraphQuery });

    return vscodeAny.lm.registerTool(tool.name, {
        async invoke(
            options: { input: GraphPathInput },
            _token: vscode.CancellationToken
        ): Promise<vscode.LanguageModelToolResult> {
            const result = await tool.execute(options.input);
            return new vscodeAny.LanguageModelToolResult([
                new vscodeAny.LanguageModelTextPart(JSON.stringify(result, null, 2)),
            ]);
        },
    });
}
