/**
 * TypeScript types for webview ↔ extension messages
 */

import type { PendingRequest } from './requests';
import type { AgentHandoff } from './agent';

// Messages from Extension to Webview
export type ExtensionMessage =
    | { type: 'init'; payload: InitPayload }
    | { type: 'stateUpdate'; payload: WorkspaceStatePayload }
    | { type: 'newRequest'; payload: PendingRequest }
    | { type: 'pendingRequestsUpdate'; payload: PendingRequest[] }
    | { type: 'historyUpdate'; payload: StoredInteraction[] }
    | { type: 'phaseProgress'; payload: PhaseProgressPayload }
    | { type: 'agentHandoff'; payload: AgentHandoff }
    | { type: 'refresh' };

export interface InitPayload {
    workspaceState: WorkspaceStatePayload;
    history: StoredInteraction[];
    pendingRequests?: PendingRequest[];
}

export interface WorkspaceStatePayload {
    isInitialized?: boolean;
    hasCopilotChatOpened?: boolean;
    projectName?: string;
    currentSpec?: string;
    currentPhase: number;
    workflowType?: 'spec' | 'implement';
    totalPhases?: number;
    phaseStatus?: string;
    taskProgress: Record<string, boolean>;
    executionMode: 'task-by-task' | 'phase-by-phase' | 'auto-run';
}

export interface PhaseProgressPayload {
    workflow: 'spec' | 'implement';
    specName: string;
    currentPhase: number;
    totalPhases: number;
    status: string;
}

export interface StoredInteraction {
    id: string;
    timestamp: number;
    type: 'ask' | 'menu' | 'confirm' | 'plan_review' | 'phase_complete';
    agentName: string;
    agentLevel: 0 | 1 | 2;
    question?: string;
    response?: string;
    status: 'pending' | 'responded' | 'cancelled' | 'timeout';
    workflowContext?: {
        workflow: 'spec' | 'implement' | 'archive';
        specName: string;
        phase?: number;
    };
}

// Messages from Webview to Extension
export type WebviewMessage =
    | { type: 'ready' }
    | { type: 'response'; payload: ResponsePayload }
    | { type: 'cancel'; payload: { requestId: string } }
    | { type: 'getState' }
    | { type: 'getHistory' }
    | { type: 'clearHistory' }
    | { type: 'updateExecutionMode'; payload: { mode: 'task-by-task' | 'phase-by-phase' | 'auto-run' } };

export interface ResponsePayload {
    requestId: string;
    response: unknown;
}
