/**
 * Graph Search Tool Tests
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

import { createGraphSearchTool, type GraphSearchInput } from '../../../codeGraph/tools/graphSearch';
import type { CodeGraphManager } from '../../../codeGraph/CodeGraphManager';
import { GraphStore } from '../../../codeGraph/core/GraphStore';

interface MockToolResult {
    parts: Array<{ text: string }>;
}

// Helper to invoke tool with proper VS Code API format
async function invokeTool(
    tool: ReturnType<typeof createGraphSearchTool>,
    input: GraphSearchInput
): Promise<{ success: boolean; data: { tool: string; result: unknown } }> {
    const result = await tool.invoke(
        { input } as Parameters<typeof tool.invoke>[0],
        { isCancellationRequested: false } as Parameters<typeof tool.invoke>[1]
    ) as unknown as MockToolResult;
    const text = result.parts[0]?.text ?? '{}';
    return JSON.parse(text);
}

describe('GraphSearchTool', () => {
    let store: GraphStore;
    let mockManager: Partial<CodeGraphManager>;

    beforeEach(() => {
        store = new GraphStore();
        mockManager = {
            getStore: () => store,
        };
    });

    describe('createGraphSearchTool', () => {
        it('should create tool with invoke method', () => {
            const tool = createGraphSearchTool(mockManager as CodeGraphManager);
            expect(typeof tool.invoke).toBe('function');
        });
    });

    describe('invoke - file search', () => {
        it('should return empty result when no store', async () => {
            const nullManager = { getStore: () => null } as unknown as CodeGraphManager;
            const tool = createGraphSearchTool(nullManager);
            const result = await invokeTool(tool, { query: 'test' });
            
            expect(result.success).toBe(true);
            expect(result.data.result).toHaveProperty('results');
            expect((result.data.result as { results: unknown[] }).results).toHaveLength(0);
        });

        it('should find files by exact name match', async () => {
            store.addNode({ id: 'file:src/utils/helpers.ts', kind: 'file', name: 'helpers.ts', path: 'src/utils/helpers.ts' });
            store.addNode({ id: 'file:src/utils/format.ts', kind: 'file', name: 'format.ts', path: 'src/utils/format.ts' });

            const tool = createGraphSearchTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, { query: 'helpers.ts', type: 'file' });
            
            expect(result.success).toBe(true);
            const data = result.data.result as { results: Array<{ name: string; score: number }> };
            expect(data.results.length).toBeGreaterThan(0);
            expect(data.results[0].name).toBe('helpers.ts');
            expect(data.results[0].score).toBe(100); // Exact match
        });

        it('should find files by partial name match', async () => {
            store.addNode({ id: 'file:src/components/Button.tsx', kind: 'file', name: 'Button.tsx', path: 'src/components/Button.tsx' });
            store.addNode({ id: 'file:src/components/Input.tsx', kind: 'file', name: 'Input.tsx', path: 'src/components/Input.tsx' });

            const tool = createGraphSearchTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, { query: 'Button', type: 'file' });
            
            expect(result.success).toBe(true);
            const data = result.data.result as { results: Array<{ name: string }> };
            expect(data.results.some(r => r.name === 'Button.tsx')).toBe(true);
        });

        it('should respect scope parameter', async () => {
            store.addNode({ id: 'file:src/utils/helpers.ts', kind: 'file', name: 'helpers.ts', path: 'src/utils/helpers.ts' });
            store.addNode({ id: 'file:lib/utils/helpers.ts', kind: 'file', name: 'helpers.ts', path: 'lib/utils/helpers.ts' });

            const tool = createGraphSearchTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, { query: 'helpers', type: 'file', scope: 'src' });
            
            expect(result.success).toBe(true);
            const data = result.data.result as { results: Array<{ path: string }> };
            expect(data.results.every(r => r.path.startsWith('src'))).toBe(true);
        });

        it('should respect limit parameter', async () => {
            for (let i = 0; i < 30; i++) {
                store.addNode({ id: `file:src/file${i}.ts`, kind: 'file', name: `file${i}.ts`, path: `src/file${i}.ts` });
            }

            const tool = createGraphSearchTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, { query: 'file', type: 'file', limit: 5 });
            
            expect(result.success).toBe(true);
            const data = result.data.result as { results: unknown[]; stats: { total: number; returned: number } };
            expect(data.results.length).toBe(5);
            expect(data.stats.returned).toBe(5);
        });
    });

    describe('invoke - symbol search', () => {
        it('should find symbols by name', async () => {
            store.addNode({ 
                id: 'file:src/services/UserService.ts', 
                kind: 'file', 
                name: 'UserService.ts', 
                path: 'src/services/UserService.ts',
                meta: { exports: ['UserService', 'createUser', 'deleteUser'] }
            });

            const tool = createGraphSearchTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, { query: 'createUser', type: 'symbol' });
            
            expect(result.success).toBe(true);
            const data = result.data.result as { results: Array<{ type: string; name: string }> };
            expect(data.results.some(r => r.type === 'symbol' && r.name === 'createUser')).toBe(true);
        });
    });

    describe('invoke - directory search', () => {
        it('should find directories by name', async () => {
            store.addNode({ id: 'file:src/features/auth/login.ts', kind: 'file', name: 'login.ts', path: 'src/features/auth/login.ts' });
            store.addNode({ id: 'file:src/features/auth/logout.ts', kind: 'file', name: 'logout.ts', path: 'src/features/auth/logout.ts' });

            const tool = createGraphSearchTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, { query: 'auth', type: 'directory' });
            
            expect(result.success).toBe(true);
            const data = result.data.result as { results: Array<{ type: string; name: string }> };
            expect(data.results.some(r => r.type === 'directory' && r.name === 'auth')).toBe(true);
        });
    });

    describe('invoke - all types search', () => {
        it('should search all types by default', async () => {
            store.addNode({ 
                id: 'file:src/auth/AuthService.ts', 
                kind: 'file', 
                name: 'AuthService.ts', 
                path: 'src/auth/AuthService.ts',
                meta: { exports: ['AuthService'] }
            });

            const tool = createGraphSearchTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, { query: 'auth' });
            
            expect(result.success).toBe(true);
            const data = result.data.result as { stats: { byType: { file: number; symbol: number; directory: number } } };
            // Should find file, symbol, and directory matches
            expect(data.stats.byType.file + data.stats.byType.symbol + data.stats.byType.directory).toBeGreaterThan(0);
        });
    });

    describe('meta information', () => {
        it('should include tokens estimate', async () => {
            const tool = createGraphSearchTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, { query: 'test' });
            
            expect(result.data.result).toHaveProperty('meta');
            expect((result.data.result as { meta: { tokensEstimate: number } }).meta.tokensEstimate).toBeGreaterThanOrEqual(0);
        });
    });
});
