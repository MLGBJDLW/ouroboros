/**
 * graphCycles Tool Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createGraphCyclesTool, type GraphCyclesResult } from '../../../codeGraph/tools/graphCycles';
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
            
            expect(result.success).toBe(true);
            const cyclesResult = result.data.result as GraphCyclesResult;
            expect(cyclesResult.cycles).toHaveLength(0);
            expect(cyclesResult.stats.totalCycles).toBe(0);
        });

        it('should return empty result when no cycles', async () => {
            store.addNode({ id: 'file:a.ts', kind: 'file', name: 'a.ts', path: 'a.ts' });
            store.addNode({ id: 'file:b.ts', kind: 'file', name: 'b.ts', path: 'b.ts' });
            store.addEdge({ id: 'e1', from: 'file:a.ts', to: 'file:b.ts', kind: 'imports', confidence: 'high' });

            const tool = createGraphCyclesTool(() => detector);
            const result = await tool.execute({});
            
            expect(result.success).toBe(true);
            const cyclesResult = result.data.result as GraphCyclesResult;
            expect(cyclesResult.cycles).toHaveLength(0);
            expect(cyclesResult.stats.totalCycles).toBe(0);
        });

        it('should detect cycles and return formatted result', async () => {
            store.addNode({ id: 'file:a.ts', kind: 'file', name: 'a.ts', path: 'a.ts' });
            store.addNode({ id: 'file:b.ts', kind: 'file', name: 'b.ts', path: 'b.ts' });
            store.addEdge({ id: 'e1', from: 'file:a.ts', to: 'file:b.ts', kind: 'imports', confidence: 'high' });
            store.addEdge({ id: 'e2', from: 'file:b.ts', to: 'file:a.ts', kind: 'imports', confidence: 'high' });

            const tool = createGraphCyclesTool(() => detector);
            const result = await tool.execute({});
            
            expect(result.success).toBe(true);
            const cyclesResult = result.data.result as GraphCyclesResult;
            expect(cyclesResult.cycles.length).toBeGreaterThan(0);
            expect(cyclesResult.stats.totalCycles).toBeGreaterThan(0);
            expect(cyclesResult.cycles[0]).toHaveProperty('nodes');
            expect(cyclesResult.cycles[0]).toHaveProperty('length');
            expect(cyclesResult.cycles[0]).toHaveProperty('severity');
            expect(cyclesResult.cycles[0]).toHaveProperty('breakPoints');
            expect(cyclesResult.cycles[0]).toHaveProperty('description');
        });

        it('should strip file: prefix from node paths', async () => {
            store.addNode({ id: 'file:a.ts', kind: 'file', name: 'a.ts', path: 'a.ts' });
            store.addNode({ id: 'file:b.ts', kind: 'file', name: 'b.ts', path: 'b.ts' });
            store.addEdge({ id: 'e1', from: 'file:a.ts', to: 'file:b.ts', kind: 'imports', confidence: 'high' });
            store.addEdge({ id: 'e2', from: 'file:b.ts', to: 'file:a.ts', kind: 'imports', confidence: 'high' });

            const tool = createGraphCyclesTool(() => detector);
            const result = await tool.execute({});
            const cyclesResult = result.data.result as GraphCyclesResult;
            
            for (const cycle of cyclesResult.cycles) {
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
            const cyclesResult = result.data.result as GraphCyclesResult;
            
            const stats = cyclesResult.stats;
            expect(stats.errorCount + stats.warningCount).toBe(stats.totalCycles);
        });

        it('should include meta information', async () => {
            const tool = createGraphCyclesTool(() => detector);
            const result = await tool.execute({ scope: 'src/features', maxCycles: 10 });
            const cyclesResult = result.data.result as GraphCyclesResult;
            
            expect(cyclesResult.meta).toHaveProperty('tokensEstimate');
            expect(cyclesResult.meta).toHaveProperty('truncated');
            expect(cyclesResult.meta.scope).toBe('src/features');
            expect(result.data.tool).toBe('ouroborosai_graph_cycles');
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
            const cyclesResult = result.data.result as GraphCyclesResult;
            
            expect(cyclesResult.meta.truncated).toBe(true);
        });
    });
});
