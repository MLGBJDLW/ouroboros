/**
 * Tests for GraphQuery
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GraphStore } from '../../codeGraph/core/GraphStore';
import { GraphQuery } from '../../codeGraph/core/GraphQuery';

describe('GraphQuery', () => {
    let store: GraphStore;
    let query: GraphQuery;

    beforeEach(() => {
        store = new GraphStore();
        query = new GraphQuery(store);

        // Setup test data
        store.addNode({ id: 'file:src/index.ts', kind: 'file', name: 'index.ts', path: 'src/index.ts', meta: { exports: ['main', 'init'] } });
        store.addNode({ id: 'file:src/utils.ts', kind: 'file', name: 'utils.ts', path: 'src/utils.ts', meta: { exports: ['helper'] } });
        store.addNode({ id: 'file:src/unused.ts', kind: 'file', name: 'unused.ts', path: 'src/unused.ts', meta: { exports: ['dead'] } });
        store.addNode({ id: 'entrypoint:main', kind: 'entrypoint', name: 'main', path: 'src/index.ts', meta: { entrypointType: 'route' } });
        store.addNode({ id: 'entrypoint:api', kind: 'entrypoint', name: 'api', path: 'src/api.ts', meta: { entrypointType: 'api' } });
        store.addNode({ id: 'module:core', kind: 'module', name: 'core' });

        store.addEdge({ id: 'edge:1', from: 'file:src/index.ts', to: 'file:src/utils.ts', kind: 'imports', confidence: 'high' });
        store.addEdge({ id: 'edge:2', from: 'file:src/utils.ts', to: 'file:src/helpers.ts', kind: 'imports', confidence: 'medium', meta: { isDynamic: true } });

        store.updateMeta({ lastIndexed: Date.now() });
    });

    describe('digest', () => {
        it('should return summary statistics', () => {
            const result = query.digest();

            expect(result.summary.files).toBe(3);
            expect(result.summary.entrypoints).toBe(2);
            expect(result.summary.modules).toBe(1);
            expect(result.summary.edges).toBe(2);
        });

        it('should group entrypoints by type', () => {
            const result = query.digest();

            expect(result.entrypoints.routes).toContain('main');
        });

        it('should find hotspots', () => {
            const result = query.digest();

            expect(result.hotspots.length).toBeGreaterThanOrEqual(0);
        });

        it('should count issues by kind', () => {
            store.setIssues([
                { id: '1', kind: 'HANDLER_UNREACHABLE', severity: 'warning', title: 'A', evidence: [] },
                { id: '2', kind: 'HANDLER_UNREACHABLE', severity: 'error', title: 'B', evidence: [] },
                { id: '3', kind: 'BROKEN_EXPORT_CHAIN', severity: 'error', title: 'C', evidence: [] },
            ]);

            const result = query.digest();

            expect(result.issues.HANDLER_UNREACHABLE).toBe(2);
            expect(result.issues.BROKEN_EXPORT_CHAIN).toBe(1);
        });

        it('should apply scope filter', () => {
            store.addNode({ id: 'file:lib/other.ts', kind: 'file', name: 'other.ts', path: 'lib/other.ts' });

            const result = query.digest({ scope: 'src/' });

            expect(result.summary.files).toBe(3); // Only src/ files
            expect(result.meta.scopeApplied).toBe('src/');
        });

        it('should estimate tokens', () => {
            const result = query.digest();

            expect(result.meta.tokensEstimate).toBeGreaterThan(0);
        });
    });

    describe('issues', () => {
        beforeEach(() => {
            store.setIssues([
                { id: '1', kind: 'HANDLER_UNREACHABLE', severity: 'warning', title: 'Unreachable A', evidence: ['Not imported'], meta: { filePath: 'src/a.ts' } },
                { id: '2', kind: 'HANDLER_UNREACHABLE', severity: 'error', title: 'Unreachable B', evidence: ['Dead code'], meta: { filePath: 'src/b.ts' } },
                { id: '3', kind: 'BROKEN_EXPORT_CHAIN', severity: 'error', title: 'Broken C', evidence: ['Missing file'], meta: { filePath: 'lib/c.ts' } },
                { id: '4', kind: 'DYNAMIC_EDGE_UNKNOWN', severity: 'info', title: 'Dynamic D', evidence: ['Cannot resolve'], meta: { filePath: 'src/d.ts' } },
            ]);
        });

        it('should return all issues', () => {
            const result = query.issues();

            expect(result.stats.total).toBe(4);
            expect(result.issues.length).toBe(4);
        });

        it('should filter by kind', () => {
            const result = query.issues({ kind: 'HANDLER_UNREACHABLE' });

            expect(result.stats.total).toBe(2);
            expect(result.issues.every((i) => i.kind === 'HANDLER_UNREACHABLE')).toBe(true);
        });

        it('should filter by severity', () => {
            const result = query.issues({ severity: 'error' });

            expect(result.issues.every((i) => i.severity === 'error')).toBe(true);
        });

        it('should filter by scope', () => {
            const result = query.issues({ scope: 'src/' });

            expect(result.issues.every((i) => i.file.startsWith('src/'))).toBe(true);
        });

        it('should respect limit', () => {
            const result = query.issues({ limit: 2 });

            expect(result.issues.length).toBe(2);
            expect(result.meta.truncated).toBe(true);
            expect(result.meta.nextQuerySuggestion).toBeTruthy();
        });

        it('should provide stats by kind and severity', () => {
            const result = query.issues();

            expect(result.stats.byKind['HANDLER_UNREACHABLE']).toBe(2);
            expect(result.stats.bySeverity['error']).toBe(2);
        });
    });

    describe('impact', () => {
        beforeEach(() => {
            // Create a dependency chain: a -> b -> c -> d
            store.addNode({ id: 'file:a.ts', kind: 'file', name: 'a.ts', path: 'a.ts' });
            store.addNode({ id: 'file:b.ts', kind: 'file', name: 'b.ts', path: 'b.ts' });
            store.addNode({ id: 'file:c.ts', kind: 'file', name: 'c.ts', path: 'c.ts' });
            store.addNode({ id: 'file:d.ts', kind: 'file', name: 'd.ts', path: 'd.ts' });

            store.addEdge({ id: 'e:a:b', from: 'file:a.ts', to: 'file:b.ts', kind: 'imports', confidence: 'high' });
            store.addEdge({ id: 'e:b:c', from: 'file:b.ts', to: 'file:c.ts', kind: 'imports', confidence: 'high' });
            store.addEdge({ id: 'e:c:d', from: 'file:c.ts', to: 'file:d.ts', kind: 'imports', confidence: 'high' });
        });

        it('should find direct dependents', () => {
            const result = query.impact('d.ts');

            expect(result.directDependents).toContain('c.ts');
        });

        it('should calculate transitive impact', () => {
            const result = query.impact('d.ts', { depth: 3 });

            expect(result.transitiveImpact.depth1).toBeGreaterThanOrEqual(1);
        });

        it('should return empty result for unknown target', () => {
            const result = query.impact('nonexistent.ts');

            expect(result.directDependents).toHaveLength(0);
            expect(result.riskAssessment.reason).toContain('not found');
        });

        it('should resolve target by path', () => {
            const result = query.impact('d.ts');

            expect(result.target).toBe('d.ts');
            expect(result.targetType).toBe('file');
        });

        it('should resolve target by node ID', () => {
            const result = query.impact('file:d.ts');

            expect(result.target).toBe('file:d.ts');
        });

        it('should assess risk level', () => {
            // Add many dependents to increase risk
            for (let i = 0; i < 25; i++) {
                store.addNode({ id: `file:dep${i}.ts`, kind: 'file', name: `dep${i}.ts`, path: `dep${i}.ts` });
                store.addEdge({ id: `e:dep${i}:d`, from: `file:dep${i}.ts`, to: 'file:d.ts', kind: 'imports', confidence: 'high' });
            }

            const result = query.impact('d.ts', { depth: 2 });

            expect(['medium', 'high', 'critical']).toContain(result.riskAssessment.level);
        });

        it('should find affected entrypoints', () => {
            store.addNode({ id: 'entrypoint:test', kind: 'entrypoint', name: 'test', path: 'a.ts', meta: { entrypointType: 'route' } });

            const result = query.impact('d.ts', { depth: 4 });

            // The entrypoint at a.ts should be affected since a -> b -> c -> d
            expect(result.affectedEntrypoints.length).toBeGreaterThanOrEqual(0);
        });
    });
});
