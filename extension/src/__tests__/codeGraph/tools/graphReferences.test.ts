/**
 * GraphReferences Tool Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';

// Mock function - defined at module level
const mockFindReferences = vi.fn();

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
vi.mock('../../../codeGraph/lsp', () => ({
    getSymbolService: () => ({
        findReferences: mockFindReferences,
    }),
}));

// Mock envelope - must match actual envelope structure
vi.mock('../../../codeGraph/tools/envelope', () => ({
    createSuccessEnvelope: (tool: string, result: unknown, workspace: unknown, meta: unknown) => ({
        success: true,
        data: {
            tool,
            version: '1.0',
            requestId: 'test-123',
            generatedAt: new Date().toISOString(),
            workspace,
            result,
            meta: { ...(meta as object), approxTokens: 100, truncated: false, limits: {} },
        },
    }),
    createErrorEnvelope: (tool: string, code: string, message: string, workspace: unknown, details: unknown) => ({
        success: false,
        data: {
            tool,
            version: '1.0',
            requestId: 'test-123',
            generatedAt: new Date().toISOString(),
            workspace,
            result: { error: { code, message, details } },
            meta: { approxTokens: 50, truncated: false, limits: {} },
        },
    }),
    envelopeToResult: (envelope: unknown) => ({
        content: [{ type: 'text', text: JSON.stringify(envelope) }],
    }),
    getWorkspaceContext: () => ({ root: '/test', repoName: 'test-workspace' }),
}));

// Mock constants
vi.mock('../../../constants', () => ({
    TOOLS: {
        GRAPH_REFERENCES: 'ouroborosai_graph_references',
        GRAPH_DEFINITION: 'ouroborosai_graph_definition',
        GRAPH_IMPACT: 'ouroborosai_graph_impact',
    },
}));

// Import after mocks
import { createGraphReferencesTool } from '../../../codeGraph/tools/graphReferences';

describe('GraphReferencesTool', () => {
    beforeEach(() => {
        mockFindReferences.mockReset();
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
            expect(parsed.data.result.references).toHaveLength(2);
            expect(parsed.data.result.stats.files).toBe(2);
            expect(parsed.data.result.stats.definitionFound).toBe(true);
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
            expect(parsed.data.result.grouped).toBeDefined();
            expect(Object.keys(parsed.data.result.grouped)).toHaveLength(2);
            expect(parsed.data.result.grouped['/path/to/file1.ts']).toHaveLength(2);
            expect(parsed.data.result.grouped['/path/to/file2.ts']).toHaveLength(1);
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
            expect(parsed.data.result.error.code).toBe('INVALID_INPUT');
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
            expect(parsed.data.result.error.code).toBe('FILE_NOT_FOUND');
        });
    });
});
