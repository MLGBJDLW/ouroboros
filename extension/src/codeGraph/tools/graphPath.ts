/**
 * Graph Path Tool
 * LM Tool for finding paths between modules in the code graph
 */

import type * as vscode from 'vscode';
import type { GraphQuery } from '../core/GraphQuery';
import type { PathResult } from '../core/types';

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
    execute: (input: GraphPathInput) => Promise<PathResult>;
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

        async execute(input: GraphPathInput): Promise<PathResult> {
            const query = manager.getQuery();
            
            if (!query) {
                return {
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
            }

            return query.path(input.from, input.to, {
                maxDepth: input.maxDepth,
                maxPaths: input.maxPaths,
            });
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
    const vscodeAny = require('vscode') as typeof vscode & {
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

    const tool = createGraphPathTool(getQuery);

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
