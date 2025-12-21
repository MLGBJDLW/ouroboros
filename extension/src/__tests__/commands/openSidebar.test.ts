/**
 * Tests for openSidebar command
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode
vi.mock('vscode', () => ({
    commands: {
        executeCommand: vi.fn(),
    },
    window: {
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

// Mock constants
vi.mock('../../constants', () => ({
    SIDEBAR_VIEW_ID: 'ouroboros.sidebarView',
}));

describe('openSidebar command', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should focus the sidebar view', async () => {
        const vscode = await import('vscode');
        (vscode.commands.executeCommand as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

        const { createOpenSidebarCommand } = await import('../../commands/openSidebar');
        const command = createOpenSidebarCommand();

        await command();

        expect(vscode.commands.executeCommand).toHaveBeenCalledWith('ouroboros.sidebarView.focus');
    });

    it('should handle errors gracefully', async () => {
        const vscode = await import('vscode');
        (vscode.commands.executeCommand as ReturnType<typeof vi.fn>).mockRejectedValue(
            new Error('Test error')
        );

        const { createOpenSidebarCommand } = await import('../../commands/openSidebar');
        const command = createOpenSidebarCommand();

        await command();

        expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
            'Failed to open Ouroboros sidebar.'
        );
    });
});
