/**
 * graphLayers Tool Tests
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

import { createGraphLayersTool, type GraphLayersResult, type GraphLayersInput } from '../../../codeGraph/tools/graphLayers';
import type { CodeGraphManager } from '../../../codeGraph/CodeGraphManager';
import { LayerAnalyzer } from '../../../codeGraph/analyzers/LayerAnalyzer';
import { GraphStore } from '../../../codeGraph/core/GraphStore';

interface MockToolResult {
    parts: Array<{ text: string }>;
}

// Helper to invoke tool with proper VS Code API format
async function invokeTool(
    tool: ReturnType<typeof createGraphLayersTool>,
    input: GraphLayersInput
): Promise<{ success: boolean; data: { tool: string; result: GraphLayersResult } }> {
    const result = await tool.invoke(
        { input } as never,
        { isCancellationRequested: false } as never
    );
    // Parse the JSON from LanguageModelToolResult
    const output = JSON.parse((result as unknown as MockToolResult).parts[0].text);
    return output;
}

describe('graphLayers Tool', () => {
    let store: GraphStore;
    let analyzer: LayerAnalyzer;
    let mockManager: Partial<CodeGraphManager>;

    beforeEach(() => {
        store = new GraphStore();
        analyzer = new LayerAnalyzer(store);
        mockManager = {
            getLayerAnalyzer: () => analyzer,
        };
    });

    describe('createGraphLayersTool', () => {
        it('should create tool with invoke method', () => {
            const tool = createGraphLayersTool(mockManager as CodeGraphManager);
            expect(typeof tool.invoke).toBe('function');
        });
    });

    describe('invoke - check action', () => {
        it('should return empty result when no analyzer', async () => {
            const nullManager = { getLayerAnalyzer: () => null } as unknown as CodeGraphManager;
            const tool = createGraphLayersTool(nullManager);
            const result = await invokeTool(tool, { action: 'check' });
            
            expect(result.success).toBe(true);
            expect(result.data.result.stats).toEqual({});
            expect(result.data.result.meta.action).toBe('check');
        });

        it('should return empty violations when no rules violated', async () => {
            store.addNode({ id: 'file:src/ui/Button.tsx', kind: 'file', name: 'Button.tsx', path: 'src/ui/Button.tsx' });
            store.addNode({ id: 'file:src/utils/helpers.ts', kind: 'file', name: 'helpers.ts', path: 'src/utils/helpers.ts' });
            store.addEdge({ id: 'e1', from: 'file:src/ui/Button.tsx', to: 'file:src/utils/helpers.ts', kind: 'imports', confidence: 'high' });

            analyzer.setRules([
                { name: 'UI cannot import DB', from: 'src/ui/**', cannotImport: 'src/db/**', severity: 'error' },
            ]);

            const tool = createGraphLayersTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, { action: 'check' });
            
            expect(result.success).toBe(true);
            expect(result.data.result.violations).toHaveLength(0);
            expect(result.data.result.stats.totalViolations).toBe(0);
        });

        it('should detect violations', async () => {
            store.addNode({ id: 'file:src/ui/Button.tsx', kind: 'file', name: 'Button.tsx', path: 'src/ui/Button.tsx' });
            store.addNode({ id: 'file:src/db/connection.ts', kind: 'file', name: 'connection.ts', path: 'src/db/connection.ts' });
            store.addEdge({ id: 'e1', from: 'file:src/ui/Button.tsx', to: 'file:src/db/connection.ts', kind: 'imports', confidence: 'high' });

            analyzer.setRules([
                { name: 'UI cannot import DB', from: 'src/ui/**', cannotImport: 'src/db/**', severity: 'error', description: 'UI should not access DB' },
            ]);

            const tool = createGraphLayersTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, { action: 'check' });
            
            expect(result.success).toBe(true);
            expect(result.data.result.violations).toHaveLength(1);
            expect(result.data.result.violations?.[0].rule).toBe('UI cannot import DB');
            expect(result.data.result.violations?.[0].sourceFile).toBe('src/ui/Button.tsx');
            expect(result.data.result.violations?.[0].targetFile).toBe('src/db/connection.ts');
            expect(result.data.result.violations?.[0].severity).toBe('error');
        });

        it('should use custom rules when provided', async () => {
            store.addNode({ id: 'file:src/ui/Button.tsx', kind: 'file', name: 'Button.tsx', path: 'src/ui/Button.tsx' });
            store.addNode({ id: 'file:src/api/routes.ts', kind: 'file', name: 'routes.ts', path: 'src/api/routes.ts' });
            store.addEdge({ id: 'e1', from: 'file:src/ui/Button.tsx', to: 'file:src/api/routes.ts', kind: 'imports', confidence: 'high' });

            const tool = createGraphLayersTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, { 
                action: 'check',
                rules: [
                    { name: 'UI cannot import API', from: 'src/ui/**', cannotImport: 'src/api/**', severity: 'warning' },
                ],
            });
            
            expect(result.success).toBe(true);
            expect(result.data.result.violations).toHaveLength(1);
            expect(result.data.result.violations?.[0].rule).toBe('UI cannot import API');
        });

        it('should count errors and warnings', async () => {
            store.addNode({ id: 'file:src/ui/Button.tsx', kind: 'file', name: 'Button.tsx', path: 'src/ui/Button.tsx' });
            store.addNode({ id: 'file:src/db/connection.ts', kind: 'file', name: 'connection.ts', path: 'src/db/connection.ts' });
            store.addNode({ id: 'file:src/api/routes.ts', kind: 'file', name: 'routes.ts', path: 'src/api/routes.ts' });
            store.addEdge({ id: 'e1', from: 'file:src/ui/Button.tsx', to: 'file:src/db/connection.ts', kind: 'imports', confidence: 'high' });
            store.addEdge({ id: 'e2', from: 'file:src/ui/Button.tsx', to: 'file:src/api/routes.ts', kind: 'imports', confidence: 'high' });

            analyzer.setRules([
                { name: 'UI cannot import DB', from: 'src/ui/**', cannotImport: 'src/db/**', severity: 'error' },
                { name: 'UI cannot import API', from: 'src/ui/**', cannotImport: 'src/api/**', severity: 'warning' },
            ]);

            const tool = createGraphLayersTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, { action: 'check' });
            
            expect(result.success).toBe(true);
            expect(result.data.result.stats.totalViolations).toBe(2);
            expect(result.data.result.stats.errorCount).toBe(1);
            expect(result.data.result.stats.warningCount).toBe(1);
        });

        it('should respect scope option', async () => {
            store.addNode({ id: 'file:src/ui/Button.tsx', kind: 'file', name: 'Button.tsx', path: 'src/ui/Button.tsx' });
            store.addNode({ id: 'file:src/features/ui/Card.tsx', kind: 'file', name: 'Card.tsx', path: 'src/features/ui/Card.tsx' });
            store.addNode({ id: 'file:src/db/connection.ts', kind: 'file', name: 'connection.ts', path: 'src/db/connection.ts' });
            store.addEdge({ id: 'e1', from: 'file:src/ui/Button.tsx', to: 'file:src/db/connection.ts', kind: 'imports', confidence: 'high' });
            store.addEdge({ id: 'e2', from: 'file:src/features/ui/Card.tsx', to: 'file:src/db/connection.ts', kind: 'imports', confidence: 'high' });

            analyzer.setRules([
                { name: 'No DB imports', from: '**/*', cannotImport: 'src/db/**', severity: 'error' },
            ]);

            const tool = createGraphLayersTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, { action: 'check', scope: 'src/ui/**' });
            
            expect(result.success).toBe(true);
            expect(result.data.result.violations).toHaveLength(1);
            expect(result.data.result.violations?.[0].sourceFile).toBe('src/ui/Button.tsx');
        });
    });

    describe('invoke - list action', () => {
        it('should list configured rules', async () => {
            analyzer.setRules([
                { name: 'Rule 1', from: 'src/ui/**', cannotImport: 'src/db/**', severity: 'error' },
                { name: 'Rule 2', from: 'src/utils/**', cannotImport: 'src/features/**', severity: 'warning' },
            ]);

            const tool = createGraphLayersTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, { action: 'list' });
            
            expect(result.success).toBe(true);
            expect(result.data.result.rules).toHaveLength(2);
            expect(result.data.result.rules?.[0].name).toBe('Rule 1');
            expect(result.data.result.rules?.[1].name).toBe('Rule 2');
            expect(result.data.result.stats.rulesCount).toBe(2);
        });

        it('should return empty rules when none configured', async () => {
            const tool = createGraphLayersTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, { action: 'list' });
            
            expect(result.success).toBe(true);
            expect(result.data.result.rules).toHaveLength(0);
            expect(result.data.result.stats.rulesCount).toBe(0);
        });
    });

    describe('invoke - suggest action', () => {
        it('should suggest rules based on directory structure', async () => {
            store.addNode({ id: 'file:src/ui/Button.tsx', kind: 'file', name: 'Button.tsx', path: 'src/ui/Button.tsx' });
            store.addNode({ id: 'file:src/db/connection.ts', kind: 'file', name: 'connection.ts', path: 'src/db/connection.ts' });
            store.addNode({ id: 'file:src/utils/helpers.ts', kind: 'file', name: 'helpers.ts', path: 'src/utils/helpers.ts' });

            const tool = createGraphLayersTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, { action: 'suggest' });
            
            expect(result.success).toBe(true);
            expect(result.data.result.suggestions).toBeDefined();
            expect((result.data.result.suggestions ?? []).length).toBeGreaterThan(0);
        });

        it('should return empty suggestions for flat structure', async () => {
            store.addNode({ id: 'file:a.ts', kind: 'file', name: 'a.ts', path: 'a.ts' });
            store.addNode({ id: 'file:b.ts', kind: 'file', name: 'b.ts', path: 'b.ts' });

            const tool = createGraphLayersTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, { action: 'suggest' });
            
            expect(result.success).toBe(true);
            expect(result.data.result.suggestions).toHaveLength(0);
        });
    });

    describe('invoke - invalid action', () => {
        it('should handle unknown action via zod validation', async () => {
            const tool = createGraphLayersTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, { action: 'unknown' as 'check' });
            
            // Unknown action will fail zod validation
            expect(result.success).toBe(false);
        });
    });

    describe('meta information', () => {
        it('should include tokens estimate', async () => {
            const tool = createGraphLayersTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, { action: 'check' });
            
            expect(result.data.result.meta.tokensEstimate).toBeDefined();
            expect(typeof result.data.result.meta.tokensEstimate).toBe('number');
        });

        it('should include action in meta', async () => {
            const tool = createGraphLayersTool(mockManager as CodeGraphManager);
            
            const checkResult = await invokeTool(tool, { action: 'check' });
            expect(checkResult.data.result.meta.action).toBe('check');
            
            const listResult = await invokeTool(tool, { action: 'list' });
            expect(listResult.data.result.meta.action).toBe('list');
            
            const suggestResult = await invokeTool(tool, { action: 'suggest' });
            expect(suggestResult.data.result.meta.action).toBe('suggest');
        });

        it('should include scope in meta when provided', async () => {
            const tool = createGraphLayersTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, { action: 'check', scope: 'src/features' });
            
            expect(result.data.result.meta.scope).toBe('src/features');
        });

        it('should include tool name in envelope', async () => {
            const tool = createGraphLayersTool(mockManager as CodeGraphManager);
            const result = await invokeTool(tool, { action: 'check' });
            
            expect(result.data.tool).toBe('ouroborosai_graph_layers');
        });
    });
});
