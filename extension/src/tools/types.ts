/**
 * TypeScript types for LM Tools inputs and outputs
 */

import type { AgentLevel, WorkflowType, RequestType, RequestStatus } from '../constants';

// ============================================================================
// Ask Tool Types
// ============================================================================

export interface AskInput {
    question?: string;
    type?: 'task' | 'question' | 'feature';
    inputLabel?: string;
    agentName?: string;
    agentLevel?: AgentLevel;
}

export interface AskOutput {
    response: string;
    cancelled: boolean;
    timeout?: boolean;
}

// ============================================================================
// Menu Tool Types
// ============================================================================

export interface MenuInput {
    question: string;
    options: string[];
    allowCustom?: boolean;
    agentName?: string;
    agentLevel?: AgentLevel;
}

export interface MenuOutput {
    selectedIndex: number;
    selectedOption: string;
    isCustom: boolean;
    cancelled: boolean;
    timeout?: boolean;
}

// ============================================================================
// Confirm Tool Types
// ============================================================================

export interface ConfirmInput {
    question: string;
    yesLabel?: string;
    noLabel?: string;
    agentName?: string;
    agentLevel?: AgentLevel;
}

export interface ConfirmOutput {
    confirmed: boolean;
    cancelled: boolean;
    timeout?: boolean;
}

// ============================================================================
// Plan Review Tool Types
// ============================================================================

export interface PlanReviewInput {
    plan: string;
    title?: string;
    mode?: 'review' | 'walkthrough';
    agentName?: string;
    agentLevel?: AgentLevel;
}

export interface PlanReviewOutput {
    approved: boolean;
    feedback?: string;
    cancelled: boolean;
    timeout?: boolean;
}

// ============================================================================
// Agent Handoff Tool Types
// ============================================================================

export interface HandoffInput {
    from: string;
    to: string;
    fromLevel: AgentLevel;
    toLevel: AgentLevel;
    reason?: string;
}

export interface HandoffOutput {
    acknowledged: boolean;
}

// ============================================================================
// Stored Interaction Types
// ============================================================================

export interface WorkflowContext {
    workflow: WorkflowType | 'archive';
    specName: string;
    phase?: number;
}

export interface StoredInteraction {
    id: string;
    timestamp: number;
    type: RequestType;
    agentName: string;
    agentLevel: AgentLevel;
    question?: string;
    response?: string;
    status: RequestStatus;
    workflowContext?: WorkflowContext;
}

// ============================================================================
// Pending Request Types
// ============================================================================

export interface PendingRequest {
    id: string;
    timestamp: number;
    type: RequestType;
    agentName: string;
    agentLevel: AgentLevel;
    data: AskInput | MenuInput | ConfirmInput | PlanReviewInput;
    resolve: (value: unknown) => void;
    reject: (reason?: unknown) => void;
}

// ============================================================================
// Tool Result Types
// ============================================================================

export interface ToolResult<T> {
    success: boolean;
    data?: T;
    error?: string;
}
