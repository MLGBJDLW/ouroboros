/**
 * Tests for initializeProject command
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode
const mockWithProgress = vi.fn();
vi.mock('vscode', () => ({
    workspace: {
        workspaceFolders: [{ uri: { fsPath: '/test-workspace' }, name: 'test', index: 0 }],
    },
    window: {
        showErrorMessage: vi.fn(),
        showInformationMessage: vi.fn(),
        showWarningMessage: vi.fn(),
        showWorkspaceFolderPick: vi.fn(),
        withProgress: mockWithProgress,
    },
    ProgressLocation: {
        Notification: 15,
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
    fetchAndTransformPrompts: vi.fn(),
    createOuroborosStructure: vi.fn(),
}));

describe('initializeProject command', () => {
    let mockContext: { extensionUri: { fsPath: string } };

    beforeEach(() => {
        vi.clearAllMocks();

        mockContext = {
            extensionUri: { fsPath: '/test' },
        };

        mockWithProgress.mockImplementation(async (_options, callback) => {
            const progress = { report: vi.fn() };
            return callback(progress);
        });
    });

    it('should show error when no workspace is open', async () => {
        const vscode = await import('vscode');
        // Override workspaceFolders to be empty
        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: [],
            configurable: true,
        });

        const { createInitializeProjectCommand } = await import('../../commands/initializeProject');
        const command = createInitializeProjectCommand(mockContext as never);

        await command();

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Please open a workspace folder to initialize Ouroboros.'
        );
    });

    it('should initialize project successfully', async () => {
        const vscode = await import('vscode');
        const { fetchAndTransformPrompts, createOuroborosStructure } =
            await import('../../utils/promptTransformer');

        // Reset workspaceFolders
        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: [{ uri: { fsPath: '/test-workspace' }, name: 'test', index: 0 }],
            configurable: true,
        });

        (fetchAndTransformPrompts as ReturnType<typeof vi.fn>).mockResolvedValue({
            success: 5,
            failed: 0,
        });
        (createOuroborosStructure as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

        const onSuccess = vi.fn();
        const { createInitializeProjectCommand } = await import('../../commands/initializeProject');
        const command = createInitializeProjectCommand(mockContext as never, onSuccess);

        await command();

        expect(fetchAndTransformPrompts).toHaveBeenCalled();
        expect(createOuroborosStructure).toHaveBeenCalled();
        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
            'Ouroboros initialized successfully! 5 files created.'
        );
        expect(onSuccess).toHaveBeenCalled();
    });

    it('should show warning when some files fail', async () => {
        const vscode = await import('vscode');
        const { fetchAndTransformPrompts, createOuroborosStructure } =
            await import('../../utils/promptTransformer');

        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: [{ uri: { fsPath: '/test-workspace' }, name: 'test', index: 0 }],
            configurable: true,
        });

        (fetchAndTransformPrompts as ReturnType<typeof vi.fn>).mockResolvedValue({
            success: 3,
            failed: 2,
        });
        (createOuroborosStructure as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

        const { createInitializeProjectCommand } = await import('../../commands/initializeProject');
        const command = createInitializeProjectCommand(mockContext as never);

        await command();

        expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
            'Ouroboros initialized with 3 files. 2 files failed to fetch.'
        );
    });

    it('should handle errors during initialization', async () => {
        const vscode = await import('vscode');
        const { fetchAndTransformPrompts } = await import('../../utils/promptTransformer');

        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: [{ uri: { fsPath: '/test-workspace' }, name: 'test', index: 0 }],
            configurable: true,
        });

        (fetchAndTransformPrompts as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error('Network error')
        );

        const { createInitializeProjectCommand } = await import('../../commands/initializeProject');
        const command = createInitializeProjectCommand(mockContext as never);

        await command();

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            expect.stringContaining('Failed to initialize Ouroboros project')
        );
    });

    it('should prompt for workspace selection when multiple workspaces', async () => {
        const vscode = await import('vscode');
        const { fetchAndTransformPrompts, createOuroborosStructure } =
            await import('../../utils/promptTransformer');

        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: [
                { uri: { fsPath: '/workspace1' }, name: 'ws1', index: 0 },
                { uri: { fsPath: '/workspace2' }, name: 'ws2', index: 1 },
            ],
            configurable: true,
        });

        (vscode.window.showWorkspaceFolderPick as ReturnType<typeof vi.fn>).mockResolvedValue({
            uri: { fsPath: '/workspace1' },
        });

        (fetchAndTransformPrompts as ReturnType<typeof vi.fn>).mockResolvedValue({
            success: 5,
            failed: 0,
        });
        (createOuroborosStructure as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

        const { createInitializeProjectCommand } = await import('../../commands/initializeProject');
        const command = createInitializeProjectCommand(mockContext as never);

        await command();

        expect(vscode.window.showWorkspaceFolderPick).toHaveBeenCalled();
    });

    it('should cancel when user does not select workspace', async () => {
        const vscode = await import('vscode');
        const { fetchAndTransformPrompts } = await import('../../utils/promptTransformer');

        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: [
                { uri: { fsPath: '/workspace1' }, name: 'ws1', index: 0 },
                { uri: { fsPath: '/workspace2' }, name: 'ws2', index: 1 },
            ],
            configurable: true,
        });

        (vscode.window.showWorkspaceFolderPick as ReturnType<typeof vi.fn>).mockResolvedValue(
            undefined
        );

        const { createInitializeProjectCommand } = await import('../../commands/initializeProject');
        const command = createInitializeProjectCommand(mockContext as never);

        await command();

        expect(fetchAndTransformPrompts).not.toHaveBeenCalled();
    });
});
