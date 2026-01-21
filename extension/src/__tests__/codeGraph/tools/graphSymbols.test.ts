/**
 * GraphSymbols Tool Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';
import type { GraphSymbolsInput } from '../../../codeGraph/tools/graphSymbols';

// Mock vscode
vi.mock('vscode', async () => {
    return {
        SymbolKind: {
            Class: 4,
            Function: 11,
            Method: 5,
            Property: 6,
            Interface: 10,
        },
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
const mockGetDocumentSymbols = vi.fn();
const mockSearchWorkspaceSymbols = vi.fn();

vi.mock('../../../codeGraph/lsp', () => ({
    getSymbolService: () => ({
        getDocumentSymbols: mockGetDocumentSymbols,
        searchWorkspaceSymbols: mockSearchWorkspaceSymbols,
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
        GRAPH_SYMBOLS: 'ouroborosai_graph_symbols',
        GRAPH_REFERENCES: 'ouroborosai_graph_references',
    },
}));

describe('GraphSymbolsTool', () => {
    let createGraphSymbolsTool: typeof import('../../../codeGraph/tools/graphSymbols').createGraphSymbolsTool;

    beforeEach(async () => {
        vi.resetAllMocks();
        const module = await import('../../../codeGraph/tools/graphSymbols');
        createGraphSymbolsTool = module.createGraphSymbolsTool;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('document mode', () => {
        it('should return document symbols for a file', async () => {
            const mockSymbols = [
                {
                    name: 'MyClass',
                    kind: 'class',
                    kindValue: 4,
                    range: { startLine: 1, startColumn: 1, endLine: 20, endColumn: 1 },
                    selectionRange: { startLine: 1, startColumn: 7, endLine: 1, endColumn: 14 },
                    children: [
                        {
                            name: 'myMethod',
                            kind: 'method',
                            kindValue: 5,
                            range: { startLine: 3, startColumn: 5, endLine: 6, endColumn: 5 },
                            selectionRange: { startLine: 3, startColumn: 5, endLine: 3, endColumn: 13 },
                        },
                    ],
                },
            ];

            mockGetDocumentSymbols.mockResolvedValue(mockSymbols);

            const tool = createGraphSymbolsTool();
            const input: GraphSymbolsInput = { target: '/path/to/file.ts', mode: 'document' };
            const result = await tool.invoke(
                { input } as vscode.LanguageModelToolInvocationOptions<GraphSymbolsInput>,
                {} as vscode.CancellationToken
            );

            expect(mockGetDocumentSymbols).toHaveBeenCalledWith('/path/to/file.ts');
            expect(result.content).toBeDefined();

            const parsed = JSON.parse((result.content[0] as { text: string }).text);
            expect(parsed.success).toBe(true);
            expect(parsed.data.mode).toBe('document');
            expect(parsed.data.symbols).toHaveLength(1);
        });

        it('should apply kind filter', async () => {
            const mockSymbols = [
                {
                    name: 'MyClass',
                    kind: 'class',
                    kindValue: 4,
                    range: { startLine: 1, startColumn: 1, endLine: 20, endColumn: 1 },
                    selectionRange: { startLine: 1, startColumn: 7, endLine: 1, endColumn: 14 },
                },
                {
                    name: 'myFunction',
                    kind: 'function',
                    kindValue: 11,
                    range: { startLine: 25, startColumn: 1, endLine: 30, endColumn: 1 },
                    selectionRange: { startLine: 25, startColumn: 10, endLine: 25, endColumn: 20 },
                },
            ];

            mockGetDocumentSymbols.mockResolvedValue(mockSymbols);

            const tool = createGraphSymbolsTool();
            const input: GraphSymbolsInput = { target: '/path/to/file.ts', mode: 'document', kindFilter: ['class'] };
            const result = await tool.invoke(
                { input } as vscode.LanguageModelToolInvocationOptions<GraphSymbolsInput>,
                {} as vscode.CancellationToken
            );

            const parsed = JSON.parse((result.content[0] as { text: string }).text);
            expect(parsed.data.symbols).toHaveLength(1);
            expect(parsed.data.symbols[0].name).toBe('MyClass');
        });

        it('should exclude children when includeChildren is false', async () => {
            const mockSymbols = [
                {
                    name: 'MyClass',
                    kind: 'class',
                    kindValue: 4,
                    range: { startLine: 1, startColumn: 1, endLine: 20, endColumn: 1 },
                    selectionRange: { startLine: 1, startColumn: 7, endLine: 1, endColumn: 14 },
                    children: [
                        {
                            name: 'myMethod',
                            kind: 'method',
                            kindValue: 5,
                            range: { startLine: 3, startColumn: 5, endLine: 6, endColumn: 5 },
                            selectionRange: { startLine: 3, startColumn: 5, endLine: 3, endColumn: 13 },
                        },
                    ],
                },
            ];

            mockGetDocumentSymbols.mockResolvedValue(mockSymbols);

            const tool = createGraphSymbolsTool();
            const input: GraphSymbolsInput = { target: '/path/to/file.ts', mode: 'document', includeChildren: false };
            const result = await tool.invoke(
                { input } as vscode.LanguageModelToolInvocationOptions<GraphSymbolsInput>,
                {} as vscode.CancellationToken
            );

            const parsed = JSON.parse((result.content[0] as { text: string }).text);
            expect(parsed.data.symbols[0].children).toBeUndefined();
        });
    });

    describe('workspace mode', () => {
        it('should search workspace symbols', async () => {
            const mockSymbols = [
                {
                    name: 'createUser',
                    kind: 'function',
                    kindValue: 11,
                    path: '/path/to/userService.ts',
                    line: 15,
                    column: 1,
                },
                {
                    name: 'createUserDto',
                    kind: 'class',
                    kindValue: 4,
                    path: '/path/to/dto.ts',
                    line: 5,
                    column: 1,
                },
            ];

            mockSearchWorkspaceSymbols.mockResolvedValue(mockSymbols);

            const tool = createGraphSymbolsTool();
            const input: GraphSymbolsInput = { target: 'createUser', mode: 'workspace' };
            const result = await tool.invoke(
                { input } as vscode.LanguageModelToolInvocationOptions<GraphSymbolsInput>,
                {} as vscode.CancellationToken
            );

            expect(mockSearchWorkspaceSymbols).toHaveBeenCalledWith('createUser', {
                limit: 50,
                kindFilter: undefined,
            });

            const parsed = JSON.parse((result.content[0] as { text: string }).text);
            expect(parsed.success).toBe(true);
            expect(parsed.data.mode).toBe('workspace');
            expect(parsed.data.symbols).toHaveLength(2);
        });

        it('should apply limit in workspace mode', async () => {
            const mockSymbols = [
                { name: 'Symbol1', kind: 'function', kindValue: 11, path: '/p1.ts', line: 1, column: 1 },
            ];

            mockSearchWorkspaceSymbols.mockResolvedValue(mockSymbols);

            const tool = createGraphSymbolsTool();
            const input: GraphSymbolsInput = { target: 'Symbol', mode: 'workspace', limit: 10 };
            await tool.invoke(
                { input } as vscode.LanguageModelToolInvocationOptions<GraphSymbolsInput>,
                {} as vscode.CancellationToken
            );

            expect(mockSearchWorkspaceSymbols).toHaveBeenCalledWith('Symbol', {
                limit: 10,
                kindFilter: undefined,
            });
        });
    });

    describe('error handling', () => {
        it('should return error for invalid input', async () => {
            const tool = createGraphSymbolsTool();
            // @ts-expect-error - testing invalid input
            const input: GraphSymbolsInput = {} as GraphSymbolsInput;
            const result = await tool.invoke(
                { input } as vscode.LanguageModelToolInvocationOptions<GraphSymbolsInput>,
                {} as vscode.CancellationToken
            );

            const parsed = JSON.parse((result.content[0] as { text: string }).text);
            expect(parsed.success).toBe(false);
            expect(parsed.error.code).toBe('INVALID_INPUT');
        });

        it('should handle LSP errors', async () => {
            mockGetDocumentSymbols.mockRejectedValue(new Error('LSP not available'));

            const tool = createGraphSymbolsTool();
            const input: GraphSymbolsInput = { target: '/path/to/file.ts' };
            const result = await tool.invoke(
                { input } as vscode.LanguageModelToolInvocationOptions<GraphSymbolsInput>,
                {} as vscode.CancellationToken
            );

            const parsed = JSON.parse((result.content[0] as { text: string }).text);
            expect(parsed.success).toBe(false);
        });
    });
});
