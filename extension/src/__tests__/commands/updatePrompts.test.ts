/**
 * Tests for updatePrompts command
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock vscode
vi.mock('vscode', () => ({
    window: {
        showErrorMessage: vi.fn(),
        showInformationMessage: vi.fn().mockResolvedValue(undefined),
        showWarningMessage: vi.fn(),
        showWorkspaceFolderPick: vi.fn(),
        withProgress: vi.fn((options, callback) => {
            const mockProgress = { report: vi.fn() };
            return callback(mockProgress);
        }),
    },
    workspace: {
        workspaceFolders: [{ uri: { fsPath: '/test/workspace' } }],
    },
    commands: {
        executeCommand: vi.fn(),
    },
    ProgressLocation: {
        Notification: 15,
    },
    extensions: {
        getExtension: vi.fn(),
    },
}));

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

import { createUpdatePromptsCommand, createCheckPromptsVersionCommand } from '../../commands/updatePrompts';
import * as vscode from 'vscode';
import { smartUpdatePrompts } from '../../utils/promptTransformer';
import { checkPromptsVersion } from '../../utils/versionService';

describe('updatePrompts command', () => {
    let mockContext: { extensionUri: { fsPath: string } };

    beforeEach(() => {
        vi.resetAllMocks();
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
            // Mock no workspace folders
            Object.defineProperty(vscode.workspace, 'workspaceFolders', {
                value: null,
                configurable: true,
            });

            const command = createUpdatePromptsCommand(mockContext as never);
            await command();

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'Please open a workspace folder to update prompts.'
            );

            // Restore
            Object.defineProperty(vscode.workspace, 'workspaceFolders', {
                value: [{ uri: { fsPath: '/test/workspace' } }],
                configurable: true,
            });
        });
    });

    describe('createCheckPromptsVersionCommand', () => {
        it('should create a command function', () => {
            const command = createCheckPromptsVersionCommand(mockContext as never);
            expect(typeof command).toBe('function');
        });
    });
});
