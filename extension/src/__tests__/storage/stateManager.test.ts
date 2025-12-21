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
            return { dispose: () => {} };
        };
        fire(data: unknown) {
            this.listeners.forEach((l) => l(data));
        }
        dispose() {}
    },
    workspace: {
        getConfiguration: vi.fn().mockReturnValue({
            get: vi.fn().mockReturnValue(undefined),
        }),
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
        vi.clearAllMocks();

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
            const { StateManager } = await import('../../storage/stateManager');
            const manager = new StateManager(mockContext as never);

            await manager.initialize();

            const state = manager.getWorkspaceState();
            expect(state).toBeDefined();
            expect(state.currentPhase).toBe(0);
        });

        it('should load saved workspace state', async () => {
            mockContext.workspaceState.get.mockReturnValue({
                currentSpec: 'test-spec',
                currentPhase: 3,
            });

            const { StateManager } = await import('../../storage/stateManager');
            const manager = new StateManager(mockContext as never);

            await manager.initialize();

            const state = manager.getWorkspaceState();
            expect(state.currentSpec).toBe('test-spec');
            expect(state.currentPhase).toBe(3);
        });

        it('should load saved interaction history', async () => {
            const savedHistory = [{ id: '1', type: 'ask', timestamp: Date.now() }];
            mockContext.globalState.get.mockReturnValue(savedHistory);

            const { StateManager } = await import('../../storage/stateManager');
            const manager = new StateManager(mockContext as never);

            await manager.initialize();

            const history = manager.getInteractionHistory();
            expect(history).toHaveLength(1);
        });

        it('should load execution mode from configuration', async () => {
            const vscode = await import('vscode');
            (vscode.workspace.getConfiguration as ReturnType<typeof vi.fn>).mockReturnValue({
                get: vi.fn().mockReturnValue('auto-run'),
            });

            const { StateManager } = await import('../../storage/stateManager');
            const manager = new StateManager(mockContext as never);

            await manager.initialize();

            expect(manager.getExecutionMode()).toBe('auto-run');
        });
    });

    describe('Interaction history', () => {
        it('should start with empty history', async () => {
            const { StateManager } = await import('../../storage/stateManager');
            const manager = new StateManager(mockContext as never);

            await manager.initialize();

            const history = manager.getInteractionHistory();
            expect(history).toEqual([]);
        });

        it('should add interaction to history', async () => {
            const { StateManager } = await import('../../storage/stateManager');
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
            expect(history[0].id).toBeDefined();
            expect(history[0].timestamp).toBeDefined();
        });

        it('should trim history when exceeding limit', async () => {
            const vscode = await import('vscode');
            (vscode.workspace.getConfiguration as ReturnType<typeof vi.fn>).mockReturnValue({
                get: vi.fn().mockReturnValue(2), // Set limit to 2
            });

            const { StateManager } = await import('../../storage/stateManager');
            const manager = new StateManager(mockContext as never);

            await manager.initialize();

            // Add 3 interactions
            for (let i = 0; i < 3; i++) {
                await manager.addInteraction({
                    type: 'ask',
                    agentName: 'test',
                    agentLevel: 0,
                    question: `Question ${i}`,
                    response: `Response ${i}`,
                    status: 'responded',
                });
            }

            const history = manager.getInteractionHistory();
            expect(history).toHaveLength(2);
        });
    });

    describe('State updates', () => {
        it('should update workspace state', async () => {
            const { StateManager } = await import('../../storage/stateManager');
            const manager = new StateManager(mockContext as never);

            await manager.initialize();
            await manager.updateWorkspaceState({ currentPhase: 3 });

            const state = manager.getWorkspaceState();
            expect(state.currentPhase).toBe(3);
            expect(mockContext.workspaceState.update).toHaveBeenCalled();
        });

        it('should emit state change event', async () => {
            const { StateManager } = await import('../../storage/stateManager');
            const manager = new StateManager(mockContext as never);

            await manager.initialize();

            const listener = vi.fn();
            manager.onStateChange(listener);

            await manager.updateWorkspaceState({ currentPhase: 5 });

            expect(listener).toHaveBeenCalled();
        });
    });

    describe('Task progress', () => {
        it('should update task progress', async () => {
            const { StateManager } = await import('../../storage/stateManager');
            const manager = new StateManager(mockContext as never);

            await manager.initialize();
            await manager.updateTaskProgress('task-1', true);

            const state = manager.getWorkspaceState();
            expect(state.taskProgress['task-1']).toBe(true);
        });
    });

    describe('Execution mode', () => {
        it('should return current execution mode', async () => {
            const { StateManager } = await import('../../storage/stateManager');
            const manager = new StateManager(mockContext as never);

            await manager.initialize();

            const mode = manager.getExecutionMode();
            // Default mode when config returns undefined
            expect(mode).toBeDefined();
        });
    });

    describe('History clearing', () => {
        it('should clear interaction history', async () => {
            const { StateManager } = await import('../../storage/stateManager');
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
            expect(mockContext.globalState.update).toHaveBeenCalledWith(expect.any(String), []);
        });
    });

    describe('Disposal', () => {
        it('should dispose properly', async () => {
            const { StateManager } = await import('../../storage/stateManager');
            const manager = new StateManager(mockContext as never);

            await manager.initialize();

            expect(() => manager.dispose()).not.toThrow();
        });
    });
});
