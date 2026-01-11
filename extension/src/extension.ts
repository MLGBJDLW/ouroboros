import * as vscode from 'vscode';
import { EXTENSION_ID } from './constants';
import { registerTools } from './tools';
import { SidebarProvider } from './webview/SidebarProvider';
import { registerCommands } from './commands';
import { StateManager } from './storage/stateManager';
import { StatusBarManager } from './statusBar/StatusBarManager';
import { SpecWatcher } from './services/specWatcher';
import { CodeGraphManager } from './codeGraph/CodeGraphManager';
import { createLogger } from './utils/logger';

const logger = createLogger('Extension');

let stateManager: StateManager | undefined;
let statusBarManager: StatusBarManager | undefined;
let sidebarProvider: SidebarProvider | undefined;
let specWatcher: SpecWatcher | undefined;
let codeGraphManager: CodeGraphManager | undefined;

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

        // Initialize spec watcher for file-based workflow tracking
        specWatcher = new SpecWatcher();
        context.subscriptions.push(specWatcher);

        // Set spec watcher reference in sidebar provider for workspace switching
        sidebarProvider.setSpecWatcher(specWatcher);

        // Register spec change listener BEFORE starting the watcher
        // This ensures we capture subsequent changes (not initial scan)
        specWatcher.onSpecChange(async (specs) => {
            logger.info('SpecWatcher fired onSpecChange', {
                activeCount: specs.active.length,
                archivedCount: specs.archived.length,
            });
            await stateManager?.updateWorkspaceState({
                activeSpecs: specs.active,
                archivedSpecs: specs.archived,
            });
            logger.info('StateManager updated with specs');
        });

        // Start watching the first workspace folder (triggers initial scan)
        // We await the initial scan and update state synchronously to ensure
        // specs are available before webview sends 'ready' message
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            const savedPath = stateManager.getWorkspaceState().selectedWorkspacePath;
            const workspacePath = savedPath ?? workspaceFolders[0].uri.fsPath;
            logger.debug('Starting spec watcher', { savedPath, workspacePath });
            const initialSpecs = await specWatcher.start(workspacePath);
            // Ensure state is updated synchronously with initial scan results
            await stateManager.updateWorkspaceState({
                activeSpecs: initialSpecs.active,
                archivedSpecs: initialSpecs.archived,
            });
            logger.debug('Initial specs loaded', {
                activeCount: initialSpecs.active.length,
                archivedCount: initialSpecs.archived.length,
            });

            // Initialize Code Graph Manager
            codeGraphManager = new CodeGraphManager(workspacePath);
            context.subscriptions.push(codeGraphManager);
            // Set reference in sidebar provider
            sidebarProvider.setCodeGraphManager(codeGraphManager);
            // Initialize asynchronously (don't block activation)
            codeGraphManager.initialize().catch((error) => {
                logger.error('Failed to initialize Code Graph:', error);
            });
        }

        // Register LM Tools (including Code Graph tools)
        const toolDisposables = registerTools(stateManager, sidebarProvider, codeGraphManager);
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
    specWatcher?.dispose();
    codeGraphManager?.dispose();
    sidebarProvider?.dispose();
    stateManager?.dispose();

    logger.info(`${EXTENSION_ID} extension deactivated`);
}
