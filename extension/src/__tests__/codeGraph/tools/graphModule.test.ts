/**
 * Graph Module Tool Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGraphModuleTool } from '../../../codeGraph/tools/graphModule';
import type { GraphQuery } from '../../../codeGraph/core/GraphQuery';
import type { ModuleResult } from '../../../codeGraph/core/types';

describe('createGraphModuleTool', () => {
    let mockQuery: Partial<GraphQuery>;
    let getQuery: () => GraphQuery | null;

    beforeEach(() => {
        mockQuery = {
            module: vi.fn(),
        };
        getQuery = () => mockQuery as GraphQuery;
    });

    it('should return module result successfully', async () => {
        const mockResult: ModuleResult = {
            id: 'file:src/utils/helpers.ts',
            path: 'src/utils/helpers.ts',
            name: 'helpers.ts',
            kind: 'file',
            imports: ['lodash', './constants'],
            importedBy: ['src/index.ts', 'src/api/users.ts'],
            exports: ['formatDate', 'parseJSON'],
            reexports: [],
            entrypoints: [],
            isBarrel: false,
            meta: { tokensEstimate: 200 },
        };

        vi.mocked(mockQuery.module!).mockReturnValue(mockResult);

        const tool = createGraphModuleTool(getQuery);
        const result = await tool.execute({ target: 'src/utils/helpers.ts' });

        expect(result).toEqual(mockResult);
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

        vi.mocked(mockQuery.module!).mockReturnValue(mockResult);

        const tool = createGraphModuleTool(getQuery);
        await tool.execute({ target: 'src/index.ts', includeTransitive: true });

        expect(mockQuery.module).toHaveBeenCalledWith('src/index.ts', {
            includeTransitive: true,
        });
    });

    it('should return default result when query is null', async () => {
        const tool = createGraphModuleTool(() => null);
        const result = await tool.execute({ target: 'src/test.ts' });

        expect(result.id).toBe('file:src/test.ts');
        expect(result.path).toBe('src/test.ts');
        expect(result.imports).toHaveLength(0);
        expect(result.isBarrel).toBe(false);
    });

    it('should have correct tool metadata', () => {
        const tool = createGraphModuleTool(getQuery);

        expect(tool.name).toBe('ouroborosai_graph_module');
        expect(tool.description).toContain('detailed information');
        expect(tool.inputSchema).toHaveProperty('properties.target');
        expect(tool.inputSchema).toHaveProperty('properties.includeTransitive');
    });
});
