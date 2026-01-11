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

/**
 * Sections that can be included in module response
 */
const MODULE_SECTIONS = ['imports', 'importedBy', 'exports', 'reexports', 'entrypoints'] as const;
type ModuleSection = typeof MODULE_SECTIONS[number];

export interface GraphModuleInput {
    target: string;
    includeTransitive?: boolean;
    include?: ModuleSection[];
    importLimit?: number;
    importedByLimit?: number;
}

export interface GraphModuleTool {
    name: string;
    description: string;
    inputSchema: object;
    execute: (input: GraphModuleInput) => Promise<ToolEnvelope<ModuleResult | Record<string, unknown>>>;
}

export function createGraphModuleTool(
    manager: { getQuery: () => GraphQuery }
): GraphModuleTool {
    return {
        name: 'ouroborosai_graph_module',
        description: `Get detailed information about a specific module/file in the codebase.
Returns imports, exports, dependents, and whether it's a barrel file.
Use 'include' to select specific sections and limits to control output size.

Sections: imports, importedBy, exports, reexports, entrypoints

Examples:
- Quick check: target="src/utils/helpers.ts", include=["exports"]
- Full analysis: target="src/services/auth.ts"
- Check who imports: target="src/config.ts", include=["importedBy"], importedByLimit=5`,

        inputSchema: {
            type: 'object',
            required: ['target'],
            properties: {
                target: {
                    type: 'string',
                    description: 'File path or module name to analyze (e.g., "src/utils/helpers.ts")',
                },
                includeTransitive: {
                    type: 'boolean',
                    description: 'Include transitive dependencies (default: false)',
                },
                include: {
                    type: 'array',
                    items: {
                        type: 'string',
                        enum: ['imports', 'importedBy', 'exports', 'reexports', 'entrypoints'],
                    },
                    description: 'Sections to include. Default: all',
                },
                importLimit: {
                    type: 'number',
                    description: 'Max imports to return (1-50, default: all)',
                },
                importedByLimit: {
                    type: 'number',
                    description: 'Max importedBy to return (1-50, default: all)',
                },
            },
        },

        async execute(input: GraphModuleInput): Promise<ToolEnvelope<ModuleResult | Record<string, unknown>>> {
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

            const fullResult = query.module(input.target, {
                includeTransitive: input.includeTransitive,
            });

            // Determine which sections to include
            const sections = new Set<ModuleSection>(input.include ?? MODULE_SECTIONS);

            // Build filtered result
            const filteredResult: Record<string, unknown> = {
                id: fullResult.id,
                path: fullResult.path,
                name: fullResult.name,
                kind: fullResult.kind,
                isBarrel: fullResult.isBarrel,
                meta: fullResult.meta,
            };

            if (sections.has('imports')) {
                const limit = input.importLimit;
                filteredResult.imports = limit
                    ? fullResult.imports.slice(0, limit)
                    : fullResult.imports;
                if (limit && fullResult.imports.length > limit) {
                    filteredResult.importsTotal = fullResult.imports.length;
                }
            }

            if (sections.has('importedBy')) {
                const limit = input.importedByLimit;
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

            // Recalculate token estimate
            const tokensEstimate = Math.ceil(JSON.stringify(filteredResult).length / 4);
            (filteredResult.meta as Record<string, unknown>).tokensEstimate = tokensEstimate;

            return createSuccessEnvelope(
                TOOLS.GRAPH_MODULE,
                filteredResult,
                workspace,
                {
                    truncated: false,
                    limits: {
                        importLimit: input.importLimit,
                        importedByLimit: input.importedByLimit,
                    },
                    nextQuerySuggestion: fullResult.importedBy.length > 5
                        ? [{
                            tool: TOOLS.GRAPH_IMPACT,
                            args: { target: input.target, depth: 2 },
                            reason: `High importer count (${fullResult.importedBy.length}) - analyze impact`,
                        }]
                        : fullResult.isBarrel
                            ? [{
                                tool: TOOLS.GRAPH_PATH,
                                args: { from: fullResult.imports[0]?.path, to: input.target },
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
