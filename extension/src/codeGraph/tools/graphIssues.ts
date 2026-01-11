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

/**
 * All supported issue kinds
 */
const ISSUE_KINDS = [
    'HANDLER_UNREACHABLE',
    'DYNAMIC_EDGE_UNKNOWN',
    'BROKEN_EXPORT_CHAIN',
    'CIRCULAR_REEXPORT',
    'ORPHAN_EXPORT',
    'ENTRY_MISSING_HANDLER',
    'NOT_REGISTERED',
    'CYCLE_RISK',
    'LAYER_VIOLATION',
] as const;

export const GraphIssuesInputSchema = z.object({
    kind: z
        .enum(ISSUE_KINDS)
        .optional()
        .describe('Filter by issue type. Options: HANDLER_UNREACHABLE, DYNAMIC_EDGE_UNKNOWN, BROKEN_EXPORT_CHAIN, CIRCULAR_REEXPORT, ORPHAN_EXPORT, ENTRY_MISSING_HANDLER, NOT_REGISTERED, CYCLE_RISK, LAYER_VIOLATION'),
    severity: z
        .enum(['info', 'warning', 'error'])
        .optional()
        .describe('Minimum severity level: info (all), warning (warning+error), error (errors only)'),
    scope: z
        .string()
        .optional()
        .describe('Directory scope to filter issues (e.g., "src/features")'),
    limit: z
        .number()
        .min(1)
        .max(50)
        .optional()
        .describe('Maximum issues to return (1-50, default: 20)'),
    groupBy: z
        .enum(['none', 'kind', 'severity', 'file'])
        .optional()
        .describe('Group results by: none (flat list), kind, severity, or file'),
});

export type GraphIssuesInput = z.infer<typeof GraphIssuesInputSchema>;

/**
 * Group issues by a specific field
 */
function groupIssues(
    issues: Array<{ kind: string; severity: string; file: string; [key: string]: unknown }>,
    groupBy: 'kind' | 'severity' | 'file'
): Record<string, typeof issues> {
    const grouped: Record<string, typeof issues> = {};
    for (const issue of issues) {
        const key = issue[groupBy] as string;
        if (!grouped[key]) {
            grouped[key] = [];
        }
        grouped[key].push(issue);
    }
    return grouped;
}

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

                const { kind, severity, scope, limit, groupBy } = parsed.data;

                const result = manager.getIssues({
                    kind,
                    severity,
                    scope,
                    limit,
                });

                logger.debug('Issues result', {
                    total: result.stats.total,
                    returned: result.stats.returned,
                    tokensEstimate: result.meta.tokensEstimate,
                });

                // Apply grouping if requested
                let responseData: Record<string, unknown>;
                if (groupBy && groupBy !== 'none') {
                    const grouped = groupIssues(result.issues, groupBy);
                    responseData = {
                        groupedBy: groupBy,
                        groups: grouped,
                        stats: result.stats,
                        meta: result.meta,
                    };
                } else {
                    responseData = result;
                }

                const envelope = createSuccessEnvelope(
                    TOOLS.GRAPH_ISSUES,
                    responseData,
                    workspace,
                    {
                        truncated: result.stats.returned < result.stats.total,
                        limits: { maxItems: limit ?? 20 },
                        nextQuerySuggestion: result.stats.returned < result.stats.total
                            ? [{
                                tool: TOOLS.GRAPH_ISSUES,
                                args: { ...parsed.data, limit: Math.min((limit ?? 20) + 10, 50) },
                                reason: `${result.stats.total - result.stats.returned} more issues available`,
                            }]
                            : result.stats.byKind?.['CYCLE_RISK'] && result.stats.byKind['CYCLE_RISK'] > 0
                                ? [{
                                    tool: TOOLS.GRAPH_CYCLES,
                                    args: { scope },
                                    reason: 'Cycle risks detected - analyze circular dependencies',
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
