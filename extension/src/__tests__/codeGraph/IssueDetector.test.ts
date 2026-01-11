/**
 * Tests for IssueDetector
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GraphStore } from '../../codeGraph/core/GraphStore';
import { IssueDetector } from '../../codeGraph/analyzers/IssueDetector';

describe('IssueDetector', () => {
    let store: GraphStore;
    let detector: IssueDetector;

    beforeEach(() => {
        store = new GraphStore();
        detector = new IssueDetector(store);
    });

    describe('detectUnreachableHandlers', () => {
        it('should detect unreachable files with exports', () => {
            store.addNode({ id: 'entrypoint:main', kind: 'entrypoint', name: 'main' });
            store.addNode({ id: 'file:used.ts', kind: 'file', name: 'used.ts', path: 'src/used.ts', meta: { exports: ['foo'] } });
            store.addNode({ id: 'file:unused.ts', kind: 'file', name: 'unused.ts', path: 'src/unused.ts', meta: { exports: ['bar', 'baz'] } });

            store.addEdge({ id: 'e:main:used', from: 'entrypoint:main', to: 'file:used.ts', kind: 'imports', confidence: 'high' });

            const issues = detector.detectUnreachableHandlers();

            expect(issues.length).toBeGreaterThanOrEqual(1);
            expect(issues.some((i) => i.kind === 'HANDLER_UNREACHABLE')).toBe(true);
        });

        it('should skip test files', () => {
            store.addNode({ id: 'file:test.test.ts', kind: 'file', name: 'test.test.ts', path: 'src/test.test.ts', meta: { exports: ['test'] } });

            const issues = detector.detectUnreachableHandlers();

            expect(issues.some((i) => i.meta?.filePath?.includes('.test.'))).toBe(false);
        });
    });

    describe('detectDynamicEdges', () => {
        it('should detect dynamic imports', () => {
            store.addNode({ id: 'file:a.ts', kind: 'file', name: 'a.ts', path: 'src/a.ts' });
            store.addEdge({
                id: 'e:dynamic',
                from: 'file:a.ts',
                to: 'file:unknown.ts',
                kind: 'imports',
                confidence: 'unknown',
                reason: 'dynamic import',
                meta: { isDynamic: true },
            });

            const issues = detector.detectDynamicEdges();

            expect(issues.length).toBe(1);
            expect(issues[0].kind).toBe('DYNAMIC_EDGE_UNKNOWN');
        });
    });

    describe('detectBrokenExports', () => {
        it('should detect exports to non-existent targets', () => {
            store.addNode({ id: 'file:index.ts', kind: 'file', name: 'index.ts', path: 'src/index.ts' });
            store.addEdge({
                id: 'e:broken',
                from: 'file:index.ts',
                to: 'file:missing.ts',
                kind: 'reexports',
                confidence: 'high',
            });

            const issues = detector.detectBrokenExports();

            expect(issues.length).toBe(1);
            expect(issues[0].kind).toBe('BROKEN_EXPORT_CHAIN');
            expect(issues[0].severity).toBe('error');
        });
    });

    describe('detectAll', () => {
        it('should detect all issue types', () => {
            // Setup unreachable
            store.addNode({ id: 'file:orphan.ts', kind: 'file', name: 'orphan.ts', path: 'src/orphan.ts', meta: { exports: ['x'] } });

            // Setup dynamic
            store.addNode({ id: 'file:a.ts', kind: 'file', name: 'a.ts', path: 'src/a.ts' });
            store.addEdge({ id: 'e:dyn', from: 'file:a.ts', to: 'file:x.ts', kind: 'imports', confidence: 'unknown', meta: { isDynamic: true } });

            // Setup broken
            store.addEdge({ id: 'e:broken', from: 'file:a.ts', to: 'file:missing.ts', kind: 'reexports', confidence: 'high' });

            const issues = detector.detectAll();

            expect(issues.length).toBeGreaterThanOrEqual(2);
        });
    });
});
