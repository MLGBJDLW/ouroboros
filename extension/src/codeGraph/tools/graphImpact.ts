/**
 * Graph Impact Tool
 * LM Tool for analyzing the impact of changes to a file or symbol
 * 
 * Enhanced with LSP integration for symbol-level reference counting
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
import { getSymbolService } from '../lsp';

const logger = createLogger('GraphImpactTool');

/**
 * Sections that can be included in impact response
 */
const IMPACT_SECTIONS = ['directDependents', 'transitiveImpact', 'affectedEntrypoints', 'riskAssessment', 'symbolRefs'] as const;
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
        .describe('Sections to include: directDependents, transitiveImpact, affectedEntrypoints, riskAssessment, symbolRefs. Default: all except symbolRefs'),
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
    useSymbolRefs: z
        .boolean()
        .optional()
        .describe('Use LSP to get precise symbol reference counts (requires active language server)'),
    symbolLine: z
        .number()
        .optional()
        .describe('Line number for symbol-level impact analysis (required with useSymbolRefs)'),
    symbolColumn: z
        .number()
        .optional()
        .describe('Column number for symbol-level impact (optional, default: 1)'),
});

export type GraphImpactInput = z.infer<typeof GraphImpactInputSchema>;

// Enhanced result type
interface EnhancedImpactResult extends Record<string, unknown> {
    symbolRefs?: {
        totalReferences: number;
        uniqueFiles: number;
        referencedFiles: Array<{ path: string; count: number }>;
    };
}

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

                const {
                    target,
                    depth,
                    include,
                    dependentLimit,
                    entrypointLimit,
                    useSymbolRefs,
                    symbolLine,
                    symbolColumn,
                } = parsed.data;

                // Default sections (exclude symbolRefs for backwards compatibility)
                const defaultSections: ImpactSection[] = ['directDependents', 'transitiveImpact', 'affectedEntrypoints', 'riskAssessment'];
                const sections = new Set<ImpactSection>(include ?? defaultSections);

                // Add symbolRefs if explicitly requested
                if (useSymbolRefs) {
                    sections.add('symbolRefs');
                }

                const fullResult = manager.getImpact(target, depth);

                // Build filtered result based on requested sections
                const filteredResult: EnhancedImpactResult = {
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

                // Get LSP symbol references if requested
                if (sections.has('symbolRefs') && symbolLine) {
                    try {
                        const symbolService = getSymbolService();
                        const references = await symbolService.findReferences(
                            target,
                            symbolLine,
                            symbolColumn ?? 1,
                            { includeDeclaration: false, limit: 100 }
                        );

                        // Group by file and count
                        const fileCounts = new Map<string, number>();
                        for (const ref of references) {
                            fileCounts.set(ref.path, (fileCounts.get(ref.path) ?? 0) + 1);
                        }

                        const referencedFiles = Array.from(fileCounts.entries())
                            .map(([path, count]) => ({ path, count }))
                            .sort((a, b) => b.count - a.count);

                        filteredResult.symbolRefs = {
                            totalReferences: references.length,
                            uniqueFiles: fileCounts.size,
                            referencedFiles,
                        };

                        logger.debug('LSP symbol refs retrieved', {
                            target,
                            symbolLine,
                            totalRefs: references.length,
                        });
                    } catch (error) {
                        logger.warn('Failed to get LSP symbol refs', { target, error });
                        filteredResult.symbolRefsError = 'LSP not available - open file in editor first';
                    }
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

                // Construct next query suggestions
                const suggestions = [];

                if (isHighRisk && fullResult.affectedEntrypoints.length > 0) {
                    suggestions.push({
                        tool: TOOLS.GRAPH_PATH,
                        args: { from: target, to: fullResult.affectedEntrypoints[0]?.path },
                        reason: 'High risk - trace dependency path to entrypoint',
                    });
                }

                if (!sections.has('symbolRefs') && fullResult.directDependents.length > 5) {
                    suggestions.push({
                        tool: TOOLS.GRAPH_SYMBOLS,
                        args: { target, mode: 'document' },
                        reason: 'Get symbols for precise reference analysis',
                    });
                }

                if (filteredResult.symbolRefs && filteredResult.symbolRefs.totalReferences > 10) {
                    suggestions.push({
                        tool: TOOLS.GRAPH_CALL_HIERARCHY,
                        args: { path: target, line: symbolLine },
                        reason: `High ref count (${filteredResult.symbolRefs.totalReferences}) - trace call hierarchy`,
                    });
                }

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
                        nextQuerySuggestion: suggestions.length > 0 ? suggestions : undefined,
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

