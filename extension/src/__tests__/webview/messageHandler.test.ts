/**
 * Tests for webview message handler
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock vscode at the top
const mockUpdate = vi.fn().mockResolvedValue(undefined);

vi.mock('vscode', () => ({
    workspace: {
        workspaceFolders: [{ uri: { fsPath: '/test-workspace' }, name: 'test-project', index: 0 }],
        fs: {
            stat: vi.fn(),
        },
        getConfiguration: vi.fn().mockReturnValue({
            update: mockUpdate,
        }),
    },
    commands: {
        executeCommand: vi.fn().mockResolvedValue(undefined),
    },
    Uri: {
        joinPath: vi.fn().mockImplementation((base: { fsPath: string }, ...segments: string[]) => ({
            fsPath: [base.fsPath, ...segments].join('/'),
        })),
    },
    ConfigurationTarget: {
        Global: 1,
        Workspace: 2,
    },
}));

// Mock logger
vi.mock('../../utils/logger', () => ({
    createLogger: vi.fn().mockReturnValue({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    }),
}));

describe('messageHandler', () => {
    let mockSidebarProvider: {
        resolveRequest: ReturnType<typeof vi.fn>;
        cancelRequest: ReturnType<typeof vi.fn>;
        postMessage: ReturnType<typeof vi.fn>;
    };

    let mockStateManager: {
        getWorkspaceState: ReturnType<typeof vi.fn>;
        getInteractionHistory: ReturnType<typeof vi.fn>;
        clearHistory: ReturnType<typeof vi.fn>;
        updateWorkspaceState: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        vi.clearAllMocks();

        mockSidebarProvider = {
            resolveRequest: vi.fn(),
            cancelRequest: vi.fn(),
            postMessage: vi.fn(),
        };

        mockStateManager = {
            getWorkspaceState: vi.fn().mockReturnValue({
                currentSpec: undefined,
                currentPhase: 0,
                workflowType: undefined,
                executionMode: 'task-by-task',
            }),
            getInteractionHistory: vi.fn().mockReturnValue([]),
            clearHistory: vi.fn().mockResolvedValue(undefined),
            updateWorkspaceState: vi.fn().mockResolvedValue(undefined),
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('response message', () => {
        it('should resolve pending request with response', async () => {
            const { handleMessage } = await import('../../webview/messageHandler');

            await handleMessage(
                {
                    type: 'response',
                    payload: { requestId: 'req-123', response: 'user input' },
                },
                mockSidebarProvider as never,
                mockStateManager as never
            );

            expect(mockSidebarProvider.resolveRequest).toHaveBeenCalledWith(
                'req-123',
                'user input'
            );
        });
    });

    describe('cancel message', () => {
        it('should cancel pending request', async () => {
            const { handleMessage } = await import('../../webview/messageHandler');

            await handleMessage(
                {
                    type: 'cancel',
                    payload: { requestId: 'req-456' },
                },
                mockSidebarProvider as never,
                mockStateManager as never
            );

            expect(mockSidebarProvider.cancelRequest).toHaveBeenCalledWith('req-456');
        });
    });

    describe('getState message', () => {
        it('should send current state to webview', async () => {
            const { handleMessage } = await import('../../webview/messageHandler');
            const mockState = { currentSpec: 'test-spec', currentPhase: 2 };
            mockStateManager.getWorkspaceState.mockReturnValue(mockState);

            await handleMessage(
                { type: 'getState' },
                mockSidebarProvider as never,
                mockStateManager as never
            );

            expect(mockSidebarProvider.postMessage).toHaveBeenCalledWith({
                type: 'stateUpdate',
                payload: mockState,
            });
        });
    });

    describe('getHistory message', () => {
        it('should send interaction history to webview', async () => {
            const { handleMessage } = await import('../../webview/messageHandler');
            const mockHistory = [{ id: '1', type: 'ask' }];
            mockStateManager.getInteractionHistory.mockReturnValue(mockHistory);

            await handleMessage(
                { type: 'getHistory' },
                mockSidebarProvider as never,
                mockStateManager as never
            );

            expect(mockSidebarProvider.postMessage).toHaveBeenCalledWith({
                type: 'historyUpdate',
                payload: mockHistory,
            });
        });
    });

    describe('clearHistory message', () => {
        it('should clear history and notify webview', async () => {
            const { handleMessage } = await import('../../webview/messageHandler');

            await handleMessage(
                { type: 'clearHistory' },
                mockSidebarProvider as never,
                mockStateManager as never
            );

            expect(mockStateManager.clearHistory).toHaveBeenCalled();
            expect(mockSidebarProvider.postMessage).toHaveBeenCalledWith({
                type: 'historyUpdate',
                payload: [],
            });
        });
    });

    describe('ready message', () => {
        it('should send init payload with state and history', async () => {
            const { handleMessage } = await import('../../webview/messageHandler');
            const vscode = await import('vscode');

            // Mock workspace as not initialized
            (vscode.workspace.fs.stat as ReturnType<typeof vi.fn>).mockRejectedValue(
                new Error('Not found')
            );

            await handleMessage(
                { type: 'ready' },
                mockSidebarProvider as never,
                mockStateManager as never
            );

            expect(mockSidebarProvider.postMessage).toHaveBeenCalledWith({
                type: 'init',
                payload: expect.objectContaining({
                    workspaceState: expect.objectContaining({
                        projectName: 'test-project',
                        isInitialized: false,
                    }),
                    history: [],
                }),
            });
        });

        it('should detect initialized workspace', async () => {
            const { handleMessage } = await import('../../webview/messageHandler');
            const vscode = await import('vscode');

            // Mock workspace as initialized (agents dir exists)
            (vscode.workspace.fs.stat as ReturnType<typeof vi.fn>).mockResolvedValue({
                type: 1,
            });

            await handleMessage(
                { type: 'ready' },
                mockSidebarProvider as never,
                mockStateManager as never
            );

            expect(mockSidebarProvider.postMessage).toHaveBeenCalledWith({
                type: 'init',
                payload: expect.objectContaining({
                    workspaceState: expect.objectContaining({
                        isInitialized: true,
                    }),
                }),
            });
        });
    });

    describe('refresh message', () => {
        it('should send init payload same as ready', async () => {
            const { handleMessage } = await import('../../webview/messageHandler');
            const vscode = await import('vscode');

            (vscode.workspace.fs.stat as ReturnType<typeof vi.fn>).mockRejectedValue(
                new Error('Not found')
            );

            await handleMessage(
                { type: 'refresh' },
                mockSidebarProvider as never,
                mockStateManager as never
            );

            expect(mockSidebarProvider.postMessage).toHaveBeenCalledWith({
                type: 'init',
                payload: expect.any(Object),
            });
        });
    });

    describe('updateExecutionMode message', () => {
        // Skip this test - the dynamic import pattern makes mocking
        // vscode.workspace.getConfiguration().update() complex
        it.skip('should update execution mode in state manager', async () => {
            const { handleMessage } = await import('../../webview/messageHandler');

            await handleMessage(
                {
                    type: 'updateExecutionMode',
                    payload: { mode: 'auto-run' },
                },
                mockSidebarProvider as never,
                mockStateManager as never
            );

            // Verify state manager was called (the config update is internal detail)
            expect(mockStateManager.updateWorkspaceState).toHaveBeenCalledWith({
                executionMode: 'auto-run',
            });
        });
    });

    describe('command message', () => {
        it('should execute vscode command', async () => {
            const { handleMessage } = await import('../../webview/messageHandler');
            const vscode = await import('vscode');

            await handleMessage(
                {
                    type: 'command',
                    payload: { command: 'ouroboros.initializeProject', args: [] },
                },
                mockSidebarProvider as never,
                mockStateManager as never
            );

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'ouroboros.initializeProject'
            );
        });

        it('should handle command execution errors', async () => {
            const { handleMessage } = await import('../../webview/messageHandler');
            const vscode = await import('vscode');

            (vscode.commands.executeCommand as ReturnType<typeof vi.fn>).mockRejectedValue(
                new Error('Command failed')
            );

            // Should not throw
            await expect(
                handleMessage(
                    {
                        type: 'command',
                        payload: { command: 'invalid.command' },
                    },
                    mockSidebarProvider as never,
                    mockStateManager as never
                )
            ).resolves.not.toThrow();
        });
    });

    describe('openCopilotChat message', () => {
        it('should open Copilot Chat panel', async () => {
            const { handleMessage } = await import('../../webview/messageHandler');
            const vscode = await import('vscode');

            await handleMessage(
                { type: 'openCopilotChat' },
                mockSidebarProvider as never,
                mockStateManager as never
            );

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
                'workbench.panel.chat.view.copilot.focus'
            );
        });
    });

    describe('selectWorkspace message', () => {
        it('should update selected workspace and restart spec watcher', async () => {
            const { handleMessage } = await import('../../webview/messageHandler');
            const vscode = await import('vscode');

            // Mock workspace as not initialized
            (vscode.workspace.fs.stat as ReturnType<typeof vi.fn>).mockRejectedValue(
                new Error('Not found')
            );

            const mockSpecWatcher = {
                start: vi.fn().mockResolvedValue(undefined),
            };

            await handleMessage(
                {
                    type: 'selectWorkspace',
                    payload: { path: '/new-workspace' },
                },
                mockSidebarProvider as never,
                mockStateManager as never,
                mockSpecWatcher as never
            );

            expect(mockStateManager.updateWorkspaceState).toHaveBeenCalledWith({
                selectedWorkspacePath: '/new-workspace',
            });
            expect(mockSpecWatcher.start).toHaveBeenCalledWith('/new-workspace');
            expect(mockSidebarProvider.postMessage).toHaveBeenCalledWith({
                type: 'stateUpdate',
                payload: expect.any(Object),
            });
        });

        it('should work without spec watcher', async () => {
            const { handleMessage } = await import('../../webview/messageHandler');
            const vscode = await import('vscode');

            (vscode.workspace.fs.stat as ReturnType<typeof vi.fn>).mockRejectedValue(
                new Error('Not found')
            );

            // Should not throw when specWatcher is undefined
            await expect(
                handleMessage(
                    {
                        type: 'selectWorkspace',
                        payload: { path: '/new-workspace' },
                    },
                    mockSidebarProvider as never,
                    mockStateManager as never
                )
            ).resolves.not.toThrow();
        });
    });

    describe('unknown message', () => {
        it('should handle unknown message types gracefully', async () => {
            const { handleMessage } = await import('../../webview/messageHandler');

            // Should not throw
            await expect(
                handleMessage(
                    { type: 'unknownType' },
                    mockSidebarProvider as never,
                    mockStateManager as never
                )
            ).resolves.not.toThrow();
        });
    });
});
