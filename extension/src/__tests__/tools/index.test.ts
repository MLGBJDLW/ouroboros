/**
 * Tests for tools index
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use global vscode mock from __mocks__/vscode.ts (no vi.mock needed)

// Mock logger
vi.mock('../../utils/logger', () => ({
    createLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    }),
}));

// Mock constants
vi.mock('../../constants', () => ({
    TOOLS: {
        ASK: 'ouroboros_ask',
        MENU: 'ouroboros_menu',
        CONFIRM: 'ouroboros_confirm',
        PLAN_REVIEW: 'ouroboros_plan_review',
        AGENT_HANDOFF: 'ouroboros_agent_handoff',
        GRAPH_SYMBOLS: 'ouroborosai_graph_symbols',
        GRAPH_REFERENCES: 'ouroborosai_graph_references',
        GRAPH_DEFINITION: 'ouroborosai_graph_definition',
        GRAPH_CALL_HIERARCHY: 'ouroborosai_graph_call_hierarchy',
    },
}));

// Mock tool creators
vi.mock('../../tools/ask', () => ({
    createAskTool: vi.fn().mockReturnValue({}),
}));

vi.mock('../../tools/menu', () => ({
    createMenuTool: vi.fn().mockReturnValue({}),
}));

vi.mock('../../tools/confirm', () => ({
    createConfirmTool: vi.fn().mockReturnValue({}),
}));

vi.mock('../../tools/planReview', () => ({
    createPlanReviewTool: vi.fn().mockReturnValue({}),
}));

vi.mock('../../tools/handoff', () => ({
    createHandoffTool: vi.fn().mockReturnValue({}),
}));

// Mock LSP tools
vi.mock('../../codeGraph/tools/graphSymbols', () => ({
    createGraphSymbolsTool: vi.fn().mockReturnValue({}),
}));

vi.mock('../../codeGraph/tools/graphReferences', () => ({
    createGraphReferencesTool: vi.fn().mockReturnValue({}),
}));

vi.mock('../../codeGraph/tools/graphDefinition', () => ({
    createGraphDefinitionTool: vi.fn().mockReturnValue({}),
}));

vi.mock('../../codeGraph/tools/graphCallHierarchy', () => ({
    createGraphCallHierarchyTool: vi.fn().mockReturnValue({}),
}));

vi.mock('../../codeGraph/lsp', () => ({
    initSymbolService: vi.fn(),
}));

describe('registerTools', () => {
    let mockStateManager: object;
    let mockSidebarProvider: object;

    beforeEach(() => {
        vi.clearAllMocks();

        mockStateManager = {};
        mockSidebarProvider = {};
    });

    it('should register all tools', async () => {
        const vscode = await import('vscode');
        const { registerTools } = await import('../../tools/index');

        const disposables = registerTools(mockStateManager as never, mockSidebarProvider as never);

        // 5 base tools + 4 LSP tools = 9 total (no CodeGraphManager provided)
        expect(vscode.lm.registerTool).toHaveBeenCalledTimes(9);
        expect(disposables).toHaveLength(9);
    });

    it('should register tools with correct names', async () => {
        const vscode = await import('vscode');
        const { registerTools } = await import('../../tools/index');

        registerTools(mockStateManager as never, mockSidebarProvider as never);

        const calls = (vscode.lm.registerTool as ReturnType<typeof vi.fn>).mock.calls;
        const toolNames = calls.map((call) => call[0]);

        // Base tools
        expect(toolNames).toContain('ouroboros_ask');
        expect(toolNames).toContain('ouroboros_menu');
        expect(toolNames).toContain('ouroboros_confirm');
        expect(toolNames).toContain('ouroboros_plan_review');
        expect(toolNames).toContain('ouroboros_agent_handoff');
        
        // LSP tools
        expect(toolNames).toContain('ouroborosai_graph_symbols');
        expect(toolNames).toContain('ouroborosai_graph_references');
        expect(toolNames).toContain('ouroborosai_graph_definition');
        expect(toolNames).toContain('ouroborosai_graph_call_hierarchy');
    });
});
