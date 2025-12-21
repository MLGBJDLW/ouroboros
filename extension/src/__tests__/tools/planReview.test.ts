/**
 * Tests for planReview tool
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
    workspace: {
        openTextDocument: vi.fn(),
    },
    window: {
        showTextDocument: vi.fn(),
        showInformationMessage: vi.fn(),
        showInputBox: vi.fn(),
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

describe('createPlanReviewTool', () => {
    let mockStateManager: {
        addInteraction: ReturnType<typeof vi.fn>;
    };

    let mockSidebarProvider: {
        createPlanReviewRequest: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        vi.clearAllMocks();

        mockStateManager = {
            addInteraction: vi.fn().mockResolvedValue(undefined),
        };

        mockSidebarProvider = {
            createPlanReviewRequest: vi.fn(),
        };
    });

    it('should return error for invalid input', async () => {
        const { createPlanReviewTool } = await import('../../tools/planReview');

        const tool = createPlanReviewTool(mockStateManager as never, mockSidebarProvider as never);

        const result = await tool.invoke(
            { input: {} } as never,
            { isCancellationRequested: false } as never
        );

        const output = JSON.parse((result.parts[0] as { text: string }).text);
        expect(output.success).toBe(false);
    });

    it('should create plan review request successfully', async () => {
        const { createPlanReviewTool } = await import('../../tools/planReview');

        mockSidebarProvider.createPlanReviewRequest.mockResolvedValue({
            approved: true,
            cancelled: false,
        });

        const tool = createPlanReviewTool(mockStateManager as never, mockSidebarProvider as never);

        const result = await tool.invoke(
            {
                input: {
                    plan: '# Test Plan\n\nThis is a test plan.',
                    title: 'Test Plan',
                    mode: 'review',
                },
            } as never,
            { isCancellationRequested: false } as never
        );

        const output = JSON.parse((result.parts[0] as { text: string }).text);
        expect(output.approved).toBe(true);
        expect(mockStateManager.addInteraction).toHaveBeenCalled();
    });

    it('should handle rejection with feedback', async () => {
        const { createPlanReviewTool } = await import('../../tools/planReview');

        mockSidebarProvider.createPlanReviewRequest.mockResolvedValue({
            approved: false,
            feedback: 'Please add more details',
            cancelled: false,
        });

        const tool = createPlanReviewTool(mockStateManager as never, mockSidebarProvider as never);

        const result = await tool.invoke(
            {
                input: {
                    plan: '# Plan',
                    mode: 'review',
                },
            } as never,
            { isCancellationRequested: false } as never
        );

        const output = JSON.parse((result.parts[0] as { text: string }).text);
        expect(output.approved).toBe(false);
        expect(output.feedback).toBe('Please add more details');
    });

    it('should handle timeout', async () => {
        const { createPlanReviewTool } = await import('../../tools/planReview');

        mockSidebarProvider.createPlanReviewRequest.mockResolvedValue({
            approved: false,
            cancelled: false,
            timeout: true,
        });

        const tool = createPlanReviewTool(mockStateManager as never, mockSidebarProvider as never);

        const result = await tool.invoke(
            {
                input: {
                    plan: '# Plan',
                },
            } as never,
            { isCancellationRequested: false } as never
        );

        const output = JSON.parse((result.parts[0] as { text: string }).text);
        expect(output.timeout).toBe(true);
    });

    it('should fallback to VS Code preview on error', async () => {
        const vscode = await import('vscode');
        const { createPlanReviewTool } = await import('../../tools/planReview');

        mockSidebarProvider.createPlanReviewRequest.mockRejectedValue(new Error('Test error'));
        (vscode.workspace.openTextDocument as ReturnType<typeof vi.fn>).mockResolvedValue({});
        (vscode.window.showTextDocument as ReturnType<typeof vi.fn>).mockResolvedValue({});
        (vscode.window.showInformationMessage as ReturnType<typeof vi.fn>).mockResolvedValue(
            'Approve'
        );

        const tool = createPlanReviewTool(mockStateManager as never, mockSidebarProvider as never);

        const result = await tool.invoke(
            {
                input: {
                    plan: '# Plan',
                    title: 'Test',
                },
            } as never,
            { isCancellationRequested: false } as never
        );

        const output = JSON.parse((result.parts[0] as { text: string }).text);
        expect(output.approved).toBe(true);
    });

    it('should handle request changes in fallback', async () => {
        const vscode = await import('vscode');
        const { createPlanReviewTool } = await import('../../tools/planReview');

        mockSidebarProvider.createPlanReviewRequest.mockRejectedValue(new Error('Test error'));
        (vscode.workspace.openTextDocument as ReturnType<typeof vi.fn>).mockResolvedValue({});
        (vscode.window.showTextDocument as ReturnType<typeof vi.fn>).mockResolvedValue({});
        (vscode.window.showInformationMessage as ReturnType<typeof vi.fn>).mockResolvedValue(
            'Request Changes'
        );
        (vscode.window.showInputBox as ReturnType<typeof vi.fn>).mockResolvedValue(
            'Add more tests'
        );

        const tool = createPlanReviewTool(mockStateManager as never, mockSidebarProvider as never);

        const result = await tool.invoke(
            {
                input: {
                    plan: '# Plan',
                },
            } as never,
            { isCancellationRequested: false } as never
        );

        const output = JSON.parse((result.parts[0] as { text: string }).text);
        expect(output.approved).toBe(false);
        expect(output.feedback).toBe('Add more tests');
    });

    it('should handle cancelled fallback', async () => {
        const vscode = await import('vscode');
        const { createPlanReviewTool } = await import('../../tools/planReview');

        mockSidebarProvider.createPlanReviewRequest.mockRejectedValue(new Error('Test error'));
        (vscode.workspace.openTextDocument as ReturnType<typeof vi.fn>).mockResolvedValue({});
        (vscode.window.showTextDocument as ReturnType<typeof vi.fn>).mockResolvedValue({});
        (vscode.window.showInformationMessage as ReturnType<typeof vi.fn>).mockResolvedValue(
            undefined
        );

        const tool = createPlanReviewTool(mockStateManager as never, mockSidebarProvider as never);

        const result = await tool.invoke(
            {
                input: {
                    plan: '# Plan',
                },
            } as never,
            { isCancellationRequested: false } as never
        );

        const output = JSON.parse((result.parts[0] as { text: string }).text);
        expect(output.cancelled).toBe(true);
    });
});
