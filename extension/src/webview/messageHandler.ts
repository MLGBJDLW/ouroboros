/**
 * Webview message handler
 */

import { createLogger } from '../utils/logger';
import { CONFIG } from '../constants';
import { fetchCopilotInsights } from '../services/copilotInsights';
import type { SidebarProvider } from './SidebarProvider';
import type { StateManager } from '../storage/stateManager';
import type { SpecWatcher } from '../services/specWatcher';
import type { CodeGraphManager } from '../codeGraph/CodeGraphManager';

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
export async function getWorkspacesInfo(): Promise<WorkspaceInfo[]> {
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
export async function checkInitializationStatus(selectedPath?: string): Promise<{
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
    specWatcher?: SpecWatcher,
    codeGraphManager?: CodeGraphManager
): Promise<void> {
    logger.debug('Received message from webview:', message.type);

    switch (message.type) {
        case 'response': {
            const payload = message.payload as ResponsePayload;
            logger.debug('Response payload received:', JSON.stringify(payload.response));
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
                
                // Special handling for vscode.open command
                // The webview sends { path: string } but vscode.open needs a Uri
                if (payload.command === 'vscode.open' && payload.args && payload.args.length > 0) {
                    const firstArg = payload.args[0] as { path?: string } | string;
                    let filePath: string | undefined;
                    
                    if (typeof firstArg === 'string') {
                        filePath = firstArg;
                    } else if (firstArg && typeof firstArg === 'object' && 'path' in firstArg) {
                        filePath = firstArg.path;
                    }
                    
                    if (filePath) {
                        // Convert relative path to absolute if needed
                        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                        let uri: typeof vscode.Uri.prototype;
                        
                        if (filePath.startsWith('/') || /^[a-zA-Z]:/.test(filePath)) {
                            // Absolute path
                            uri = vscode.Uri.file(filePath);
                        } else if (workspaceFolder) {
                            // Relative path - resolve against workspace
                            uri = vscode.Uri.joinPath(workspaceFolder.uri, filePath);
                        } else {
                            uri = vscode.Uri.file(filePath);
                        }
                        
                        await vscode.commands.executeCommand('vscode.open', uri);
                        return;
                    }
                }
                
                // Default command execution
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

        case 'fetchCopilotInsights': {
            logger.info('Fetching Copilot insights');
            const result = await fetchCopilotInsights();
            sidebarProvider.postMessage({
                type: 'copilotInsightsResult',
                payload: result,
            });
            break;
        }

        case 'getGraphDigest': {
            logger.info('Getting graph digest');
            if (codeGraphManager) {
                try {
                    const digest = codeGraphManager.getDigest();
                    sidebarProvider.postMessage({
                        type: 'graphDigest',
                        payload: digest,
                    });
                } catch (error) {
                    logger.error('Failed to get graph digest:', error);
                    sidebarProvider.postMessage({
                        type: 'graphError',
                        payload: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            } else {
                sidebarProvider.postMessage({
                    type: 'graphError',
                    payload: 'Code Graph not initialized',
                });
            }
            break;
        }

        case 'refreshGraph': {
            logger.info('Refreshing graph (full re-index)');
            if (codeGraphManager) {
                try {
                    // Notify webview that refresh is starting
                    sidebarProvider.postMessage({
                        type: 'graphRefreshStarted',
                        payload: null,
                    });
                    
                    // Invalidate cache before re-index
                    codeGraphManager.invalidateCache();
                    
                    // Perform full re-index
                    await codeGraphManager.fullIndex();
                    
                    // Invalidate cache again after re-index to ensure fresh data
                    codeGraphManager.invalidateCache();
                    
                    // Send updated data (these will recompute, not use cache)
                    const digest = codeGraphManager.getDigest();
                    const issues = codeGraphManager.getIssues();
                    const fileIndex = codeGraphManager.getFileIndex();
                    
                    // Get edges
                    const store = codeGraphManager.getStore();
                    const allEdges = store.getAllEdges();
                    const edges = allEdges
                        .filter(edge => 
                            edge.kind === 'imports' && 
                            edge.from.startsWith('file:') && 
                            edge.to.startsWith('file:')
                        )
                        .map(edge => ({
                            source: edge.from.slice(5),
                            target: edge.to.slice(5),
                            type: edge.kind,
                        }));
                    
                    sidebarProvider.postMessage({
                        type: 'graphDigest',
                        payload: digest,
                    });
                    sidebarProvider.postMessage({
                        type: 'graphIssues',
                        payload: issues,
                    });
                    sidebarProvider.postMessage({
                        type: 'graphFiles',
                        payload: fileIndex,
                    });
                    sidebarProvider.postMessage({
                        type: 'graphEdges',
                        payload: { edges },
                    });
                    sidebarProvider.postMessage({
                        type: 'graphRefreshCompleted',
                        payload: null,
                    });
                } catch (error) {
                    logger.error('Failed to refresh graph:', error);
                    sidebarProvider.postMessage({
                        type: 'graphError',
                        payload: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            } else {
                sidebarProvider.postMessage({
                    type: 'graphError',
                    payload: 'Code Graph not initialized',
                });
            }
            break;
        }

        case 'getGraphIssues': {
            logger.info('Getting graph issues');
            if (codeGraphManager) {
                try {
                    const issues = codeGraphManager.getIssues();
                    sidebarProvider.postMessage({
                        type: 'graphIssues',
                        payload: issues,
                    });
                } catch (error) {
                    logger.error('Failed to get graph issues:', error);
                }
            }
            break;
        }

        case 'getGraphFiles': {
            logger.info('Getting graph file index');
            if (codeGraphManager) {
                try {
                    const payload = codeGraphManager.getFileIndex();
                    sidebarProvider.postMessage({
                        type: 'graphFiles',
                        payload,
                    });
                } catch (error) {
                    logger.error('Failed to get graph files:', error);
                    sidebarProvider.postMessage({
                        type: 'graphError',
                        payload: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            } else {
                sidebarProvider.postMessage({
                    type: 'graphError',
                    payload: 'Code Graph not initialized',
                });
            }
            break;
        }

        case 'getGraphEdges': {
            logger.info('Getting graph edges');
            if (codeGraphManager) {
                try {
                    const store = codeGraphManager.getStore();
                    const allEdges = store.getAllEdges();
                    
                    // Transform edges to a simpler format for the webview
                    // Only include import edges between files
                    const edges = allEdges
                        .filter(edge => 
                            edge.kind === 'imports' && 
                            edge.from.startsWith('file:') && 
                            edge.to.startsWith('file:')
                        )
                        .map(edge => ({
                            source: edge.from.slice(5), // Remove 'file:' prefix
                            target: edge.to.slice(5),
                            type: edge.kind,
                        }));
                    
                    sidebarProvider.postMessage({
                        type: 'graphEdges',
                        payload: { edges },
                    });
                } catch (error) {
                    logger.error('Failed to get graph edges:', error);
                    sidebarProvider.postMessage({
                        type: 'graphError',
                        payload: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            } else {
                sidebarProvider.postMessage({
                    type: 'graphError',
                    payload: 'Code Graph not initialized',
                });
            }
            break;
        }

        case 'getGraphImpact': {
            logger.info('Getting graph impact');
            if (codeGraphManager) {
                try {
                    const payload = message.payload as { target: string; depth?: number };
                    const impact = codeGraphManager.getImpact(payload.target, payload.depth);
                    const entrypointPaths = new Set(
                        impact.affectedEntrypoints.map((ep) => ep.path).filter(Boolean)
                    );
                    const affectedFiles = impact.directDependents.map((path) => ({
                        path,
                        distance: 1,
                        reason: 'Direct import',
                        isEntrypoint: entrypointPaths.has(path),
                    }));

                    for (const ep of impact.affectedEntrypoints) {
                        if (!ep.path || affectedFiles.find((f) => f.path === ep.path)) continue;
                        affectedFiles.push({
                            path: ep.path,
                            distance: 2,
                            reason: 'Entrypoint depends on target',
                            isEntrypoint: true,
                        });
                    }

                    const summaryParts = [impact.riskAssessment.reason, ...impact.riskAssessment.factors];
                    sidebarProvider.postMessage({
                        type: 'graphImpact',
                        payload: {
                            target: impact.target,
                            depth: impact.meta.depthReached,
                            affectedFiles,
                            riskLevel: impact.riskAssessment.level,
                            summary: summaryParts.filter(Boolean).join(' · '),
                        },
                    });
                } catch (error) {
                    logger.error('Failed to get graph impact:', error);
                    sidebarProvider.postMessage({
                        type: 'graphError',
                        payload: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            } else {
                sidebarProvider.postMessage({
                    type: 'graphError',
                    payload: 'Code Graph not initialized',
                });
            }
            break;
        }

        case 'getGraphModule': {
            logger.info('Getting graph module');
            if (codeGraphManager) {
                try {
                    const payload = message.payload as { target: string };
                    const moduleInfo = codeGraphManager.getModule(payload.target);
                    sidebarProvider.postMessage({
                        type: 'graphModule',
                        payload: {
                            path: moduleInfo.path ?? payload.target,
                            imports: moduleInfo.imports.map((imp) => imp.path),
                            exports: moduleInfo.exports,
                            dependents: moduleInfo.importedBy.map((dep) => dep.path),
                            isEntrypoint: moduleInfo.entrypoints.length > 0,
                            entrypointType: moduleInfo.entrypoints[0]?.type,
                            issues: [],
                        },
                    });
                } catch (error) {
                    logger.error('Failed to get graph module:', error);
                    sidebarProvider.postMessage({
                        type: 'graphError',
                        payload: error instanceof Error ? error.message : 'Unknown error',
                    });
                }
            } else {
                sidebarProvider.postMessage({
                    type: 'graphError',
                    payload: 'Code Graph not initialized',
                });
            }
            break;
        }

        case 'addGraphContext': {
            const payload = message.payload as {
                type: string;
                data: unknown;
                timestamp: number;
            };
            logger.info('Adding graph context:', payload.type);
            sidebarProvider.addGraphContext(payload);
            break;
        }

        default:
            logger.warn('Unknown message type:', message.type);
    }
}
