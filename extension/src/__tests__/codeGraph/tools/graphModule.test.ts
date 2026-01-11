/**
 * Graph Module Tool Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGraphModuleTool } from '../../../codeGraph/tools/graphModule';
import type { GraphQuery } from '../../../codeGraph/core/GraphQuery';
import type { ModuleResult } from '../../../codeGraph/core/types';

describe('createGraphModuleTool', () => {
    let mockQuery: Partial<GraphQuery>;
    let mockManager: { getQuery: () => GraphQuery };

    beforeEach(() => {
        mockQuery = {
            module: vi.fn(),
        };
        mockManager = { getQuery: () => mockQuery as GraphQuery };
    });

    it('should return module result successfully', async () => {
        const mockResult: ModuleResult = {
            id: 'file:src/utils/helpers.ts',
            path: 'src/utils/helpers.ts',
            name: 'helpers.ts',
            kind: 'file',
            imports: [{ path: 'lodash', kind: 'imports', confidence: 'high' }],
            importedBy: [{ path: 'src/index.ts', kind: 'imports' }],
            exports: ['formatDate', 'parseJSON'],
            reexports: [],
            entrypoints: [],
            isBarrel: false,
            meta: { tokensEstimate: 200 },
        };

        vi.mocked(mockQuery.module as NonNullable<typeof mockQuery.module>).mockReturnValue(mockResult);

        const tool = createGraphModuleTool(mockManager);
        const result = await tool.execute({ target: 'src/utils/helpers.ts' });

        expect(result.success).toBe(true);
        expect(result.data.result).toEqual(mockResult);
        expect(result.data.tool).toBe('ouroborosai_graph_module');
        expect(mockQuery.module).toHaveBeenCalledWith('src/utils/helpers.ts', {
            includeTransitive: undefined,
        });
    });

    it('should pass includeTransitive parameter', async () => {
        const mockResult: ModuleResult = {
            id: 'file:src/index.ts',
            path: 'src/index.ts',
            name: 'index.ts',
            kind: 'file',
            imports: [],
            importedBy: [],
            exports: [],
            reexports: [],
            entrypoints: [],
            isBarrel: true,
            meta: { tokensEstimate: 150 },
        };

        vi.mocked(mockQuery.module as NonNullable<typeof mockQuery.module>).mockReturnValue(mockResult);

        const tool = createGraphModuleTool(mockManager);
        await tool.execute({ target: 'src/index.ts', includeTransitive: true });

        expect(mockQuery.module).toHaveBeenCalledWith('src/index.ts', {
            includeTransitive: true,
        });
    });

    it('should return default result when query is null', async () => {
        const nullManager = { getQuery: () => null } as unknown as { getQuery: () => GraphQuery };
        const tool = createGraphModuleTool(nullManager);
        const result = await tool.execute({ target: 'src/test.ts' });
        const moduleResult = result.data.result as ModuleResult;

        expect(result.success).toBe(true);
        expect(moduleResult.id).toBe('file:src/test.ts');
        expect(moduleResult.path).toBe('src/test.ts');
        expect(moduleResult.imports).toHaveLength(0);
        expect(moduleResult.isBarrel).toBe(false);
    });

    it('should have correct tool metadata', () => {
        const tool = createGraphModuleTool(mockManager);

        expect(tool.name).toBe('ouroborosai_graph_module');
        expect(tool.description).toContain('detailed information');
        expect(tool.inputSchema).toHaveProperty('properties.target');
        expect(tool.inputSchema).toHaveProperty('properties.includeTransitive');
    });
});
