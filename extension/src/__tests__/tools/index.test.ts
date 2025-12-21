/**
 * Tests for tools index
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode
vi.mock('vscode', () => ({
    lm: {
        registerTool: vi.fn().mockReturnValue({ dispose: vi.fn() }),
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

// Mock constants
vi.mock('../../constants', () => ({
    TOOLS: {
        ASK: 'ouroboros_ask',
        MENU: 'ouroboros_menu',
        CONFIRM: 'ouroboros_confirm',
        PLAN_REVIEW: 'ouroboros_plan_review',
        PHASE_PROGRESS: 'ouroboros_phase_progress',
        AGENT_HANDOFF: 'ouroboros_agent_handoff',
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

vi.mock('../../tools/phaseProgress', () => ({
    createPhaseProgressTool: vi.fn().mockReturnValue({}),
}));

vi.mock('../../tools/handoff', () => ({
    createHandoffTool: vi.fn().mockReturnValue({}),
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

        expect(vscode.lm.registerTool).toHaveBeenCalledTimes(6);
        expect(disposables).toHaveLength(6);
    });

    it('should register tools with correct names', async () => {
        const vscode = await import('vscode');
        const { registerTools } = await import('../../tools/index');

        registerTools(mockStateManager as never, mockSidebarProvider as never);

        const calls = (vscode.lm.registerTool as ReturnType<typeof vi.fn>).mock.calls;
        const toolNames = calls.map((call) => call[0]);

        expect(toolNames).toContain('ouroboros_ask');
        expect(toolNames).toContain('ouroboros_menu');
        expect(toolNames).toContain('ouroboros_confirm');
        expect(toolNames).toContain('ouroboros_plan_review');
        expect(toolNames).toContain('ouroboros_phase_progress');
        expect(toolNames).toContain('ouroboros_agent_handoff');
    });
});
