/**
 * Tests for ask tool
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

describe('createAskTool', () => {
    let mockStateManager: {
        addInteraction: ReturnType<typeof vi.fn>;
    };

    let mockSidebarProvider: {
        createAskRequest: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        vi.clearAllMocks();

        mockStateManager = {
            addInteraction: vi.fn().mockResolvedValue(undefined),
        };

        mockSidebarProvider = {
            createAskRequest: vi.fn(),
            consumeGraphContext: vi.fn().mockReturnValue([]),
        };
    });

    it('should return error for invalid input', async () => {
        const { createAskTool } = await import('../../tools/ask');

        const tool = createAskTool(mockStateManager as never, mockSidebarProvider as never);

        // AskInputSchema has all optional fields, so we need to test with invalid type
        const result = await tool.invoke(
            { input: { type: 'invalid_type' } } as never,
            { isCancellationRequested: false } as never
        );

        const output = JSON.parse((result as unknown as MockToolResult).parts[0].text);
        expect(output.success).toBe(false);
        expect(output.error).toBeDefined();
    });

    it('should create ask request successfully', async () => {
        const { createAskTool } = await import('../../tools/ask');

        mockSidebarProvider.createAskRequest.mockResolvedValue({
            response: 'user response',
            cancelled: false,
        });

        const tool = createAskTool(mockStateManager as never, mockSidebarProvider as never);

        const result = await tool.invoke(
            {
                input: {
                    question: 'What is your name?',
                    type: 'question',
                },
            } as never,
            { isCancellationRequested: false } as never
        );

        const output = JSON.parse((result as unknown as MockToolResult).parts[0].text);
        expect(output.response).toBe('user response');
        expect(output.cancelled).toBe(false);
        expect(mockStateManager.addInteraction).toHaveBeenCalled();
    });

    it('should handle timeout', async () => {
        const { createAskTool } = await import('../../tools/ask');

        mockSidebarProvider.createAskRequest.mockResolvedValue({
            response: '',
            cancelled: false,
            timeout: true,
        });

        const tool = createAskTool(mockStateManager as never, mockSidebarProvider as never);

        const result = await tool.invoke(
            {
                input: {
                    question: 'Test?',
                    type: 'task',
                },
            } as never,
            { isCancellationRequested: false } as never
        );

        const output = JSON.parse((result as unknown as MockToolResult).parts[0].text);
        expect(output.timeout).toBe(true);
    });

    it('should fallback to VS Code input box on error', async () => {
        const vscode = await import('vscode');
        const { createAskTool } = await import('../../tools/ask');

        mockSidebarProvider.createAskRequest.mockRejectedValue(new Error('Test error'));
        (vscode.window.showInputBox as ReturnType<typeof vi.fn>).mockResolvedValue(
            'fallback response'
        );

        const tool = createAskTool(mockStateManager as never, mockSidebarProvider as never);

        const result = await tool.invoke(
            {
                input: {
                    question: 'Test?',
                    type: 'question',
                },
            } as never,
            { isCancellationRequested: false } as never
        );

        const output = JSON.parse((result as unknown as MockToolResult).parts[0].text);
        expect(output.response).toBe('fallback response');
        expect(vscode.window.showInputBox).toHaveBeenCalled();
    });

    it('should handle cancelled fallback input', async () => {
        const vscode = await import('vscode');
        const { createAskTool } = await import('../../tools/ask');

        mockSidebarProvider.createAskRequest.mockRejectedValue(new Error('Test error'));
        (vscode.window.showInputBox as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

        const tool = createAskTool(mockStateManager as never, mockSidebarProvider as never);

        const result = await tool.invoke(
            {
                input: {
                    question: 'Test?',
                    type: 'feature',
                },
            } as never,
            { isCancellationRequested: false } as never
        );

        const output = JSON.parse((result as unknown as MockToolResult).parts[0].text);
        expect(output.cancelled).toBe(true);
    });
});
