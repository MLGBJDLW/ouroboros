/**
 * Graph Digest Tool
 * LM Tool for getting a token-efficient overview of the codebase
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
            const workspace = getWorkspaceContext();

            logger.info('Graph digest requested', { scope: input.scope });

            try {
                // Validate input
                const parsed = GraphDigestInputSchema.safeParse(input);
                if (!parsed.success) {
                    const envelope = createErrorEnvelope(
                        TOOLS.GRAPH_DIGEST,
                        'INVALID_INPUT',
                        'Invalid input: ' + parsed.error.message,
                        workspace,
                        { errors: parsed.error.errors }
                    );
                    return envelopeToResult(envelope);
                }

                const result = manager.getDigest(parsed.data.scope);

                logger.debug('Digest result', {
                    files: result.summary.files,
                    entrypoints: result.summary.entrypoints,
                    tokensEstimate: result.meta.tokensEstimate,
                });

                const envelope = createSuccessEnvelope(
                    TOOLS.GRAPH_DIGEST,
                    result,
                    workspace,
                    {
                        truncated: result.meta.truncated ?? false,
                        limits: { maxItems: 10 },
                        nextQuerySuggestion: result.issues.HANDLER_UNREACHABLE > 0 ||
                            result.issues.BROKEN_EXPORT_CHAIN > 0
                            ? [{
                                tool: TOOLS.GRAPH_ISSUES,
                                args: { severity: 'error', limit: 20 },
                                reason: 'Issues detected - review errors first',
                            }]
                            : undefined,
                    }
                );
                return envelopeToResult(envelope);
            } catch (error) {
                logger.error('Graph digest error:', error);
                const envelope = createErrorEnvelope(
                    TOOLS.GRAPH_DIGEST,
                    'INTERNAL_ERROR',
                    error instanceof Error ? error.message : 'Unknown error',
                    workspace
                );
                return envelopeToResult(envelope);
            }
        },
    };
}
