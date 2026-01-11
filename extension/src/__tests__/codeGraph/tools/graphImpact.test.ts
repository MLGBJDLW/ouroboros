/**
 * Tests for graphImpact tool
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

describe('createGraphImpactTool', () => {
    let mockManager: {
        getImpact: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        vi.clearAllMocks();

        mockManager = {
            getImpact: vi.fn().mockReturnValue({
                target: 'src/utils.ts',
                targetType: 'file',
                directDependents: ['src/index.ts', 'src/app.ts'],
                transitiveImpact: {
                    depth1: 2,
                    depth2: 5,
                    depth3: 8,
                },
                affectedEntrypoints: [
                    { type: 'route', name: 'main', path: 'src/index.ts' },
                ],
                riskAssessment: {
                    level: 'medium',
                    reason: 'Moderate impact, review dependents',
                    factors: ['5 files affected'],
                },
                meta: {
                    tokensEstimate: 350,
                    truncated: false,
                    depthReached: 2,
                },
            }),
        };
    });

    it('should return impact analysis successfully', async () => {
        const { createGraphImpactTool } = await import('../../../codeGraph/tools/graphImpact');

        const tool = createGraphImpactTool(mockManager as never);

        const result = await tool.invoke(
            { input: { target: 'src/utils.ts' } } as never,
            { isCancellationRequested: false } as never
        );

        const output = JSON.parse((result as unknown as MockToolResult).parts[0].text);
        expect(output.success).toBe(true);
        expect(output.data.target).toBe('src/utils.ts');
        expect(output.data.directDependents).toHaveLength(2);
        expect(mockManager.getImpact).toHaveBeenCalledWith('src/utils.ts', undefined);
    });

    it('should pass depth parameter', async () => {
        const { createGraphImpactTool } = await import('../../../codeGraph/tools/graphImpact');

        const tool = createGraphImpactTool(mockManager as never);

        await tool.invoke(
            { input: { target: 'src/utils.ts', depth: 3 } } as never,
            { isCancellationRequested: false } as never
        );

        expect(mockManager.getImpact).toHaveBeenCalledWith('src/utils.ts', 3);
    });

    it('should handle errors gracefully', async () => {
        const { createGraphImpactTool } = await import('../../../codeGraph/tools/graphImpact');

        mockManager.getImpact.mockImplementation(() => {
            throw new Error('Test error');
        });

        const tool = createGraphImpactTool(mockManager as never);

        const result = await tool.invoke(
            { input: { target: 'src/utils.ts' } } as never,
            { isCancellationRequested: false } as never
        );

        const output = JSON.parse((result as unknown as MockToolResult).parts[0].text);
        expect(output.success).toBe(false);
        expect(output.error).toBe('Test error');
    });

    it('should reject invalid input', async () => {
        const { createGraphImpactTool } = await import('../../../codeGraph/tools/graphImpact');

        const tool = createGraphImpactTool(mockManager as never);

        const result = await tool.invoke(
            { input: { depth: 5 } } as never, // missing required target
            { isCancellationRequested: false } as never
        );

        const output = JSON.parse((result as unknown as MockToolResult).parts[0].text);
        expect(output.success).toBe(false);
        expect(output.error).toContain('Invalid input');
    });
});
