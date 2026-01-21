/**
 * LspEnhancer Tests
 * Tests for LSP integration with Graph system
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock vscode before importing anything else
vi.mock('vscode', () => ({
    languages: {
        onDidChangeDiagnostics: vi.fn(() => ({ dispose: vi.fn() })),
        getDiagnostics: vi.fn(() => []),
    },
    workspace: {
        getWorkspaceFolder: vi.fn((uri) => ({
            uri: { fsPath: '/workspace' },
        })),
        openTextDocument: vi.fn(),
        workspaceFolders: [{ uri: { fsPath: '/workspace' } }],
    },
    window: {
        createOutputChannel: vi.fn(() => ({
            appendLine: vi.fn(),
            append: vi.fn(),
            clear: vi.fn(),
            show: vi.fn(),
            hide: vi.fn(),
            dispose: vi.fn(),
        })),
        showErrorMessage: vi.fn(),
        showWarningMessage: vi.fn(),
        showInformationMessage: vi.fn(),
    },
    DiagnosticSeverity: {
        Error: 0,
        Warning: 1,
        Information: 2,
        Hint: 3,
    },
    Uri: {
        file: (path: string) => ({ fsPath: path }),
        joinPath: vi.fn(),
    },
    commands: {
        executeCommand: vi.fn(),
    },
    Position: class {
        constructor(public line: number, public character: number) {}
    },
    Range: class {
        constructor(public start: { line: number; character: number }, public end: { line: number; character: number }) {}
    },
}));

// Create mock symbol service
const mockSymbolService = {
    getDocumentSymbols: vi.fn().mockResolvedValue([
        {
            name: 'TestClass',
            kind: 'class',
            kindValue: 5,
            range: { startLine: 1, startColumn: 1, endLine: 10, endColumn: 1 },
            selectionRange: { startLine: 1, startColumn: 7, endLine: 1, endColumn: 16 },
            children: [
                {
                    name: 'testMethod',
                    kind: 'method',
                    kindValue: 6,
                    range: { startLine: 2, startColumn: 3, endLine: 5, endColumn: 3 },
                    selectionRange: { startLine: 2, startColumn: 3, endLine: 2, endColumn: 13 },
                },
            ],
        },
    ]),
    findReferences: vi.fn().mockResolvedValue([
        { path: 'src/test.ts', line: 1, column: 7, lineText: 'class TestClass', isDefinition: true },
        { path: 'src/other.ts', line: 5, column: 10, lineText: 'new TestClass()', isDefinition: false },
    ]),
    getDefinition: vi.fn().mockResolvedValue([
        { path: 'src/test.ts', line: 1, column: 7, endLine: 1, endColumn: 16, lineText: 'class TestClass' },
    ]),
    getCallHierarchy: vi.fn().mockResolvedValue({
        item: { name: 'testMethod', kind: 'method', path: 'src/test.ts', line: 2 },
        callers: [{ from: { name: 'caller', kind: 'function', path: 'src/caller.ts', line: 10 }, callSites: [{ line: 10, column: 5 }] }],
        callees: [{ to: { name: 'callee', kind: 'function', path: 'src/callee.ts', line: 20 }, callSites: [{ line: 3, column: 5 }] }],
    }),
    clearCache: vi.fn(),
    clearFileCache: vi.fn(),
    isLspAvailable: vi.fn().mockResolvedValue(true),
};

// Mock SymbolService
vi.mock('../../../codeGraph/lsp/SymbolService', () => ({
    getSymbolService: vi.fn(() => mockSymbolService),
}));

import { LspEnhancer } from '../../../codeGraph/lsp/LspEnhancer';
import { GraphStore } from '../../../codeGraph/core/GraphStore';

describe('LspEnhancer', () => {
    let store: GraphStore;
    let enhancer: LspEnhancer;

    beforeEach(() => {
        vi.clearAllMocks();
        store = new GraphStore();
        enhancer = new LspEnhancer(store);
    });

    afterEach(() => {
        enhancer.dispose();
    });

    describe('getEnhancedNodeInfo', () => {
        it('should return combined graph and LSP info', async () => {
            store.addNode({
                id: 'file:src/test.ts',
                kind: 'file',
                name: 'test.ts',
                path: 'src/test.ts',
                meta: { exports: ['foo', 'bar'] },
            });

            store.addEdge({
                id: 'edge:1',
                from: 'file:src/test.ts',
                to: 'file:src/utils.ts',
                kind: 'imports',
                confidence: 'high',
            });

            store.addEdge({
                id: 'edge:2',
                from: 'file:src/main.ts',
                to: 'file:src/test.ts',
                kind: 'imports',
                confidence: 'high',
            });

            const info = await enhancer.getEnhancedNodeInfo('src/test.ts');

            expect(info.path).toBe('src/test.ts');
            expect(info.graph.exports).toEqual(['foo', 'bar']);
            expect(info.graph.imports).toContain('src/utils.ts');
            expect(info.graph.importedBy).toContain('src/main.ts');
            expect(info.lsp).toBeDefined();
            expect(info.lsp.available).toBe(true);
            expect(info.lsp.symbols).toHaveLength(1);
        });

        it('should handle files not in graph', async () => {
            const info = await enhancer.getEnhancedNodeInfo('src/unknown.ts');

            expect(info.path).toBe('src/unknown.ts');
            expect(info.graph.imports).toEqual([]);
            expect(info.graph.importedBy).toEqual([]);
            expect(info.graph.exports).toEqual([]);
        });

        it('should detect hotspots based on importer count', async () => {
            store.addNode({
                id: 'file:src/utils.ts',
                kind: 'file',
                name: 'utils.ts',
                path: 'src/utils.ts',
            });

            // Add 5+ importers to make it a hotspot
            for (let i = 0; i < 6; i++) {
                store.addEdge({
                    id: `edge:${i}`,
                    from: `file:src/file${i}.ts`,
                    to: 'file:src/utils.ts',
                    kind: 'imports',
                    confidence: 'high',
                });
            }

            const info = await enhancer.getEnhancedNodeInfo('src/utils.ts');
            expect(info.graph.isHotspot).toBe(true);
        });

        it('should use cached symbols within timeout', async () => {
            await enhancer.getEnhancedNodeInfo('src/test.ts');
            await enhancer.getEnhancedNodeInfo('src/test.ts');

            // Should only call getDocumentSymbols once due to caching
            expect(mockSymbolService.getDocumentSymbols).toHaveBeenCalledTimes(1);
        });
    });

    describe('getExportReferences', () => {
        it('should get references for exported symbols', async () => {
            const refs = await enhancer.getExportReferences('src/test.ts');
            
            expect(refs).toBeDefined();
            expect(Array.isArray(refs)).toBe(true);
        });
    });

    describe('validateIssues', () => {
        it('should validate issues array', async () => {
            const issues = [
                {
                    id: 'issue:1',
                    kind: 'ORPHAN_EXPORT' as const,
                    severity: 'warning' as const,
                    meta: { filePath: 'src/test.ts', symbol: 'unusedExport' },
                },
            ];

            const validated = await enhancer.validateIssues(issues);

            expect(validated).toHaveLength(1);
            expect(validated[0].issue.id).toBe('issue:1');
            expect(validated[0].confidence).toBeDefined();
        });

        it('should validate CIRCULAR_DEPENDENCY issues', async () => {
            const issues = [
                {
                    id: 'issue:2',
                    kind: 'CIRCULAR_DEPENDENCY' as const,
                    severity: 'warning' as const,
                    meta: { filePath: 'src/test.ts' },
                },
            ];

            const validated = await enhancer.validateIssues(issues);
            expect(validated[0].validated).toBe(true);
        });

        it('should validate BROKEN_EXPORT_CHAIN issues', async () => {
            const issues = [
                {
                    id: 'issue:3',
                    kind: 'BROKEN_EXPORT_CHAIN' as const,
                    severity: 'error' as const,
                    meta: { filePath: 'src/test.ts', symbol: 'TestClass' },
                },
            ];

            const validated = await enhancer.validateIssues(issues);
            expect(validated[0].confidence).toBeDefined();
        });

        it('should handle issues without filePath', async () => {
            const issues = [
                {
                    id: 'issue:4',
                    kind: 'DYNAMIC_EDGE_UNKNOWN' as const,
                    severity: 'info' as const,
                    meta: {},
                },
            ];

            const validated = await enhancer.validateIssues(issues);
            expect(validated[0].validated).toBe(false);
            expect(validated[0].confidence).toBe('low');
        });
    });

    describe('getCallHierarchy', () => {
        it('should get call hierarchy for a symbol', async () => {
            const hierarchy = await enhancer.getCallHierarchy('src/test.ts', 2, 3);

            expect(hierarchy).toBeDefined();
            expect(hierarchy?.name).toBe('testMethod');
            expect(hierarchy?.callers).toHaveLength(1);
            expect(hierarchy?.callees).toHaveLength(1);
        });

        it('should return null when call hierarchy not available', async () => {
            mockSymbolService.getCallHierarchy.mockResolvedValueOnce(null);
            
            const hierarchy = await enhancer.getCallHierarchy('src/test.ts', 100, 1);
            expect(hierarchy).toBeNull();
        });
    });

    describe('getDefinition', () => {
        it('should get definition for a symbol', async () => {
            const definitions = await enhancer.getDefinition('src/test.ts', 1, 7);

            expect(definitions).toHaveLength(1);
            expect(definitions[0].path).toBe('src/test.ts');
        });
    });

    describe('findReferences', () => {
        it('should find references for a symbol', async () => {
            const refs = await enhancer.findReferences('src/test.ts', 1, 7);

            expect(refs).toHaveLength(2);
            expect(refs[0].isDefinition).toBe(true);
        });

        it('should respect options', async () => {
            await enhancer.findReferences('src/test.ts', 1, 7, { includeDeclaration: false, limit: 10 });

            expect(mockSymbolService.findReferences).toHaveBeenCalledWith(
                'src/test.ts', 1, 7, { includeDeclaration: false, limit: 10 }
            );
        });
    });

    describe('getDiagnostics', () => {
        it('should return empty array for unknown file', () => {
            const diagnostics = enhancer.getDiagnostics('unknown.ts');
            expect(diagnostics).toEqual([]);
        });
    });

    describe('getAllDiagnostics', () => {
        it('should return all cached diagnostics', () => {
            const allDiagnostics = enhancer.getAllDiagnostics();
            expect(allDiagnostics).toBeInstanceOf(Map);
        });
    });

    describe('syncDiagnosticsToIssues', () => {
        it('should convert diagnostics to graph issues', () => {
            const issues = enhancer.syncDiagnosticsToIssues();
            expect(Array.isArray(issues)).toBe(true);
        });
    });

    describe('clearCache', () => {
        it('should clear all caches without error', () => {
            expect(() => enhancer.clearCache()).not.toThrow();
            expect(mockSymbolService.clearCache).toHaveBeenCalled();
        });
    });

    describe('clearFileCache', () => {
        it('should clear cache for specific file', () => {
            enhancer.clearFileCache('src/test.ts');
            expect(mockSymbolService.clearFileCache).toHaveBeenCalledWith('src/test.ts');
        });
    });

    describe('isLspAvailable', () => {
        it('should check LSP availability', async () => {
            const available = await enhancer.isLspAvailable('src/test.ts');
            expect(available).toBe(true);
        });
    });

    describe('dispose', () => {
        it('should dispose resources without error', () => {
            expect(() => enhancer.dispose()).not.toThrow();
        });
    });
});
