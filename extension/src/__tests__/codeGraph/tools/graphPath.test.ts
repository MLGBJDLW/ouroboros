/**
 * Graph Path Tool Tests
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

import { createGraphPathTool, type GraphPathInput } from '../../../codeGraph/tools/graphPath';
import type { CodeGraphManager } from '../../../codeGraph/CodeGraphManager';
import type { GraphQuery } from '../../../codeGraph/core/GraphQuery';
import type { PathResult } from '../../../codeGraph/core/types';

interface MockToolResult {
    parts: Array<{ text: string }>;
}

// Helper to invoke tool with proper VS Code API format
async function invokeTool(
    tool: ReturnType<typeof createGraphPathTool>,
    input: GraphPathInput
): Promise<{ success: boolean; data: { tool: string; result: unknown } }> {
    const result = await tool.invoke(
        { input } as never,
        { isCancellationRequested: false } as never
    );
    // Parse the JSON from LanguageModelToolResult
    const output = JSON.parse((result as unknown as MockToolResult).parts[0].text);
    return output;
}

describe('createGraphPathTool', () => {
    let mockQuery: Partial<GraphQuery>;
    let mockManager: Partial<CodeGraphManager>;

    beforeEach(() => {
        mockQuery = {
            path: vi.fn(),
        };
        mockManager = { 
            getQuery: () => mockQuery as GraphQuery,
        };
    });

    it('should return path result successfully', async () => {
        const mockResult: PathResult = {
            from: 'src/a.ts',
            to: 'src/b.ts',
            paths: [
                {
                    nodes: ['file:src/a.ts', 'file:src/b.ts'],
                    edges: ['edge:src/a.ts:src/b.ts'],
                    length: 1,
                },
            ],
            connected: true,
            shortestPath: 1,
            meta: {
                tokensEstimate: 150,
                truncated: false,
                maxDepthReached: false,
            },
        };

        vi.mocked(mockQuery.path as NonNullable<typeof mockQuery.path>).mockReturnValue(mockResult);

        const tool = createGraphPathTool(mockManager as CodeGraphManager);
        const result = await invokeTool(tool, { from: 'src/a.ts', to: 'src/b.ts' });

        expect(result.success).toBe(true);
        // New format: pathCount added, edges omitted by default
        const pathResult = result.data.result as Record<string, unknown>;
        expect(pathResult.from).toBe('src/a.ts');
        expect(pathResult.to).toBe('src/b.ts');
        expect(pathResult.connected).toBe(true);
        expect(pathResult.shortestPath).toBe(1);
        expect(pathResult.pathCount).toBe(1);
        // Edges are omitted by default to save tokens
        expect((pathResult.paths as Array<{ nodes: string[]; length: number }>)[0].nodes).toEqual(['file:src/a.ts', 'file:src/b.ts']);
        expect((pathResult.paths as Array<{ nodes: string[]; length: number }>)[0].length).toBe(1);
        expect(result.data.tool).toBe('ouroborosai_graph_path');
        expect(mockQuery.path).toHaveBeenCalledWith('src/a.ts', 'src/b.ts', {
            maxDepth: undefined,
            maxPaths: undefined,
        });
    });

    it('should pass maxDepth and maxPaths parameters', async () => {
        const mockResult: PathResult = {
            from: 'src/a.ts',
            to: 'src/c.ts',
            paths: [],
            connected: false,
            shortestPath: null,
            meta: { tokensEstimate: 100, truncated: false, maxDepthReached: true },
        };

        vi.mocked(mockQuery.path as NonNullable<typeof mockQuery.path>).mockReturnValue(mockResult);

        const tool = createGraphPathTool(mockManager as CodeGraphManager);
        await invokeTool(tool, { from: 'src/a.ts', to: 'src/c.ts', maxDepth: 3, maxPaths: 5 });

        expect(mockQuery.path).toHaveBeenCalledWith('src/a.ts', 'src/c.ts', {
            maxDepth: 3,
            maxPaths: 5,
        });
    });

    it('should return empty result when query is null', async () => {
        const nullManager = { getQuery: () => null } as unknown as CodeGraphManager;
        const tool = createGraphPathTool(nullManager);
        const result = await invokeTool(tool, { from: 'src/a.ts', to: 'src/b.ts' });
        const pathResult = result.data.result as PathResult;

        expect(result.success).toBe(true);
        expect(pathResult.connected).toBe(false);
        expect(pathResult.paths).toHaveLength(0);
        expect(pathResult.shortestPath).toBeNull();
    });

    it('should return tool via invoke method', async () => {
        const mockResult: PathResult = {
            from: 'src/a.ts',
            to: 'src/b.ts',
            paths: [],
            connected: false,
            shortestPath: null,
            meta: { tokensEstimate: 100, truncated: false, maxDepthReached: false },
        };

        vi.mocked(mockQuery.path as NonNullable<typeof mockQuery.path>).mockReturnValue(mockResult);

        const tool = createGraphPathTool(mockManager as CodeGraphManager);
        
        // Tool should have invoke method (VS Code LanguageModelTool interface)
        expect(typeof tool.invoke).toBe('function');
        
        const result = await invokeTool(tool, { from: 'src/a.ts', to: 'src/b.ts' });
        expect(result.data.tool).toBe('ouroborosai_graph_path');
    });
});
