/**
 * TypeScript types for workflow state
 */

export type WorkflowType = 'spec' | 'implement';
export type ExecutionMode = 'task-by-task' | 'phase-by-phase' | 'auto-run';

export interface PhaseInfo {
    number: number;
    name: string;
    status: 'pending' | 'current' | 'completed';
}

export interface WorkflowState {
    type: WorkflowType | null;
    specName: string | null;
    currentPhase: number;
    totalPhases: number;
    phases: PhaseInfo[];
    status: string;
    executionMode: ExecutionMode;
}

export interface TaskProgress {
    id: string;
    name: string;
    completed: boolean;
}

export interface SpecWorkflowPhases {
    research: PhaseInfo;
    requirements: PhaseInfo;
    design: PhaseInfo;
    tasks: PhaseInfo;
    validation: PhaseInfo;
}

export interface ImplementWorkflowProgress {
    tasks: TaskProgress[];
    currentTaskIndex: number;
    totalTasks: number;
}
