/**
 * Tests for ReachabilityAnalyzer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GraphStore } from '../../codeGraph/core/GraphStore';
import { ReachabilityAnalyzer } from '../../codeGraph/analyzers/ReachabilityAnalyzer';

describe('ReachabilityAnalyzer', () => {
    let store: GraphStore;
    let analyzer: ReachabilityAnalyzer;

    beforeEach(() => {
        store = new GraphStore();
        analyzer = new ReachabilityAnalyzer(store);
    });

    describe('analyze', () => {
        it('should find reachable files from entrypoints', () => {
            // Setup: entrypoint -> a -> b, c is unreachable
            store.addNode({ id: 'entrypoint:main', kind: 'entrypoint', name: 'main', path: 'main.ts' });
            store.addNode({ id: 'file:a.ts', kind: 'file', name: 'a.ts', path: 'a.ts' });
            store.addNode({ id: 'file:b.ts', kind: 'file', name: 'b.ts', path: 'b.ts' });
            store.addNode({ id: 'file:c.ts', kind: 'file', name: 'c.ts', path: 'c.ts' });

            store.addEdge({ id: 'e:main:a', from: 'entrypoint:main', to: 'file:a.ts', kind: 'imports', confidence: 'high' });
            store.addEdge({ id: 'e:a:b', from: 'file:a.ts', to: 'file:b.ts', kind: 'imports', confidence: 'high' });

            const result = analyzer.analyze();

            expect(result.reachable.has('file:a.ts')).toBe(true);
            expect(result.reachable.has('file:b.ts')).toBe(true);
            expect(result.unreachable.has('file:c.ts')).toBe(true);
        });

        it('should track entrypoint coverage', () => {
            store.addNode({ id: 'entrypoint:main', kind: 'entrypoint', name: 'main' });
            store.addNode({ id: 'file:a.ts', kind: 'file', name: 'a.ts', path: 'a.ts' });

            store.addEdge({ id: 'e:main:a', from: 'entrypoint:main', to: 'file:a.ts', kind: 'imports', confidence: 'high' });

            const result = analyzer.analyze();

            expect(result.entrypointCoverage.get('entrypoint:main')?.has('file:a.ts')).toBe(true);
        });
    });

    describe('isReachable', () => {
        it('should return true for reachable nodes', () => {
            store.addNode({ id: 'entrypoint:main', kind: 'entrypoint', name: 'main' });
            store.addNode({ id: 'file:a.ts', kind: 'file', name: 'a.ts', path: 'a.ts' });

            store.addEdge({ id: 'e:main:a', from: 'entrypoint:main', to: 'file:a.ts', kind: 'imports', confidence: 'high' });

            expect(analyzer.isReachable('file:a.ts')).toBe(true);
        });

        it('should return false for unreachable nodes', () => {
            store.addNode({ id: 'entrypoint:main', kind: 'entrypoint', name: 'main' });
            store.addNode({ id: 'file:orphan.ts', kind: 'file', name: 'orphan.ts', path: 'orphan.ts' });

            expect(analyzer.isReachable('file:orphan.ts')).toBe(false);
        });
    });

    describe('findReachingEntrypoints', () => {
        it('should find all entrypoints that can reach a node', () => {
            store.addNode({ id: 'entrypoint:main', kind: 'entrypoint', name: 'main' });
            store.addNode({ id: 'entrypoint:api', kind: 'entrypoint', name: 'api' });
            store.addNode({ id: 'file:shared.ts', kind: 'file', name: 'shared.ts', path: 'shared.ts' });

            store.addEdge({ id: 'e:main:shared', from: 'entrypoint:main', to: 'file:shared.ts', kind: 'imports', confidence: 'high' });
            store.addEdge({ id: 'e:api:shared', from: 'entrypoint:api', to: 'file:shared.ts', kind: 'imports', confidence: 'high' });

            const reaching = analyzer.findReachingEntrypoints('file:shared.ts');

            expect(reaching).toHaveLength(2);
            expect(reaching.map((e) => e.name)).toContain('main');
            expect(reaching.map((e) => e.name)).toContain('api');
        });
    });

    describe('getStats', () => {
        it('should return coverage statistics', () => {
            store.addNode({ id: 'entrypoint:main', kind: 'entrypoint', name: 'main' });
            store.addNode({ id: 'file:a.ts', kind: 'file', name: 'a.ts', path: 'a.ts' });
            store.addNode({ id: 'file:b.ts', kind: 'file', name: 'b.ts', path: 'b.ts' });

            store.addEdge({ id: 'e:main:a', from: 'entrypoint:main', to: 'file:a.ts', kind: 'imports', confidence: 'high' });

            const stats = analyzer.getStats();

            expect(stats.totalFiles).toBe(2);
            expect(stats.reachableFiles).toBeGreaterThanOrEqual(1);
            expect(stats.unreachableFiles).toBeGreaterThanOrEqual(0);
            expect(stats.coveragePercent).toBeGreaterThan(0);
        });

        it('should return 100% coverage when no files', () => {
            const stats = analyzer.getStats();

            expect(stats.coveragePercent).toBe(100);
        });
    });
});
