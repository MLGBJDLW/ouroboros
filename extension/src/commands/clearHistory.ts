/**
 * Clear History Command
 */

import * as vscode from 'vscode';
import type { StateManager } from '../storage/stateManager';
import type { SidebarProvider } from '../webview/SidebarProvider';
import { createLogger } from '../utils/logger';

const logger = createLogger('ClearHistory');

/**
 * Create the clear history command handler
 */
export function createClearHistoryCommand(
    stateManager: StateManager,
    sidebarProvider: SidebarProvider
): () => Promise<void> {
    return async () => {
        logger.info('Clearing interaction history...');

        // Confirm with user
        const confirmed = await vscode.window.showWarningMessage(
            'Are you sure you want to clear all interaction history?',
            { modal: true },
            'Clear History'
        );

        if (confirmed !== 'Clear History') {
            logger.info('Clear history cancelled by user');
            return;
        }

        try {
            await stateManager.clearHistory();

            // Notify webview
            sidebarProvider.postMessage({
                type: 'historyUpdate',
                payload: [],
            });

            vscode.window.showInformationMessage('Interaction history cleared.');
            logger.info('History cleared successfully');
        } catch (error) {
            logger.error('Failed to clear history:', error);
            vscode.window.showErrorMessage('Failed to clear interaction history.');
        }
    };
}
