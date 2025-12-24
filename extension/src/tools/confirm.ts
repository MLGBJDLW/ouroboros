/**
 * ouroboros_confirm Tool Implementation
 * Covers CCL Type: D (CONFIRM)
 */

import * as vscode from 'vscode';
import type { StateManager } from '../storage/stateManager';
import type { SidebarProvider } from '../webview/SidebarProvider';
import type { ConfirmInput, ConfirmOutput } from './types';
import { ConfirmInputSchema, validateInput } from './schemas';
import { buildToolResult } from './attachmentHelper';
import { createLogger } from '../utils/logger';

const logger = createLogger('ConfirmTool');

export function createConfirmTool(
    stateManager: StateManager,
    sidebarProvider: SidebarProvider
): vscode.LanguageModelTool<ConfirmInput> {
    return {
        async invoke(
            options: vscode.LanguageModelToolInvocationOptions<ConfirmInput>,
            token: vscode.CancellationToken
        ): Promise<vscode.LanguageModelToolResult> {
            const input = options.input;

            // Validate input
            const validation = validateInput(ConfirmInputSchema, input);
            if (!validation.success) {
                logger.error('Invalid input:', validation.error);
                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify({
                            success: false,
                            error: validation.error,
                        })
                    ),
                ]);
            }

            logger.info('Confirm tool invoked:', input);

            try {
                // Create pending request
                const result = await sidebarProvider.createConfirmRequest(validation.data, token);

                // Store interaction
                await stateManager.addInteraction({
                    type: 'confirm',
                    agentName: input.agentName ?? 'unknown',
                    agentLevel: (input.agentLevel as 0 | 1 | 2) ?? 0,
                    question: input.question,
                    response: result.timeout ? '' : result.confirmed ? 'yes' : 'no',
                    status: result.timeout
                        ? 'timeout'
                        : result.cancelled
                          ? 'cancelled'
                          : 'responded',
                });

                const output: ConfirmOutput = {
                    confirmed: result.confirmed ?? false,
                    cancelled: result.cancelled ?? false,
                    timeout: result.timeout,
                    customResponse: result.customResponse,
                    isCustom: result.isCustom,
                    attachments: result.attachments,
                };

                return buildToolResult(output, result.attachments);
            } catch (error) {
                logger.error('Confirm tool error:', error);

                // Fallback to VS Code message box
                const fallbackResult = await fallbackToVSCodeConfirm(input, token);

                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(JSON.stringify(fallbackResult)),
                ]);
            }
        },
    };
}

/**
 * Fallback to VS Code's built-in message box when webview is not available
 */
async function fallbackToVSCodeConfirm(
    input: ConfirmInput,
    _token: vscode.CancellationToken
): Promise<ConfirmOutput> {
    const yesLabel = input.yesLabel ?? 'Yes';
    const noLabel = input.noLabel ?? 'No';

    const result = await vscode.window.showInformationMessage(
        input.question,
        { modal: true },
        yesLabel,
        noLabel
    );

    if (result === undefined) {
        return {
            confirmed: false,
            cancelled: true,
        };
    }

    return {
        confirmed: result === yesLabel,
        cancelled: false,
    };
}
