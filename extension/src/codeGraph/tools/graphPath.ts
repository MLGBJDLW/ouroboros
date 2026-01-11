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
}

export interface GraphPathTool {
    name: string;
    description: string;
    inputSchema: object;
    execute: (input: GraphPathInput) => Promise<ToolEnvelope<PathResult>>;
}

export function createGraphPathTool(
    manager: { getQuery: () => GraphQuery }
): GraphPathTool {
    return {
        name: 'ouroborosai_graph_path',
        description: `Find dependency paths between two modules in the codebase.
Use this to understand how modules are connected and trace import chains.
Returns up to 3 shortest paths by default.

Examples:
- Find path from entry to utility: from="src/index.ts", to="src/utils/helpers.ts"
- Check if modules are connected: from="src/api/users.ts", to="src/db/models.ts"`,

        inputSchema: {
            type: 'object',
            required: ['from', 'to'],
            properties: {
                from: {
                    type: 'string',
                    description: 'Source file path or module name',
                },
                to: {
                    type: 'string',
                    description: 'Target file path or module name',
                },
                maxDepth: {
                    type: 'number',
                    description: 'Maximum path depth to search (default: 5, max: 10)',
                },
                maxPaths: {
                    type: 'number',
                    description: 'Maximum number of paths to return (default: 3, max: 10)',
                },
            },
        },

        async execute(input: GraphPathInput): Promise<ToolEnvelope<PathResult>> {
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

            const result = query.path(input.from, input.to, {
                maxDepth: input.maxDepth,
                maxPaths: input.maxPaths,
            });

            return createSuccessEnvelope(
                TOOLS.GRAPH_PATH,
                result,
                workspace,
                {
                    truncated: result.meta.truncated ?? false,
                    limits: {
                        maxDepth: input.maxDepth ?? 5,
                        maxItems: input.maxPaths ?? 3,
                    },
                    nextQuerySuggestion: result.connected && result.paths.length > 0
                        ? [{
                            tool: TOOLS.GRAPH_IMPACT,
                            args: { target: input.from, depth: 2 },
                            reason: 'Analyze full impact of changes to source',
                        }]
                        : !result.connected
                            ? [{
                                tool: TOOLS.GRAPH_MODULE,
                                args: { target: input.from },
                                reason: 'Modules not connected - inspect source module',
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
