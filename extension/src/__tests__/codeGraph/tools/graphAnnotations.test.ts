/**
 * Graph Annotations Tool Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGraphAnnotationsTool } from '../../../codeGraph/tools/graphAnnotations';
import type { AnnotationManager } from '../../../codeGraph/annotations/AnnotationManager';

describe('createGraphAnnotationsTool', () => {
    let mockManager: Partial<AnnotationManager>;
    let getManager: () => AnnotationManager | null;

    beforeEach(() => {
        mockManager = {
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
        getManager = () => mockManager as AnnotationManager;
    });

    describe('list action', () => {
        it('should list all annotations', async () => {
            vi.mocked(mockManager.getAll!).mockResolvedValue({
                version: '1.0.0',
                edges: [{ from: 'a.ts', to: 'b.ts', kind: 'imports', confidence: 'high', reason: 'test' }],
                entrypoints: [{ path: 'main.ts', type: 'main', name: 'Main' }],
                ignores: [{ issueKind: 'HANDLER_UNREACHABLE', path: 'legacy/*', reason: 'legacy' }],
            });

            const tool = createGraphAnnotationsTool(getManager);
            const result = await tool.execute({ action: 'list' });

            expect(result).toHaveProperty('edges');
            expect(result).toHaveProperty('entrypoints');
            expect(result).toHaveProperty('ignores');
            expect(result).toHaveProperty('stats');
        });
    });

    describe('addEdge action', () => {
        it('should add edge successfully', async () => {
            const tool = createGraphAnnotationsTool(getManager);
            const result = await tool.execute({
                action: 'addEdge',
                from: 'src/loader.ts',
                to: 'src/plugins/auth.ts',
                edgeKind: 'imports',
                reason: 'dynamic require',
            });

            expect(result).toEqual({ success: true, message: expect.stringContaining('Added edge') });
            expect(mockManager.addEdge).toHaveBeenCalled();
        });

        it('should fail without required params', async () => {
            const tool = createGraphAnnotationsTool(getManager);
            const result = await tool.execute({ action: 'addEdge' });

            expect(result).toEqual({ success: false, message: expect.stringContaining('required') });
        });
    });

    describe('addEntrypoint action', () => {
        it('should add entrypoint successfully', async () => {
            const tool = createGraphAnnotationsTool(getManager);
            const result = await tool.execute({
                action: 'addEntrypoint',
                path: 'src/workers/cleanup.ts',
                entrypointType: 'job',
                name: 'Cleanup Worker',
            });

            expect(result).toEqual({ success: true, message: expect.stringContaining('Added entrypoint') });
            expect(mockManager.addEntrypoint).toHaveBeenCalled();
        });

        it('should fail without required params', async () => {
            const tool = createGraphAnnotationsTool(getManager);
            const result = await tool.execute({ action: 'addEntrypoint', path: 'test.ts' });

            expect(result).toEqual({ success: false, message: expect.stringContaining('required') });
        });
    });

    describe('addIgnore action', () => {
        it('should add ignore rule successfully', async () => {
            const tool = createGraphAnnotationsTool(getManager);
            const result = await tool.execute({
                action: 'addIgnore',
                issueKind: 'HANDLER_UNREACHABLE',
                ignorePath: 'src/legacy/*',
                ignoreReason: 'Legacy code',
            });

            expect(result).toEqual({ success: true, message: expect.stringContaining('Added ignore') });
            expect(mockManager.addIgnore).toHaveBeenCalled();
        });

        it('should fail without required params', async () => {
            const tool = createGraphAnnotationsTool(getManager);
            const result = await tool.execute({ action: 'addIgnore' });

            expect(result).toEqual({ success: false, message: expect.stringContaining('required') });
        });
    });

    describe('remove action', () => {
        it('should remove edge', async () => {
            const tool = createGraphAnnotationsTool(getManager);
            const result = await tool.execute({
                action: 'remove',
                removeType: 'edge',
                from: 'a.ts',
                to: 'b.ts',
            });

            expect(result).toEqual({ success: true, message: 'Edge removed' });
        });

        it('should remove entrypoint', async () => {
            const tool = createGraphAnnotationsTool(getManager);
            const result = await tool.execute({
                action: 'remove',
                removeType: 'entrypoint',
                path: 'main.ts',
            });

            expect(result).toEqual({ success: true, message: 'Entrypoint removed' });
        });

        it('should remove ignore rule', async () => {
            const tool = createGraphAnnotationsTool(getManager);
            const result = await tool.execute({
                action: 'remove',
                removeType: 'ignore',
                issueKind: 'HANDLER_UNREACHABLE',
                ignorePath: 'legacy/*',
            });

            expect(result).toEqual({ success: true, message: 'Ignore rule removed' });
        });
    });

    describe('error handling', () => {
        it('should return error when manager is null', async () => {
            const tool = createGraphAnnotationsTool(() => null);
            const result = await tool.execute({ action: 'list' });

            expect(result).toEqual({ success: false, message: expect.stringContaining('not available') });
        });

        it('should handle unknown action', async () => {
            const tool = createGraphAnnotationsTool(getManager);
            const result = await tool.execute({ action: 'unknown' as any });

            expect(result).toEqual({ success: false, message: expect.stringContaining('Unknown action') });
        });
    });

    it('should have correct tool metadata', () => {
        const tool = createGraphAnnotationsTool(getManager);

        expect(tool.name).toBe('ouroborosai_graph_annotations');
        expect(tool.description).toContain('annotations');
        expect(tool.inputSchema).toHaveProperty('properties.action');
    });
});
