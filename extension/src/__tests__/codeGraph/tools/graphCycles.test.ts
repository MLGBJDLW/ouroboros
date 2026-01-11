/**
 * graphCycles Tool Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

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

import { createGraphCyclesTool, type GraphCyclesResult, type GraphCyclesInput } from '../../../codeGraph/tools/graphCycles';
import type { CodeGraphManager } from '../../../codeGraph/CodeGraphManager';
import { CycleDetector } from '../../../codeGraph/analyzers/CycleDetector';
import { GraphStore } from '../../../codeGraph/core/GraphStore';

interface MockToolResult {
    parts: Array<{ text: string }>;
}

// Helper to invoke tool with proper VS Code API format
async function invokeTool(
    tool: ReturnType<typeof createGraphCyclesTool>,
    input: GraphCyclesInput
): Promise<{ success: boolean; data: { tool: string; result: GraphCyclesResult } }> {
    const result = await tool.invoke(
        { input } as never,
        { isCancellationRequested: false } as never
    );
    // Parse the JSON from LanguageModelToolResult
    const output = JSON.parse((result as unknown as MockToolResult).parts[0].text);
    return output;
}

describe('graphCycles Tool', () => {
    let store: GraphStore;
    let detector: CycleDetector;
    let mockManager: Partial<CodeGraphManager>;

    beforeEach(() => {
        store = new GraphStore();
        detector = new CycleDetector(store);
        mockManager = {
            getCycleDetector: () => detector,
        };
    });

    describe('createGraphCyclesTool', () => {
        it('should create tool with invoke method', () => {
            const tool = createGraphCyclesTool(mockManager as CodeGraphManager);
            expect(typeof tool.invoke).toBe('function');
        });
    });

    describe('invoke', () => {
        it('should return empty result when no detector', async () => {
            const nullManager = { getCycleDetector: () => null } as unknown as CodeGraphManager;
            const tool = createGraphCyclesTool(nullManager);
            const result = await invokeTool(tool, {});
            
            expect(result.success).toBe(true);
            expect(result.data.result.cycles).toHaveLength(0);
            expect(result.data.result.stats.totalCycles).toBe(0);
        });

        it('should return empty result when no cycles', async () => {
            store.addNode({ id: 'file:a.ts', kind: 'file', name: 'a.ts', path: 'a.ts' });
            store.addNode({ id: 'file:b.ts', kind: 'file', name: 'b.ts', path: 'b.ts' });
            store.addEdge({ id: 'e1', from: 'file:a.ts', to: 'file:b.ts', kind: 'imports', confidence: 'high' });

            const tool = createGraphCyclesTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, {});
            
            expect(result.success).toBe(true);
            expect(result.data.result.cycles).toHaveLength(0);
            expect(result.data.result.stats.totalCycles).toBe(0);
        });

        it('should detect cycles and return formatted result', async () => {
            store.addNode({ id: 'file:a.ts', kind: 'file', name: 'a.ts', path: 'a.ts' });
            store.addNode({ id: 'file:b.ts', kind: 'file', name: 'b.ts', path: 'b.ts' });
            store.addEdge({ id: 'e1', from: 'file:a.ts', to: 'file:b.ts', kind: 'imports', confidence: 'high' });
            store.addEdge({ id: 'e2', from: 'file:b.ts', to: 'file:a.ts', kind: 'imports', confidence: 'high' });

            const tool = createGraphCyclesTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, {});
            
            expect(result.success).toBe(true);
            expect(result.data.result.cycles.length).toBeGreaterThan(0);
            expect(result.data.result.stats.totalCycles).toBeGreaterThan(0);
            expect(result.data.result.cycles[0]).toHaveProperty('nodes');
            expect(result.data.result.cycles[0]).toHaveProperty('length');
            expect(result.data.result.cycles[0]).toHaveProperty('severity');
            expect(result.data.result.cycles[0]).toHaveProperty('breakPoints');
            expect(result.data.result.cycles[0]).toHaveProperty('description');
        });

        it('should strip file: prefix from node paths', async () => {
            store.addNode({ id: 'file:a.ts', kind: 'file', name: 'a.ts', path: 'a.ts' });
            store.addNode({ id: 'file:b.ts', kind: 'file', name: 'b.ts', path: 'b.ts' });
            store.addEdge({ id: 'e1', from: 'file:a.ts', to: 'file:b.ts', kind: 'imports', confidence: 'high' });
            store.addEdge({ id: 'e2', from: 'file:b.ts', to: 'file:a.ts', kind: 'imports', confidence: 'high' });

            const tool = createGraphCyclesTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, {});
            
            for (const cycle of result.data.result.cycles) {
                for (const node of cycle.nodes) {
                    expect(node).not.toContain('file:');
                }
            }
        });

        it('should pass options to detector', async () => {
            const mockDetector = {
                findCycles: vi.fn().mockReturnValue([]),
            } as unknown as CycleDetector;
            const mockMgr = { getCycleDetector: () => mockDetector } as unknown as CodeGraphManager;

            const tool = createGraphCyclesTool(mockMgr);
            await invokeTool(tool, { scope: 'src/features', minLength: 3, maxCycles: 5 });
            
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

            const tool = createGraphCyclesTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, {});
            
            const stats = result.data.result.stats;
            expect(stats.errorCount + stats.warningCount).toBe(stats.totalCycles);
        });

        it('should include meta information', async () => {
            const tool = createGraphCyclesTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, { scope: 'src/features', maxCycles: 10 });
            
            expect(result.data.result.meta).toHaveProperty('tokensEstimate');
            expect(result.data.result.meta).toHaveProperty('truncated');
            expect(result.data.result.meta.scope).toBe('src/features');
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

            const tool = createGraphCyclesTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, { maxCycles: 2 });
            
            expect(result.data.result.meta.truncated).toBe(true);
        });
    });
});
