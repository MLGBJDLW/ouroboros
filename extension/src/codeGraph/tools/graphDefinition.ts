/**
 * Graph Definition Tool
 * LM Tool for going to the definition of a symbol
 * 
 * Uses VS Code LSP DefinitionProvider:
 * - Find where a symbol is defined
 * - Supports multiple definitions (e.g., overloads)
 * - Works across files and packages
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
import { getSymbolService, type DefinitionInfo } from '../lsp';

const logger = createLogger('GraphDefinitionTool');

export const GraphDefinitionInputSchema = z.object({
    path: z
        .string()
        .describe('File path containing the symbol reference'),
    line: z
        .number()
        .min(1)
        .describe('Line number of the symbol (1-indexed)'),
    column: z
        .number()
        .min(1)
        .optional()
        .describe('Column number (1-indexed, default: first non-whitespace)'),
});

export type GraphDefinitionInput = z.infer<typeof GraphDefinitionInputSchema>;

interface DefinitionResult {
    source: {
        path: string;
        line: number;
        column: number;
    };
    definitions: DefinitionInfo[];
    stats: {
        count: number;
        isSameFile: boolean;
        isExternalPackage: boolean;
    };
}

export function createGraphDefinitionTool(): vscode.LanguageModelTool<GraphDefinitionInput> {
    return {
        async invoke(
            options: vscode.LanguageModelToolInvocationOptions<GraphDefinitionInput>,
            _token: vscode.CancellationToken
        ): Promise<vscode.LanguageModelToolResult> {
            const input = options.input;
            const workspace = getWorkspaceContext();

            logger.info('Graph definition requested', input);

            try {
                // Validate input
                const parsed = GraphDefinitionInputSchema.safeParse(input);
                if (!parsed.success) {
                    const envelope = createErrorEnvelope(
                        TOOLS.GRAPH_DEFINITION,
                        'INVALID_INPUT',
                        'Invalid input: ' + parsed.error.message,
                        workspace,
                        { errors: parsed.error.errors }
                    );
                    return envelopeToResult(envelope);
                }

                const { path, line, column } = parsed.data;
                const symbolService = getSymbolService();
                const col = column ?? 1;

                // Get definition
                const definitions = await symbolService.getDefinition(path, line, col);

                // Analyze definition locations
                const isSameFile = definitions.length > 0 &&
                    definitions.every(d => d.path === path);
                const isExternalPackage = definitions.length > 0 &&
                    definitions.some(d => d.path.includes('node_modules'));

                const result: DefinitionResult = {
                    source: { path, line, column: col },
                    definitions,
                    stats: {
                        count: definitions.length,
                        isSameFile,
                        isExternalPackage,
                    },
                };

                logger.debug('Definition found', {
                    path,
                    line,
                    count: definitions.length,
                });

                const envelope = createSuccessEnvelope(
                    TOOLS.GRAPH_DEFINITION,
                    result,
                    workspace,
                    {
                        truncated: false,
                        limits: {},
                        nextQuerySuggestion: definitions.length > 0
                            ? [{
                                tool: TOOLS.GRAPH_SYMBOLS,
                                args: { target: definitions[0].path, mode: 'document' },
                                reason: 'View all symbols in the definition file',
                            }]
                            : [{
                                tool: TOOLS.GRAPH_REFERENCES,
                                args: { path, line, column: col },
                                reason: 'No definition found - try finding references instead',
                            }],
                    }
                );
                return envelopeToResult(envelope);

            } catch (error) {
                logger.error('Graph definition error:', error);

                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                let errorCode = 'INTERNAL_ERROR';

                if (errorMessage.includes('ENOENT') || errorMessage.includes('not found')) {
                    errorCode = 'FILE_NOT_FOUND';
                } else if (errorMessage.includes('language server') || errorMessage.includes('provider')) {
                    errorCode = 'LSP_NOT_AVAILABLE';
                }

                const envelope = createErrorEnvelope(
                    TOOLS.GRAPH_DEFINITION,
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
