/**
 * Graph Cycles Tool
 * LM Tool for detecting circular dependencies
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

const logger = createLogger('GraphCyclesTool');

export const GraphCyclesInputSchema = z.object({
    scope: z
        .string()
        .optional()
        .describe('Directory scope to limit detection (e.g., "src/features")'),
    minLength: z
        .number()
        .min(2)
        .optional()
        .describe('Minimum cycle length to report (default: 2)'),
    maxCycles: z
        .number()
        .min(1)
        .max(50)
        .optional()
        .describe('Maximum cycles to return (1-50, default: 20)'),
    severityFilter: z
        .enum(['all', 'warning', 'error'])
        .optional()
        .describe('Filter by severity level (default: all)'),
    includeBreakPoints: z
        .boolean()
        .optional()
        .describe('Include suggested break points (default: true)'),
});

export type GraphCyclesInput = z.infer<typeof GraphCyclesInputSchema>;

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

export function createGraphCyclesTool(
    manager: CodeGraphManager
): vscode.LanguageModelTool<GraphCyclesInput> {
    return {
        async invoke(
            options: vscode.LanguageModelToolInvocationOptions<GraphCyclesInput>,
            _token: vscode.CancellationToken
        ): Promise<vscode.LanguageModelToolResult> {
            const input = options.input;
            const workspace = getWorkspaceContext();

            logger.info('Graph cycles requested', input);

            try {
                // Validate input
                const parsed = GraphCyclesInputSchema.safeParse(input);
                if (!parsed.success) {
                    const envelope = createErrorEnvelope(
                        TOOLS.GRAPH_CYCLES,
                        'INVALID_INPUT',
                        'Invalid input: ' + parsed.error.message,
                        workspace,
                        { errors: parsed.error.errors }
                    );
                    return envelopeToResult(envelope);
                }

                const { scope, minLength, maxCycles, severityFilter, includeBreakPoints } = parsed.data;
                const detector = manager.getCycleDetector();

                if (!detector) {
                    const emptyResult: GraphCyclesResult = {
                        cycles: [],
                        stats: { totalCycles: 0, errorCount: 0, warningCount: 0 },
                        meta: { tokensEstimate: 50, truncated: false, scope: null },
                    };
                    const envelope = createSuccessEnvelope(
                        TOOLS.GRAPH_CYCLES,
                        emptyResult,
                        workspace,
                        { truncated: false, limits: {} }
                    );
                    return envelopeToResult(envelope);
                }

                let cycles = detector.findCycles({
                    scope,
                    minLength,
                    maxCycles,
                });

                // Apply severity filter
                if (severityFilter && severityFilter !== 'all') {
                    cycles = cycles.filter(c => c.severity === severityFilter);
                }

                const errorCount = cycles.filter(c => c.severity === 'error').length;
                const warningCount = cycles.filter(c => c.severity === 'warning').length;

                // Build result with optional break points
                const shouldIncludeBreakPoints = includeBreakPoints !== false;

                const result: GraphCyclesResult = {
                    cycles: cycles.map(c => {
                        const cycle: GraphCyclesResult['cycles'][0] = {
                            nodes: c.nodes.map(n => n.replace(/^(file|module):/, '')),
                            length: c.length,
                            severity: c.severity,
                            description: c.description,
                        };
                        if (shouldIncludeBreakPoints) {
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
                        truncated: cycles.length >= (maxCycles ?? 20),
                        scope: scope ?? null,
                    },
                };

                logger.debug('Cycles result', {
                    totalCycles: result.stats.totalCycles,
                    errorCount,
                    warningCount,
                });

                const envelope = createSuccessEnvelope(
                    TOOLS.GRAPH_CYCLES,
                    result,
                    workspace,
                    {
                        truncated: result.meta.truncated,
                        limits: { maxCycles: maxCycles ?? 20 },
                        nextQuerySuggestion: errorCount > 0
                            ? [{
                                tool: TOOLS.GRAPH_PATH,
                                args: { from: result.cycles[0]?.nodes[0], to: result.cycles[0]?.nodes[1] },
                                reason: 'Trace cycle path for first error-level cycle',
                            }]
                            : result.meta.truncated
                                ? [{
                                    tool: TOOLS.GRAPH_CYCLES,
                                    args: { ...input, maxCycles: Math.min((maxCycles ?? 20) + 10, 50) },
                                    reason: 'More cycles available',
                                }]
                                : undefined,
                    }
                );
                return envelopeToResult(envelope);
            } catch (error) {
                logger.error('Graph cycles error:', error);
                const envelope = createErrorEnvelope(
                    TOOLS.GRAPH_CYCLES,
                    'INTERNAL_ERROR',
                    error instanceof Error ? error.message : 'Unknown error',
                    workspace
                );
                return envelopeToResult(envelope);
            }
        },
    };
}
