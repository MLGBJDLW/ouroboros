import * as vscode from 'vscode';
import { EXTENSION_ID } from './constants';
import { registerTools } from './tools';
import { SidebarProvider } from './webview/SidebarProvider';
import { registerCommands } from './commands';
import { StateManager } from './storage/stateManager';
import { StatusBarManager } from './statusBar/StatusBarManager';
import { createLogger } from './utils/logger';

const logger = createLogger('Extension');

let stateManager: StateManager | undefined;
let statusBarManager: StatusBarManager | undefined;
let sidebarProvider: SidebarProvider | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    logger.info(`Activating ${EXTENSION_ID} extension...`);

    try {
        // Initialize state manager
        stateManager = new StateManager(context);
        await stateManager.initialize();

        // Initialize sidebar provider
        sidebarProvider = new SidebarProvider(context.extensionUri, stateManager);

        // Register sidebar view
        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider('ouroboros.sidebarView', sidebarProvider, {
                webviewOptions: {
                    retainContextWhenHidden: true,
                },
            })
        );

        // Register LM Tools
        const toolDisposables = registerTools(stateManager, sidebarProvider);
        context.subscriptions.push(...toolDisposables);

        // Register commands
        const commandDisposables = registerCommands(context, stateManager, sidebarProvider);
        context.subscriptions.push(...commandDisposables);

        // Initialize status bar
        statusBarManager = new StatusBarManager(stateManager);
        context.subscriptions.push(statusBarManager);

        logger.info(`${EXTENSION_ID} extension activated successfully`);
    } catch (error) {
        logger.error('Failed to activate extension:', error);
        throw error;
    }
}

export function deactivate(): void {
    logger.info(`Deactivating ${EXTENSION_ID} extension...`);

    statusBarManager?.dispose();
    sidebarProvider?.dispose();
    stateManager?.dispose();

    logger.info(`${EXTENSION_ID} extension deactivated`);
}
