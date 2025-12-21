/**
 * ouroboros_plan_review Tool Implementation
 * For displaying plans/documents for user approval
 */

import * as vscode from 'vscode';
import type { StateManager } from '../storage/stateManager';
import type { SidebarProvider } from '../webview/SidebarProvider';
import type { PlanReviewInput, PlanReviewOutput } from './types';
import { PlanReviewInputSchema, validateInput } from './schemas';
import { createLogger } from '../utils/logger';

const logger = createLogger('PlanReviewTool');

export function createPlanReviewTool(
    stateManager: StateManager,
    sidebarProvider: SidebarProvider
): vscode.LanguageModelTool<PlanReviewInput> {
    return {
        async invoke(
            options: vscode.LanguageModelToolInvocationOptions<PlanReviewInput>,
            token: vscode.CancellationToken
        ): Promise<vscode.LanguageModelToolResult> {
            const input = options.input;

            // Validate input
            const validation = validateInput(PlanReviewInputSchema, input);
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

            logger.info('Plan review tool invoked:', {
                title: input.title,
                mode: input.mode,
            });

            try {
                // Create pending request
                const result = await sidebarProvider.createPlanReviewRequest(
                    validation.data,
                    token
                );

                // Store interaction
                await stateManager.addInteraction({
                    type: 'plan_review',
                    agentName: input.agentName ?? 'unknown',
                    agentLevel: (input.agentLevel as 0 | 1 | 2) ?? 0,
                    question: input.title ?? 'Plan Review',
                    response: result.timeout
                        ? ''
                        : result.approved
                          ? 'approved'
                          : (result.feedback ?? 'rejected'),
                    status: result.timeout
                        ? 'timeout'
                        : result.cancelled
                          ? 'cancelled'
                          : 'responded',
                });

                const output: PlanReviewOutput = {
                    approved: result.approved ?? false,
                    feedback: result.feedback,
                    cancelled: result.cancelled ?? false,
                    timeout: result.timeout,
                };

                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(JSON.stringify(output)),
                ]);
            } catch (error) {
                logger.error('Plan review tool error:', error);

                // Fallback to VS Code preview
                const fallbackResult = await fallbackToVSCodePreview(input, token);

                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(JSON.stringify(fallbackResult)),
                ]);
            }
        },
    };
}

/**
 * Fallback to VS Code's preview when webview is not available
 */
async function fallbackToVSCodePreview(
    input: PlanReviewInput,
    _token: vscode.CancellationToken
): Promise<PlanReviewOutput> {
    // Show plan in a temporary document
    const document = await vscode.workspace.openTextDocument({
        content: input.plan,
        language: 'markdown',
    });

    await vscode.window.showTextDocument(document, {
        preview: true,
        preserveFocus: false,
    });

    // Ask for approval
    const title = input.title ?? 'Plan Review';
    const modeLabel = input.mode === 'walkthrough' ? 'Walkthrough' : 'Approval';

    const result = await vscode.window.showInformationMessage(
        `${title}\n\nDo you approve this ${modeLabel.toLowerCase()}?`,
        { modal: true },
        'Approve',
        'Reject',
        'Request Changes'
    );

    if (result === undefined) {
        return {
            approved: false,
            cancelled: true,
        };
    }

    if (result === 'Request Changes') {
        const feedback = await vscode.window.showInputBox({
            prompt: 'What changes would you like?',
            placeHolder: 'Describe the changes you want...',
            ignoreFocusOut: true,
        });

        return {
            approved: false,
            feedback: feedback ?? undefined,
            cancelled: feedback === undefined,
        };
    }

    return {
        approved: result === 'Approve',
        cancelled: false,
    };
}
