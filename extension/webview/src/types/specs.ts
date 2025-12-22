/**
 * Spec-related types for webview
 */

/**
 * Phase information for a spec
 */
export interface SpecPhase {
    name: string;
    file: string;
    status: 'completed' | 'current' | 'pending';
}

/**
 * Task summary from tasks.md
 */
export interface TaskSummary {
    total: number;
    completed: number;
    inProgress: number;
}

/**
 * Information about a spec folder
 */
export interface SpecInfo {
    name: string;
    path: string;
    type: 'spec' | 'implement';
    status: 'active' | 'archived';
    createdAt: number;
    modifiedAt: number;
    phases: SpecPhase[];
    progress: number;
    taskSummary?: TaskSummary;
}
