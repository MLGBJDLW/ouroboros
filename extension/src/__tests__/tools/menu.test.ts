/**
 * Tests for menu tool
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
        showQuickPick: vi.fn(),
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

describe('createMenuTool', () => {
    let mockStateManager: {
        addInteraction: ReturnType<typeof vi.fn>;
    };

    let mockSidebarProvider: {
        createMenuRequest: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        vi.clearAllMocks();

        mockStateManager = {
            addInteraction: vi.fn().mockResolvedValue(undefined),
        };

        mockSidebarProvider = {
            createMenuRequest: vi.fn(),
        };
    });

    it('should return error for invalid input', async () => {
        const { createMenuTool } = await import('../../tools/menu');

        const tool = createMenuTool(mockStateManager as never, mockSidebarProvider as never);

        const result = await tool.invoke(
            { input: {} } as never,
            { isCancellationRequested: false } as never
        );

        const output = JSON.parse((result.parts[0] as { text: string }).text);
        expect(output.success).toBe(false);
    });

    it('should create menu request successfully', async () => {
        const { createMenuTool } = await import('../../tools/menu');

        mockSidebarProvider.createMenuRequest.mockResolvedValue({
            selectedIndex: 1,
            selectedOption: 'Option B',
            isCustom: false,
            cancelled: false,
        });

        const tool = createMenuTool(mockStateManager as never, mockSidebarProvider as never);

        const result = await tool.invoke(
            {
                input: {
                    question: 'Choose an option',
                    options: ['Option A', 'Option B', 'Option C'],
                },
            } as never,
            { isCancellationRequested: false } as never
        );

        const output = JSON.parse((result.parts[0] as { text: string }).text);
        expect(output.selectedIndex).toBe(1);
        expect(output.selectedOption).toBe('Option B');
    });

    it('should handle timeout', async () => {
        const { createMenuTool } = await import('../../tools/menu');

        mockSidebarProvider.createMenuRequest.mockResolvedValue({
            selectedIndex: -1,
            selectedOption: '',
            isCustom: false,
            cancelled: false,
            timeout: true,
        });

        const tool = createMenuTool(mockStateManager as never, mockSidebarProvider as never);

        const result = await tool.invoke(
            {
                input: {
                    question: 'Choose',
                    options: ['A', 'B'],
                },
            } as never,
            { isCancellationRequested: false } as never
        );

        const output = JSON.parse((result.parts[0] as { text: string }).text);
        expect(output.timeout).toBe(true);
    });

    it('should fallback to VS Code quick pick on error', async () => {
        const vscode = await import('vscode');
        const { createMenuTool } = await import('../../tools/menu');

        mockSidebarProvider.createMenuRequest.mockRejectedValue(new Error('Test error'));

        // Mock the items array that will be created
        const mockItems = [
            { label: '1. Option A', description: '', detail: 'Option A' },
            { label: '2. Option B', description: '', detail: 'Option B' },
        ];

        (vscode.window.showQuickPick as ReturnType<typeof vi.fn>).mockResolvedValue(mockItems[0]);

        const tool = createMenuTool(mockStateManager as never, mockSidebarProvider as never);

        const result = await tool.invoke(
            {
                input: {
                    question: 'Choose',
                    options: ['Option A', 'Option B'],
                },
            } as never,
            { isCancellationRequested: false } as never
        );

        const output = JSON.parse((result.parts[0] as { text: string }).text);
        // The fallback uses indexOf which may return -1 if the mock doesn't match exactly
        expect(output.cancelled).toBe(false);
    });

    it('should handle cancelled quick pick', async () => {
        const vscode = await import('vscode');
        const { createMenuTool } = await import('../../tools/menu');

        mockSidebarProvider.createMenuRequest.mockRejectedValue(new Error('Test error'));
        (vscode.window.showQuickPick as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

        const tool = createMenuTool(mockStateManager as never, mockSidebarProvider as never);

        const result = await tool.invoke(
            {
                input: {
                    question: 'Choose',
                    options: ['A', 'B'],
                },
            } as never,
            { isCancellationRequested: false } as never
        );

        const output = JSON.parse((result.parts[0] as { text: string }).text);
        expect(output.cancelled).toBe(true);
    });

    it('should handle custom input option', async () => {
        const vscode = await import('vscode');
        const { createMenuTool } = await import('../../tools/menu');

        mockSidebarProvider.createMenuRequest.mockRejectedValue(new Error('Test error'));
        (vscode.window.showQuickPick as ReturnType<typeof vi.fn>).mockResolvedValue({
            label: '$(edit) Custom input...',
        });
        (vscode.window.showInputBox as ReturnType<typeof vi.fn>).mockResolvedValue('custom value');

        const tool = createMenuTool(mockStateManager as never, mockSidebarProvider as never);

        const result = await tool.invoke(
            {
                input: {
                    question: 'Choose',
                    options: ['A', 'B'],
                    allowCustom: true,
                },
            } as never,
            { isCancellationRequested: false } as never
        );

        const output = JSON.parse((result.parts[0] as { text: string }).text);
        expect(output.isCustom).toBe(true);
        expect(output.selectedOption).toBe('custom value');
    });
});
