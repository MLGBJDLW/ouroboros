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

/**
 * Sections that can be included in the digest response
 */
const DIGEST_SECTIONS = ['summary', 'entrypoints', 'hotspots', 'issues'] as const;
type DigestSection = typeof DIGEST_SECTIONS[number];

export const GraphDigestInputSchema = z.object({
    scope: z
        .string()
        .optional()
        .describe('Directory scope to limit the digest (e.g., "src/features")'),
    include: z
        .array(z.enum(DIGEST_SECTIONS))
        .optional()
        .describe('Sections to include: summary, entrypoints, hotspots, issues. Default: all'),
    hotspotLimit: z
        .number()
        .min(1)
        .max(20)
        .optional()
        .describe('Max hotspots to return (1-20, default: 10)'),
    entrypointLimit: z
        .number()
        .min(1)
        .max(20)
        .optional()
        .describe('Max entrypoints per type (1-20, default: 5)'),
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

            logger.info('Graph digest requested', {
                scope: input.scope,
                include: input.include,
                hotspotLimit: input.hotspotLimit,
                entrypointLimit: input.entrypointLimit,
            });

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

                const { scope, include, hotspotLimit, entrypointLimit } = parsed.data;

                // Determine which sections to include
                const sections = new Set<DigestSection>(include ?? DIGEST_SECTIONS);

                const fullResult = manager.getDigest(scope);

                // Build filtered result based on requested sections
                const filteredResult: Record<string, unknown> = {
                    meta: fullResult.meta,
                };

                if (sections.has('summary')) {
                    filteredResult.summary = fullResult.summary;
                }

                if (sections.has('entrypoints')) {
                    const limit = entrypointLimit ?? 5;
                    filteredResult.entrypoints = {
                        routes: fullResult.entrypoints.routes.slice(0, limit),
                        commands: fullResult.entrypoints.commands.slice(0, limit),
                        pages: fullResult.entrypoints.pages.slice(0, limit),
                        jobs: fullResult.entrypoints.jobs.slice(0, limit),
                    };
                }

                if (sections.has('hotspots')) {
                    const limit = hotspotLimit ?? 10;
                    filteredResult.hotspots = fullResult.hotspots.slice(0, limit);
                }

                if (sections.has('issues')) {
                    filteredResult.issues = fullResult.issues;
                }

                // Recalculate token estimate for filtered result
                const tokensEstimate = Math.ceil(JSON.stringify(filteredResult).length / 4);
                (filteredResult.meta as Record<string, unknown>).tokensEstimate = tokensEstimate;

                logger.debug('Digest result', {
                    sections: Array.from(sections),
                    tokensEstimate,
                });

                const hasIssues = sections.has('issues') && (
                    fullResult.issues.HANDLER_UNREACHABLE > 0 ||
                    fullResult.issues.BROKEN_EXPORT_CHAIN > 0
                );

                // Build next query suggestions
                const suggestions = [];

                if (hasIssues) {
                    suggestions.push({
                        tool: TOOLS.GRAPH_ISSUES,
                        args: { severity: 'error', limit: 10 },
                        reason: 'Issues detected - review errors first',
                    });
                }

                if (!sections.has('hotspots') && fullResult.hotspots.length > 0) {
                    suggestions.push({
                        tool: TOOLS.GRAPH_DIGEST,
                        args: { include: ['hotspots'], hotspotLimit: 5 },
                        reason: 'Get hotspot files for impact analysis',
                    });
                }

                // Suggest LSP tools for deeper analysis
                if (fullResult.hotspots.length > 0) {
                    const topHotspot = fullResult.hotspots[0];
                    suggestions.push({
                        tool: TOOLS.GRAPH_SYMBOLS,
                        args: { target: topHotspot.path, mode: 'document' },
                        reason: `Analyze symbols in top hotspot: ${topHotspot.path}`,
                    });
                }

                const envelope = createSuccessEnvelope(
                    TOOLS.GRAPH_DIGEST,
                    filteredResult,
                    workspace,
                    {
                        truncated: fullResult.meta.truncated ?? false,
                        limits: {
                            hotspotLimit: hotspotLimit ?? 10,
                            entrypointLimit: entrypointLimit ?? 5,
                        },
                        nextQuerySuggestion: suggestions.length > 0 ? suggestions.slice(0, 3) : undefined,
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
