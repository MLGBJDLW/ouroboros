/**
 * Graph Annotations Tool Tests
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

import { createGraphAnnotationsTool, type GraphAnnotationsInput } from '../../../codeGraph/tools/graphAnnotations';
import type { CodeGraphManager } from '../../../codeGraph/CodeGraphManager';
import type { AnnotationManager } from '../../../codeGraph/annotations/AnnotationManager';

interface MockToolResult {
    parts: Array<{ text: string }>;
}

// Helper to invoke tool with proper VS Code API format
async function invokeTool(
    tool: ReturnType<typeof createGraphAnnotationsTool>,
    input: GraphAnnotationsInput
): Promise<{ success: boolean; data: { tool: string; result: unknown } }> {
    const result = await tool.invoke(
        { input } as never,
        { isCancellationRequested: false } as never
    );
    // Parse the JSON from LanguageModelToolResult
    const output = JSON.parse((result as unknown as MockToolResult).parts[0].text);
    return output;
}

describe('createGraphAnnotationsTool', () => {
    let mockAnnotationManager: Partial<AnnotationManager>;
    let mockManager: Partial<CodeGraphManager>;

    beforeEach(() => {
        mockAnnotationManager = {
            getAll: vi.fn().mockResolvedValue({
                edges: [],
                entrypoints: [],
                ignores: [],
            }),
            addEdge: vi.fn().mockResolvedValue(undefined),
            addEntrypoint: vi.fn().mockResolvedValue(undefined),
            addIgnore: vi.fn().mockResolvedValue(undefined),
            removeEdge: vi.fn().mockResolvedValue(true),
            removeEntrypoint: vi.fn().mockResolvedValue(true),
            removeIgnore: vi.fn().mockResolvedValue(true),
            getFilePath: vi.fn().mockReturnValue('/workspace/.ouroboros/graph/annotations.json'),
        };
        mockManager = { 
            getAnnotationManager: () => mockAnnotationManager as AnnotationManager,
        };
    });

    describe('list action', () => {
        it('should list all annotations', async () => {
            const getAll = mockAnnotationManager.getAll as NonNullable<typeof mockAnnotationManager.getAll>;
            vi.mocked(getAll).mockResolvedValue({
                version: '1.0.0',
                edges: [{ from: 'a.ts', to: 'b.ts', kind: 'imports', confidence: 'high', reason: 'test' }],
                entrypoints: [{ path: 'main.ts', type: 'main', name: 'Main' }],
                ignores: [{ issueKind: 'HANDLER_UNREACHABLE', path: 'legacy/*', reason: 'legacy' }],
            });

            const tool = createGraphAnnotationsTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, { action: 'list' });

            expect(result.success).toBe(true);
            expect(result.data.result).toHaveProperty('edges');
            expect(result.data.result).toHaveProperty('entrypoints');
            expect(result.data.result).toHaveProperty('ignores');
            expect(result.data.result).toHaveProperty('stats');
            expect(result.data.tool).toBe('ouroborosai_graph_annotations');
        });
    });

    describe('addEdge action', () => {
        it('should add edge successfully', async () => {
            const tool = createGraphAnnotationsTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, {
                action: 'addEdge',
                from: 'src/loader.ts',
                to: 'src/plugins/auth.ts',
                edgeKind: 'imports',
                reason: 'dynamic require',
            });

            expect(result.success).toBe(true);
            expect(result.data.result).toHaveProperty('success', true);
            expect(result.data.result).toHaveProperty('message');
            expect((result.data.result as { message: string }).message).toContain('Added edge');
            expect(mockAnnotationManager.addEdge).toHaveBeenCalled();
        });

        it('should fail without required params', async () => {
            const tool = createGraphAnnotationsTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, { action: 'addEdge' });

            expect(result.success).toBe(false);
            expect(result.data.result).toHaveProperty('error');
            expect((result.data.result as { error: { code: string } }).error.code).toBe('MISSING_PARAMS');
        });
    });

    describe('addEntrypoint action', () => {
        it('should add entrypoint successfully', async () => {
            const tool = createGraphAnnotationsTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, {
                action: 'addEntrypoint',
                path: 'src/workers/cleanup.ts',
                entrypointType: 'job',
                name: 'Cleanup Worker',
            });

            expect(result.success).toBe(true);
            expect(result.data.result).toHaveProperty('success', true);
            expect((result.data.result as { message: string }).message).toContain('Added entrypoint');
            expect(mockAnnotationManager.addEntrypoint).toHaveBeenCalled();
        });

        it('should fail without required params', async () => {
            const tool = createGraphAnnotationsTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, { action: 'addEntrypoint', path: 'test.ts' });

            expect(result.success).toBe(false);
            expect((result.data.result as { error: { code: string } }).error.code).toBe('MISSING_PARAMS');
        });
    });

    describe('addIgnore action', () => {
        it('should add ignore rule successfully', async () => {
            const tool = createGraphAnnotationsTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, {
                action: 'addIgnore',
                issueKind: 'HANDLER_UNREACHABLE',
                ignorePath: 'src/legacy/*',
                ignoreReason: 'Legacy code',
            });

            expect(result.success).toBe(true);
            expect(result.data.result).toHaveProperty('success', true);
            expect((result.data.result as { message: string }).message).toContain('Added ignore');
            expect(mockAnnotationManager.addIgnore).toHaveBeenCalled();
        });

        it('should fail without required params', async () => {
            const tool = createGraphAnnotationsTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, { action: 'addIgnore' });

            expect(result.success).toBe(false);
            expect((result.data.result as { error: { code: string } }).error.code).toBe('MISSING_PARAMS');
        });
    });

    describe('remove action', () => {
        it('should remove edge', async () => {
            const tool = createGraphAnnotationsTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, {
                action: 'remove',
                removeType: 'edge',
                from: 'a.ts',
                to: 'b.ts',
            });

            expect(result.success).toBe(true);
            expect(result.data.result).toEqual({ success: true, message: 'Edge removed' });
        });

        it('should remove entrypoint', async () => {
            const tool = createGraphAnnotationsTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, {
                action: 'remove',
                removeType: 'entrypoint',
                path: 'main.ts',
            });

            expect(result.success).toBe(true);
            expect(result.data.result).toEqual({ success: true, message: 'Entrypoint removed' });
        });

        it('should remove ignore rule', async () => {
            const tool = createGraphAnnotationsTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, {
                action: 'remove',
                removeType: 'ignore',
                issueKind: 'HANDLER_UNREACHABLE',
                ignorePath: 'legacy/*',
            });

            expect(result.success).toBe(true);
            expect(result.data.result).toEqual({ success: true, message: 'Ignore rule removed' });
        });
    });

    describe('error handling', () => {
        it('should return error when manager is null', async () => {
            const nullManager = { getAnnotationManager: () => null } as unknown as CodeGraphManager;
            const tool = createGraphAnnotationsTool(nullManager);
            const result = await invokeTool(tool, { action: 'list' });

            expect(result.success).toBe(false);
            expect((result.data.result as { error: { code: string } }).error.code).toBe('NOT_AVAILABLE');
        });

        it('should handle unknown action', async () => {
            const tool = createGraphAnnotationsTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, { action: 'unknown' as 'list' });

            expect(result.success).toBe(false);
            // Unknown action will fail zod validation
            expect((result.data.result as { error: { code: string } }).error.code).toBe('INVALID_INPUT');
        });
    });

    it('should return tool via invoke method', async () => {
        const tool = createGraphAnnotationsTool(mockManager as CodeGraphManager);
        
        // Tool should have invoke method (VS Code LanguageModelTool interface)
        expect(typeof tool.invoke).toBe('function');
        
        const result = await invokeTool(tool, { action: 'list' });
        expect(result.data.tool).toBe('ouroborosai_graph_annotations');
    });
});
