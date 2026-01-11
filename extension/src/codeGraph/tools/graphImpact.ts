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

export const GraphImpactInputSchema = z.object({
    target: z.string().describe('File path or symbol to analyze impact for'),
    depth: z
        .number()
        .min(1)
        .max(4)
        .optional()
        .describe('Depth of transitive impact analysis (1-4, default: 2)'),
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

                const result = manager.getImpact(parsed.data.target, parsed.data.depth);

                logger.debug('Impact result', {
                    target: result.target,
                    directDependents: result.directDependents.length,
                    riskLevel: result.riskAssessment.level,
                    tokensEstimate: result.meta.tokensEstimate,
                });

                const envelope = createSuccessEnvelope(
                    TOOLS.GRAPH_IMPACT,
                    result,
                    workspace,
                    {
                        truncated: result.meta.truncated ?? false,
                        limits: { maxDepth: parsed.data.depth ?? 2 },
                        nextQuerySuggestion: result.riskAssessment.level === 'high' ||
                            result.riskAssessment.level === 'critical'
                            ? [{
                                tool: TOOLS.GRAPH_PATH,
                                args: { from: result.target, to: result.affectedEntrypoints[0]?.path },
                                reason: 'High risk - trace dependency path to entrypoint',
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
