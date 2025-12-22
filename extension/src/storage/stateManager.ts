/**
 * State Manager - Main state management coordinator
 */

import * as vscode from 'vscode';
import { DisposableBase } from '../utils/disposable';
import { createLogger } from '../utils/logger';
import { STORAGE_KEYS, CONFIG, type ExecutionMode, type WorkflowType } from '../constants';
import type { StoredInteraction } from '../tools/types';
import type { SpecInfo } from '../services/specScanner';

const logger = createLogger('StateManager');

export interface WorkspaceState {
    currentSpec: string | undefined;
    currentPhase: number;
    workflowType?: WorkflowType;
    totalPhases?: number;
    phaseStatus?: string;
    taskProgress: Record<string, boolean>;
    executionMode: ExecutionMode;
    hasCopilotChatOpened?: boolean;
    selectedWorkspacePath?: string;
    // File-based specs data
    activeSpecs?: SpecInfo[];
    archivedSpecs?: SpecInfo[];
}

export interface GlobalState {
    interactionHistory: StoredInteraction[];
}

/**
 * State manager for workspace and global state
 */
export class StateManager extends DisposableBase {
    private workspaceState: WorkspaceState = {
        currentSpec: undefined,
        currentPhase: 0,
        workflowType: undefined,
        totalPhases: undefined,
        phaseStatus: '',
        taskProgress: {},
        executionMode: 'task-by-task',
    };

    private globalState: GlobalState = {
        interactionHistory: [],
    };

    private readonly onStateChangeEmitter = new vscode.EventEmitter<WorkspaceState>();
    public readonly onStateChange = this.onStateChangeEmitter.event;

    constructor(private readonly context: vscode.ExtensionContext) {
        super();
        this.register(this.onStateChangeEmitter);
    }

    /**
     * Initialize state from storage
     */
    async initialize(): Promise<void> {
        logger.info('Initializing state manager...');

        // Load workspace state
        const savedWorkspaceState = this.context.workspaceState.get<WorkspaceState>(
            STORAGE_KEYS.WORKSPACE.CURRENT_SPEC
        );
        if (savedWorkspaceState) {
            this.workspaceState = { ...this.workspaceState, ...savedWorkspaceState };
        }

        // Load global state
        const savedHistory = this.context.globalState.get<StoredInteraction[]>(
            STORAGE_KEYS.GLOBAL.INTERACTION_HISTORY
        );
        if (savedHistory) {
            this.globalState.interactionHistory = savedHistory;
        }

        // Load execution mode from configuration
        const executionMode = vscode.workspace
            .getConfiguration()
            .get<ExecutionMode>(CONFIG.EXECUTION_MODE);
        if (executionMode) {
            this.workspaceState.executionMode = executionMode;
        }

        logger.info('State manager initialized', {
            currentSpec: this.workspaceState.currentSpec,
            historyCount: this.globalState.interactionHistory.length,
        });
    }

    /**
     * Get current workspace state
     */
    getWorkspaceState(): Readonly<WorkspaceState> {
        return { ...this.workspaceState };
    }

    /**
     * Update workspace state
     */
    async updateWorkspaceState(updates: Partial<WorkspaceState>): Promise<void> {
        this.workspaceState = { ...this.workspaceState, ...updates };

        await this.context.workspaceState.update(
            STORAGE_KEYS.WORKSPACE.CURRENT_SPEC,
            this.workspaceState
        );

        this.onStateChangeEmitter.fire(this.workspaceState);
        logger.debug('Workspace state updated', updates);
    }

    /**
     * Get interaction history
     */
    getInteractionHistory(): ReadonlyArray<StoredInteraction> {
        return [...this.globalState.interactionHistory];
    }

    /**
     * Add a new interaction to history
     */
    async addInteraction(interaction: Omit<StoredInteraction, 'id' | 'timestamp'>): Promise<void> {
        const historyLimit = vscode.workspace
            .getConfiguration()
            .get<number>(CONFIG.HISTORY_LIMIT, 100);

        const newInteraction: StoredInteraction = {
            ...interaction,
            id: this.generateId(),
            timestamp: Date.now(),
        };

        this.globalState.interactionHistory.push(newInteraction);

        // Trim history if exceeds limit
        if (this.globalState.interactionHistory.length > historyLimit) {
            this.globalState.interactionHistory =
                this.globalState.interactionHistory.slice(-historyLimit);
        }

        await this.context.globalState.update(
            STORAGE_KEYS.GLOBAL.INTERACTION_HISTORY,
            this.globalState.interactionHistory
        );

        logger.debug('Interaction added', { type: interaction.type });
    }

    /**
     * Clear interaction history
     */
    async clearHistory(): Promise<void> {
        this.globalState.interactionHistory = [];
        await this.context.globalState.update(STORAGE_KEYS.GLOBAL.INTERACTION_HISTORY, []);
        logger.info('Interaction history cleared');
    }

    /**
     * Get current execution mode
     */
    getExecutionMode(): ExecutionMode {
        return this.workspaceState.executionMode;
    }

    /**
     * Update task progress
     */
    async updateTaskProgress(taskId: string, completed: boolean): Promise<void> {
        this.workspaceState.taskProgress[taskId] = completed;
        await this.updateWorkspaceState({
            taskProgress: this.workspaceState.taskProgress,
        });
    }

    /**
     * Generate unique ID
     */
    private generateId(): string {
        return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }

    public override dispose(): void {
        logger.info('Disposing state manager');
        super.dispose();
    }
}
