/**
 * Graph Impact Tool
 * LM Tool for analyzing the impact of changes to a file or symbol
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

const logger = createLogger('GraphImpactTool');

/**
 * Sections that can be included in impact response
 */
const IMPACT_SECTIONS = ['directDependents', 'transitiveImpact', 'affectedEntrypoints', 'riskAssessment'] as const;
type ImpactSection = typeof IMPACT_SECTIONS[number];

export const GraphImpactInputSchema = z.object({
    target: z
        .string()
        .describe('File path or symbol to analyze impact for (e.g., "src/utils/helpers.ts")'),
    depth: z
        .number()
        .min(1)
        .max(4)
        .optional()
        .describe('Depth of transitive impact analysis (1-4, default: 2). Higher = more complete but slower'),
    include: z
        .array(z.enum(IMPACT_SECTIONS))
        .optional()
        .describe('Sections to include: directDependents, transitiveImpact, affectedEntrypoints, riskAssessment. Default: all'),
    dependentLimit: z
        .number()
        .min(1)
        .max(50)
        .optional()
        .describe('Max direct dependents to return (1-50, default: 30)'),
    entrypointLimit: z
        .number()
        .min(1)
        .max(20)
        .optional()
        .describe('Max affected entrypoints to return (1-20, default: 10)'),
});

export type GraphImpactInput = z.infer<typeof GraphImpactInputSchema>;

export function createGraphImpactTool(
    manager: CodeGraphManager
): vscode.LanguageModelTool<GraphImpactInput> {
    return {
        async invoke(
            options: vscode.LanguageModelToolInvocationOptions<GraphImpactInput>,
            _token: vscode.CancellationToken
        ): Promise<vscode.LanguageModelToolResult> {
            const input = options.input;
            const workspace = getWorkspaceContext();

            logger.info('Graph impact requested', input);

            try {
                // Validate input
                const parsed = GraphImpactInputSchema.safeParse(input);
                if (!parsed.success) {
                    const envelope = createErrorEnvelope(
                        TOOLS.GRAPH_IMPACT,
                        'INVALID_INPUT',
                        'Invalid input: ' + parsed.error.message,
                        workspace,
                        { errors: parsed.error.errors }
                    );
                    return envelopeToResult(envelope);
                }

                const { target, depth, include, dependentLimit, entrypointLimit } = parsed.data;
                const sections = new Set<ImpactSection>(include ?? IMPACT_SECTIONS);

                const fullResult = manager.getImpact(target, depth);

                // Build filtered result based on requested sections
                const filteredResult: Record<string, unknown> = {
                    target: fullResult.target,
                    targetType: fullResult.targetType,
                    meta: fullResult.meta,
                };

                if (sections.has('directDependents')) {
                    const limit = dependentLimit ?? 30;
                    filteredResult.directDependents = fullResult.directDependents.slice(0, limit);
                    filteredResult.directDependentsTotal = fullResult.directDependents.length;
                }

                if (sections.has('transitiveImpact')) {
                    filteredResult.transitiveImpact = fullResult.transitiveImpact;
                }

                if (sections.has('affectedEntrypoints')) {
                    const limit = entrypointLimit ?? 10;
                    filteredResult.affectedEntrypoints = fullResult.affectedEntrypoints.slice(0, limit);
                    filteredResult.affectedEntrypointsTotal = fullResult.affectedEntrypoints.length;
                }

                if (sections.has('riskAssessment')) {
                    filteredResult.riskAssessment = fullResult.riskAssessment;
                }

                // Recalculate token estimate
                const tokensEstimate = Math.ceil(JSON.stringify(filteredResult).length / 4);
                (filteredResult.meta as Record<string, unknown>).tokensEstimate = tokensEstimate;

                logger.debug('Impact result', {
                    target: fullResult.target,
                    sections: Array.from(sections),
                    riskLevel: fullResult.riskAssessment.level,
                    tokensEstimate,
                });

                const isHighRisk = fullResult.riskAssessment.level === 'high' ||
                    fullResult.riskAssessment.level === 'critical';

                const envelope = createSuccessEnvelope(
                    TOOLS.GRAPH_IMPACT,
                    filteredResult,
                    workspace,
                    {
                        truncated: fullResult.meta.truncated ?? false,
                        limits: {
                            maxDepth: depth ?? 2,
                            dependentLimit: dependentLimit ?? 30,
                            entrypointLimit: entrypointLimit ?? 10,
                        },
                        nextQuerySuggestion: isHighRisk && fullResult.affectedEntrypoints.length > 0
                            ? [{
                                tool: TOOLS.GRAPH_PATH,
                                args: { from: target, to: fullResult.affectedEntrypoints[0]?.path },
                                reason: 'High risk - trace dependency path to entrypoint',
                            }]
                            : !sections.has('riskAssessment')
                                ? [{
                                    tool: TOOLS.GRAPH_IMPACT,
                                    args: { target, include: ['riskAssessment'] },
                                    reason: 'Get risk assessment for this change',
                                }]
                                : undefined,
                    }
                );
                return envelopeToResult(envelope);
            } catch (error) {
                logger.error('Graph impact error:', error);
                const envelope = createErrorEnvelope(
                    TOOLS.GRAPH_IMPACT,
                    'INTERNAL_ERROR',
                    error instanceof Error ? error.message : 'Unknown error',
                    workspace
                );
                return envelopeToResult(envelope);
            }
        },
    };
}
