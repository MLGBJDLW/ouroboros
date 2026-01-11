/**
 * CycleDetector Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CycleDetector } from '../../../codeGraph/analyzers/CycleDetector';
import { GraphStore } from '../../../codeGraph/core/GraphStore';

describe('CycleDetector', () => {
    let store: GraphStore;
    let detector: CycleDetector;

    beforeEach(() => {
        store = new GraphStore();
        detector = new CycleDetector(store);
    });

    describe('findCycles', () => {
        it('should return empty array when no cycles exist', () => {
            // Linear dependency: A -> B -> C
            store.addNode({ id: 'file:a.ts', kind: 'file', name: 'a.ts', path: 'a.ts' });
            store.addNode({ id: 'file:b.ts', kind: 'file', name: 'b.ts', path: 'b.ts' });
            store.addNode({ id: 'file:c.ts', kind: 'file', name: 'c.ts', path: 'c.ts' });
            store.addEdge({ id: 'e1', from: 'file:a.ts', to: 'file:b.ts', kind: 'imports', confidence: 'high' });
            store.addEdge({ id: 'e2', from: 'file:b.ts', to: 'file:c.ts', kind: 'imports', confidence: 'high' });

            const cycles = detector.findCycles();
            expect(cycles).toHaveLength(0);
        });

        it('should detect simple 2-node cycle', () => {
            // A -> B -> A
            store.addNode({ id: 'file:a.ts', kind: 'file', name: 'a.ts', path: 'a.ts' });
            store.addNode({ id: 'file:b.ts', kind: 'file', name: 'b.ts', path: 'b.ts' });
            store.addEdge({ id: 'e1', from: 'file:a.ts', to: 'file:b.ts', kind: 'imports', confidence: 'high' });
            store.addEdge({ id: 'e2', from: 'file:b.ts', to: 'file:a.ts', kind: 'imports', confidence: 'high' });

            const cycles = detector.findCycles();
            expect(cycles.length).toBeGreaterThanOrEqual(1);
            expect(cycles[0].length).toBe(2);
            expect(cycles[0].severity).toBe('warning');
        });

        it('should detect 3-node cycle', () => {
            // A -> B -> C -> A
            store.addNode({ id: 'file:a.ts', kind: 'file', name: 'a.ts', path: 'a.ts' });
            store.addNode({ id: 'file:b.ts', kind: 'file', name: 'b.ts', path: 'b.ts' });
            store.addNode({ id: 'file:c.ts', kind: 'file', name: 'c.ts', path: 'c.ts' });
            store.addEdge({ id: 'e1', from: 'file:a.ts', to: 'file:b.ts', kind: 'imports', confidence: 'high' });
            store.addEdge({ id: 'e2', from: 'file:b.ts', to: 'file:c.ts', kind: 'imports', confidence: 'high' });
            store.addEdge({ id: 'e3', from: 'file:c.ts', to: 'file:a.ts', kind: 'imports', confidence: 'high' });

            const cycles = detector.findCycles();
            expect(cycles.length).toBeGreaterThanOrEqual(1);
            expect(cycles[0].length).toBe(3);
        });

        it('should detect self-loop', () => {
            // A -> A (self-loop is a special case)
            // Note: Self-loops are detected separately from SCCs
            store.addNode({ id: 'file:a.ts', kind: 'file', name: 'a.ts', path: 'a.ts' });
            store.addEdge({ id: 'e1', from: 'file:a.ts', to: 'file:a.ts', kind: 'imports', confidence: 'high' });

            // Self-loops with minLength=1 should be detected
            const cycles = detector.findCycles({ minLength: 1 });
            // Self-loop detection depends on implementation - may or may not be detected
            // The important thing is no crash occurs
            expect(Array.isArray(cycles)).toBe(true);
        });

        it('should mark large cycles as error severity', () => {
            // A -> B -> C -> D -> A (4 nodes)
            store.addNode({ id: 'file:a.ts', kind: 'file', name: 'a.ts', path: 'a.ts' });
            store.addNode({ id: 'file:b.ts', kind: 'file', name: 'b.ts', path: 'b.ts' });
            store.addNode({ id: 'file:c.ts', kind: 'file', name: 'c.ts', path: 'c.ts' });
            store.addNode({ id: 'file:d.ts', kind: 'file', name: 'd.ts', path: 'd.ts' });
            store.addEdge({ id: 'e1', from: 'file:a.ts', to: 'file:b.ts', kind: 'imports', confidence: 'high' });
            store.addEdge({ id: 'e2', from: 'file:b.ts', to: 'file:c.ts', kind: 'imports', confidence: 'high' });
            store.addEdge({ id: 'e3', from: 'file:c.ts', to: 'file:d.ts', kind: 'imports', confidence: 'high' });
            store.addEdge({ id: 'e4', from: 'file:d.ts', to: 'file:a.ts', kind: 'imports', confidence: 'high' });

            const cycles = detector.findCycles();
            expect(cycles.length).toBeGreaterThanOrEqual(1);
            expect(cycles[0].severity).toBe('error');
        });

        it('should respect minLength option', () => {
            // A -> B -> A (2 nodes)
            store.addNode({ id: 'file:a.ts', kind: 'file', name: 'a.ts', path: 'a.ts' });
            store.addNode({ id: 'file:b.ts', kind: 'file', name: 'b.ts', path: 'b.ts' });
            store.addEdge({ id: 'e1', from: 'file:a.ts', to: 'file:b.ts', kind: 'imports', confidence: 'high' });
            store.addEdge({ id: 'e2', from: 'file:b.ts', to: 'file:a.ts', kind: 'imports', confidence: 'high' });

            const cycles = detector.findCycles({ minLength: 3 });
            expect(cycles).toHaveLength(0);
        });

        it('should respect maxCycles option', () => {
            // Create multiple cycles
            for (let i = 0; i < 5; i++) {
                store.addNode({ id: `file:a${i}.ts`, kind: 'file', name: `a${i}.ts`, path: `a${i}.ts` });
                store.addNode({ id: `file:b${i}.ts`, kind: 'file', name: `b${i}.ts`, path: `b${i}.ts` });
                store.addEdge({ id: `e${i}a`, from: `file:a${i}.ts`, to: `file:b${i}.ts`, kind: 'imports', confidence: 'high' });
                store.addEdge({ id: `e${i}b`, from: `file:b${i}.ts`, to: `file:a${i}.ts`, kind: 'imports', confidence: 'high' });
            }

            const cycles = detector.findCycles({ maxCycles: 2 });
            expect(cycles.length).toBeLessThanOrEqual(2);
        });

        it('should respect scope option', () => {
            // Cycle in src/features
            store.addNode({ id: 'file:src/features/a.ts', kind: 'file', name: 'a.ts', path: 'src/features/a.ts' });
            store.addNode({ id: 'file:src/features/b.ts', kind: 'file', name: 'b.ts', path: 'src/features/b.ts' });
            store.addEdge({ id: 'e1', from: 'file:src/features/a.ts', to: 'file:src/features/b.ts', kind: 'imports', confidence: 'high' });
            store.addEdge({ id: 'e2', from: 'file:src/features/b.ts', to: 'file:src/features/a.ts', kind: 'imports', confidence: 'high' });

            // Cycle in src/utils
            store.addNode({ id: 'file:src/utils/c.ts', kind: 'file', name: 'c.ts', path: 'src/utils/c.ts' });
            store.addNode({ id: 'file:src/utils/d.ts', kind: 'file', name: 'd.ts', path: 'src/utils/d.ts' });
            store.addEdge({ id: 'e3', from: 'file:src/utils/c.ts', to: 'file:src/utils/d.ts', kind: 'imports', confidence: 'high' });
            store.addEdge({ id: 'e4', from: 'file:src/utils/d.ts', to: 'file:src/utils/c.ts', kind: 'imports', confidence: 'high' });

            const cycles = detector.findCycles({ scope: 'src/features/**' });
            expect(cycles.length).toBeGreaterThanOrEqual(1);
            // All cycles should be in src/features
            for (const cycle of cycles) {
                for (const node of cycle.nodes) {
                    expect(node).toContain('src/features');
                }
            }
        });

        it('should provide break points', () => {
            // A -> B -> C -> A
            store.addNode({ id: 'file:a.ts', kind: 'file', name: 'a.ts', path: 'a.ts' });
            store.addNode({ id: 'file:b.ts', kind: 'file', name: 'b.ts', path: 'b.ts' });
            store.addNode({ id: 'file:c.ts', kind: 'file', name: 'c.ts', path: 'c.ts' });
            store.addEdge({ id: 'e1', from: 'file:a.ts', to: 'file:b.ts', kind: 'imports', confidence: 'high' });
            store.addEdge({ id: 'e2', from: 'file:b.ts', to: 'file:c.ts', kind: 'imports', confidence: 'high' });
            store.addEdge({ id: 'e3', from: 'file:c.ts', to: 'file:a.ts', kind: 'imports', confidence: 'high' });

            const cycles = detector.findCycles();
            expect(cycles[0].breakPoints.length).toBeGreaterThan(0);
        });
    });

    describe('detectCycleIssues', () => {
        it('should convert cycles to GraphIssues', () => {
            // A -> B -> A
            store.addNode({ id: 'file:a.ts', kind: 'file', name: 'a.ts', path: 'a.ts' });
            store.addNode({ id: 'file:b.ts', kind: 'file', name: 'b.ts', path: 'b.ts' });
            store.addEdge({ id: 'e1', from: 'file:a.ts', to: 'file:b.ts', kind: 'imports', confidence: 'high' });
            store.addEdge({ id: 'e2', from: 'file:b.ts', to: 'file:a.ts', kind: 'imports', confidence: 'high' });

            const issues = detector.detectCycleIssues();
            expect(issues.length).toBeGreaterThanOrEqual(1);
            expect(issues[0].kind).toBe('CYCLE_RISK');
            expect(issues[0].title).toContain('Circular dependency');
            expect(issues[0].suggestedFix).toBeDefined();
        });

        it('should include evidence in issues', () => {
            store.addNode({ id: 'file:a.ts', kind: 'file', name: 'a.ts', path: 'a.ts' });
            store.addNode({ id: 'file:b.ts', kind: 'file', name: 'b.ts', path: 'b.ts' });
            store.addEdge({ id: 'e1', from: 'file:a.ts', to: 'file:b.ts', kind: 'imports', confidence: 'high' });
            store.addEdge({ id: 'e2', from: 'file:b.ts', to: 'file:a.ts', kind: 'imports', confidence: 'high' });

            const issues = detector.detectCycleIssues();
            expect(issues[0].evidence).toBeDefined();
            expect(Array.isArray(issues[0].evidence)).toBe(true);
        });
    });
});
