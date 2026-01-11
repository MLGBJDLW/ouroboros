/**
 * Graph Issues Tool
 * LM Tool for getting code graph issues (missing links, unreachable code)
 */

import * as vscode from 'vscode';
import { z } from 'zod';
import type { CodeGraphManager } from '../CodeGraphManager';
import { createLogger } from '../../utils/logger';

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

            logger.info('Graph issues requested', input);

            try {
                // Validate input
                const parsed = GraphIssuesInputSchema.safeParse(input);
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

                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify({
                            success: true,
                            data: result,
                        })
                    ),
                ]);
            } catch (error) {
                logger.error('Graph issues error:', error);
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
