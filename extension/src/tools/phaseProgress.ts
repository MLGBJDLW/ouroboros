/**
 * ouroboros_phase_progress Tool Implementation
 * For displaying workflow phase progress
 */

import * as vscode from 'vscode';
import type { StateManager } from '../storage/stateManager';
import type { SidebarProvider } from '../webview/SidebarProvider';
import type { PhaseProgressInput, PhaseProgressOutput } from './types';
import { PhaseProgressInputSchema, validateInput } from './schemas';
import { createLogger } from '../utils/logger';

const logger = createLogger('PhaseProgressTool');

export function createPhaseProgressTool(
    stateManager: StateManager,
    sidebarProvider: SidebarProvider
): vscode.LanguageModelTool<PhaseProgressInput> {
    return {
        async invoke(
            options: vscode.LanguageModelToolInvocationOptions<PhaseProgressInput>,
            _token: vscode.CancellationToken
        ): Promise<vscode.LanguageModelToolResult> {
            const input = options.input;

            // Validate input
            const validation = validateInput(PhaseProgressInputSchema, input);
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

            logger.info('Phase progress tool invoked:', input);

            try {
                // Update workflow state
                await stateManager.updateWorkspaceState({
                    currentSpec: input.specName,
                    currentPhase: input.currentPhase,
                    workflowType: input.workflow,
                    totalPhases: input.totalPhases,
                    phaseStatus: input.status,
                });

                // Update sidebar view
                await sidebarProvider.updatePhaseProgress(validation.data);

                // Store interaction
                await stateManager.addInteraction({
                    type: 'phase_complete',
                    agentName: input.agentName ?? 'unknown',
                    agentLevel: (input.agentLevel as 0 | 1 | 2) ?? 0,
                    question: `${input.workflow}: Phase ${input.currentPhase}/${input.totalPhases}`,
                    response: input.status,
                    status: 'responded',
                    workflowContext: {
                        workflow: input.workflow,
                        specName: input.specName,
                        phase: input.currentPhase,
                    },
                });

                const output: PhaseProgressOutput = {
                    acknowledged: true,
                };

                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(JSON.stringify(output)),
                ]);
            } catch (error) {
                logger.error('Phase progress tool error:', error);

                // Show progress in status bar as fallback
                await showProgressInStatusBar(input);

                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(
                        JSON.stringify({
                            acknowledged: true,
                            fallback: true,
                        })
                    ),
                ]);
            }
        },
    };
}

/**
 * Show progress in status bar when webview is not available
 */
async function showProgressInStatusBar(
    input: PhaseProgressInput
): Promise<void> {
    const workflowIcon = input.workflow === 'spec' ? '$(checklist)' : '$(gear)';
    const progress = Math.round((input.currentPhase / input.totalPhases) * 100);

    vscode.window.setStatusBarMessage(
        `${workflowIcon} ${input.specName}: Phase ${input.currentPhase}/${input.totalPhases} (${progress}%) - ${input.status}`,
        5000
    );
}
