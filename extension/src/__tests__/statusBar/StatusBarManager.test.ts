/**
 * Tests for StatusBarManager
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock vscode
const mockStatusBarItem = {
    text: '',
    command: '',
    tooltip: '',
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn(),
};

const mockOnStateChange = vi.fn();
const mockOnDidChangeConfiguration = vi.fn();

vi.mock('vscode', () => ({
    window: {
        createStatusBarItem: vi.fn().mockReturnValue(mockStatusBarItem),
    },
    workspace: {
        getConfiguration: vi.fn().mockReturnValue({
            get: vi.fn().mockReturnValue(true),
        }),
        onDidChangeConfiguration: mockOnDidChangeConfiguration.mockReturnValue({
            dispose: vi.fn(),
        }),
    },
    StatusBarAlignment: {
        Left: 1,
        Right: 2,
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
    CONFIG: {
        SHOW_STATUS_BAR: 'ouroboros.showStatusBar',
    },
    COMMANDS: {
        OPEN_SIDEBAR: 'ouroboros.openSidebar',
    },
}));

// Mock formatters
vi.mock('../../statusBar/formatters', () => ({
    formatStatusBarText: vi.fn().mockReturnValue('$(infinity) Ouroboros'),
}));

describe('StatusBarManager', () => {
    let mockStateManager: {
        onStateChange: ReturnType<typeof vi.fn>;
        getWorkspaceState: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();

        mockStatusBarItem.text = '';
        mockStatusBarItem.command = '';
        mockStatusBarItem.tooltip = '';

        mockStateManager = {
            onStateChange: mockOnStateChange.mockReturnValue({ dispose: vi.fn() }),
            getWorkspaceState: vi.fn().mockReturnValue({}),
        };
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should create status bar item on construction', async () => {
        const vscode = await import('vscode');
        const { StatusBarManager } = await import('../../statusBar/StatusBarManager');

        const manager = new StatusBarManager(mockStateManager as never);

        expect(vscode.window.createStatusBarItem).toHaveBeenCalledWith(
            vscode.StatusBarAlignment.Left,
            100
        );
        expect(mockStatusBarItem.command).toBe('ouroboros.openSidebar');
        expect(mockStatusBarItem.show).toHaveBeenCalled();

        manager.dispose();
    });

    it('should update status bar text on state change', async () => {
        const { StatusBarManager } = await import('../../statusBar/StatusBarManager');
        const { formatStatusBarText } = await import('../../statusBar/formatters');

        const manager = new StatusBarManager(mockStateManager as never);

        // Get the state change callback
        const stateChangeCallback = mockOnStateChange.mock.calls[0][0];

        // Simulate state change
        const newState = { currentSpec: 'test-spec' };
        stateChangeCallback(newState);

        expect(formatStatusBarText).toHaveBeenCalledWith(newState);

        manager.dispose();
    });

    it('should show temporary message', async () => {
        const { StatusBarManager } = await import('../../statusBar/StatusBarManager');

        const manager = new StatusBarManager(mockStateManager as never);

        const originalText = mockStatusBarItem.text;
        manager.showTemporaryMessage('Test message', 1000);

        expect(mockStatusBarItem.text).toBe('Test message');

        // Fast forward time
        vi.advanceTimersByTime(1000);

        expect(mockStatusBarItem.text).toBe(originalText);

        manager.dispose();
    });

    it('should hide status bar when config is false', async () => {
        const vscode = await import('vscode');
        (vscode.workspace.getConfiguration as ReturnType<typeof vi.fn>).mockReturnValue({
            get: vi.fn().mockReturnValue(false),
        });

        const { StatusBarManager } = await import('../../statusBar/StatusBarManager');

        const manager = new StatusBarManager(mockStateManager as never);

        expect(mockStatusBarItem.show).not.toHaveBeenCalled();

        manager.dispose();
    });

    it('should respond to configuration changes', async () => {
        const vscode = await import('vscode');
        const { StatusBarManager } = await import('../../statusBar/StatusBarManager');

        const manager = new StatusBarManager(mockStateManager as never);

        // Get the config change callback
        const configChangeCallback = mockOnDidChangeConfiguration.mock.calls[0][0];

        // Simulate config change to hide
        (vscode.workspace.getConfiguration as ReturnType<typeof vi.fn>).mockReturnValue({
            get: vi.fn().mockReturnValue(false),
        });
        configChangeCallback({
            affectsConfiguration: (key: string) => key === 'ouroboros.showStatusBar',
        });

        expect(mockStatusBarItem.hide).toHaveBeenCalled();

        // Simulate config change to show
        (vscode.workspace.getConfiguration as ReturnType<typeof vi.fn>).mockReturnValue({
            get: vi.fn().mockReturnValue(true),
        });
        configChangeCallback({
            affectsConfiguration: (key: string) => key === 'ouroboros.showStatusBar',
        });

        expect(mockStatusBarItem.show).toHaveBeenCalled();

        manager.dispose();
    });

    it('should dispose properly', async () => {
        const { StatusBarManager } = await import('../../statusBar/StatusBarManager');

        const manager = new StatusBarManager(mockStateManager as never);

        expect(() => manager.dispose()).not.toThrow();
    });
});
