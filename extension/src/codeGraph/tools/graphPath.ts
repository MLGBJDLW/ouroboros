/**
 * Graph Path Tool
 * LM Tool for finding paths between modules in the code graph
 */

import * as vscode from 'vscode';
import { z } from 'zod';
import type { CodeGraphManager } from '../CodeGraphManager';
import type { PathResult } from '../core/types';
import { createLogger } from '../../utils/logger';
import {
    createSuccessEnvelope,
    createErrorEnvelope,
    envelopeToResult,
    getWorkspaceContext,
} from './envelope';
import { TOOLS } from '../../constants';

const logger = createLogger('GraphPathTool');

export const GraphPathInputSchema = z.object({
    from: z
        .string()
        .describe('Source file path (e.g., "src/index.ts")'),
    to: z
        .string()
        .describe('Target file path (e.g., "src/utils/helpers.ts")'),
    maxDepth: z
        .number()
        .min(1)
        .max(10)
        .optional()
        .describe('Maximum path depth to search (1-10, default: 5)'),
    maxPaths: z
        .number()
        .min(1)
        .max(10)
        .optional()
        .describe('Maximum number of paths to return (1-10, default: 3)'),
    includeEdgeDetails: z
        .boolean()
        .optional()
        .describe('Include edge IDs in response (default: false, saves tokens)'),
});

export type GraphPathInput = z.infer<typeof GraphPathInputSchema>;

export function createGraphPathTool(
    manager: CodeGraphManager
): vscode.LanguageModelTool<GraphPathInput> {
    return {
        async invoke(
            options: vscode.LanguageModelToolInvocationOptions<GraphPathInput>,
            _token: vscode.CancellationToken
        ): Promise<vscode.LanguageModelToolResult> {
            const input = options.input;
            const workspace = getWorkspaceContext();

            logger.info('Graph path requested', input);

            try {
                // Validate input
                const parsed = GraphPathInputSchema.safeParse(input);
                if (!parsed.success) {
                    const envelope = createErrorEnvelope(
                        TOOLS.GRAPH_PATH,
                        'INVALID_INPUT',
                        'Invalid input: ' + parsed.error.message,
                        workspace,
                        { errors: parsed.error.errors }
                    );
                    return envelopeToResult(envelope);
                }

                const { from, to, maxDepth, maxPaths, includeEdgeDetails } = parsed.data;
                const query = manager.getQuery();

                if (!query) {
                    const emptyResult: PathResult = {
                        from,
                        to,
                        paths: [],
                        connected: false,
                        shortestPath: null,
                        meta: {
                            tokensEstimate: 100,
                            truncated: false,
                            maxDepthReached: false,
                        },
                    };
                    const envelope = createSuccessEnvelope(
                        TOOLS.GRAPH_PATH,
                        emptyResult,
                        workspace,
                        { truncated: false, limits: {} }
                    );
                    return envelopeToResult(envelope);
                }

                const fullResult = query.path(from, to, {
                    maxDepth,
                    maxPaths,
                });

                // Build filtered result
                const filteredResult: Record<string, unknown> = {
                    from: fullResult.from,
                    to: fullResult.to,
                    connected: fullResult.connected,
                    shortestPath: fullResult.shortestPath,
                    pathCount: fullResult.paths.length,
                    meta: fullResult.meta,
                };

                // Include paths with or without edge details
                if (includeEdgeDetails) {
                    filteredResult.paths = fullResult.paths;
                } else {
                    // Omit edge IDs to save tokens
                    filteredResult.paths = fullResult.paths.map(p => ({
                        nodes: p.nodes,
                        length: p.length,
                    }));
                }

                // Recalculate token estimate
                const tokensEstimate = Math.ceil(JSON.stringify(filteredResult).length / 4);
                (filteredResult.meta as Record<string, unknown>).tokensEstimate = tokensEstimate;

                logger.debug('Path result', {
                    from,
                    to,
                    connected: fullResult.connected,
                    pathCount: fullResult.paths.length,
                    tokensEstimate,
                });

                const envelope = createSuccessEnvelope(
                    TOOLS.GRAPH_PATH,
                    filteredResult,
                    workspace,
                    {
                        truncated: fullResult.meta.truncated ?? false,
                        limits: {
                            maxDepth: maxDepth ?? 5,
                            maxPaths: maxPaths ?? 3,
                        },
                        nextQuerySuggestion: fullResult.connected && fullResult.paths.length > 0
                            ? [{
                                tool: TOOLS.GRAPH_IMPACT,
                                args: { target: from, depth: 2 },
                                reason: 'Analyze full impact of changes to source',
                            }]
                            : !fullResult.connected
                                ? [{
                                    tool: TOOLS.GRAPH_MODULE,
                                    args: { target: from, include: ['imports'] },
                                    reason: 'Modules not connected - inspect source imports',
                                }]
                                : undefined,
                    }
                );
                return envelopeToResult(envelope);
            } catch (error) {
                logger.error('Graph path error:', error);
                const envelope = createErrorEnvelope(
                    TOOLS.GRAPH_PATH,
                    'INTERNAL_ERROR',
                    error instanceof Error ? error.message : 'Unknown error',
                    workspace
                );
                return envelopeToResult(envelope);
            }
        },
    };
}
