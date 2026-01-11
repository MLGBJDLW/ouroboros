/**
 * Graph Digest Tool
 * LM Tool for getting a token-efficient overview of the codebase
 */

import * as vscode from 'vscode';
import { z } from 'zod';
import type { CodeGraphManager } from '../CodeGraphManager';
import { createLogger } from '../../utils/logger';

const logger = createLogger('GraphDigestTool');

export const GraphDigestInputSchema = z.object({
    scope: z.string().optional().describe('Optional directory scope to limit the digest'),
});

export type GraphDigestInput = z.infer<typeof GraphDigestInputSchema>;

export function createGraphDigestTool(
    manager: CodeGraphManager
): vscode.LanguageModelTool<GraphDigestInput> {
    return {
        async invoke(
            options: vscode.LanguageModelToolInvocationOptions<GraphDigestInput>,
            _token: vscode.CancellationToken
        ): Promise<vscode.LanguageModelToolResult> {
            const input = options.input;

            logger.info('Graph digest requested', { scope: input.scope });

            try {
                // Validate input
                const parsed = GraphDigestInputSchema.safeParse(input);
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

                const result = manager.getDigest(parsed.data.scope);

                logger.debug('Digest result', {
                    files: result.summary.files,
                    entrypoints: result.summary.entrypoints,
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
                logger.error('Graph digest error:', error);
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
