/**
 * Graph Issues Tool
 * LM Tool for getting code graph issues (missing links, unreachable code)
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

const logger = createLogger('GraphIssuesTool');

export const GraphIssuesInputSchema = z.object({
    kind: z
        .enum(['HANDLER_UNREACHABLE', 'DYNAMIC_EDGE_UNKNOWN', 'BROKEN_EXPORT_CHAIN'])
        .optional()
        .describe('Filter by issue type'),
    severity: z
        .enum(['info', 'warning', 'error'])
        .optional()
        .describe('Minimum severity level'),
    scope: z.string().optional().describe('Directory scope to filter issues'),
    limit: z.number().optional().describe('Maximum number of issues to return (default: 20, max: 50)'),
});

export type GraphIssuesInput = z.infer<typeof GraphIssuesInputSchema>;

export function createGraphIssuesTool(
    manager: CodeGraphManager
): vscode.LanguageModelTool<GraphIssuesInput> {
    return {
        async invoke(
            options: vscode.LanguageModelToolInvocationOptions<GraphIssuesInput>,
            _token: vscode.CancellationToken
        ): Promise<vscode.LanguageModelToolResult> {
            const input = options.input;
            const workspace = getWorkspaceContext();

            logger.info('Graph issues requested', input);

            try {
                // Validate input
                const parsed = GraphIssuesInputSchema.safeParse(input);
                if (!parsed.success) {
                    const envelope = createErrorEnvelope(
                        TOOLS.GRAPH_ISSUES,
                        'INVALID_INPUT',
                        'Invalid input: ' + parsed.error.message,
                        workspace,
                        { errors: parsed.error.errors }
                    );
                    return envelopeToResult(envelope);
                }

                const result = manager.getIssues({
                    kind: parsed.data.kind,
                    severity: parsed.data.severity,
                    scope: parsed.data.scope,
                    limit: parsed.data.limit,
                });

                logger.debug('Issues result', {
                    total: result.stats.total,
                    returned: result.stats.returned,
                    tokensEstimate: result.meta.tokensEstimate,
                });

                const envelope = createSuccessEnvelope(
                    TOOLS.GRAPH_ISSUES,
                    result,
                    workspace,
                    {
                        truncated: result.stats.returned < result.stats.total,
                        limits: { maxItems: parsed.data.limit ?? 20 },
                        nextQuerySuggestion: result.stats.returned < result.stats.total
                            ? [{
                                tool: TOOLS.GRAPH_ISSUES,
                                args: { ...parsed.data, limit: (parsed.data.limit ?? 20) + 20 },
                                reason: `${result.stats.total - result.stats.returned} more issues available`,
                            }]
                            : undefined,
                    }
                );
                return envelopeToResult(envelope);
            } catch (error) {
                logger.error('Graph issues error:', error);
                const envelope = createErrorEnvelope(
                    TOOLS.GRAPH_ISSUES,
                    'INTERNAL_ERROR',
                    error instanceof Error ? error.message : 'Unknown error',
                    workspace
                );
                return envelopeToResult(envelope);
            }
        },
    };
}
