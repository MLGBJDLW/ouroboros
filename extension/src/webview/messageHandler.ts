/**
 * Webview message handler
 */

import { createLogger } from '../utils/logger';
import { CONFIG } from '../constants';
import type { SidebarProvider } from './SidebarProvider';
import type { StateManager } from '../storage/stateManager';
import type { SpecWatcher } from '../services/specWatcher';

const logger = createLogger('MessageHandler');

interface WebviewMessage {
    type: string;
    payload?: unknown;
}

interface ResponsePayload {
    requestId: string;
    response: unknown;
}

/**
 * Workspace info for multi-root workspace support
 */
export interface WorkspaceInfo {
    name: string;
    path: string;
    isInitialized: boolean;
}

/**
 * Get info for all workspace folders
 */
async function getWorkspacesInfo(): Promise<WorkspaceInfo[]> {
    const vscode = await import('vscode');
    const folders = vscode.workspace.workspaceFolders || [];

    return Promise.all(
        folders.map(async (folder) => {
            let isInitialized = false;
            try {
                const agentsDir = vscode.Uri.joinPath(folder.uri, '.github', 'agents');
                await vscode.workspace.fs.stat(agentsDir);
                isInitialized = true;
            } catch {
                // Directory doesn't exist
            }

            return {
                name: folder.name,
                path: folder.uri.fsPath,
                isInitialized,
            };
        })
    );
}

/**
 * Check if Ouroboros is initialized in the workspace
 */
async function checkInitializationStatus(selectedPath?: string): Promise<{
    isInitialized: boolean;
    projectName: string | undefined;
}> {
    const vscode = await import('vscode');
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders || workspaceFolders.length === 0) {
        return { isInitialized: false, projectName: undefined };
    }

    // Find the selected workspace or use first one
    const targetFolder = selectedPath
        ? workspaceFolders.find((f) => f.uri.fsPath === selectedPath) || workspaceFolders[0]
        : workspaceFolders[0];

    const projectName = targetFolder.name;

    let isInitialized = false;
    try {
        const agentsDir = vscode.Uri.joinPath(targetFolder.uri, '.github', 'agents');
        await vscode.workspace.fs.stat(agentsDir);
        isInitialized = true;
    } catch {
        // Directory doesn't exist, not initialized
    }

    return { isInitialized, projectName };
}

/**
 * Handle messages from the webview
 */
export async function handleMessage(
    message: WebviewMessage,
    sidebarProvider: SidebarProvider,
    stateManager: StateManager,
    specWatcher?: SpecWatcher
): Promise<void> {
    logger.debug('Received message from webview:', message.type);

    switch (message.type) {
        case 'response': {
            const payload = message.payload as ResponsePayload;
            sidebarProvider.resolveRequest(payload.requestId, payload.response);
            break;
        }

        case 'cancel': {
            const payload = message.payload as { requestId: string };
            sidebarProvider.cancelRequest(payload.requestId);
            break;
        }

        case 'getState': {
            sidebarProvider.postMessage({
                type: 'stateUpdate',
                payload: stateManager.getWorkspaceState(),
            });
            break;
        }

        case 'getHistory': {
            sidebarProvider.postMessage({
                type: 'historyUpdate',
                payload: stateManager.getInteractionHistory(),
            });
            break;
        }

        case 'clearHistory': {
            await stateManager.clearHistory();
            sidebarProvider.postMessage({
                type: 'historyUpdate',
                payload: [],
            });
            break;
        }

        case 'updateExecutionMode': {
            const payload = message.payload as {
                mode: 'task-by-task' | 'phase-by-phase' | 'auto-run';
            };
            const vscode = await import('vscode');
            const target = vscode.workspace.workspaceFolders?.length
                ? vscode.ConfigurationTarget.Workspace
                : vscode.ConfigurationTarget.Global;
            await vscode.workspace
                .getConfiguration()
                .update(CONFIG.EXECUTION_MODE, payload.mode, target);
            await stateManager.updateWorkspaceState({
                executionMode: payload.mode,
            });
            break;
        }

        case 'ready':
        case 'refresh': {
            logger.debug(message.type === 'ready' ? 'Webview ready' : 'Refreshing state');

            const workspaces = await getWorkspacesInfo();
            const selectedPath = stateManager.getWorkspaceState().selectedWorkspacePath;
            const { isInitialized, projectName } = await checkInitializationStatus(selectedPath);
            const workspaceState = stateManager.getWorkspaceState();

            logger.debug('Sending init to webview', {
                activeSpecs: workspaceState.activeSpecs?.length ?? 0,
                archivedSpecs: workspaceState.archivedSpecs?.length ?? 0,
            });

            sidebarProvider.postMessage({
                type: 'init',
                payload: {
                    workspaceState: {
                        ...workspaceState,
                        projectName,
                        isInitialized,
                    },
                    workspaces,
                    history: stateManager.getInteractionHistory(),
                },
            });
            break;
        }

        case 'command': {
            const payload = message.payload as { command: string; args?: unknown[] };
            logger.info('Executing command:', payload.command);
            try {
                const vscode = await import('vscode');
                await vscode.commands.executeCommand(payload.command, ...(payload.args || []));
            } catch (error) {
                logger.error('Failed to execute command:', error);
            }
            break;
        }

        case 'openCopilotChat': {
            logger.info('Opening Copilot Chat');
            try {
                const vscode = await import('vscode');
                // Try to open Copilot Chat with /ouroboros
                await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
                // Update state to mark step as completed
                await stateManager.updateWorkspaceState({
                    hasCopilotChatOpened: true,
                });
                // Get full initialization status to include in update
                const selectedPath = stateManager.getWorkspaceState().selectedWorkspacePath;
                const { isInitialized, projectName } = await checkInitializationStatus(selectedPath);
                const workspaceState = stateManager.getWorkspaceState();
                sidebarProvider.postMessage({
                    type: 'stateUpdate',
                    payload: {
                        ...workspaceState,
                        projectName,
                        isInitialized,
                    },
                });
            } catch (error) {
                logger.error('Failed to open Copilot Chat:', error);
            }
            break;
        }

        case 'selectWorkspace': {
            const payload = message.payload as { path: string };
            logger.info('Selecting workspace:', payload.path);

            await stateManager.updateWorkspaceState({
                selectedWorkspacePath: payload.path,
            });

            // Restart spec watcher for the new workspace and wait for initial scan
            if (specWatcher) {
                const specs = await specWatcher.start(payload.path);
                // Update state with new specs synchronously
                await stateManager.updateWorkspaceState({
                    activeSpecs: specs.active,
                    archivedSpecs: specs.archived,
                });
            }

            // Re-check initialization status for the selected workspace
            const { isInitialized, projectName } = await checkInitializationStatus(payload.path);
            const workspaceState = stateManager.getWorkspaceState();

            sidebarProvider.postMessage({
                type: 'stateUpdate',
                payload: {
                    ...workspaceState,
                    projectName,
                    isInitialized,
                },
            });
            break;
        }

        default:
            logger.warn('Unknown message type:', message.type);
    }
}
