/**
 * Extension constants
 */

export const EXTENSION_ID = 'ouroboros-ai';
export const EXTENSION_DISPLAY_NAME = 'Ouroboros AI';

// View IDs
export const SIDEBAR_VIEW_ID = 'ouroboros.sidebarView';
export const SIDEBAR_CONTAINER_ID = 'ouroboros-sidebar';

// Command IDs
export const COMMANDS = {
    INITIALIZE_PROJECT: 'ouroboros.initializeProject',
    OPEN_SIDEBAR: 'ouroboros.openSidebar',
    CLEAR_HISTORY: 'ouroboros.clearHistory',
    CANCEL_CURRENT_REQUEST: 'ouroboros.cancelCurrentRequest',
    UPDATE_PROMPTS: 'ouroboros.updatePrompts',
    CHECK_PROMPTS_VERSION: 'ouroboros.checkPromptsVersion',
} as const;

// Tool Names
export const TOOLS = {
    ASK: 'ouroborosai_ask',
    MENU: 'ouroborosai_menu',
    CONFIRM: 'ouroborosai_confirm',
    PLAN_REVIEW: 'ouroborosai_plan_review',
    AGENT_HANDOFF: 'ouroborosai_agent_handoff',
    // Code Graph Tools (MVP)
    GRAPH_DIGEST: 'ouroborosai_graph_digest',
    GRAPH_ISSUES: 'ouroborosai_graph_issues',
    GRAPH_IMPACT: 'ouroborosai_graph_impact',
    // Code Graph Tools (v0.2)
    GRAPH_PATH: 'ouroborosai_graph_path',
    GRAPH_MODULE: 'ouroborosai_graph_module',
    GRAPH_ANNOTATIONS: 'ouroborosai_graph_annotations',
    // Code Graph Tools (v0.5)
    GRAPH_CYCLES: 'ouroborosai_graph_cycles',
    GRAPH_LAYERS: 'ouroborosai_graph_layers',
} as const;

// Configuration Keys
export const CONFIG = {
    EXECUTION_MODE: 'ouroboros.executionMode',
    SHOW_STATUS_BAR: 'ouroboros.showStatusBar',
    HISTORY_LIMIT: 'ouroboros.historyLimit',
} as const;

// Execution Modes
export type ExecutionMode = 'task-by-task' | 'phase-by-phase' | 'auto-run';

// Agent Levels
export type AgentLevel = 0 | 1 | 2;

// Workflow Types
export type WorkflowType = 'spec' | 'implement' | 'prd';

// Request Types
export type RequestType = 'ask' | 'menu' | 'confirm' | 'plan_review' | 'phase_complete';

// Request Status
export type RequestStatus = 'pending' | 'responded' | 'cancelled' | 'timeout';

// Timeouts (in milliseconds)
export const TIMEOUTS = {
    USER_CONFIRMATION: 30 * 60 * 1000, // 30 minutes
    AUTO_RUN_TASK: 30 * 1000, // 30 seconds
} as const;

// Storage Keys
export const STORAGE_KEYS = {
    WORKSPACE: {
        CURRENT_SPEC: 'currentSpec',
        CURRENT_PHASE: 'currentPhase',
        TASK_PROGRESS: 'taskProgress',
        EXECUTION_MODE: 'executionMode',
    },
    GLOBAL: {
        INTERACTION_HISTORY: 'interactionHistory',
    },
} as const;
