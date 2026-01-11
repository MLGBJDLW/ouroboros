/**
 * Tests for graphDigest tool
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

describe('createGraphDigestTool', () => {
    let mockManager: {
        getDigest: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        vi.clearAllMocks();

        mockManager = {
            getDigest: vi.fn().mockReturnValue({
                summary: {
                    files: 10,
                    modules: 5,
                    entrypoints: 3,
                    edges: 20,
                },
                entrypoints: {
                    routes: ['GET /api/users'],
                    commands: [],
                    pages: ['dashboard'],
                    jobs: [],
                },
                hotspots: [
                    { path: 'src/utils.ts', importers: 8, exports: 5 },
                ],
                issues: {
                    HANDLER_UNREACHABLE: 2,
                    DYNAMIC_EDGE_UNKNOWN: 1,
                    BROKEN_EXPORT_CHAIN: 0,
                },
                meta: {
                    lastIndexed: '2024-01-01T00:00:00.000Z',
                    tokensEstimate: 450,
                    truncated: false,
                    scopeApplied: null,
                },
            }),
        };
    });

    it('should return digest successfully', async () => {
        const { createGraphDigestTool } = await import('../../../codeGraph/tools/graphDigest');

        const tool = createGraphDigestTool(mockManager as never);

        const result = await tool.invoke(
            { input: {} } as never,
            { isCancellationRequested: false } as never
        );

        const output = JSON.parse((result as unknown as MockToolResult).parts[0].text);
        expect(output.success).toBe(true);
        expect(output.data.result.summary.files).toBe(10);
        expect(output.data.tool).toBe('ouroborosai_graph_digest');
        expect(output.data.meta).toHaveProperty('approxTokens');
        expect(mockManager.getDigest).toHaveBeenCalledWith(undefined);
    });

    it('should pass scope parameter', async () => {
        const { createGraphDigestTool } = await import('../../../codeGraph/tools/graphDigest');

        const tool = createGraphDigestTool(mockManager as never);

        await tool.invoke(
            { input: { scope: 'src/components' } } as never,
            { isCancellationRequested: false } as never
        );

        expect(mockManager.getDigest).toHaveBeenCalledWith('src/components');
    });

    it('should handle errors gracefully', async () => {
        const { createGraphDigestTool } = await import('../../../codeGraph/tools/graphDigest');

        mockManager.getDigest.mockImplementation(() => {
            throw new Error('Test error');
        });

        const tool = createGraphDigestTool(mockManager as never);

        const result = await tool.invoke(
            { input: {} } as never,
            { isCancellationRequested: false } as never
        );

        const output = JSON.parse((result as unknown as MockToolResult).parts[0].text);
        expect(output.success).toBe(false);
        expect(output.data.result.error.message).toBe('Test error');
        expect(output.data.result.error.code).toBe('INTERNAL_ERROR');
    });
});
