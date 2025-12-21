/**
 * Tests for clearHistory command
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode
vi.mock('vscode', () => ({
    window: {
        showWarningMessage: vi.fn(),
        showInformationMessage: vi.fn(),
        showErrorMessage: vi.fn(),
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

describe('clearHistory command', () => {
    let mockStateManager: {
        clearHistory: ReturnType<typeof vi.fn>;
    };

    let mockSidebarProvider: {
        postMessage: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        vi.clearAllMocks();

        mockStateManager = {
            clearHistory: vi.fn().mockResolvedValue(undefined),
        };

        mockSidebarProvider = {
            postMessage: vi.fn(),
        };
    });

    it('should clear history when user confirms', async () => {
        const vscode = await import('vscode');
        (vscode.window.showWarningMessage as ReturnType<typeof vi.fn>).mockResolvedValue(
            'Clear History'
        );

        const { createClearHistoryCommand } = await import('../../commands/clearHistory');
        const command = createClearHistoryCommand(
            mockStateManager as never,
            mockSidebarProvider as never
        );

        await command();

        expect(mockStateManager.clearHistory).toHaveBeenCalled();
        expect(mockSidebarProvider.postMessage).toHaveBeenCalledWith({
            type: 'historyUpdate',
            payload: [],
        });
        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
            'Interaction history cleared.'
        );
    });

    it('should not clear history when user cancels', async () => {
        const vscode = await import('vscode');
        (vscode.window.showWarningMessage as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

        const { createClearHistoryCommand } = await import('../../commands/clearHistory');
        const command = createClearHistoryCommand(
            mockStateManager as never,
            mockSidebarProvider as never
        );

        await command();

        expect(mockStateManager.clearHistory).not.toHaveBeenCalled();
        expect(mockSidebarProvider.postMessage).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
        const vscode = await import('vscode');
        (vscode.window.showWarningMessage as ReturnType<typeof vi.fn>).mockResolvedValue(
            'Clear History'
        );
        mockStateManager.clearHistory.mockRejectedValue(new Error('Test error'));

        const { createClearHistoryCommand } = await import('../../commands/clearHistory');
        const command = createClearHistoryCommand(
            mockStateManager as never,
            mockSidebarProvider as never
        );

        await command();

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Failed to clear interaction history.'
        );
    });
});
