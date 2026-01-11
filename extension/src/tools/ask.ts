/**
 * ouroboros_ask Tool Implementation
 * Covers CCL Types: A (TASK), A+Q (TASK+Q), C (FEATURE), E (QUESTION)
 */

import * as vscode from 'vscode';
import type { StateManager } from '../storage/stateManager';
import type { SidebarProvider } from '../webview/SidebarProvider';
import type { AskInput, AskOutput } from './types';
import { AskInputSchema, validateInput } from './schemas';
import { buildToolResult } from './attachmentHelper';
import { createLogger } from '../utils/logger';

const logger = createLogger('AskTool');

export function createAskTool(
    stateManager: StateManager,
    sidebarProvider: SidebarProvider
): vscode.LanguageModelTool<AskInput> {
    return {
        async invoke(
            options: vscode.LanguageModelToolInvocationOptions<AskInput>,
            token: vscode.CancellationToken
        ): Promise<vscode.LanguageModelToolResult> {
            const input = options.input;

            // Validate input
            const validation = validateInput(AskInputSchema, input);
            if (!validation.success) {
                logger.error('Invalid input:', validation.error);
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify({
                            success: false,
                            error: validation.error,
                        } satisfies { success: boolean; error: string })
                    ),
                ]);
            }

            logger.info('Ask tool invoked:', input);

            try {
                // Create pending request
                const result = await sidebarProvider.createAskRequest(validation.data, token);

                logger.debug('Ask result received:', JSON.stringify({
                    response: result.response,
                    attachmentsCount: result.attachments?.length ?? 0,
                    attachments: result.attachments?.map(a => ({ name: a.name, type: a.type, size: a.size })),
                }));

                // Consume graph context and include in response
                const graphContext = sidebarProvider.consumeGraphContext();
                
                // Store interaction
                await stateManager.addInteraction({
                    type: 'ask',
                    agentName: input.agentName ?? 'unknown',
                    agentLevel: (input.agentLevel as 0 | 1 | 2) ?? 0,
                    question: input.question,
                    response: result.response ?? '',
                    status: result.timeout
                        ? 'timeout'
                        : result.cancelled
                          ? 'cancelled'
                          : 'responded',
                });

                // Build response with graph context if present
                let responseText = result.response || '';
                if (graphContext.length > 0) {
                    const contextSummary = graphContext.map(ctx => {
                        if (ctx.type === 'graph_digest') {
                            return '[Code Graph Digest attached]';
                        } else if (ctx.type === 'graph_issue') {
                            const issue = ctx.data as { file: string; kind: string };
                            return `[Issue: ${issue.kind} in ${issue.file}]`;
                        } else if (ctx.type === 'graph_hotspot') {
                            const hotspot = ctx.data as { path: string };
                            return `[Hotspot: ${hotspot.path}]`;
                        }
                        return `[${ctx.type}]`;
                    }).join(' ');
                    responseText = responseText ? `${responseText}\n\n${contextSummary}` : contextSummary;
                }

                const output: AskOutput = {
                    response: responseText || (result.attachments?.length ? '[See attached image(s)]' : ''),
                    cancelled: result.cancelled ?? false,
                    timeout: result.timeout,
                    attachments: result.attachments,
                    graphContext: graphContext.length > 0 ? graphContext : undefined,
                };

                return buildToolResult(output, result.attachments);
            } catch (error) {
                logger.error('Ask tool error:', error);

                // Fallback to VS Code input box
                const fallbackResult = await fallbackToVSCodeInput(input, token);

                // Store interaction for fallback path too
                await stateManager.addInteraction({
                    type: 'ask',
                    agentName: input.agentName ?? 'unknown',
                    agentLevel: (input.agentLevel as 0 | 1 | 2) ?? 0,
                    question: input.question,
                    response: fallbackResult.response ?? '',
                    status: fallbackResult.cancelled ? 'cancelled' : 'responded',
                });

                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(JSON.stringify(fallbackResult)),
                ]);
            }
        },
    };
}

/**
 * Fallback to VS Code's built-in input box when webview is not available
 */
async function fallbackToVSCodeInput(
    input: AskInput,
    token: vscode.CancellationToken
): Promise<AskOutput> {
    const prompt = input.question ?? getDefaultPrompt(input.type);
    const placeholder = input.inputLabel ?? getDefaultPlaceholder(input.type);

    const response = await vscode.window.showInputBox(
        {
            prompt,
            placeHolder: placeholder,
            ignoreFocusOut: true,
        },
        token
    );

    return {
        response: response ?? '',
        cancelled: response === undefined,
    };
}

function getDefaultPrompt(type?: 'task' | 'question' | 'feature'): string {
    switch (type) {
        case 'task':
            return 'What would you like me to do?';
        case 'feature':
            return 'Describe the feature you want to implement:';
        case 'question':
            return 'Please answer the following question:';
        default:
            return 'Please provide your input:';
    }
}

function getDefaultPlaceholder(type?: 'task' | 'question' | 'feature'): string {
    switch (type) {
        case 'task':
            return 'Enter your task...';
        case 'feature':
            return 'Describe the feature...';
        case 'question':
            return 'Your answer...';
        default:
            return 'Enter your response...';
    }
}
