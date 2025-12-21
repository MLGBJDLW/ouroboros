/**
 * Tests for confirm tool
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
        showInformationMessage: vi.fn(),
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

describe('createConfirmTool', () => {
    let mockStateManager: {
        addInteraction: ReturnType<typeof vi.fn>;
    };

    let mockSidebarProvider: {
        createConfirmRequest: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        vi.clearAllMocks();

        mockStateManager = {
            addInteraction: vi.fn().mockResolvedValue(undefined),
        };

        mockSidebarProvider = {
            createConfirmRequest: vi.fn(),
        };
    });

    it('should return error for invalid input', async () => {
        const { createConfirmTool } = await import('../../tools/confirm');

        const tool = createConfirmTool(mockStateManager as never, mockSidebarProvider as never);

        const result = await tool.invoke(
            { input: {} } as never,
            { isCancellationRequested: false } as never
        );

        const output = JSON.parse((result.parts[0] as { text: string }).text);
        expect(output.success).toBe(false);
    });

    it('should create confirm request successfully', async () => {
        const { createConfirmTool } = await import('../../tools/confirm');

        mockSidebarProvider.createConfirmRequest.mockResolvedValue({
            confirmed: true,
            cancelled: false,
        });

        const tool = createConfirmTool(mockStateManager as never, mockSidebarProvider as never);

        const result = await tool.invoke(
            {
                input: {
                    question: 'Are you sure?',
                },
            } as never,
            { isCancellationRequested: false } as never
        );

        const output = JSON.parse((result.parts[0] as { text: string }).text);
        expect(output.confirmed).toBe(true);
        expect(output.cancelled).toBe(false);
    });

    it('should handle timeout', async () => {
        const { createConfirmTool } = await import('../../tools/confirm');

        mockSidebarProvider.createConfirmRequest.mockResolvedValue({
            confirmed: false,
            cancelled: false,
            timeout: true,
        });

        const tool = createConfirmTool(mockStateManager as never, mockSidebarProvider as never);

        const result = await tool.invoke(
            {
                input: {
                    question: 'Confirm?',
                },
            } as never,
            { isCancellationRequested: false } as never
        );

        const output = JSON.parse((result.parts[0] as { text: string }).text);
        expect(output.timeout).toBe(true);
    });

    it('should fallback to VS Code message box on error', async () => {
        const vscode = await import('vscode');
        const { createConfirmTool } = await import('../../tools/confirm');

        mockSidebarProvider.createConfirmRequest.mockRejectedValue(new Error('Test error'));
        (vscode.window.showInformationMessage as ReturnType<typeof vi.fn>).mockResolvedValue('Yes');

        const tool = createConfirmTool(mockStateManager as never, mockSidebarProvider as never);

        const result = await tool.invoke(
            {
                input: {
                    question: 'Confirm?',
                },
            } as never,
            { isCancellationRequested: false } as never
        );

        const output = JSON.parse((result.parts[0] as { text: string }).text);
        expect(output.confirmed).toBe(true);
    });

    it('should handle cancelled fallback', async () => {
        const vscode = await import('vscode');
        const { createConfirmTool } = await import('../../tools/confirm');

        mockSidebarProvider.createConfirmRequest.mockRejectedValue(new Error('Test error'));
        (vscode.window.showInformationMessage as ReturnType<typeof vi.fn>).mockResolvedValue(
            undefined
        );

        const tool = createConfirmTool(mockStateManager as never, mockSidebarProvider as never);

        const result = await tool.invoke(
            {
                input: {
                    question: 'Confirm?',
                },
            } as never,
            { isCancellationRequested: false } as never
        );

        const output = JSON.parse((result.parts[0] as { text: string }).text);
        expect(output.cancelled).toBe(true);
    });

    it('should use custom labels', async () => {
        const vscode = await import('vscode');
        const { createConfirmTool } = await import('../../tools/confirm');

        mockSidebarProvider.createConfirmRequest.mockRejectedValue(new Error('Test error'));
        (vscode.window.showInformationMessage as ReturnType<typeof vi.fn>).mockResolvedValue(
            'Proceed'
        );

        const tool = createConfirmTool(mockStateManager as never, mockSidebarProvider as never);

        const result = await tool.invoke(
            {
                input: {
                    question: 'Confirm?',
                    yesLabel: 'Proceed',
                    noLabel: 'Cancel',
                },
            } as never,
            { isCancellationRequested: false } as never
        );

        expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
            'Confirm?',
            { modal: true },
            'Proceed',
            'Cancel'
        );

        const output = JSON.parse((result.parts[0] as { text: string }).text);
        expect(output.confirmed).toBe(true);
    });
});
