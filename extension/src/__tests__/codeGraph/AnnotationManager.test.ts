/**
 * AnnotationManager Tests
 * Note: Each test creates a fresh manager instance to avoid state sharing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', () => ({
    promises: {
        readFile: vi.fn(),
        writeFile: vi.fn(),
        mkdir: vi.fn(),
        access: vi.fn(),
    },
}));

import * as fs from 'fs';
import { AnnotationManager } from '../../codeGraph/annotations/AnnotationManager';

describe('AnnotationManager', () => {
    const workspaceRoot = '/workspace';

    beforeEach(() => {
        vi.mocked(fs.promises.readFile).mockRejectedValue(new Error('ENOENT'));
        vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined);
        vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined);
    });

    describe('load', () => {
        it('should load annotations from file', async () => {
            vi.mocked(fs.promises.readFile).mockResolvedValueOnce(JSON.stringify({
                version: '1.0.0',
                edges: [{ from: 'a.ts', to: 'b.ts', kind: 'imports', confidence: 'high', reason: 'test' }],
                entrypoints: [{ path: 'main.ts', type: 'main', name: 'Main' }],
                ignores: [{ issueKind: 'HANDLER_UNREACHABLE', path: 'legacy/*', reason: 'legacy' }],
            }));

            const manager = new AnnotationManager(workspaceRoot);
            await manager.load();
            const all = await manager.getAll();

            expect(all.edges).toHaveLength(1);
            expect(all.entrypoints).toHaveLength(1);
            expect(all.ignores).toHaveLength(1);
        });

        it('should use defaults if file not found', async () => {
            const manager = new AnnotationManager(workspaceRoot);
            await manager.load();
            const all = await manager.getAll();

            expect(all.edges).toHaveLength(0);
            expect(all.entrypoints).toHaveLength(0);
            expect(all.ignores).toHaveLength(0);
        });
    });

    describe('Edge operations', () => {
        it('should add and retrieve edge', async () => {
            const manager = new AnnotationManager(workspaceRoot);
            
            await manager.addEdge({
                from: 'src/loader.ts',
                to: 'src/plugins/auth.ts',
                kind: 'imports',
                confidence: 'high',
                reason: 'dynamic require',
            });

            const edges = await manager.getEdges();
            expect(edges.length).toBeGreaterThanOrEqual(1);
            expect(edges.some(e => e.from === 'src/loader.ts')).toBe(true);
        });

        it('should convert to GraphEdges format', async () => {
            const manager = new AnnotationManager(workspaceRoot);
            
            await manager.addEdge({
                from: 'test.ts',
                to: 'other.ts',
                kind: 'imports',
                confidence: 'high',
                reason: 'test',
            });

            const graphEdges = await manager.getGraphEdges();
            const testEdge = graphEdges.find(e => e.from === 'file:test.ts');
            expect(testEdge).toBeDefined();
            expect(testEdge?.id).toContain('annotation');
        });
    });

    describe('Entrypoint operations', () => {
        it('should add and retrieve entrypoint', async () => {
            const manager = new AnnotationManager(workspaceRoot);
            
            await manager.addEntrypoint({
                path: 'src/workers/cleanup.ts',
                type: 'job',
                name: 'Cleanup Worker',
            });

            const entrypoints = await manager.getEntrypoints();
            expect(entrypoints.some(e => e.name === 'Cleanup Worker')).toBe(true);
        });

        it('should convert to GraphNodes format', async () => {
            const manager = new AnnotationManager(workspaceRoot);
            
            await manager.addEntrypoint({
                path: 'unique-main.ts',
                type: 'main',
                name: 'Unique Main Entry',
            });

            const nodes = await manager.getGraphEntrypoints();
            const mainNode = nodes.find(n => n.name === 'Unique Main Entry');
            expect(mainNode).toBeDefined();
            expect(mainNode?.kind).toBe('entrypoint');
            expect(mainNode?.meta?.isAnnotation).toBe(true);
        });
    });

    describe('Ignore operations', () => {
        it('should add and retrieve ignore rule', async () => {
            const manager = new AnnotationManager(workspaceRoot);
            
            await manager.addIgnore({
                issueKind: 'HANDLER_UNREACHABLE',
                path: 'src/legacy/*',
                reason: 'Legacy code',
            });

            const ignores = await manager.getIgnores();
            expect(ignores.some(i => i.path === 'src/legacy/*')).toBe(true);
        });

        it('should check wildcard ignore pattern', async () => {
            const manager = new AnnotationManager(workspaceRoot);
            
            await manager.addIgnore({
                issueKind: 'HANDLER_UNREACHABLE',
                path: 'src/test-legacy/*',
                reason: 'Legacy',
            });

            const shouldIgnore = await manager.shouldIgnore('HANDLER_UNREACHABLE', 'src/test-legacy/old.ts');
            expect(shouldIgnore).toBe(true);
        });

        it('should not ignore different issue kinds', async () => {
            const manager = new AnnotationManager(workspaceRoot);
            
            await manager.addIgnore({
                issueKind: 'HANDLER_UNREACHABLE',
                path: 'src/other-legacy/*',
                reason: 'Legacy',
            });

            const shouldIgnore = await manager.shouldIgnore('BROKEN_EXPORT_CHAIN', 'src/other-legacy/old.ts');
            expect(shouldIgnore).toBe(false);
        });
    });

    describe('Utility methods', () => {
        it('should return correct file path', () => {
            const manager = new AnnotationManager(workspaceRoot);
            const filePath = manager.getFilePath();
            expect(filePath).toContain('annotations.json');
            expect(filePath).toContain('.ouroboros');
        });

        it('should check file existence', async () => {
            vi.mocked(fs.promises.access).mockResolvedValueOnce(undefined);
            
            const manager = new AnnotationManager(workspaceRoot);
            const exists = await manager.exists();
            expect(exists).toBe(true);
        });

        it('should return false when file does not exist', async () => {
            vi.mocked(fs.promises.access).mockRejectedValueOnce(new Error('ENOENT'));
            
            const manager = new AnnotationManager(workspaceRoot);
            const exists = await manager.exists();
            expect(exists).toBe(false);
        });
    });
});
