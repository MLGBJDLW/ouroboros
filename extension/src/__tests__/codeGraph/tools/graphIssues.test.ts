/**
 * Tests for graphIssues tool
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
}));

// Mock logger
vi.mock('../../../utils/logger', () => ({
    createLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    }),
}));

interface MockToolResult {
    parts: Array<{ text: string }>;
}

describe('createGraphIssuesTool', () => {
    let mockManager: {
        getIssues: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        vi.clearAllMocks();

        mockManager = {
            getIssues: vi.fn().mockReturnValue({
                issues: [
                    {
                        id: '1',
                        kind: 'HANDLER_UNREACHABLE',
                        severity: 'warning',
                        file: 'src/unused.ts',
                        summary: 'Unreachable file',
                        evidence: ['Not imported'],
                        suggestedFix: ['Import or remove'],
                    },
                ],
                stats: {
                    total: 1,
                    returned: 1,
                    byKind: { HANDLER_UNREACHABLE: 1 },
                    bySeverity: { warning: 1 },
                },
                meta: {
                    tokensEstimate: 200,
                    truncated: false,
                    nextQuerySuggestion: null,
                },
            }),
        };
    });

    it('should return issues successfully', async () => {
        const { createGraphIssuesTool } = await import('../../../codeGraph/tools/graphIssues');

        const tool = createGraphIssuesTool(mockManager as never);

        const result = await tool.invoke(
            { input: {} } as never,
            { isCancellationRequested: false } as never
        );

        const output = JSON.parse((result as unknown as MockToolResult).parts[0].text);
        expect(output.success).toBe(true);
        expect(output.data.issues).toHaveLength(1);
        expect(mockManager.getIssues).toHaveBeenCalled();
    });

    it('should pass filter parameters', async () => {
        const { createGraphIssuesTool } = await import('../../../codeGraph/tools/graphIssues');

        const tool = createGraphIssuesTool(mockManager as never);

        await tool.invoke(
            {
                input: {
                    kind: 'HANDLER_UNREACHABLE',
                    severity: 'warning',
                    scope: 'src/',
                    limit: 10,
                },
            } as never,
            { isCancellationRequested: false } as never
        );

        expect(mockManager.getIssues).toHaveBeenCalledWith({
            kind: 'HANDLER_UNREACHABLE',
            severity: 'warning',
            scope: 'src/',
            limit: 10,
        });
    });

    it('should handle errors gracefully', async () => {
        const { createGraphIssuesTool } = await import('../../../codeGraph/tools/graphIssues');

        mockManager.getIssues.mockImplementation(() => {
            throw new Error('Test error');
        });

        const tool = createGraphIssuesTool(mockManager as never);

        const result = await tool.invoke(
            { input: {} } as never,
            { isCancellationRequested: false } as never
        );

        const output = JSON.parse((result as unknown as MockToolResult).parts[0].text);
        expect(output.success).toBe(false);
        expect(output.error).toBe('Test error');
    });
});
