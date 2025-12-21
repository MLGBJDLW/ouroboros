/**
 * TypeScript types for agent hierarchy
 */

export type AgentLevel = 0 | 1 | 2;

export interface Agent {
    name: string;
    level: AgentLevel;
    displayName?: string;
}

export interface AgentHandoff {
    from: Agent;
    to: Agent;
    reason?: string;
    timestamp: number;
}

export interface AgentHierarchyState {
    currentAgent: Agent | null;
    handoffHistory: AgentHandoff[];
    activeAgents: Agent[];
}

// Agent name to display name mapping
export const AGENT_DISPLAY_NAMES: Record<string, string> = {
    // Level 0
    'ouroboros-god': 'God Mode',

    // Level 1
    'ouroboros-spec-lead': 'Spec Lead',
    'ouroboros-implement-lead': 'Implement Lead',
    'ouroboros-archive-lead': 'Archive Lead',

    // Level 2
    'ouroboros-researcher': 'Researcher',
    'ouroboros-requirements': 'Requirements',
    'ouroboros-architect': 'Architect',
    'ouroboros-task-planner': 'Task Planner',
    'ouroboros-validator': 'Validator',
    'ouroboros-coder': 'Coder',
    'ouroboros-tester': 'Tester',
    'ouroboros-security': 'Security',
    'ouroboros-docs': 'Docs',
    'ouroboros-git': 'Git',
    'ouroboros-review': 'Review',
    'ouroboros-merger': 'Merger',
};
