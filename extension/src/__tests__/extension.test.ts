/**
 * Tests for extension activation/deactivation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode
const mockRegisterWebviewViewProvider = vi.fn().mockReturnValue({ dispose: vi.fn() });

vi.mock('vscode', () => ({
    window: {
        registerWebviewViewProvider: mockRegisterWebviewViewProvider,
    },
    workspace: {
        workspaceFolders: [{ uri: { fsPath: '/test-workspace' }, name: 'test', index: 0 }],
    },
}));

// Mock logger
vi.mock('../utils/logger', () => ({
    createLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    }),
}));

// Mock constants
vi.mock('../constants', () => ({
    EXTENSION_ID: 'ouroboros',
    COMMANDS: {
        INITIALIZE_PROJECT: 'ouroboros.initializeProject',
        OPEN_SIDEBAR: 'ouroboros.openSidebar',
        CLEAR_HISTORY: 'ouroboros.clearHistory',
        CANCEL_CURRENT_REQUEST: 'ouroboros.cancelCurrentRequest',
    },
}));

// Mock StateManager
vi.mock('../storage/stateManager', () => ({
    StateManager: vi.fn().mockImplementation(() => ({
        initialize: vi.fn().mockResolvedValue(undefined),
        dispose: vi.fn(),
        onStateChange: vi.fn().mockReturnValue({ dispose: vi.fn() }),
        getWorkspaceState: vi.fn().mockReturnValue({}),
        getInteractionHistory: vi.fn().mockReturnValue([]),
    })),
}));

// Mock SidebarProvider
vi.mock('../webview/SidebarProvider', () => ({
    SidebarProvider: vi.fn().mockImplementation(() => ({
        dispose: vi.fn(),
    })),
}));

// Mock StatusBarManager
vi.mock('../statusBar/StatusBarManager', () => ({
    StatusBarManager: vi.fn().mockImplementation(() => ({
        dispose: vi.fn(),
    })),
}));

// Mock registerTools
vi.mock('../tools', () => ({
    registerTools: vi.fn().mockReturnValue([{ dispose: vi.fn() }]),
}));

// Mock registerCommands
vi.mock('../commands', () => ({
    registerCommands: vi.fn().mockReturnValue([{ dispose: vi.fn() }]),
}));

// Mock SpecWatcher
vi.mock('../services/specWatcher', () => ({
    SpecWatcher: vi.fn().mockImplementation(() => ({
        start: vi.fn().mockResolvedValue(undefined),
        onSpecChange: vi.fn().mockReturnValue({ dispose: vi.fn() }),
        forceRescan: vi.fn().mockResolvedValue(null),
        dispose: vi.fn(),
    })),
}));

describe('extension', () => {
    let mockContext: {
        extensionUri: { fsPath: string };
        subscriptions: { push: ReturnType<typeof vi.fn> };
    };

    beforeEach(() => {
        vi.clearAllMocks();

        mockContext = {
            extensionUri: { fsPath: '/test' },
            subscriptions: { push: vi.fn() },
        };
    });

    it('should activate extension successfully', async () => {
        const { activate } = await import('../extension');

        await expect(activate(mockContext as never)).resolves.not.toThrow();

        expect(mockRegisterWebviewViewProvider).toHaveBeenCalledWith(
            'ouroboros.sidebarView',
            expect.anything(),
            expect.objectContaining({
                webviewOptions: { retainContextWhenHidden: true },
            })
        );
    });

    it('should deactivate extension', async () => {
        const { activate, deactivate } = await import('../extension');

        await activate(mockContext as never);

        expect(() => deactivate()).not.toThrow();
    });

    it('should handle activation errors', async () => {
        const { StateManager } = await import('../storage/stateManager');
        (StateManager as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
            initialize: vi.fn().mockRejectedValue(new Error('Init failed')),
            dispose: vi.fn(),
        }));

        // Re-import to get fresh module
        vi.resetModules();

        // Re-setup mocks after reset
        vi.doMock('vscode', () => ({
            window: {
                registerWebviewViewProvider: mockRegisterWebviewViewProvider,
            },
            workspace: {
                workspaceFolders: [{ uri: { fsPath: '/test-workspace' }, name: 'test', index: 0 }],
            },
        }));

        const extension = await import('../extension');

        await expect(extension.activate(mockContext as never)).rejects.toThrow();
    });
});
