/**
 * Unit tests for StateManager
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock VS Code
vi.mock('vscode', () => ({
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
    workspace: {
        getConfiguration: vi.fn().mockReturnValue({
            get: vi.fn().mockReturnValue(undefined),
        }),
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

describe('StateManager', () => {
    let mockContext: {
        workspaceState: {
            get: ReturnType<typeof vi.fn>;
            update: ReturnType<typeof vi.fn>;
        };
        globalState: {
            get: ReturnType<typeof vi.fn>;
            update: ReturnType<typeof vi.fn>;
        };
    };

    beforeEach(() => {
        mockContext = {
            workspaceState: {
                get: vi.fn().mockReturnValue(undefined),
                update: vi.fn().mockResolvedValue(undefined),
            },
            globalState: {
                get: vi.fn().mockReturnValue(undefined),
                update: vi.fn().mockResolvedValue(undefined),
            },
        };
    });

    describe('Initialization', () => {
        it('should initialize with default state', async () => {
            const { StateManager } = await import('./stateManager');
            const manager = new StateManager(mockContext as never);

            await manager.initialize();

            const state = manager.getWorkspaceState();
            expect(state).toBeDefined();
            expect(state.currentPhase).toBe(0);
        });
    });

    describe('Interaction history', () => {
        it('should start with empty history', async () => {
            const { StateManager } = await import('./stateManager');
            const manager = new StateManager(mockContext as never);

            await manager.initialize();

            const history = manager.getInteractionHistory();
            expect(history).toEqual([]);
        });

        it('should add interaction to history', async () => {
            const { StateManager } = await import('./stateManager');
            const manager = new StateManager(mockContext as never);

            await manager.initialize();
            await manager.addInteraction({
                type: 'ask',
                agentName: 'ouroboros',
                agentLevel: 0,
                question: 'What is your task?',
                response: 'Build a feature',
                status: 'responded',
            });

            const history = manager.getInteractionHistory();
            expect(history).toHaveLength(1);
            expect(history[0].type).toBe('ask');
            expect(history[0].response).toBe('Build a feature');
        });
    });

    describe('State updates', () => {
        it('should update workspace state', async () => {
            const { StateManager } = await import('./stateManager');
            const manager = new StateManager(mockContext as never);

            await manager.initialize();
            await manager.updateWorkspaceState({ currentPhase: 3 });

            const state = manager.getWorkspaceState();
            expect(state.currentPhase).toBe(3);
        });

        it('should emit state change event', async () => {
            const { StateManager } = await import('./stateManager');
            const manager = new StateManager(mockContext as never);

            await manager.initialize();

            const listener = vi.fn();
            manager.onStateChange(listener);

            await manager.updateWorkspaceState({ currentPhase: 5 });

            expect(listener).toHaveBeenCalled();
        });
    });

    describe('History clearing', () => {
        it('should clear interaction history', async () => {
            const { StateManager } = await import('./stateManager');
            const manager = new StateManager(mockContext as never);

            await manager.initialize();
            await manager.addInteraction({
                type: 'confirm',
                agentName: 'test',
                agentLevel: 1,
                question: 'Confirm?',
                response: 'yes',
                status: 'responded',
            });

            await manager.clearHistory();

            const history = manager.getInteractionHistory();
            expect(history).toEqual([]);
        });
    });
});
