/**
 * Graph Impact Tool
 * LM Tool for analyzing the impact of changes to a file or symbol
 */

import * as vscode from 'vscode';
import { z } from 'zod';
import type { CodeGraphManager } from '../CodeGraphManager';
import { createLogger } from '../../utils/logger';

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

            logger.info('Graph impact requested', input);

            try {
                // Validate input
                const parsed = GraphImpactInputSchema.safeParse(input);
                if (!parsed.success) {
                    return new vscode.LanguageModelToolResult([
                        new vscode.LanguageModelTextPart(
                            JSON.stringify({
                                success: false,
                                error: 'Invalid input: ' + parsed.error.message,
                            })
                        ),
                    ]);
                }

                const result = manager.getImpact(parsed.data.target, parsed.data.depth);

                logger.debug('Impact result', {
                    target: result.target,
                    directDependents: result.directDependents.length,
                    riskLevel: result.riskAssessment.level,
                    tokensEstimate: result.meta.tokensEstimate,
                });

                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify({
                            success: true,
                            data: result,
                        })
                    ),
                ]);
            } catch (error) {
                logger.error('Graph impact error:', error);
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify({
                            success: false,
                            error: error instanceof Error ? error.message : 'Unknown error',
                        })
                    ),
                ]);
            }
        },
    };
}
