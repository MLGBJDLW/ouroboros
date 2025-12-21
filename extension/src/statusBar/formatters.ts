/**
 * Status bar text formatters
 */

import type { WorkspaceState } from '../storage/stateManager';

/**
 * Format the status bar text based on current state
 */
export function formatStatusBarText(state: WorkspaceState): string {
    const icon = '$(infinity)';
    const label = 'Ouroboros';

    if (!state.currentSpec) {
        return `${icon} ${label}`;
    }

    const specName = truncate(state.currentSpec, 20);
    const phase = state.currentPhase > 0 ? ` (${state.currentPhase})` : '';
    const workflowLabel = state.workflowType
        ? `${formatWorkflowType(state.workflowType)} `
        : '';
    const modeLabel = state.executionMode
        ? ` | ${formatExecutionMode(state.executionMode)}`
        : '';

    return `${icon} ${label} | ${workflowLabel}${specName}${phase}${modeLabel}`;
}

/**
 * Format a relative timestamp
 */
export function formatRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
        return `${days}d ago`;
    }
    if (hours > 0) {
        return `${hours}h ago`;
    }
    if (minutes > 0) {
        return `${minutes}m ago`;
    }
    if (seconds > 10) {
        return `${seconds}s ago`;
    }
    return 'just now';
}

/**
 * Truncate a string to a maximum length
 */
export function truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) {
        return str;
    }
    return str.substring(0, maxLength - 1) + '…';
}

/**
 * Format agent level for display
 */
export function formatAgentLevel(level: 0 | 1 | 2): string {
    switch (level) {
        case 0:
            return 'L0 (God)';
        case 1:
            return 'L1 (Lead)';
        case 2:
            return 'L2 (Worker)';
        default:
            return `L${level}`;
    }
}

/**
 * Format workflow type for display
 */
export function formatWorkflowType(workflow: 'spec' | 'implement'): string {
    switch (workflow) {
        case 'spec':
            return '$(checklist) Spec';
        case 'implement':
            return '$(gear) Implement';
        default:
            return workflow;
    }
}

/**
 * Format execution mode for display
 */
export function formatExecutionMode(
    mode: 'task-by-task' | 'phase-by-phase' | 'auto-run'
): string {
    switch (mode) {
        case 'task-by-task':
            return 'Task-by-Task';
        case 'phase-by-phase':
            return 'Phase-by-Phase';
        case 'auto-run':
            return 'Auto-Run';
        default:
            return mode;
    }
}
