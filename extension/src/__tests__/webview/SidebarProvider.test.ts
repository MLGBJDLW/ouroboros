/**
 * Unit tests for SidebarProvider
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
        static from() {
            return { dispose: () => { } };
        }
        dispose() { }
    },
    CancellationTokenSource: class {
        token = {
            isCancellationRequested: false,
            onCancellationRequested: vi.fn().mockReturnValue({ dispose: () => { } }),
        };
        cancel() {
            this.token.isCancellationRequested = true;
        }
    },
}));

// Mock constants
vi.mock('../../constants', () => ({
    TIMEOUTS: {
        USER_CONFIRMATION: 60000,
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

// Mock htmlGenerator
vi.mock('../../webview/htmlGenerator', () => ({
    generateHtml: vi.fn().mockReturnValue('<html></html>'),
}));

// Mock messageHandler
vi.mock('../../webview/messageHandler', () => ({
    handleMessage: vi.fn(),
}));

describe('SidebarProvider', () => {
    let mockStateManager: {
        onStateChange: ReturnType<typeof vi.fn>;
        getWorkspaceState: ReturnType<typeof vi.fn>;
        getInteractionHistory: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();

        mockStateManager = {
            onStateChange: vi.fn().mockReturnValue({ dispose: () => { } }),
            getWorkspaceState: vi.fn().mockReturnValue({}),
            getInteractionHistory: vi.fn().mockReturnValue([]),
        };
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('Request ID generation', () => {
        it('should generate unique request IDs', async () => {
            // Import dynamically after mocks
            const { SidebarProvider } = await import('../../webview/SidebarProvider');

            const provider = new SidebarProvider(
                { fsPath: '/test' } as never,
                mockStateManager as never
            );

            // Access private method via type casting for testing
            const generateId = (provider as unknown as { generateRequestId: () => string })
                .generateRequestId;

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
            const { SidebarProvider } = await import('../../webview/SidebarProvider');

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
            const { SidebarProvider } = await import('../../webview/SidebarProvider');

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
            const { SidebarProvider } = await import('../../webview/SidebarProvider');

            const provider = new SidebarProvider(
                { fsPath: '/test' } as never,
                mockStateManager as never
            );

            expect(() => provider.dispose()).not.toThrow();
        });
    });

    describe('resolveWebviewView', () => {
        it('should setup webview correctly', async () => {
            const { SidebarProvider } = await import('../../webview/SidebarProvider');

            const provider = new SidebarProvider(
                { fsPath: '/test' } as never,
                mockStateManager as never
            );

            const mockWebviewView = {
                webview: {
                    options: {},
                    html: '',
                    postMessage: vi.fn(),
                    onDidReceiveMessage: vi.fn().mockReturnValue({ dispose: vi.fn() }),
                },
            };

            provider.resolveWebviewView(
                mockWebviewView as never,
                {} as never,
                { isCancellationRequested: false } as never
            );

            expect((mockWebviewView.webview.options as { enableScripts?: boolean }).enableScripts).toBe(true);
            expect(mockWebviewView.webview.html).toBeDefined();
            expect(mockWebviewView.webview.postMessage).toHaveBeenCalled();

            provider.dispose();
        });
    });

    describe('updateAgentHandoff', () => {
        it('should post agent handoff message', async () => {
            const { SidebarProvider } = await import('../../webview/SidebarProvider');

            const provider = new SidebarProvider(
                { fsPath: '/test' } as never,
                mockStateManager as never
            );

            const mockWebviewView = {
                webview: {
                    options: {},
                    html: '',
                    postMessage: vi.fn(),
                    onDidReceiveMessage: vi.fn().mockReturnValue({ dispose: vi.fn() }),
                },
            };

            provider.resolveWebviewView(
                mockWebviewView as never,
                {} as never,
                { isCancellationRequested: false } as never
            );

            await provider.updateAgentHandoff({
                from: 'agent1',
                to: 'agent2',
                fromLevel: 0,
                toLevel: 1,
            });

            expect(mockWebviewView.webview.postMessage).toHaveBeenCalledWith({
                type: 'agentHandoff',
                payload: expect.objectContaining({
                    from: 'agent1',
                    to: 'agent2',
                }),
            });

            provider.dispose();
        });
    });

    describe('resolveRequest', () => {
        it('should resolve pending request', async () => {
            const { SidebarProvider } = await import('../../webview/SidebarProvider');

            const provider = new SidebarProvider(
                { fsPath: '/test' } as never,
                mockStateManager as never
            );

            // Access private pendingRequests map
            const pendingRequests = (
                provider as unknown as { pendingRequests: Map<string, unknown> }
            ).pendingRequests;
            const mockResolve = vi.fn();

            pendingRequests.set('test-req', {
                id: 'test-req',
                timestamp: Date.now(),
                type: 'ask',
                agentName: 'test',
                agentLevel: 0,
                data: {},
                resolve: mockResolve,
                reject: vi.fn(),
            });

            provider.resolveRequest('test-req', 'test response');

            expect(mockResolve).toHaveBeenCalledWith('test response');
            expect(pendingRequests.has('test-req')).toBe(false);

            provider.dispose();
        });
    });

    describe('cancelRequest', () => {
        it('should cancel pending request', async () => {
            const { SidebarProvider } = await import('../../webview/SidebarProvider');

            const provider = new SidebarProvider(
                { fsPath: '/test' } as never,
                mockStateManager as never
            );

            const pendingRequests = (
                provider as unknown as { pendingRequests: Map<string, unknown> }
            ).pendingRequests;
            const mockResolve = vi.fn();

            pendingRequests.set('test-req', {
                id: 'test-req',
                timestamp: Date.now(),
                type: 'ask',
                agentName: 'test',
                agentLevel: 0,
                data: {},
                resolve: mockResolve,
                reject: vi.fn(),
            });

            provider.cancelRequest('test-req');

            expect(mockResolve).toHaveBeenCalledWith({ cancelled: true });
            expect(pendingRequests.has('test-req')).toBe(false);

            provider.dispose();
        });
    });

    describe('cancelCurrentRequest', () => {
        it('should cancel the most recent request', async () => {
            const { SidebarProvider } = await import('../../webview/SidebarProvider');

            const provider = new SidebarProvider(
                { fsPath: '/test' } as never,
                mockStateManager as never
            );

            const pendingRequests = (
                provider as unknown as { pendingRequests: Map<string, unknown> }
            ).pendingRequests;
            const mockResolve1 = vi.fn();
            const mockResolve2 = vi.fn();

            pendingRequests.set('req-1', {
                id: 'req-1',
                timestamp: 1000,
                type: 'ask',
                agentName: 'test',
                agentLevel: 0,
                data: {},
                resolve: mockResolve1,
                reject: vi.fn(),
            });

            pendingRequests.set('req-2', {
                id: 'req-2',
                timestamp: 2000,
                type: 'ask',
                agentName: 'test',
                agentLevel: 0,
                data: {},
                resolve: mockResolve2,
                reject: vi.fn(),
            });

            const result = provider.cancelCurrentRequest();

            expect(result).toBe(true);
            expect(mockResolve2).toHaveBeenCalledWith({ cancelled: true });
            expect(mockResolve1).not.toHaveBeenCalled();

            provider.dispose();
        });
    });
});
