/**
 * Graph References Tool
 * LM Tool for finding all references to a symbol
 * 
 * Uses VS Code LSP ReferenceProvider for accurate reference finding:
 * - All usages of a symbol across the workspace
 * - Includes the definition location
 * - Line preview for each reference
 */

import * as vscode from 'vscode';
import { z } from 'zod';
import { createLogger } from '../../utils/logger';
import {
    createSuccessEnvelope,
    createErrorEnvelope,
    envelopeToResult,
    getWorkspaceContext,
} from './envelope';
import { TOOLS } from '../../constants';
import { getSymbolService, type ReferenceInfo } from '../lsp';

const logger = createLogger('GraphReferencesTool');

export const GraphReferencesInputSchema = z.object({
    path: z
        .string()
        .describe('File path containing the symbol'),
    line: z
        .number()
        .min(1)
        .describe('Line number of the symbol (1-indexed)'),
    column: z
        .number()
        .min(1)
        .optional()
        .describe('Column number (1-indexed, default: first non-whitespace)'),
    includeDeclaration: z
        .boolean()
        .optional()
        .describe('Include the declaration in results (default: true)'),
    limit: z
        .number()
        .min(1)
        .max(200)
        .optional()
        .describe('Max references to return (1-200, default: 50)'),
    groupByFile: z
        .boolean()
        .optional()
        .describe('Group references by file (default: false)'),
});

export type GraphReferencesInput = z.infer<typeof GraphReferencesInputSchema>;

interface ReferencesResult {
    target: {
        path: string;
        line: number;
        column: number;
    };
    references: ReferenceInfo[];
    stats: {
        total: number;
        returned: number;
        files: number;
        definitionFound: boolean;
    };
    grouped?: Record<string, ReferenceInfo[]>;
}

export function createGraphReferencesTool(): vscode.LanguageModelTool<GraphReferencesInput> {
    return {
        async invoke(
            options: vscode.LanguageModelToolInvocationOptions<GraphReferencesInput>,
            _token: vscode.CancellationToken
        ): Promise<vscode.LanguageModelToolResult> {
            const input = options.input;
            const workspace = getWorkspaceContext();

            logger.info('Graph references requested', input);

            try {
                // Validate input
                const parsed = GraphReferencesInputSchema.safeParse(input);
                if (!parsed.success) {
                    const envelope = createErrorEnvelope(
                        TOOLS.GRAPH_REFERENCES,
                        'INVALID_INPUT',
                        'Invalid input: ' + parsed.error.message,
                        workspace,
                        { errors: parsed.error.errors }
                    );
                    return envelopeToResult(envelope);
                }

                const { path, line, column, includeDeclaration, limit, groupByFile } = parsed.data;
                const symbolService = getSymbolService();
                const maxResults = limit ?? 50;
                const col = column ?? 1;

                // Find references
                const references = await symbolService.findReferences(path, line, col, {
                    includeDeclaration: includeDeclaration ?? true,
                    limit: maxResults,
                });

                // Find unique files
                const uniqueFiles = new Set(references.map(r => r.path));
                const definitionFound = references.some(r => r.isDefinition);

                // Group by file if requested
                let grouped: Record<string, ReferenceInfo[]> | undefined;
                if (groupByFile) {
                    grouped = {};
                    for (const ref of references) {
                        if (!grouped[ref.path]) {
                            grouped[ref.path] = [];
                        }
                        grouped[ref.path].push(ref);
                    }
                }

                const result: ReferencesResult = {
                    target: { path, line, column: col },
                    references: groupByFile ? [] : references, // Empty if grouped
                    stats: {
                        total: references.length,
                        returned: references.length,
                        files: uniqueFiles.size,
                        definitionFound,
                    },
                    grouped,
                };

                logger.debug('References found', {
                    path,
                    line,
                    total: result.stats.total,
                    files: result.stats.files,
                });

                const envelope = createSuccessEnvelope(
                    TOOLS.GRAPH_REFERENCES,
                    result,
                    workspace,
                    {
                        truncated: references.length >= maxResults,
                        limits: { limit: maxResults },
                        nextQuerySuggestion: references.length > 0 && !definitionFound
                            ? [{
                                tool: TOOLS.GRAPH_DEFINITION,
                                args: { path, line, column: col },
                                reason: 'Go to definition of this symbol',
                            }]
                            : references.length > 5
                                ? [{
                                    tool: TOOLS.GRAPH_IMPACT,
                                    args: { target: path },
                                    reason: `${references.length} references found - analyze full impact`,
                                }]
                                : undefined,
                    }
                );
                return envelopeToResult(envelope);

            } catch (error) {
                logger.error('Graph references error:', error);

                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                let errorCode = 'INTERNAL_ERROR';

                if (errorMessage.includes('ENOENT') || errorMessage.includes('not found')) {
                    errorCode = 'FILE_NOT_FOUND';
                } else if (errorMessage.includes('language server') || errorMessage.includes('provider')) {
                    errorCode = 'LSP_NOT_AVAILABLE';
                }

                const envelope = createErrorEnvelope(
                    TOOLS.GRAPH_REFERENCES,
                    errorCode,
                    errorMessage,
                    workspace,
                    {
                        suggestion: errorCode === 'LSP_NOT_AVAILABLE'
                            ? 'Language server may not be active. Try opening the file in the editor first.'
                            : undefined
                    }
                );
                return envelopeToResult(envelope);
            }
        },
    };
}
