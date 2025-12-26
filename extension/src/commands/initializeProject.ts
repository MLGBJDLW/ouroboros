/**
 * Initialize Project Command
 * Fetches prompts from GitHub and transforms them for Extension mode
 */

import * as vscode from 'vscode';
import { createLogger } from '../utils/logger';
import { fetchAndTransformPrompts, createOuroborosStructure } from '../utils/promptTransformer';

const logger = createLogger('InitializeProject');

/**
 * Create the initialize project command handler
 * @param context Extension context
 * @param onSuccess Callback when initialization succeeds, receives the workspace path
 */
export function createInitializeProjectCommand(
    context: vscode.ExtensionContext,
    onSuccess?: (workspacePath?: string) => void
): (targetPath?: string) => Promise<void> {
    return async (targetPath?: string) => {
        logger.info('Initializing Ouroboros project...', { targetPath });

        // Check if workspace is open
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage(
                'Please open a workspace folder to initialize Ouroboros.'
            );
            return;
        }

        // Determine workspace root
        let workspaceRoot: vscode.Uri;
        
        if (targetPath) {
            // Use provided path (from Welcome page selection)
            const targetFolder = workspaceFolders.find(f => f.uri.fsPath === targetPath);
            if (targetFolder) {
                workspaceRoot = targetFolder.uri;
            } else {
                // Fallback to first workspace if path not found
                workspaceRoot = workspaceFolders[0].uri;
            }
        } else if (workspaceFolders.length > 1) {
            // No path provided and multiple workspaces - let user choose
            const selected = await vscode.window.showWorkspaceFolderPick({
                placeHolder: 'Select workspace folder to initialize Ouroboros',
            });
            if (!selected) {
                return;
            }
            workspaceRoot = selected.uri;
        } else {
            // Single workspace
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

                    logger.info(
                        `Project initialization complete: ${success} success, ${failed} failed`
                    );

                    // Notify callback of success to refresh UI, passing the workspace path
                    onSuccess?.(workspaceRoot.fsPath);
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
