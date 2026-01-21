/**
 * Graph Call Hierarchy Tool
 * LM Tool for getting call hierarchy of a function
 * 
 * Uses VS Code LSP CallHierarchyProvider:
 * - Incoming calls: who calls this function
 * - Outgoing calls: what this function calls
 * - Essential for impact analysis and refactoring
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
import { getSymbolService, type CallHierarchyInfo } from '../lsp';

const logger = createLogger('GraphCallHierarchyTool');

export const GraphCallHierarchyInputSchema = z.object({
    path: z
        .string()
        .describe('File path containing the function'),
    line: z
        .number()
        .min(1)
        .describe('Line number of the function (1-indexed)'),
    column: z
        .number()
        .min(1)
        .optional()
        .describe('Column number (1-indexed, default: first non-whitespace)'),
    direction: z
        .enum(['incoming', 'outgoing', 'both'])
        .optional()
        .describe('incoming: callers, outgoing: callees, both: all (default: both)'),
    limit: z
        .number()
        .min(1)
        .max(50)
        .optional()
        .describe('Max items per direction (1-50, default: 20)'),
});

export type GraphCallHierarchyInput = z.infer<typeof GraphCallHierarchyInputSchema>;

interface CallHierarchyToolResult {
    target: {
        path: string;
        line: number;
        column: number;
    };
    item: CallHierarchyInfo | null;
    callers: Array<{
        from: CallHierarchyInfo;
        callSites: Array<{ line: number; column: number }>;
    }>;
    callees: Array<{
        to: CallHierarchyInfo;
        callSites: Array<{ line: number; column: number }>;
    }>;
    stats: {
        callerCount: number;
        calleeCount: number;
        uniqueCallerFiles: number;
        uniqueCalleeFiles: number;
    };
}

export function createGraphCallHierarchyTool(): vscode.LanguageModelTool<GraphCallHierarchyInput> {
    return {
        async invoke(
            options: vscode.LanguageModelToolInvocationOptions<GraphCallHierarchyInput>,
            _token: vscode.CancellationToken
        ): Promise<vscode.LanguageModelToolResult> {
            const input = options.input;
            const workspace = getWorkspaceContext();

            logger.info('Graph call hierarchy requested', input);

            try {
                // Validate input
                const parsed = GraphCallHierarchyInputSchema.safeParse(input);
                if (!parsed.success) {
                    const envelope = createErrorEnvelope(
                        TOOLS.GRAPH_CALL_HIERARCHY,
                        'INVALID_INPUT',
                        'Invalid input: ' + parsed.error.message,
                        workspace,
                        { errors: parsed.error.errors }
                    );
                    return envelopeToResult(envelope);
                }

                const { path, line, column, direction, limit } = parsed.data;
                const symbolService = getSymbolService();
                const col = column ?? 1;
                const dir = direction ?? 'both';
                const maxItems = limit ?? 20;

                // Get call hierarchy
                const hierarchy = await symbolService.getCallHierarchy(path, line, col, {
                    direction: dir,
                });

                if (!hierarchy) {
                    // Call hierarchy not available for this location
                    const envelope = createSuccessEnvelope(
                        TOOLS.GRAPH_CALL_HIERARCHY,
                        {
                            target: { path, line, column: col },
                            item: null,
                            callers: [],
                            callees: [],
                            stats: {
                                callerCount: 0,
                                calleeCount: 0,
                                uniqueCallerFiles: 0,
                                uniqueCalleeFiles: 0,
                            },
                            message: 'Call hierarchy not available at this location. Make sure the cursor is on a function or method.',
                        },
                        workspace,
                        {
                            truncated: false,
                            limits: {},
                            nextQuerySuggestion: [{
                                tool: TOOLS.GRAPH_SYMBOLS,
                                args: { target: path, mode: 'document', kindFilter: ['function', 'method'] },
                                reason: 'Find functions in this file to analyze',
                            }],
                        }
                    );
                    return envelopeToResult(envelope);
                }

                // Apply limits
                const callers = hierarchy.callers.slice(0, maxItems);
                const callees = hierarchy.callees.slice(0, maxItems);

                // Count unique files
                const uniqueCallerFiles = new Set(callers.map(c => c.from.path)).size;
                const uniqueCalleeFiles = new Set(callees.map(c => c.to.path)).size;

                const result: CallHierarchyToolResult = {
                    target: { path, line, column: col },
                    item: hierarchy.item,
                    callers,
                    callees,
                    stats: {
                        callerCount: hierarchy.callers.length,
                        calleeCount: hierarchy.callees.length,
                        uniqueCallerFiles,
                        uniqueCalleeFiles,
                    },
                };

                logger.debug('Call hierarchy retrieved', {
                    path,
                    line,
                    callers: result.stats.callerCount,
                    callees: result.stats.calleeCount,
                });

                // Determine next query suggestion
                let nextSuggestion;
                if (result.stats.callerCount > 5) {
                    nextSuggestion = [{
                        tool: TOOLS.GRAPH_IMPACT,
                        args: { target: path },
                        reason: `${result.stats.callerCount} callers - analyze full impact`,
                    }];
                } else if (result.stats.calleeCount > 0) {
                    const firstCallee = callees[0];
                    nextSuggestion = [{
                        tool: TOOLS.GRAPH_CALL_HIERARCHY,
                        args: { path: firstCallee.to.path, line: firstCallee.to.line },
                        reason: `Trace callees: explore ${firstCallee.to.name}`,
                    }];
                }

                const envelope = createSuccessEnvelope(
                    TOOLS.GRAPH_CALL_HIERARCHY,
                    result,
                    workspace,
                    {
                        truncated: hierarchy.callers.length > maxItems || hierarchy.callees.length > maxItems,
                        limits: { limit: maxItems },
                        nextQuerySuggestion: nextSuggestion,
                    }
                );
                return envelopeToResult(envelope);

            } catch (error) {
                logger.error('Graph call hierarchy error:', error);

                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                let errorCode = 'INTERNAL_ERROR';

                if (errorMessage.includes('ENOENT') || errorMessage.includes('not found')) {
                    errorCode = 'FILE_NOT_FOUND';
                } else if (errorMessage.includes('language server') || errorMessage.includes('provider')) {
                    errorCode = 'LSP_NOT_AVAILABLE';
                }

                const envelope = createErrorEnvelope(
                    TOOLS.GRAPH_CALL_HIERARCHY,
                    errorCode,
                    errorMessage,
                    workspace,
                    {
                        suggestion: errorCode === 'LSP_NOT_AVAILABLE'
                            ? 'Call hierarchy requires language server support. TypeScript/JavaScript files should work. Try opening the file first.'
                            : undefined
                    }
                );
                return envelopeToResult(envelope);
            }
        },
    };
}
