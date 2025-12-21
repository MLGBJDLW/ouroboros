/**
 * ouroboros_agent_handoff Tool Implementation
 * For notifying agent hierarchy changes
 */

import * as vscode from 'vscode';
import type { StateManager } from '../storage/stateManager';
import type { SidebarProvider } from '../webview/SidebarProvider';
import type { HandoffInput, HandoffOutput } from './types';
import { HandoffInputSchema, validateInput } from './schemas';
import { createLogger } from '../utils/logger';

const logger = createLogger('HandoffTool');

export function createHandoffTool(
    stateManager: StateManager,
    sidebarProvider: SidebarProvider
): vscode.LanguageModelTool<HandoffInput> {
    return {
        async invoke(
            options: vscode.LanguageModelToolInvocationOptions<HandoffInput>,
            _token: vscode.CancellationToken
        ): Promise<vscode.LanguageModelToolResult> {
            const input = options.input;

            // Validate input
            const validation = validateInput(HandoffInputSchema, input);
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

            logger.info('Agent handoff tool invoked:', input);

            try {
                // Update sidebar with handoff info
                await sidebarProvider.updateAgentHandoff(validation.data);

                // Log the handoff
                const direction = input.toLevel > input.fromLevel ? 'down' : 'up';
                logger.info(
                    `Agent handoff ${direction}: ${input.from} (L${input.fromLevel}) → ${input.to} (L${input.toLevel})`
                );

                const output: HandoffOutput = {
                    acknowledged: true,
                };

                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(JSON.stringify(output)),
                ]);
            } catch (error) {
                logger.error('Agent handoff tool error:', error);

                // Show handoff in status bar as fallback
                await showHandoffInStatusBar(input);

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
 * Show handoff in status bar when webview is not available
 */
async function showHandoffInStatusBar(input: HandoffInput): Promise<void> {
    const arrow = input.toLevel > input.fromLevel ? '→' : '←';
    const reason = input.reason ? ` (${input.reason})` : '';

    vscode.window.setStatusBarMessage(
        `$(organization) ${input.from} ${arrow} ${input.to}${reason}`,
        5000
    );
}
