/**
 * Tests for handoff tool
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Helper type for mocked tool result
interface MockToolResult {
    parts: Array<{ text: string }>;
}

// Mock vscode
vi.mock('vscode', () => ({
    LanguageModelToolResult: class {
        constructor(public parts: unknown[]) { }
    },
    LanguageModelTextPart: class {
        constructor(public text: string) { }
    },
    window: {
        setStatusBarMessage: vi.fn(),
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

describe('createHandoffTool', () => {
    let mockStateManager: object;

    let mockSidebarProvider: {
        updateAgentHandoff: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        vi.clearAllMocks();

        mockStateManager = {};

        mockSidebarProvider = {
            updateAgentHandoff: vi.fn().mockResolvedValue(undefined),
        };
    });

    it('should return error for invalid input', async () => {
        const { createHandoffTool } = await import('../../tools/handoff');

        const tool = createHandoffTool(mockStateManager as never, mockSidebarProvider as never);

        const result = await tool.invoke(
            { input: {} } as never,
            { isCancellationRequested: false } as never
        );

        const output = JSON.parse((result as unknown as MockToolResult).parts[0].text);
        expect(output.success).toBe(false);
    });

    it('should handle handoff successfully', async () => {
        const { createHandoffTool } = await import('../../tools/handoff');

        const tool = createHandoffTool(mockStateManager as never, mockSidebarProvider as never);

        const result = await tool.invoke(
            {
                input: {
                    from: 'ouroboros',
                    to: 'ouroboros-coder',
                    fromLevel: 0,
                    toLevel: 1,
                    reason: 'Delegating coding task',
                },
            } as never,
            { isCancellationRequested: false } as never
        );

        const output = JSON.parse((result as unknown as MockToolResult).parts[0].text);
        expect(output.acknowledged).toBe(true);
        expect(mockSidebarProvider.updateAgentHandoff).toHaveBeenCalled();
    });

    it('should handle handoff up the hierarchy', async () => {
        const { createHandoffTool } = await import('../../tools/handoff');

        const tool = createHandoffTool(mockStateManager as never, mockSidebarProvider as never);

        const result = await tool.invoke(
            {
                input: {
                    from: 'ouroboros-coder',
                    to: 'ouroboros',
                    fromLevel: 1,
                    toLevel: 0,
                },
            } as never,
            { isCancellationRequested: false } as never
        );

        const output = JSON.parse((result as unknown as MockToolResult).parts[0].text);
        expect(output.acknowledged).toBe(true);
    });

    it('should fallback to status bar on error', async () => {
        const vscode = await import('vscode');
        const { createHandoffTool } = await import('../../tools/handoff');

        mockSidebarProvider.updateAgentHandoff.mockRejectedValue(new Error('Test error'));

        const tool = createHandoffTool(mockStateManager as never, mockSidebarProvider as never);

        const result = await tool.invoke(
            {
                input: {
                    from: 'agent1',
                    to: 'agent2',
                    fromLevel: 0,
                    toLevel: 1,
                    reason: 'test',
                },
            } as never,
            { isCancellationRequested: false } as never
        );

        const output = JSON.parse((result as unknown as MockToolResult).parts[0].text);
        expect(output.acknowledged).toBe(true);
        expect(output.fallback).toBe(true);
        expect(vscode.window.setStatusBarMessage).toHaveBeenCalled();
    });
});
