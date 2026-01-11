/**
 * Graph Module Tool
 * LM Tool for getting detailed information about a specific module
 */

import * as vscode from 'vscode';
import type { GraphQuery } from '../core/GraphQuery';
import type { ModuleResult } from '../core/types';
import {
    createSuccessEnvelope,
    getWorkspaceContext,
    type ToolEnvelope,
} from './envelope';
import { TOOLS } from '../../constants';

export interface GraphModuleInput {
    target: string;
    includeTransitive?: boolean;
}

export interface GraphModuleTool {
    name: string;
    description: string;
    inputSchema: object;
    execute: (input: GraphModuleInput) => Promise<ToolEnvelope<ModuleResult>>;
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

        async execute(input: GraphModuleInput): Promise<ToolEnvelope<ModuleResult>> {
            const workspace = getWorkspaceContext();
            const query = manager.getQuery();
            
            if (!query) {
                const emptyResult: ModuleResult = {
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
                return createSuccessEnvelope(
                    TOOLS.GRAPH_MODULE,
                    emptyResult,
                    workspace,
                    { truncated: false, limits: {} }
                );
            }

            const result = query.module(input.target, {
                includeTransitive: input.includeTransitive,
            });

            return createSuccessEnvelope(
                TOOLS.GRAPH_MODULE,
                result,
                workspace,
                {
                    truncated: false,
                    limits: {},
                    nextQuerySuggestion: result.importedBy.length > 5
                        ? [{
                            tool: TOOLS.GRAPH_IMPACT,
                            args: { target: input.target, depth: 2 },
                            reason: `High importer count (${result.importedBy.length}) - analyze impact`,
                        }]
                        : result.isBarrel
                            ? [{
                                tool: TOOLS.GRAPH_PATH,
                                args: { from: result.imports[0]?.path, to: input.target },
                                reason: 'Barrel file detected - trace re-export chain',
                            }]
                            : undefined,
                }
            );
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
    const vscodeAny = vscode as typeof vscode & {
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

    const tool = createGraphModuleTool(getQuery as unknown as { getQuery: () => GraphQuery });

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
