/**
 * Graph Module Tool
 * LM Tool for getting detailed information about a specific module
 */

import type * as vscode from 'vscode';
import type { GraphQuery } from '../core/GraphQuery';
import type { ModuleResult } from '../core/types';

export interface GraphModuleInput {
    target: string;
    includeTransitive?: boolean;
}

export interface GraphModuleTool {
    name: string;
    description: string;
    inputSchema: object;
    execute: (input: GraphModuleInput) => Promise<ModuleResult>;
}

export function createGraphModuleTool(
    manager: { getQuery: () => GraphQuery }
): GraphModuleTool {
    return {
        name: 'ouroborosai_graph_module',
        description: `Get detailed information about a specific module/file in the codebase.
Returns imports, exports, dependents, and whether it's a barrel file.
Use this to understand a module's role in the dependency graph.

Examples:
- Analyze a utility file: target="src/utils/helpers.ts"
- Check barrel file structure: target="src/components/index.ts"
- Understand module dependencies: target="src/services/auth.ts"`,

        inputSchema: {
            type: 'object',
            required: ['target'],
            properties: {
                target: {
                    type: 'string',
                    description: 'File path or module name to analyze',
                },
                includeTransitive: {
                    type: 'boolean',
                    description: 'Include transitive dependencies (default: false)',
                },
            },
        },

        async execute(input: GraphModuleInput): Promise<ModuleResult> {
            const query = manager.getQuery();
            
            if (!query) {
                return {
                    id: `file:${input.target}`,
                    path: input.target,
                    name: input.target.split('/').pop() ?? input.target,
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
            }

            return query.module(input.target, {
                includeTransitive: input.includeTransitive,
            });
        },
    };
}

/**
 * Register the graph module tool with VS Code
 */
export function registerGraphModuleTool(
    context: vscode.ExtensionContext,
    getQuery: () => GraphQuery | null
): vscode.Disposable | undefined {
    const vscodeAny = require('vscode') as typeof vscode & {
        lm?: {
            registerTool?: (
                name: string,
                tool: {
                    invoke: (
                        options: { input: GraphModuleInput },
                        token: vscode.CancellationToken
                    ) => Promise<vscode.LanguageModelToolResult>;
                }
            ) => vscode.Disposable;
        };
    };

    if (!vscodeAny.lm?.registerTool) {
        return undefined;
    }

    const tool = createGraphModuleTool(getQuery);

    return vscodeAny.lm.registerTool(tool.name, {
        async invoke(
            options: { input: GraphModuleInput },
            _token: vscode.CancellationToken
        ): Promise<vscode.LanguageModelToolResult> {
            const result = await tool.execute(options.input);
            return new vscodeAny.LanguageModelToolResult([
                new vscodeAny.LanguageModelTextPart(JSON.stringify(result, null, 2)),
            ]);
        },
    });
}
