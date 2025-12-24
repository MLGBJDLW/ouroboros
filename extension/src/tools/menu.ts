/**
 * ouroboros_menu Tool Implementation
 * Covers CCL Type: B (MENU)
 */

import * as vscode from 'vscode';
import type { StateManager } from '../storage/stateManager';
import type { SidebarProvider } from '../webview/SidebarProvider';
import type { MenuInput, MenuOutput } from './types';
import { MenuInputSchema, validateInput } from './schemas';
import { buildToolResult } from './attachmentHelper';
import { createLogger } from '../utils/logger';

const logger = createLogger('MenuTool');

export function createMenuTool(
    stateManager: StateManager,
    sidebarProvider: SidebarProvider
): vscode.LanguageModelTool<MenuInput> {
    return {
        async invoke(
            options: vscode.LanguageModelToolInvocationOptions<MenuInput>,
            token: vscode.CancellationToken
        ): Promise<vscode.LanguageModelToolResult> {
            const input = options.input;

            // Validate input
            const validation = validateInput(MenuInputSchema, input);
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

            logger.info('Menu tool invoked:', input);

            try {
                // Create pending request
                const result = await sidebarProvider.createMenuRequest(validation.data, token);

                // Store interaction
                await stateManager.addInteraction({
                    type: 'menu',
                    agentName: input.agentName ?? 'unknown',
                    agentLevel: (input.agentLevel as 0 | 1 | 2) ?? 0,
                    question: input.question,
                    response: result.selectedOption ?? '',
                    status: result.timeout
                        ? 'timeout'
                        : result.cancelled
                          ? 'cancelled'
                          : 'responded',
                });

                const output: MenuOutput = {
                    selectedIndex: result.selectedIndex ?? -1,
                    selectedOption: result.selectedOption || (result.attachments?.length ? '[See attached image(s)]' : ''),
                    isCustom: result.isCustom ?? false,
                    cancelled: result.cancelled ?? false,
                    timeout: result.timeout,
                    attachments: result.attachments,
                };

                return buildToolResult(output, result.attachments);
            } catch (error) {
                logger.error('Menu tool error:', error);

                // Fallback to VS Code quick pick
                const fallbackResult = await fallbackToVSCodeQuickPick(input, token);

                return new vscode.LanguageModelToolResult([
                    new vscode.LanguageModelTextPart(JSON.stringify(fallbackResult)),
                ]);
            }
        },
    };
}

/**
 * Fallback to VS Code's built-in quick pick when webview is not available
 */
async function fallbackToVSCodeQuickPick(
    input: MenuInput,
    token: vscode.CancellationToken
): Promise<MenuOutput> {
    const items: vscode.QuickPickItem[] = input.options.map((option, index) => ({
        label: `${index + 1}. ${option}`,
        description: '',
        detail: option,
    }));

    if (input.allowCustom) {
        items.push({
            label: '$(edit) Custom input...',
            description: 'Enter a custom response',
            alwaysShow: true,
        });
    }

    const selected = await vscode.window.showQuickPick(items, {
        title: input.question,
        placeHolder: 'Select an option',
        ignoreFocusOut: true,
        canPickMany: false,
    });

    if (!selected) {
        return {
            selectedIndex: -1,
            selectedOption: '',
            isCustom: false,
            cancelled: true,
        };
    }

    // Check if custom input was selected
    if (selected.label.startsWith('$(edit)')) {
        const customInput = await vscode.window.showInputBox(
            {
                prompt: 'Enter your custom response',
                ignoreFocusOut: true,
            },
            token
        );

        return {
            selectedIndex: -1,
            selectedOption: customInput ?? '',
            isCustom: true,
            cancelled: customInput === undefined,
        };
    }

    const selectedIndex = items.indexOf(selected);
    return {
        selectedIndex,
        selectedOption: input.options[selectedIndex] ?? '',
        isCustom: false,
        cancelled: false,
    };
}
