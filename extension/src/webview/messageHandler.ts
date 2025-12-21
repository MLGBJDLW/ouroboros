/**
 * Webview message handler
 */

import { createLogger } from '../utils/logger';
import { CONFIG } from '../constants';
import type { SidebarProvider } from './SidebarProvider';
import type { StateManager } from '../storage/stateManager';

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
 * Check if Ouroboros is initialized in the workspace
 */
async function checkInitializationStatus(): Promise<{
    isInitialized: boolean;
    projectName: string | undefined;
}> {
    const vscode = await import('vscode');
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const projectName = workspaceFolders?.[0]?.name || undefined;

    let isInitialized = false;
    if (workspaceFolders && workspaceFolders.length > 0) {
        try {
            const agentsDir = vscode.Uri.joinPath(workspaceFolders[0].uri, '.github', 'agents');
            await vscode.workspace.fs.stat(agentsDir);
            isInitialized = true;
        } catch {
            // Directory doesn't exist, not initialized
            isInitialized = false;
        }
    }

    return { isInitialized, projectName };
}

/**
 * Handle messages from the webview
 */
export async function handleMessage(
    message: WebviewMessage,
    sidebarProvider: SidebarProvider,
    stateManager: StateManager
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
            logger.info(message.type === 'ready' ? 'Webview ready' : 'Refreshing state');

            const { isInitialized, projectName } = await checkInitializationStatus();
            const workspaceState = stateManager.getWorkspaceState();

            sidebarProvider.postMessage({
                type: 'init',
                payload: {
                    workspaceState: {
                        ...workspaceState,
                        projectName,
                        isInitialized,
                    },
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
                sidebarProvider.postMessage({
                    type: 'stateUpdate',
                    payload: stateManager.getWorkspaceState(),
                });
            } catch (error) {
                logger.error('Failed to open Copilot Chat:', error);
            }
            break;
        }

        default:
            logger.warn('Unknown message type:', message.type);
    }
}
