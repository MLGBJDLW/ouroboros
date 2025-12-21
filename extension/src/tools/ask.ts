/**
 * ouroboros_ask Tool Implementation
 * Covers CCL Types: A (TASK), A+Q (TASK+Q), C (FEATURE), E (QUESTION)
 */

import * as vscode from 'vscode';
import type { StateManager } from '../storage/stateManager';
import type { SidebarProvider } from '../webview/SidebarProvider';
import type { AskInput, AskOutput } from './types';
import { AskInputSchema, validateInput } from './schemas';
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

                const output: AskOutput = {
                    response: result.response ?? '',
                    cancelled: result.cancelled ?? false,
                    timeout: result.timeout,
                };

                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(JSON.stringify(output)),
                ]);
            } catch (error) {
                logger.error('Ask tool error:', error);

                // Fallback to VS Code input box
                const fallbackResult = await fallbackToVSCodeInput(input, token);

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
