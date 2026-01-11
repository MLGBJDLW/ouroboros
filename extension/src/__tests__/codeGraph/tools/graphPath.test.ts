/**
 * Graph Path Tool Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGraphPathTool } from '../../../codeGraph/tools/graphPath';
import type { GraphQuery } from '../../../codeGraph/core/GraphQuery';
import type { PathResult } from '../../../codeGraph/core/types';

describe('createGraphPathTool', () => {
    let mockQuery: Partial<GraphQuery>;
    let mockManager: { getQuery: () => GraphQuery | null };

    beforeEach(() => {
        mockQuery = {
            path: vi.fn(),
        };
        mockManager = { getQuery: () => mockQuery as GraphQuery };
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

        vi.mocked(mockQuery.path!).mockReturnValue(mockResult);

        const tool = createGraphPathTool(mockManager);
        const result = await tool.execute({ from: 'src/a.ts', to: 'src/b.ts' });

        expect(result).toEqual(mockResult);
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

        vi.mocked(mockQuery.path!).mockReturnValue(mockResult);

        const tool = createGraphPathTool(mockManager);
        await tool.execute({ from: 'src/a.ts', to: 'src/c.ts', maxDepth: 3, maxPaths: 5 });

        expect(mockQuery.path).toHaveBeenCalledWith('src/a.ts', 'src/c.ts', {
            maxDepth: 3,
            maxPaths: 5,
        });
    });

    it('should return empty result when query is null', async () => {
        const nullManager = { getQuery: () => null };
        const tool = createGraphPathTool(nullManager);
        const result = await tool.execute({ from: 'src/a.ts', to: 'src/b.ts' });

        expect(result.connected).toBe(false);
        expect(result.paths).toHaveLength(0);
        expect(result.shortestPath).toBeNull();
    });

    it('should have correct tool metadata', () => {
        const tool = createGraphPathTool(mockManager);

        expect(tool.name).toBe('ouroborosai_graph_path');
        expect(tool.description).toContain('dependency paths');
        expect(tool.inputSchema).toHaveProperty('properties.from');
        expect(tool.inputSchema).toHaveProperty('properties.to');
    });
});
