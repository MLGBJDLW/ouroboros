/**
 * Graph Module Tool Tests
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

import { createGraphModuleTool, type GraphModuleInput } from '../../../codeGraph/tools/graphModule';
import type { CodeGraphManager } from '../../../codeGraph/CodeGraphManager';
import type { GraphQuery } from '../../../codeGraph/core/GraphQuery';
import type { ModuleResult } from '../../../codeGraph/core/types';

interface MockToolResult {
    parts: Array<{ text: string }>;
}

// Helper to invoke tool with proper VS Code API format
async function invokeTool(
    tool: ReturnType<typeof createGraphModuleTool>,
    input: GraphModuleInput
): Promise<{ success: boolean; data: { tool: string; result: unknown } }> {
    const result = await tool.invoke(
        { input } as never,
        { isCancellationRequested: false } as never
    );
    // Parse the JSON from LanguageModelToolResult
    const output = JSON.parse((result as unknown as MockToolResult).parts[0].text);
    return output;
}

describe('createGraphModuleTool', () => {
    let mockQuery: Partial<GraphQuery>;
    let mockManager: Partial<CodeGraphManager>;

    beforeEach(() => {
        mockQuery = {
            module: vi.fn(),
        };
        mockManager = { 
            getQuery: () => mockQuery as GraphQuery,
        };
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

        const tool = createGraphModuleTool(mockManager as CodeGraphManager);
        const result = await invokeTool(tool, { target: 'src/utils/helpers.ts' });

        expect(result.success).toBe(true);
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

        const tool = createGraphModuleTool(mockManager as CodeGraphManager);
        await invokeTool(tool, { target: 'src/index.ts', includeTransitive: true });

        expect(mockQuery.module).toHaveBeenCalledWith('src/index.ts', {
            includeTransitive: true,
        });
    });

    it('should return default result when query is null', async () => {
        const nullManager = { getQuery: () => null } as unknown as CodeGraphManager;
        const tool = createGraphModuleTool(nullManager);
        const result = await invokeTool(tool, { target: 'src/test.ts' });
        const moduleResult = result.data.result as ModuleResult;

        expect(result.success).toBe(true);
        expect(moduleResult.id).toBe('file:src/test.ts');
        expect(moduleResult.path).toBe('src/test.ts');
        expect(moduleResult.imports).toHaveLength(0);
        expect(moduleResult.isBarrel).toBe(false);
    });

    it('should return tool via invoke method', async () => {
        const mockResult: ModuleResult = {
            id: 'file:src/test.ts',
            path: 'src/test.ts',
            name: 'test.ts',
            kind: 'file',
            imports: [],
            importedBy: [],
            exports: [],
            reexports: [],
            entrypoints: [],
            isBarrel: false,
            meta: { tokensEstimate: 100 },
        };

        vi.mocked(mockQuery.module as NonNullable<typeof mockQuery.module>).mockReturnValue(mockResult);

        const tool = createGraphModuleTool(mockManager as CodeGraphManager);
        
        // Tool should have invoke method (VS Code LanguageModelTool interface)
        expect(typeof tool.invoke).toBe('function');
        
        const result = await invokeTool(tool, { target: 'src/test.ts' });
        expect(result.data.tool).toBe('ouroborosai_graph_module');
    });
});
