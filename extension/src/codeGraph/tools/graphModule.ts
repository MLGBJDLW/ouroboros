/**
 * Graph Module Tool
 * LM Tool for getting detailed information about a specific module
 */

import * as vscode from 'vscode';
import { z } from 'zod';
import type { CodeGraphManager } from '../CodeGraphManager';
import type { ModuleResult } from '../core/types';
import { createLogger } from '../../utils/logger';
import {
    createSuccessEnvelope,
    createErrorEnvelope,
    envelopeToResult,
    getWorkspaceContext,
} from './envelope';
import { TOOLS } from '../../constants';

const logger = createLogger('GraphModuleTool');

/**
 * Sections that can be included in module response
 */
const MODULE_SECTIONS = ['imports', 'importedBy', 'exports', 'reexports', 'entrypoints'] as const;
type ModuleSection = typeof MODULE_SECTIONS[number];

export const GraphModuleInputSchema = z.object({
    target: z
        .string()
        .describe('File path or module name to analyze (e.g., "src/utils/helpers.ts")'),
    includeTransitive: z
        .boolean()
        .optional()
        .describe('Include transitive dependencies (default: false)'),
    include: z
        .array(z.enum(MODULE_SECTIONS))
        .optional()
        .describe('Sections to include: imports, importedBy, exports, reexports, entrypoints. Default: all'),
    importLimit: z
        .number()
        .min(1)
        .max(50)
        .optional()
        .describe('Max imports to return (1-50, default: all)'),
    importedByLimit: z
        .number()
        .min(1)
        .max(50)
        .optional()
        .describe('Max importedBy to return (1-50, default: all)'),
});

export type GraphModuleInput = z.infer<typeof GraphModuleInputSchema>;

export function createGraphModuleTool(
    manager: CodeGraphManager
): vscode.LanguageModelTool<GraphModuleInput> {
    return {
        async invoke(
            options: vscode.LanguageModelToolInvocationOptions<GraphModuleInput>,
            _token: vscode.CancellationToken
        ): Promise<vscode.LanguageModelToolResult> {
            const input = options.input;
            const workspace = getWorkspaceContext();

            logger.info('Graph module requested', input);

            try {
                // Validate input
                const parsed = GraphModuleInputSchema.safeParse(input);
                if (!parsed.success) {
                    const envelope = createErrorEnvelope(
                        TOOLS.GRAPH_MODULE,
                        'INVALID_INPUT',
                        'Invalid input: ' + parsed.error.message,
                        workspace,
                        { errors: parsed.error.errors }
                    );
                    return envelopeToResult(envelope);
                }

                const { target, includeTransitive, include, importLimit, importedByLimit } = parsed.data;
                const query = manager.getQuery();

                if (!query) {
                    const emptyResult: ModuleResult = {
                        id: `file:${target}`,
                        path: target,
                        name: target.split('/').pop() ?? target,
                        kind: 'file',
                        imports: [],
                        importedBy: [],
                        exports: [],
                        reexports: [],
                        entrypoints: [],
                        isBarrel: false,
                        meta: {
                            tokensEstimate: 100,
                        },
                    };
                    const envelope = createSuccessEnvelope(
                        TOOLS.GRAPH_MODULE,
                        emptyResult,
                        workspace,
                        { truncated: false, limits: {} }
                    );
                    return envelopeToResult(envelope);
                }

                const fullResult = query.module(target, {
                    includeTransitive,
                });

                // Determine which sections to include
                const sections = new Set<ModuleSection>(include ?? MODULE_SECTIONS);

                // Build filtered result
                const filteredResult: Record<string, unknown> = {
                    id: fullResult.id,
                    path: fullResult.path,
                    name: fullResult.name,
                    kind: fullResult.kind,
                    isBarrel: fullResult.isBarrel,
                    meta: fullResult.meta,
                };

                if (sections.has('imports')) {
                    const limit = importLimit;
                    filteredResult.imports = limit
                        ? fullResult.imports.slice(0, limit)
                        : fullResult.imports;
                    if (limit && fullResult.imports.length > limit) {
                        filteredResult.importsTotal = fullResult.imports.length;
                    }
                }

                if (sections.has('importedBy')) {
                    const limit = importedByLimit;
                    filteredResult.importedBy = limit
                        ? fullResult.importedBy.slice(0, limit)
                        : fullResult.importedBy;
                    if (limit && fullResult.importedBy.length > limit) {
                        filteredResult.importedByTotal = fullResult.importedBy.length;
                    }
                }

                if (sections.has('exports')) {
                    filteredResult.exports = fullResult.exports;
                }

                if (sections.has('reexports')) {
                    filteredResult.reexports = fullResult.reexports;
                }

                if (sections.has('entrypoints')) {
                    filteredResult.entrypoints = fullResult.entrypoints;
                }

                // Recalculate token estimate
                const tokensEstimate = Math.ceil(JSON.stringify(filteredResult).length / 4);
                (filteredResult.meta as Record<string, unknown>).tokensEstimate = tokensEstimate;

                logger.debug('Module result', {
                    target,
                    sections: Array.from(sections),
                    tokensEstimate,
                });

                const envelope = createSuccessEnvelope(
                    TOOLS.GRAPH_MODULE,
                    filteredResult,
                    workspace,
                    {
                        truncated: false,
                        limits: {
                            importLimit,
                            importedByLimit,
                        },
                        nextQuerySuggestion: fullResult.importedBy.length > 5
                            ? [{
                                tool: TOOLS.GRAPH_IMPACT,
                                args: { target, depth: 2 },
                                reason: `High importer count (${fullResult.importedBy.length}) - analyze impact`,
                            }]
                            : fullResult.isBarrel
                                ? [{
                                    tool: TOOLS.GRAPH_PATH,
                                    args: { from: fullResult.imports[0]?.path, to: target },
                                    reason: 'Barrel file detected - trace re-export chain',
                                }]
                                : undefined,
                    }
                );
                return envelopeToResult(envelope);
            } catch (error) {
                logger.error('Graph module error:', error);
                const envelope = createErrorEnvelope(
                    TOOLS.GRAPH_MODULE,
                    'INTERNAL_ERROR',
                    error instanceof Error ? error.message : 'Unknown error',
                    workspace
                );
                return envelopeToResult(envelope);
            }
        },
    };
}
