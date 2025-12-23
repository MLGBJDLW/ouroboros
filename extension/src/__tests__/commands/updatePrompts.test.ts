/**
 * Tests for updatePrompts command
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock vscode - use inline functions that can be spied on
vi.mock('vscode', () => {
    const mockFns = {
        showErrorMessage: vi.fn(),
        showInformationMessage: vi.fn().mockResolvedValue(undefined),
        showWarningMessage: vi.fn(),
        showWorkspaceFolderPick: vi.fn(),
        withProgress: vi.fn(async (_options: unknown, callback: (progress: { report: ReturnType<typeof vi.fn> }) => Promise<unknown>) => {
            const mockProgress = { report: vi.fn() };
            return await callback(mockProgress);
        }),
        executeCommand: vi.fn(),
    };
    return {
        window: {
            showErrorMessage: mockFns.showErrorMessage,
            showInformationMessage: mockFns.showInformationMessage,
            showWarningMessage: mockFns.showWarningMessage,
            showWorkspaceFolderPick: mockFns.showWorkspaceFolderPick,
            withProgress: mockFns.withProgress,
        },
        workspace: {
            workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
        },
        commands: {
            executeCommand: mockFns.executeCommand,
        },
        ProgressLocation: {
            Notification: 15,
        },
        extensions: {
            getExtension: vi.fn(),
        },
    };
});

// Mock logger
vi.mock('../../utils/logger', () => ({
    createLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    }),
}));

// Mock promptTransformer
vi.mock('../../utils/promptTransformer', () => ({
    smartUpdatePrompts: vi.fn().mockResolvedValue({
        updated: 10,
        created: 2,
        failed: 0,
    }),
}));

// Mock versionService
vi.mock('../../utils/versionService', () => ({
    checkPromptsVersion: vi.fn().mockResolvedValue({
        localVersion: '3.2.2',
        remoteVersion: '3.2.3',
        isOutdated: true,
    }),
}));

import * as vscode from 'vscode';
import { createUpdatePromptsCommand, createCheckPromptsVersionCommand } from '../../commands/updatePrompts';
import { smartUpdatePrompts } from '../../utils/promptTransformer';
import { checkPromptsVersion } from '../../utils/versionService';

describe('updatePrompts command', () => {
    let mockContext: { extensionUri: { fsPath: string } };

    beforeEach(() => {
        vi.clearAllMocks();
        mockContext = { extensionUri: { fsPath: '/test' } };

        // Reset default mock behavior
        vi.mocked(smartUpdatePrompts).mockResolvedValue({
            updated: 10,
            created: 2,
            failed: 0,
        });

        vi.mocked(checkPromptsVersion).mockResolvedValue({
            localVersion: '3.2.2',
            remoteVersion: '3.2.3',
            isOutdated: true,
        });

        vi.mocked(vscode.window.showInformationMessage).mockResolvedValue(undefined as never);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('createUpdatePromptsCommand', () => {
        it('should create a command function', () => {
            const command = createUpdatePromptsCommand(mockContext as never);
            expect(typeof command).toBe('function');
        });

        it('should show error when no workspace is open', async () => {
            Object.defineProperty(vscode.workspace, 'workspaceFolders', {
                value: null,
                configurable: true,
            });

            const command = createUpdatePromptsCommand(mockContext as never);
            await command();

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'Please open a workspace folder to update prompts.'
            );

            Object.defineProperty(vscode.workspace, 'workspaceFolders', {
                value: [{ uri: { fsPath: '/test/workspace' } }],
                configurable: true,
            });
        });

        it('should show error when workspace folders is empty', async () => {
            Object.defineProperty(vscode.workspace, 'workspaceFolders', {
                value: [],
                configurable: true,
            });

            const command = createUpdatePromptsCommand(mockContext as never);
            await command();

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'Please open a workspace folder to update prompts.'
            );

            Object.defineProperty(vscode.workspace, 'workspaceFolders', {
                value: [{ uri: { fsPath: '/test/workspace' } }],
                configurable: true,
            });
        });

        it('should prompt for workspace selection when multiple workspaces', async () => {
            Object.defineProperty(vscode.workspace, 'workspaceFolders', {
                value: [
                    { uri: { fsPath: '/test/workspace1' } },
                    { uri: { fsPath: '/test/workspace2' } },
                ],
                configurable: true,
            });

            vi.mocked(vscode.window.showWorkspaceFolderPick).mockResolvedValue({
                uri: { fsPath: '/test/workspace1' },
            } as never);

            const command = createUpdatePromptsCommand(mockContext as never);
            await command();

            expect(vscode.window.showWorkspaceFolderPick).toHaveBeenCalled();

            Object.defineProperty(vscode.workspace, 'workspaceFolders', {
                value: [{ uri: { fsPath: '/test/workspace' } }],
                configurable: true,
            });
        });

        it('should return early if user cancels workspace selection', async () => {
            Object.defineProperty(vscode.workspace, 'workspaceFolders', {
                value: [
                    { uri: { fsPath: '/test/workspace1' } },
                    { uri: { fsPath: '/test/workspace2' } },
                ],
                configurable: true,
            });

            vi.mocked(vscode.window.showWorkspaceFolderPick).mockResolvedValue(undefined);

            const command = createUpdatePromptsCommand(mockContext as never);
            await command();

            expect(smartUpdatePrompts).not.toHaveBeenCalled();

            Object.defineProperty(vscode.workspace, 'workspaceFolders', {
                value: [{ uri: { fsPath: '/test/workspace' } }],
                configurable: true,
            });
        });

        it('should show success message when update succeeds', async () => {
            const command = createUpdatePromptsCommand(mockContext as never);
            await command();

            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                expect.stringContaining('Prompts updated successfully')
            );
        });

        it('should show warning message when some updates fail', async () => {
            vi.mocked(smartUpdatePrompts).mockResolvedValue({
                updated: 8,
                created: 1,
                failed: 2,
            });

            const command = createUpdatePromptsCommand(mockContext as never);
            await command();

            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
                expect.stringContaining('failed')
            );
        });

        it('should show error message when update throws', async () => {
            vi.mocked(smartUpdatePrompts).mockRejectedValue(new Error('Network error'));

            const command = createUpdatePromptsCommand(mockContext as never);
            await command();

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('Failed to update prompts')
            );
        });

        it('should call onSuccess callback when update succeeds', async () => {
            const onSuccess = vi.fn();
            const command = createUpdatePromptsCommand(mockContext as never, onSuccess);
            await command();

            expect(onSuccess).toHaveBeenCalled();
        });
    });

    describe('createCheckPromptsVersionCommand', () => {
        it('should create a command function', () => {
            const command = createCheckPromptsVersionCommand(mockContext as never);
            expect(typeof command).toBe('function');
        });

        it('should show update available message when outdated', async () => {
            const command = createCheckPromptsVersionCommand(mockContext as never);
            await command();

            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                expect.stringContaining('Update available'),
                'Update Now',
                'Later'
            );
        });

        it('should execute update command when user clicks Update Now', async () => {
            vi.mocked(vscode.window.showInformationMessage).mockResolvedValue('Update Now' as never);

            const command = createCheckPromptsVersionCommand(mockContext as never);
            await command();

            expect(vscode.commands.executeCommand).toHaveBeenCalledWith('ouroboros.updatePrompts');
        });

        it('should show up to date message when not outdated', async () => {
            vi.mocked(checkPromptsVersion).mockResolvedValue({
                localVersion: '3.2.3',
                remoteVersion: '3.2.3',
                isOutdated: false,
            });

            const command = createCheckPromptsVersionCommand(mockContext as never);
            await command();

            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                expect.stringContaining('up to date')
            );
        });

        it('should show error message when check fails', async () => {
            vi.mocked(checkPromptsVersion).mockRejectedValue(new Error('Network error'));

            const command = createCheckPromptsVersionCommand(mockContext as never);
            await command();

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('Failed to check version')
            );
        });
    });
});
