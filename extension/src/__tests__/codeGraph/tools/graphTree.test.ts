/**
 * Graph Tree Tool Tests
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

import { createGraphTreeTool, type GraphTreeInput } from '../../../codeGraph/tools/graphTree';
import type { CodeGraphManager } from '../../../codeGraph/CodeGraphManager';
import { GraphStore } from '../../../codeGraph/core/GraphStore';

interface MockToolResult {
    parts: Array<{ text: string }>;
}

// Helper to invoke tool with proper VS Code API format
async function invokeTool(
    tool: ReturnType<typeof createGraphTreeTool>,
    input: GraphTreeInput
): Promise<{ success: boolean; data: { tool: string; result: unknown } }> {
    const result = await tool.invoke(
        { input } as Parameters<typeof tool.invoke>[0],
        { isCancellationRequested: false } as Parameters<typeof tool.invoke>[1]
    ) as unknown as MockToolResult;
    const text = result.parts[0]?.text ?? '{}';
    return JSON.parse(text);
}

interface TreeNode {
    name: string;
    path: string;
    type: 'directory' | 'file';
    children?: TreeNode[];
    stats?: {
        files?: number;
        imports?: number;
        exports?: number;
    };
}

describe('GraphTreeTool', () => {
    let store: GraphStore;
    let mockManager: Partial<CodeGraphManager>;

    beforeEach(() => {
        store = new GraphStore();
        mockManager = {
            getStore: () => store,
        };
    });

    describe('createGraphTreeTool', () => {
        it('should create tool with invoke method', () => {
            const tool = createGraphTreeTool(mockManager as CodeGraphManager);
            expect(typeof tool.invoke).toBe('function');
        });
    });

    describe('invoke - basic tree', () => {
        it('should return empty tree when no store', async () => {
            const nullManager = { getStore: () => null } as unknown as CodeGraphManager;
            const tool = createGraphTreeTool(nullManager);
            const result = await invokeTool(tool, {});
            
            expect(result.success).toBe(true);
            expect(result.data.result).toHaveProperty('tree');
            expect((result.data.result as { tree: null }).tree).toBeNull();
        });

        it('should build tree from files', async () => {
            store.addNode({ id: 'file:src/index.ts', kind: 'file', name: 'index.ts', path: 'src/index.ts' });
            store.addNode({ id: 'file:src/utils/helpers.ts', kind: 'file', name: 'helpers.ts', path: 'src/utils/helpers.ts' });

            const tool = createGraphTreeTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, {});
            
            expect(result.success).toBe(true);
            const data = result.data.result as { tree: TreeNode; stats: { directories: number; files: number } };
            expect(data.tree).toBeDefined();
            expect(data.stats.files).toBeGreaterThan(0);
        });

        it('should respect path parameter', async () => {
            store.addNode({ id: 'file:src/index.ts', kind: 'file', name: 'index.ts', path: 'src/index.ts' });
            store.addNode({ id: 'file:src/utils/helpers.ts', kind: 'file', name: 'helpers.ts', path: 'src/utils/helpers.ts' });
            store.addNode({ id: 'file:lib/index.ts', kind: 'file', name: 'index.ts', path: 'lib/index.ts' });

            const tool = createGraphTreeTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, { path: 'src' });
            
            expect(result.success).toBe(true);
            const data = result.data.result as { tree: TreeNode; path: string };
            expect(data.path).toBe('src');
        });

        it('should respect depth parameter', async () => {
            store.addNode({ id: 'file:src/a/b/c/deep.ts', kind: 'file', name: 'deep.ts', path: 'src/a/b/c/deep.ts' });

            const tool = createGraphTreeTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, { depth: 1 });
            
            expect(result.success).toBe(true);
            const data = result.data.result as { meta: { depth: number } };
            expect(data.meta.depth).toBe(1);
        });
    });

    describe('invoke - with stats', () => {
        it('should include file stats when includeStats is true', async () => {
            store.addNode({ id: 'file:src/index.ts', kind: 'file', name: 'index.ts', path: 'src/index.ts' });
            store.addNode({ id: 'file:src/utils.ts', kind: 'file', name: 'utils.ts', path: 'src/utils.ts' });
            store.addEdge({ id: 'e1', from: 'file:src/index.ts', to: 'file:src/utils.ts', kind: 'imports', confidence: 'high' });

            const tool = createGraphTreeTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, { includeStats: true });
            
            expect(result.success).toBe(true);
            const data = result.data.result as { tree: TreeNode };
            expect(data.tree.stats).toBeDefined();
        });

        it('should not include stats when includeStats is false', async () => {
            store.addNode({ id: 'file:src/index.ts', kind: 'file', name: 'index.ts', path: 'src/index.ts' });

            const tool = createGraphTreeTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, { includeStats: false });
            
            expect(result.success).toBe(true);
            const data = result.data.result as { tree: TreeNode };
            // Stats should be undefined when disabled
            const findFile = (node: TreeNode): TreeNode | undefined => {
                if (node.type === 'file') return node;
                for (const child of node.children ?? []) {
                    const found = findFile(child);
                    if (found) return found;
                }
                return undefined;
            };
            const fileNode = findFile(data.tree);
            expect(fileNode?.stats).toBeUndefined();
        });
    });

    describe('invoke - with pattern', () => {
        it('should filter files by pattern', async () => {
            store.addNode({ id: 'file:src/index.ts', kind: 'file', name: 'index.ts', path: 'src/index.ts' });
            store.addNode({ id: 'file:src/index.test.ts', kind: 'file', name: 'index.test.ts', path: 'src/index.test.ts' });
            store.addNode({ id: 'file:src/utils.ts', kind: 'file', name: 'utils.ts', path: 'src/utils.ts' });

            const tool = createGraphTreeTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, { pattern: '*.test.ts' });
            
            expect(result.success).toBe(true);
            const data = result.data.result as { meta: { patternApplied: string } };
            expect(data.meta.patternApplied).toBe('*.test.ts');
        });
    });

    describe('invoke - includeFiles', () => {
        it('should include files when includeFiles is true', async () => {
            store.addNode({ id: 'file:src/index.ts', kind: 'file', name: 'index.ts', path: 'src/index.ts' });

            const tool = createGraphTreeTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, { includeFiles: true });
            
            expect(result.success).toBe(true);
            const data = result.data.result as { stats: { files: number } };
            expect(data.stats.files).toBeGreaterThan(0);
        });

        it('should not include files when includeFiles is false', async () => {
            store.addNode({ id: 'file:src/index.ts', kind: 'file', name: 'index.ts', path: 'src/index.ts' });

            const tool = createGraphTreeTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, { includeFiles: false });
            
            expect(result.success).toBe(true);
            const data = result.data.result as { stats: { files: number } };
            expect(data.stats.files).toBe(0);
        });
    });

    describe('meta information', () => {
        it('should include tokens estimate', async () => {
            const tool = createGraphTreeTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, {});
            
            expect(result.data.result).toHaveProperty('meta');
            expect((result.data.result as { meta: { tokensEstimate: number } }).meta.tokensEstimate).toBeGreaterThanOrEqual(0);
        });

        it('should include depth in meta', async () => {
            const tool = createGraphTreeTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, { depth: 3 });
            
            expect((result.data.result as { meta: { depth: number } }).meta.depth).toBe(3);
        });
    });
});
