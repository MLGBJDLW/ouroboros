/**
 * GraphQuery Path and Module Tests (v0.2)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GraphStore } from '../../codeGraph/core/GraphStore';
import { GraphQuery } from '../../codeGraph/core/GraphQuery';

describe('GraphQuery v0.2 Features', () => {
    let store: GraphStore;
    let query: GraphQuery;

    beforeEach(() => {
        store = new GraphStore();
        query = new GraphQuery(store);
    });

    describe('path query', () => {
        beforeEach(() => {
            // Setup: A -> B -> C -> D
            store.addNode({ id: 'file:a.ts', kind: 'file', name: 'a.ts', path: 'a.ts' });
            store.addNode({ id: 'file:b.ts', kind: 'file', name: 'b.ts', path: 'b.ts' });
            store.addNode({ id: 'file:c.ts', kind: 'file', name: 'c.ts', path: 'c.ts' });
            store.addNode({ id: 'file:d.ts', kind: 'file', name: 'd.ts', path: 'd.ts' });

            store.addEdge({ id: 'e1', from: 'file:a.ts', to: 'file:b.ts', kind: 'imports', confidence: 'high' });
            store.addEdge({ id: 'e2', from: 'file:b.ts', to: 'file:c.ts', kind: 'imports', confidence: 'high' });
            store.addEdge({ id: 'e3', from: 'file:c.ts', to: 'file:d.ts', kind: 'imports', confidence: 'high' });
        });

        it('should find direct path', () => {
            const result = query.path('a.ts', 'b.ts');

            expect(result.connected).toBe(true);
            expect(result.shortestPath).toBe(1);
            expect(result.paths.length).toBeGreaterThan(0);
        });

        it('should find transitive path', () => {
            const result = query.path('a.ts', 'd.ts');

            expect(result.connected).toBe(true);
            expect(result.shortestPath).toBe(3);
        });

        it('should return not connected for unreachable nodes', () => {
            store.addNode({ id: 'file:isolated.ts', kind: 'file', name: 'isolated.ts', path: 'isolated.ts' });

            const result = query.path('a.ts', 'isolated.ts');

            expect(result.connected).toBe(false);
            expect(result.shortestPath).toBeNull();
            expect(result.paths).toHaveLength(0);
        });

        it('should respect maxDepth', () => {
            const result = query.path('a.ts', 'd.ts', { maxDepth: 2 });

            // Path requires 3 hops, but maxDepth is 2
            expect(result.connected).toBe(false);
        });

        it('should find multiple paths', () => {
            // Add alternative path: A -> E -> D
            store.addNode({ id: 'file:e.ts', kind: 'file', name: 'e.ts', path: 'e.ts' });
            store.addEdge({ id: 'e4', from: 'file:a.ts', to: 'file:e.ts', kind: 'imports', confidence: 'high' });
            store.addEdge({ id: 'e5', from: 'file:e.ts', to: 'file:d.ts', kind: 'imports', confidence: 'high' });

            const result = query.path('a.ts', 'd.ts', { maxPaths: 5 });

            expect(result.paths.length).toBeGreaterThanOrEqual(1);
        });

        it('should handle non-existent source', () => {
            const result = query.path('nonexistent.ts', 'b.ts');

            expect(result.connected).toBe(false);
            expect(result.from).toBe('nonexistent.ts');
        });

        it('should handle non-existent target', () => {
            const result = query.path('a.ts', 'nonexistent.ts');

            expect(result.connected).toBe(false);
            expect(result.to).toBe('nonexistent.ts');
        });

        it('should include path nodes and edges', () => {
            const result = query.path('a.ts', 'c.ts');

            expect(result.paths[0].nodes).toContain('a.ts');
            expect(result.paths[0].nodes).toContain('b.ts');
            expect(result.paths[0].nodes).toContain('c.ts');
            expect(result.paths[0].edges.length).toBe(2);
        });

        it('should estimate tokens', () => {
            const result = query.path('a.ts', 'd.ts');

            expect(result.meta.tokensEstimate).toBeGreaterThan(0);
        });
    });

    describe('module query', () => {
        beforeEach(() => {
            // Setup module with imports and exports
            store.addNode({
                id: 'file:src/utils.ts',
                kind: 'file',
                name: 'utils.ts',
                path: 'src/utils.ts',
                meta: {
                    exports: ['formatDate', 'parseDate', 'validateDate'],
                    framework: 'none',
                },
            });

            store.addNode({ id: 'file:src/index.ts', kind: 'file', name: 'index.ts', path: 'src/index.ts' });
            store.addNode({ id: 'file:src/app.ts', kind: 'file', name: 'app.ts', path: 'src/app.ts' });
            store.addNode({ id: 'file:src/helpers.ts', kind: 'file', name: 'helpers.ts', path: 'src/helpers.ts' });

            // utils imports helpers
            store.addEdge({ id: 'e1', from: 'file:src/utils.ts', to: 'file:src/helpers.ts', kind: 'imports', confidence: 'high' });
            
            // index and app import utils
            store.addEdge({ id: 'e2', from: 'file:src/index.ts', to: 'file:src/utils.ts', kind: 'imports', confidence: 'high' });
            store.addEdge({ id: 'e3', from: 'file:src/app.ts', to: 'file:src/utils.ts', kind: 'imports', confidence: 'high' });
        });

        it('should return module info', () => {
            const result = query.module('src/utils.ts');

            expect(result.path).toBe('src/utils.ts');
            expect(result.name).toBe('utils.ts');
            expect(result.kind).toBe('file');
        });

        it('should list imports', () => {
            const result = query.module('src/utils.ts');

            expect(result.imports).toHaveLength(1);
            expect(result.imports[0].path).toBe('src/helpers.ts');
        });

        it('should list importedBy', () => {
            const result = query.module('src/utils.ts');

            expect(result.importedBy).toHaveLength(2);
            expect(result.importedBy.map(i => i.path)).toContain('src/index.ts');
            expect(result.importedBy.map(i => i.path)).toContain('src/app.ts');
        });

        it('should list exports', () => {
            const result = query.module('src/utils.ts');

            expect(result.exports).toContain('formatDate');
            expect(result.exports).toContain('parseDate');
            expect(result.exports).toContain('validateDate');
        });

        it('should detect barrel files', () => {
            store.addNode({
                id: 'file:src/components/index.ts',
                kind: 'file',
                name: 'index.ts',
                path: 'src/components/index.ts',
                meta: { entrypointType: 'barrel' },
            });
            store.addEdge({
                id: 'e-barrel',
                from: 'file:src/components/index.ts',
                to: 'file:src/utils.ts',
                kind: 'reexports',
                confidence: 'high',
            });

            const result = query.module('src/components/index.ts');

            expect(result.isBarrel).toBe(true);
        });

        it('should return empty result for non-existent module', () => {
            const result = query.module('nonexistent.ts');

            expect(result.imports).toHaveLength(0);
            expect(result.importedBy).toHaveLength(0);
            expect(result.exports).toHaveLength(0);
        });

        it('should include related entrypoints', () => {
            store.addNode({
                id: 'entrypoint:src/utils.ts',
                kind: 'entrypoint',
                name: 'Utils API',
                path: 'src/utils.ts',
                meta: { entrypointType: 'api' },
            });

            const result = query.module('src/utils.ts');

            expect(result.entrypoints.length).toBeGreaterThan(0);
            expect(result.entrypoints[0].type).toBe('api');
        });

        it('should estimate tokens', () => {
            const result = query.module('src/utils.ts');

            expect(result.meta.tokensEstimate).toBeGreaterThan(0);
        });

        it('should resolve by file:path format', () => {
            const result = query.module('file:src/utils.ts');

            expect(result.path).toBe('src/utils.ts');
        });
    });

    describe('digest with new issue types', () => {
        it('should include CIRCULAR_REEXPORT in issue counts', () => {
            store.setIssues([
                {
                    id: 'issue-1',
                    kind: 'CIRCULAR_REEXPORT',
                    severity: 'warning',
                    title: 'Circular re-export',
                    evidence: [],
                },
            ]);

            const result = query.digest();

            expect(result.issues.CIRCULAR_REEXPORT).toBe(1);
        });

        it('should include ORPHAN_EXPORT in issue counts', () => {
            store.setIssues([
                {
                    id: 'issue-1',
                    kind: 'ORPHAN_EXPORT',
                    severity: 'info',
                    title: 'Orphan export',
                    evidence: [],
                },
            ]);

            const result = query.digest();

            expect(result.issues.ORPHAN_EXPORT).toBe(1);
        });
    });
});
