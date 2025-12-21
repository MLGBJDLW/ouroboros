/**
 * Unit tests for SidebarProvider
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock VS Code before importing SidebarProvider
vi.mock('vscode', () => ({
    Uri: {
        joinPath: (base: { fsPath: string }, ...segments: string[]) => ({
            fsPath: [base.fsPath, ...segments].join('/'),
        }),
    },
    EventEmitter: class {
        private listeners: ((e: unknown) => void)[] = [];
        event = (listener: (e: unknown) => void) => {
            this.listeners.push(listener);
            return { dispose: () => { } };
        };
        fire(data: unknown) {
            this.listeners.forEach((l) => l(data));
        }
        dispose() { }
    },
    Disposable: class {
        static from() { return { dispose: () => { } }; }
        dispose() { }
    },
    CancellationTokenSource: class {
        token = {
            isCancellationRequested: false,
            onCancellationRequested: vi.fn().mockReturnValue({ dispose: () => { } }),
        };
    },
}));

// Mock constants
vi.mock('../constants', () => ({
    TIMEOUTS: {
        USER_CONFIRMATION: 60000,
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

describe('SidebarProvider', () => {
    describe('Request ID generation', () => {
        it('should generate unique request IDs', async () => {
            // Import dynamically after mocks
            const { SidebarProvider } = await import('./SidebarProvider');

            const mockStateManager = {
                onStateChange: vi.fn().mockReturnValue({ dispose: () => { } }),
                getWorkspaceState: vi.fn().mockReturnValue({}),
                getInteractionHistory: vi.fn().mockReturnValue([]),
            };

            const provider = new SidebarProvider(
                { fsPath: '/test' } as never,
                mockStateManager as never
            );

            // Access private method via type casting for testing
            const generateId = (provider as unknown as { generateRequestId: () => string }).generateRequestId;

            if (generateId) {
                const id1 = generateId.call(provider);
                const id2 = generateId.call(provider);

                expect(id1).toMatch(/^req-\d+-[a-z0-9]+$/);
                expect(id2).toMatch(/^req-\d+-[a-z0-9]+$/);
                expect(id1).not.toBe(id2);
            }

            provider.dispose();
        });
    });

    describe('Message posting', () => {
        it('should not throw when webview is not available', async () => {
            const { SidebarProvider } = await import('./SidebarProvider');

            const mockStateManager = {
                onStateChange: vi.fn().mockReturnValue({ dispose: () => { } }),
                getWorkspaceState: vi.fn().mockReturnValue({}),
                getInteractionHistory: vi.fn().mockReturnValue([]),
            };

            const provider = new SidebarProvider(
                { fsPath: '/test' } as never,
                mockStateManager as never
            );

            // Should not throw
            expect(() => {
                provider.postMessage({ type: 'test', payload: {} });
            }).not.toThrow();

            provider.dispose();
        });
    });

    describe('Request cancellation', () => {
        it('should return false when no pending requests', async () => {
            const { SidebarProvider } = await import('./SidebarProvider');

            const mockStateManager = {
                onStateChange: vi.fn().mockReturnValue({ dispose: () => { } }),
                getWorkspaceState: vi.fn().mockReturnValue({}),
                getInteractionHistory: vi.fn().mockReturnValue([]),
            };

            const provider = new SidebarProvider(
                { fsPath: '/test' } as never,
                mockStateManager as never
            );

            const result = provider.cancelCurrentRequest();
            expect(result).toBe(false);

            provider.dispose();
        });
    });

    describe('Disposal', () => {
        it('should clean up on dispose', async () => {
            const { SidebarProvider } = await import('./SidebarProvider');

            const mockStateManager = {
                onStateChange: vi.fn().mockReturnValue({ dispose: () => { } }),
                getWorkspaceState: vi.fn().mockReturnValue({}),
                getInteractionHistory: vi.fn().mockReturnValue([]),
            };

            const provider = new SidebarProvider(
                { fsPath: '/test' } as never,
                mockStateManager as never
            );

            expect(() => provider.dispose()).not.toThrow();
        });
    });
});
