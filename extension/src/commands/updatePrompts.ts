/**
 * Update Prompts Command
 * Smart updates prompts while preserving user YAML customizations
 */

import * as vscode from 'vscode';
import { createLogger } from '../utils/logger';
import { smartUpdatePrompts } from '../utils/promptTransformer';
import { checkPromptsVersion } from '../utils/versionService';

const logger = createLogger('UpdatePrompts');

/**
 * Create the update prompts command handler
 */
export function createUpdatePromptsCommand(
    context: vscode.ExtensionContext,
    onSuccess?: () => void
): () => Promise<void> {
    return async () => {
        logger.info('Updating Ouroboros prompts...');

        // Check if workspace is open
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage(
                'Please open a workspace folder to update prompts.'
            );
            return;
        }

        // If multiple workspaces, let user choose
        let workspaceRoot: vscode.Uri;
        if (workspaceFolders.length > 1) {
            const selected = await vscode.window.showWorkspaceFolderPick({
                placeHolder: 'Select workspace folder to update prompts',
            });
            if (!selected) {
                return;
            }
            workspaceRoot = selected.uri;
        } else {
            workspaceRoot = workspaceFolders[0].uri;
        }

        // Show progress
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Updating Ouroboros Prompts',
                cancellable: false,
            },
            async (progress) => {
                try {
                    // Run smart update
                    progress.report({ message: 'Fetching latest prompts...' });
                    const { updated, created, failed } = await smartUpdatePrompts(
                        workspaceRoot,
                        progress
                    );

                    // Show result
                    if (failed === 0) {
                        vscode.window.showInformationMessage(
                            `Prompts updated successfully! ${updated} updated, ${created} created. Your custom tools have been preserved.`
                        );
                    } else {
                        vscode.window.showWarningMessage(
                            `Prompts update completed with ${updated} updated, ${created} created, ${failed} failed.`
                        );
                    }

                    logger.info(
                        `Prompts update complete: ${updated} updated, ${created} created, ${failed} failed`
                    );

                    // Notify callback of success to refresh UI
                    onSuccess?.();
                } catch (error) {
                    logger.error('Failed to update prompts:', error);
                    vscode.window.showErrorMessage(
                        `Failed to update prompts: ${error}`
                    );
                }
            }
        );
    };
}

/**
 * Create the check prompts version command handler
 */
export function createCheckPromptsVersionCommand(
    context: vscode.ExtensionContext
): () => Promise<void> {
    return async () => {
        logger.info('Checking prompts version...');

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Checking for updates',
                cancellable: false,
            },
            async () => {
                try {
                    const versionInfo = await checkPromptsVersion();

                    if (versionInfo.isOutdated) {
                        const action = await vscode.window.showInformationMessage(
                            `Update available! Local: v${versionInfo.localVersion}, Remote: v${versionInfo.remoteVersion}`,
                            'Update Now',
                            'Later'
                        );
                        if (action === 'Update Now') {
                            await vscode.commands.executeCommand('ouroboros.updatePrompts');
                        }
                    } else {
                        vscode.window.showInformationMessage(
                            `Prompts are up to date (v${versionInfo.localVersion})`
                        );
                    }
                } catch (error) {
                    logger.error('Failed to check version:', error);
                    vscode.window.showErrorMessage(
                        `Failed to check version: ${error}`
                    );
                }
            }
        );
    };
}
