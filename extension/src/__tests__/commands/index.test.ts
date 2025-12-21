/**
 * Tests for commands index
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode
vi.mock('vscode', () => ({
    commands: {
        registerCommand: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    },
    window: {
        showInformationMessage: vi.fn(),
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

// Mock constants
vi.mock('../../constants', () => ({
    COMMANDS: {
        INITIALIZE_PROJECT: 'ouroboros.initializeProject',
        OPEN_SIDEBAR: 'ouroboros.openSidebar',
        CLEAR_HISTORY: 'ouroboros.clearHistory',
        CANCEL_CURRENT_REQUEST: 'ouroboros.cancelCurrentRequest',
        UPDATE_PROMPTS: 'ouroboros.updatePrompts',
        CHECK_PROMPTS_VERSION: 'ouroboros.checkPromptsVersion',
    },
}));

// Mock command creators
vi.mock('../../commands/initializeProject', () => ({
    createInitializeProjectCommand: vi.fn().mockReturnValue(vi.fn()),
}));

vi.mock('../../commands/openSidebar', () => ({
    createOpenSidebarCommand: vi.fn().mockReturnValue(vi.fn()),
}));

vi.mock('../../commands/clearHistory', () => ({
    createClearHistoryCommand: vi.fn().mockReturnValue(vi.fn()),
}));

vi.mock('../../commands/updatePrompts', () => ({
    createUpdatePromptsCommand: vi.fn().mockReturnValue(vi.fn()),
    createCheckPromptsVersionCommand: vi.fn().mockReturnValue(vi.fn()),
}));

describe('registerCommands', () => {
    let mockContext: { extensionUri: { fsPath: string } };
    let mockStateManager: object;
    let mockSidebarProvider: {
        postMessage: ReturnType<typeof vi.fn>;
        cancelCurrentRequest: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        vi.clearAllMocks();

        mockContext = {
            extensionUri: { fsPath: '/test' },
        };

        mockStateManager = {};

        mockSidebarProvider = {
            postMessage: vi.fn(),
            cancelCurrentRequest: vi.fn(),
        };
    });

    it('should register all commands', async () => {
        const vscode = await import('vscode');
        const { registerCommands } = await import('../../commands/index');

        const disposables = registerCommands(
            mockContext as never,
            mockStateManager as never,
            mockSidebarProvider as never
        );

        expect(vscode.commands.registerCommand).toHaveBeenCalledTimes(6);
        expect(disposables).toHaveLength(6);
    });

    it('should register cancel request command that shows message when no active request', async () => {
        const vscode = await import('vscode');
        const { registerCommands } = await import('../../commands/index');

        mockSidebarProvider.cancelCurrentRequest.mockReturnValue(false);

        registerCommands(
            mockContext as never,
            mockStateManager as never,
            mockSidebarProvider as never
        );

        // Get the cancel command handler
        const cancelCall = (
            vscode.commands.registerCommand as ReturnType<typeof vi.fn>
        ).mock.calls.find((call) => call[0] === 'ouroboros.cancelCurrentRequest');

        expect(cancelCall).toBeDefined();

        // Execute the handler
        const handler = cancelCall![1];
        handler();

        expect(mockSidebarProvider.cancelCurrentRequest).toHaveBeenCalled();
        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
            'No active request to cancel.'
        );
    });
});
