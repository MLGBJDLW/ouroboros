/**
 * Initialize Project Command
 * Fetches prompts from GitHub and transforms them for Extension mode
 */

import * as vscode from 'vscode';
import { createLogger } from '../utils/logger';
import {
    fetchAndTransformPrompts,
    createOuroborosStructure,
} from '../utils/promptTransformer';

const logger = createLogger('InitializeProject');

/**
 * Create the initialize project command handler
 */
export function createInitializeProjectCommand(
    context: vscode.ExtensionContext,
    onSuccess?: () => void
): () => Promise<void> {
    return async () => {
        logger.info('Initializing Ouroboros project...');

        // Check if workspace is open
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage(
                'Please open a workspace folder to initialize Ouroboros.'
            );
            return;
        }

        // If multiple workspaces, let user choose
        let workspaceRoot: vscode.Uri;
        if (workspaceFolders.length > 1) {
            const selected = await vscode.window.showWorkspaceFolderPick({
                placeHolder: 'Select workspace folder to initialize Ouroboros',
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
                title: 'Initializing Ouroboros',
                cancellable: false,
            },
            async (progress) => {
                try {
                    // Step 1: Fetch and transform prompts from GitHub
                    progress.report({ message: 'Fetching prompts from GitHub...' });
                    const { success, failed } = await fetchAndTransformPrompts(
                        workspaceRoot,
                        progress
                    );

                    // Step 2: Create .ouroboros structure
                    progress.report({ message: 'Creating project structure...' });
                    await createOuroborosStructure(workspaceRoot);

                    // Show result
                    if (failed === 0) {
                        vscode.window.showInformationMessage(
                            `Ouroboros initialized successfully! ${success} files created.`
                        );
                    } else {
                        vscode.window.showWarningMessage(
                            `Ouroboros initialized with ${success} files. ${failed} files failed to fetch.`
                        );
                    }

                    logger.info(`Project initialization complete: ${success} success, ${failed} failed`);

                    // Notify callback of success to refresh UI
                    onSuccess?.();
                } catch (error) {
                    logger.error('Failed to initialize project:', error);
                    vscode.window.showErrorMessage(
                        `Failed to initialize Ouroboros project: ${error}`
                    );
                }
            }
        );
    };
}
