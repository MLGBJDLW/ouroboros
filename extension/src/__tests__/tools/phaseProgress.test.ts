/**
 * Tests for phaseProgress tool
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode
vi.mock('vscode', () => ({
    LanguageModelToolResult: class {
        constructor(public parts: unknown[]) {}
    },
    LanguageModelTextPart: class {
        constructor(public text: string) {}
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

describe('createPhaseProgressTool', () => {
    let mockStateManager: {
        updateWorkspaceState: ReturnType<typeof vi.fn>;
        addInteraction: ReturnType<typeof vi.fn>;
    };

    let mockSidebarProvider: {
        updatePhaseProgress: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        vi.clearAllMocks();

        mockStateManager = {
            updateWorkspaceState: vi.fn().mockResolvedValue(undefined),
            addInteraction: vi.fn().mockResolvedValue(undefined),
        };

        mockSidebarProvider = {
            updatePhaseProgress: vi.fn().mockResolvedValue(undefined),
        };
    });

    it('should return error for invalid input', async () => {
        const { createPhaseProgressTool } = await import('../../tools/phaseProgress');

        const tool = createPhaseProgressTool(
            mockStateManager as never,
            mockSidebarProvider as never
        );

        const result = await tool.invoke(
            { input: {} } as never,
            { isCancellationRequested: false } as never
        );

        const output = JSON.parse((result.parts[0] as { text: string }).text);
        expect(output.success).toBe(false);
    });

    it('should update phase progress successfully', async () => {
        const { createPhaseProgressTool } = await import('../../tools/phaseProgress');

        const tool = createPhaseProgressTool(
            mockStateManager as never,
            mockSidebarProvider as never
        );

        const result = await tool.invoke(
            {
                input: {
                    workflow: 'spec',
                    specName: 'test-feature',
                    currentPhase: 2,
                    totalPhases: 5,
                    status: 'In progress',
                },
            } as never,
            { isCancellationRequested: false } as never
        );

        const output = JSON.parse((result.parts[0] as { text: string }).text);
        expect(output.acknowledged).toBe(true);
        expect(mockStateManager.updateWorkspaceState).toHaveBeenCalled();
        expect(mockSidebarProvider.updatePhaseProgress).toHaveBeenCalled();
    });

    it('should handle implement workflow', async () => {
        const { createPhaseProgressTool } = await import('../../tools/phaseProgress');

        const tool = createPhaseProgressTool(
            mockStateManager as never,
            mockSidebarProvider as never
        );

        const result = await tool.invoke(
            {
                input: {
                    workflow: 'implement',
                    specName: 'test-feature',
                    currentPhase: 3,
                    totalPhases: 4,
                    status: 'Implementing',
                },
            } as never,
            { isCancellationRequested: false } as never
        );

        const output = JSON.parse((result.parts[0] as { text: string }).text);
        expect(output.acknowledged).toBe(true);
    });

    it('should fallback to status bar on error', async () => {
        const vscode = await import('vscode');
        const { createPhaseProgressTool } = await import('../../tools/phaseProgress');

        mockSidebarProvider.updatePhaseProgress.mockRejectedValue(new Error('Test error'));

        const tool = createPhaseProgressTool(
            mockStateManager as never,
            mockSidebarProvider as never
        );

        const result = await tool.invoke(
            {
                input: {
                    workflow: 'spec',
                    specName: 'test',
                    currentPhase: 1,
                    totalPhases: 3,
                    status: 'Starting',
                },
            } as never,
            { isCancellationRequested: false } as never
        );

        const output = JSON.parse((result.parts[0] as { text: string }).text);
        expect(output.acknowledged).toBe(true);
        expect(output.fallback).toBe(true);
        expect(vscode.window.setStatusBarMessage).toHaveBeenCalled();
    });
});
