/**
 * Graph Cycles Tool
 * LM Tool for detecting circular dependencies
 */

import type * as vscode from 'vscode';
import type { CycleDetector } from '../analyzers/CycleDetector';
import {
    createSuccessEnvelope,
    getWorkspaceContext,
    type ToolEnvelope,
} from './envelope';
import { TOOLS } from '../../constants';

export interface GraphCyclesInput {
    scope?: string;
    minLength?: number;
    maxCycles?: number;
    severityFilter?: 'all' | 'warning' | 'error';
    includeBreakPoints?: boolean;
}

export interface GraphCyclesResult {
    cycles: Array<{
        nodes: string[];
        length: number;
        severity: 'warning' | 'error';
        breakPoints?: string[];
        description: string;
    }>;
    stats: {
        totalCycles: number;
        errorCount: number;
        warningCount: number;
    };
    meta: {
        tokensEstimate: number;
        truncated: boolean;
        scope: string | null;
    };
}

export interface GraphCyclesTool {
    name: string;
    description: string;
    inputSchema: object;
    execute: (input: GraphCyclesInput) => Promise<ToolEnvelope<GraphCyclesResult>>;
}

export function createGraphCyclesTool(
    getCycleDetector: () => CycleDetector | null
): GraphCyclesTool {
    return {
        name: 'ouroborosai_graph_cycles',
        description: `Detect circular dependencies in the codebase using Tarjan's algorithm.
Returns cycles with severity and suggested break points.

Parameters:
- scope: Limit to directory (e.g., "src/features")
- minLength: Minimum cycle length (default: 2)
- maxCycles: Max cycles to return (default: 20)
- severityFilter: Filter by severity: all, warning, error (default: all)
- includeBreakPoints: Include suggested break points (default: true)

Examples:
- Quick check: maxCycles=5, includeBreakPoints=false
- Errors only: severityFilter="error"
- Specific scope: scope="src/services", maxCycles=10`,

        inputSchema: {
            type: 'object',
            properties: {
                scope: {
                    type: 'string',
                    description: 'Directory scope to limit detection (e.g., "src/features")',
                },
                minLength: {
                    type: 'number',
                    description: 'Minimum cycle length to report (default: 2)',
                },
                maxCycles: {
                    type: 'number',
                    description: 'Maximum cycles to return (1-50, default: 20)',
                },
                severityFilter: {
                    type: 'string',
                    enum: ['all', 'warning', 'error'],
                    description: 'Filter by severity level (default: all)',
                },
                includeBreakPoints: {
                    type: 'boolean',
                    description: 'Include suggested break points (default: true)',
                },
            },
        },

        async execute(input: GraphCyclesInput): Promise<ToolEnvelope<GraphCyclesResult>> {
            const workspace = getWorkspaceContext();
            const detector = getCycleDetector();

            if (!detector) {
                const emptyResult: GraphCyclesResult = {
                    cycles: [],
                    stats: { totalCycles: 0, errorCount: 0, warningCount: 0 },
                    meta: { tokensEstimate: 50, truncated: false, scope: null },
                };
                return createSuccessEnvelope(
                    TOOLS.GRAPH_CYCLES,
                    emptyResult,
                    workspace,
                    { truncated: false, limits: {} }
                );
            }

            let cycles = detector.findCycles({
                scope: input.scope,
                minLength: input.minLength,
                maxCycles: input.maxCycles,
            });

            // Apply severity filter
            if (input.severityFilter && input.severityFilter !== 'all') {
                cycles = cycles.filter(c => c.severity === input.severityFilter);
            }

            const errorCount = cycles.filter(c => c.severity === 'error').length;
            const warningCount = cycles.filter(c => c.severity === 'warning').length;

            // Build result with optional break points
            const includeBreakPoints = input.includeBreakPoints !== false;
            
            const result: GraphCyclesResult = {
                cycles: cycles.map(c => {
                    const cycle: GraphCyclesResult['cycles'][0] = {
                        nodes: c.nodes.map(n => n.replace(/^(file|module):/, '')),
                        length: c.length,
                        severity: c.severity,
                        description: c.description,
                    };
                    if (includeBreakPoints) {
                        cycle.breakPoints = c.breakPoints.map(n => n.replace(/^(file|module):/, ''));
                    }
                    return cycle;
                }),
                stats: {
                    totalCycles: cycles.length,
                    errorCount,
                    warningCount,
                },
                meta: {
                    tokensEstimate: Math.ceil(JSON.stringify(cycles).length / 4),
                    truncated: cycles.length >= (input.maxCycles ?? 20),
                    scope: input.scope ?? null,
                },
            };

            return createSuccessEnvelope(
                TOOLS.GRAPH_CYCLES,
                result,
                workspace,
                {
                    truncated: result.meta.truncated,
                    limits: { maxCycles: input.maxCycles ?? 20 },
                    nextQuerySuggestion: errorCount > 0
                        ? [{
                            tool: TOOLS.GRAPH_PATH,
                            args: { from: result.cycles[0]?.nodes[0], to: result.cycles[0]?.nodes[1] },
                            reason: 'Trace cycle path for first error-level cycle',
                        }]
                        : result.meta.truncated
                            ? [{
                                tool: TOOLS.GRAPH_CYCLES,
                                args: { ...input, maxCycles: Math.min((input.maxCycles ?? 20) + 10, 50) },
                                reason: 'More cycles available',
                            }]
                            : undefined,
                }
            );
        },
    };
}

/**
 * Register the graph cycles tool with VS Code
 */
export function registerGraphCyclesTool(
    _context: vscode.ExtensionContext,
    getCycleDetector: () => CycleDetector | null
): vscode.Disposable | undefined {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const vscodeAny = require('vscode') as typeof vscode & {
        lm?: {
            registerTool?: (
                name: string,
                tool: {
                    invoke: (
                        options: { input: GraphCyclesInput },
                        token: vscode.CancellationToken
                    ) => Promise<vscode.LanguageModelToolResult>;
                }
            ) => vscode.Disposable;
        };
    };

    if (!vscodeAny.lm?.registerTool) {
        return undefined;
    }

    const tool = createGraphCyclesTool(getCycleDetector);

    return vscodeAny.lm.registerTool(tool.name, {
        async invoke(
            options: { input: GraphCyclesInput },
            _token: vscode.CancellationToken
        ): Promise<vscode.LanguageModelToolResult> {
            const result = await tool.execute(options.input);
            return new vscodeAny.LanguageModelToolResult([
                new vscodeAny.LanguageModelTextPart(JSON.stringify(result, null, 2)),
            ]);
        },
    });
}
