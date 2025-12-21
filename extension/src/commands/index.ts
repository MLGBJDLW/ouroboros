/**
 * Command registration entry point
 */

import * as vscode from 'vscode';
import { COMMANDS } from '../constants';
import type { StateManager } from '../storage/stateManager';
import type { SidebarProvider } from '../webview/SidebarProvider';
import { createInitializeProjectCommand } from './initializeProject';
import { createOpenSidebarCommand } from './openSidebar';
import { createClearHistoryCommand } from './clearHistory';
import { createLogger } from '../utils/logger';

const logger = createLogger('Commands');

/**
 * Register all commands
 */
export function registerCommands(
    context: vscode.ExtensionContext,
    stateManager: StateManager,
    sidebarProvider: SidebarProvider
): vscode.Disposable[] {
    const disposables: vscode.Disposable[] = [];

    logger.info('Registering commands...');

    // Register initialize project command
    disposables.push(
        vscode.commands.registerCommand(
            COMMANDS.INITIALIZE_PROJECT,
            createInitializeProjectCommand(context, () => {
                // Trigger UI refresh after successful initialization
                sidebarProvider.postMessage({ type: 'refresh' });
            })
        )
    );
    logger.info(`Registered command: ${COMMANDS.INITIALIZE_PROJECT}`);

    // Register open sidebar command
    disposables.push(
        vscode.commands.registerCommand(COMMANDS.OPEN_SIDEBAR, createOpenSidebarCommand())
    );
    logger.info(`Registered command: ${COMMANDS.OPEN_SIDEBAR}`);

    // Register clear history command
    disposables.push(
        vscode.commands.registerCommand(
            COMMANDS.CLEAR_HISTORY,
            createClearHistoryCommand(stateManager, sidebarProvider)
        )
    );
    logger.info(`Registered command: ${COMMANDS.CLEAR_HISTORY}`);

    // Register cancel current request command
    disposables.push(
        vscode.commands.registerCommand(COMMANDS.CANCEL_CURRENT_REQUEST, () => {
            const cancelled = sidebarProvider.cancelCurrentRequest();
            if (!cancelled) {
                vscode.window.showInformationMessage('No active request to cancel.');
            }
        })
    );
    logger.info(`Registered command: ${COMMANDS.CANCEL_CURRENT_REQUEST}`);

    logger.info('All commands registered');

    return disposables;
}
