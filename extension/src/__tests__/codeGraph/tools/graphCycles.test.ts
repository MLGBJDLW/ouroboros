/**
 * graphCycles Tool Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createGraphCyclesTool } from '../../../codeGraph/tools/graphCycles';
import { CycleDetector } from '../../../codeGraph/analyzers/CycleDetector';
import { GraphStore } from '../../../codeGraph/core/GraphStore';

describe('graphCycles Tool', () => {
    let store: GraphStore;
    let detector: CycleDetector;

    beforeEach(() => {
        store = new GraphStore();
        detector = new CycleDetector(store);
    });

    describe('createGraphCyclesTool', () => {
        it('should create tool with correct name and description', () => {
            const tool = createGraphCyclesTool(() => detector);
            expect(tool.name).toBe('ouroborosai_graph_cycles');
            expect(tool.description).toContain('circular dependencies');
        });

        it('should have correct input schema', () => {
            const tool = createGraphCyclesTool(() => detector);
            expect(tool.inputSchema).toHaveProperty('properties');
            const props = (tool.inputSchema as { properties: Record<string, unknown> }).properties;
            expect(props).toHaveProperty('scope');
            expect(props).toHaveProperty('minLength');
            expect(props).toHaveProperty('maxCycles');
        });
    });

    describe('execute', () => {
        it('should return empty result when no detector', async () => {
            const tool = createGraphCyclesTool(() => null);
            const result = await tool.execute({});
            
            expect(result.cycles).toHaveLength(0);
            expect(result.stats.totalCycles).toBe(0);
        });

        it('should return empty result when no cycles', async () => {
            store.addNode({ id: 'file:a.ts', kind: 'file', name: 'a.ts', path: 'a.ts' });
            store.addNode({ id: 'file:b.ts', kind: 'file', name: 'b.ts', path: 'b.ts' });
            store.addEdge({ id: 'e1', from: 'file:a.ts', to: 'file:b.ts', kind: 'imports', confidence: 'high' });

            const tool = createGraphCyclesTool(() => detector);
            const result = await tool.execute({});
            
            expect(result.cycles).toHaveLength(0);
            expect(result.stats.totalCycles).toBe(0);
        });

        it('should detect cycles and return formatted result', async () => {
            store.addNode({ id: 'file:a.ts', kind: 'file', name: 'a.ts', path: 'a.ts' });
            store.addNode({ id: 'file:b.ts', kind: 'file', name: 'b.ts', path: 'b.ts' });
            store.addEdge({ id: 'e1', from: 'file:a.ts', to: 'file:b.ts', kind: 'imports', confidence: 'high' });
            store.addEdge({ id: 'e2', from: 'file:b.ts', to: 'file:a.ts', kind: 'imports', confidence: 'high' });

            const tool = createGraphCyclesTool(() => detector);
            const result = await tool.execute({});
            
            expect(result.cycles.length).toBeGreaterThan(0);
            expect(result.stats.totalCycles).toBeGreaterThan(0);
            expect(result.cycles[0]).toHaveProperty('nodes');
            expect(result.cycles[0]).toHaveProperty('length');
            expect(result.cycles[0]).toHaveProperty('severity');
            expect(result.cycles[0]).toHaveProperty('breakPoints');
            expect(result.cycles[0]).toHaveProperty('description');
        });

        it('should strip file: prefix from node paths', async () => {
            store.addNode({ id: 'file:a.ts', kind: 'file', name: 'a.ts', path: 'a.ts' });
            store.addNode({ id: 'file:b.ts', kind: 'file', name: 'b.ts', path: 'b.ts' });
            store.addEdge({ id: 'e1', from: 'file:a.ts', to: 'file:b.ts', kind: 'imports', confidence: 'high' });
            store.addEdge({ id: 'e2', from: 'file:b.ts', to: 'file:a.ts', kind: 'imports', confidence: 'high' });

            const tool = createGraphCyclesTool(() => detector);
            const result = await tool.execute({});
            
            for (const cycle of result.cycles) {
                for (const node of cycle.nodes) {
                    expect(node).not.toContain('file:');
                }
            }
        });

        it('should pass options to detector', async () => {
            const mockDetector = {
                findCycles: vi.fn().mockReturnValue([]),
            } as unknown as CycleDetector;

            const tool = createGraphCyclesTool(() => mockDetector);
            await tool.execute({ scope: 'src/features', minLength: 3, maxCycles: 5 });
            
            expect(mockDetector.findCycles).toHaveBeenCalledWith({
                scope: 'src/features',
                minLength: 3,
                maxCycles: 5,
            });
        });

        it('should count errors and warnings correctly', async () => {
            // Create a large cycle (error) and a small cycle (warning)
            store.addNode({ id: 'file:a.ts', kind: 'file', name: 'a.ts', path: 'a.ts' });
            store.addNode({ id: 'file:b.ts', kind: 'file', name: 'b.ts', path: 'b.ts' });
            store.addEdge({ id: 'e1', from: 'file:a.ts', to: 'file:b.ts', kind: 'imports', confidence: 'high' });
            store.addEdge({ id: 'e2', from: 'file:b.ts', to: 'file:a.ts', kind: 'imports', confidence: 'high' });

            const tool = createGraphCyclesTool(() => detector);
            const result = await tool.execute({});
            
            expect(result.stats.errorCount + result.stats.warningCount).toBe(result.stats.totalCycles);
        });

        it('should include meta information', async () => {
            const tool = createGraphCyclesTool(() => detector);
            const result = await tool.execute({ scope: 'src/features', maxCycles: 10 });
            
            expect(result.meta).toHaveProperty('tokensEstimate');
            expect(result.meta).toHaveProperty('truncated');
            expect(result.meta.scope).toBe('src/features');
        });

        it('should set truncated flag when max cycles reached', async () => {
            // Create multiple cycles
            for (let i = 0; i < 5; i++) {
                store.addNode({ id: `file:a${i}.ts`, kind: 'file', name: `a${i}.ts`, path: `a${i}.ts` });
                store.addNode({ id: `file:b${i}.ts`, kind: 'file', name: `b${i}.ts`, path: `b${i}.ts` });
                store.addEdge({ id: `e${i}a`, from: `file:a${i}.ts`, to: `file:b${i}.ts`, kind: 'imports', confidence: 'high' });
                store.addEdge({ id: `e${i}b`, from: `file:b${i}.ts`, to: `file:a${i}.ts`, kind: 'imports', confidence: 'high' });
            }

            const tool = createGraphCyclesTool(() => detector);
            const result = await tool.execute({ maxCycles: 2 });
            
            expect(result.meta.truncated).toBe(true);
        });
    });
});
