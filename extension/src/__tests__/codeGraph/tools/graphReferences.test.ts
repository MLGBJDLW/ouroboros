/**
 * GraphReferences Tool Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';

// Mock vscode
vi.mock('vscode', async () => {
    return {
        Uri: {
            file: vi.fn((path: string) => ({ fsPath: path })),
        },
    };
});

// Mock logger
vi.mock('../../../utils/logger', () => ({
    createLogger: () => ({
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }),
}));

// Mock SymbolService
const mockFindReferences = vi.fn();

vi.mock('../../../codeGraph/lsp', () => ({
    getSymbolService: () => ({
        findReferences: mockFindReferences,
    }),
}));

// Mock envelope
vi.mock('../../../codeGraph/tools/envelope', () => ({
    createSuccessEnvelope: vi.fn((tool, data, workspace, meta) => ({
        success: true,
        tool,
        data,
        meta,
    })),
    createErrorEnvelope: vi.fn((tool, code, message, workspace, details) => ({
        success: false,
        tool,
        error: { code, message },
        details,
    })),
    envelopeToResult: vi.fn((envelope) => ({
        content: [{ type: 'text', text: JSON.stringify(envelope) }],
    })),
    getWorkspaceContext: vi.fn(() => ({ name: 'test-workspace' })),
}));

// Mock constants
vi.mock('../../../constants', () => ({
    TOOLS: {
        GRAPH_REFERENCES: 'ouroborosai_graph_references',
        GRAPH_DEFINITION: 'ouroborosai_graph_definition',
        GRAPH_IMPACT: 'ouroborosai_graph_impact',
    },
}));

describe('GraphReferencesTool', () => {
    let createGraphReferencesTool: typeof import('../../../codeGraph/tools/graphReferences').createGraphReferencesTool;

    beforeEach(async () => {
        vi.resetAllMocks();
        const module = await import('../../../codeGraph/tools/graphReferences');
        createGraphReferencesTool = module.createGraphReferencesTool;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('find references', () => {
        it('should find references to a symbol', async () => {
            const mockReferences = [
                {
                    path: '/path/to/file1.ts',
                    line: 10,
                    column: 5,
                    lineText: 'const result = myFunction();',
                    isDefinition: true,
                },
                {
                    path: '/path/to/file2.ts',
                    line: 25,
                    column: 8,
                    lineText: 'return myFunction(arg);',
                    isDefinition: false,
                },
            ];

            mockFindReferences.mockResolvedValue(mockReferences);

            const tool = createGraphReferencesTool();
            const result = await tool.invoke(
                {
                    input: { path: '/path/to/source.ts', line: 10 },
                } as vscode.LanguageModelToolInvocationOptions<{ path: string; line: number }>,
                {} as vscode.CancellationToken
            );

            expect(mockFindReferences).toHaveBeenCalledWith('/path/to/source.ts', 10, 1, {
                includeDeclaration: true,
                limit: 50,
            });

            const parsed = JSON.parse((result.content[0] as { text: string }).text);
            expect(parsed.success).toBe(true);
            expect(parsed.data.references).toHaveLength(2);
            expect(parsed.data.stats.files).toBe(2);
            expect(parsed.data.stats.definitionFound).toBe(true);
        });

        it('should use custom column', async () => {
            mockFindReferences.mockResolvedValue([]);

            const tool = createGraphReferencesTool();
            await tool.invoke(
                {
                    input: { path: '/path/to/file.ts', line: 10, column: 15 },
                } as vscode.LanguageModelToolInvocationOptions<{ path: string; line: number; column: number }>,
                {} as vscode.CancellationToken
            );

            expect(mockFindReferences).toHaveBeenCalledWith('/path/to/file.ts', 10, 15, {
                includeDeclaration: true,
                limit: 50,
            });
        });

        it('should respect includeDeclaration option', async () => {
            mockFindReferences.mockResolvedValue([]);

            const tool = createGraphReferencesTool();
            await tool.invoke(
                {
                    input: { path: '/path/to/file.ts', line: 10, includeDeclaration: false },
                } as vscode.LanguageModelToolInvocationOptions<{ path: string; line: number; includeDeclaration: boolean }>,
                {} as vscode.CancellationToken
            );

            expect(mockFindReferences).toHaveBeenCalledWith('/path/to/file.ts', 10, 1, {
                includeDeclaration: false,
                limit: 50,
            });
        });

        it('should group references by file', async () => {
            const mockReferences = [
                { path: '/path/to/file1.ts', line: 10, column: 5, lineText: 'line 1', isDefinition: false },
                { path: '/path/to/file1.ts', line: 20, column: 5, lineText: 'line 2', isDefinition: false },
                { path: '/path/to/file2.ts', line: 15, column: 8, lineText: 'line 3', isDefinition: false },
            ];

            mockFindReferences.mockResolvedValue(mockReferences);

            const tool = createGraphReferencesTool();
            const result = await tool.invoke(
                {
                    input: { path: '/path/to/source.ts', line: 10, groupByFile: true },
                } as vscode.LanguageModelToolInvocationOptions<{ path: string; line: number; groupByFile: boolean }>,
                {} as vscode.CancellationToken
            );

            const parsed = JSON.parse((result.content[0] as { text: string }).text);
            expect(parsed.data.grouped).toBeDefined();
            expect(Object.keys(parsed.data.grouped)).toHaveLength(2);
            expect(parsed.data.grouped['/path/to/file1.ts']).toHaveLength(2);
            expect(parsed.data.grouped['/path/to/file2.ts']).toHaveLength(1);
        });
    });

    describe('error handling', () => {
        it('should return error for missing required fields', async () => {
            const tool = createGraphReferencesTool();
            const result = await tool.invoke(
                {
                    input: { path: '/path/to/file.ts' }, // Missing line
                } as vscode.LanguageModelToolInvocationOptions<{ path: string }>,
                {} as vscode.CancellationToken
            );

            const parsed = JSON.parse((result.content[0] as { text: string }).text);
            expect(parsed.success).toBe(false);
            expect(parsed.error.code).toBe('INVALID_INPUT');
        });

        it('should handle file not found error', async () => {
            mockFindReferences.mockRejectedValue(new Error('ENOENT: file not found'));

            const tool = createGraphReferencesTool();
            const result = await tool.invoke(
                {
                    input: { path: '/nonexistent.ts', line: 10 },
                } as vscode.LanguageModelToolInvocationOptions<{ path: string; line: number }>,
                {} as vscode.CancellationToken
            );

            const parsed = JSON.parse((result.content[0] as { text: string }).text);
            expect(parsed.success).toBe(false);
            expect(parsed.error.code).toBe('FILE_NOT_FOUND');
        });
    });
});
