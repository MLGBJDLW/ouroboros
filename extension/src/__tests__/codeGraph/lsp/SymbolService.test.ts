/**
 * SymbolService Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';

// Mock vscode module
vi.mock('vscode', async () => {
    const mockSymbolKind = {
        File: 0,
        Module: 1,
        Namespace: 2,
        Package: 3,
        Class: 4,
        Method: 5,
        Property: 6,
        Field: 7,
        Constructor: 8,
        Enum: 9,
        Interface: 10,
        Function: 11,
        Variable: 12,
        Constant: 13,
        String: 14,
        Number: 15,
        Boolean: 16,
        Array: 17,
        Object: 18,
        Key: 19,
        Null: 20,
        EnumMember: 21,
        Struct: 22,
        Event: 23,
        Operator: 24,
        TypeParameter: 25,
    };

    return {
        SymbolKind: mockSymbolKind,
        Uri: {
            file: vi.fn((path: string) => ({ fsPath: path, toString: () => `file://${path}` })),
        },
        Position: vi.fn((line: number, character: number) => ({ line, character })),
        Range: vi.fn((startLine: number, startChar: number, endLine: number, endChar: number) => ({
            start: { line: startLine, character: startChar },
            end: { line: endLine, character: endChar },
        })),
        commands: {
            executeCommand: vi.fn(),
        },
        workspace: {
            openTextDocument: vi.fn(),
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

describe('SymbolService', () => {
    let getSymbolService: typeof import('../../../codeGraph/lsp/SymbolService').getSymbolService;
    let resetSymbolService: typeof import('../../../codeGraph/lsp/SymbolService').resetSymbolService;

    beforeEach(async () => {
        vi.resetAllMocks();

        // Reset singleton
        const module = await import('../../../codeGraph/lsp/SymbolService');
        getSymbolService = module.getSymbolService;
        resetSymbolService = module.resetSymbolService;
        resetSymbolService();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getDocumentSymbols', () => {
        it('should return symbols for a valid file', async () => {
            const mockSymbols = [
                {
                    name: 'MyClass',
                    kind: vscode.SymbolKind.Class,
                    range: { start: { line: 0, character: 0 }, end: { line: 20, character: 1 } },
                    selectionRange: { start: { line: 0, character: 6 }, end: { line: 0, character: 13 } },
                    children: [
                        {
                            name: 'myMethod',
                            kind: vscode.SymbolKind.Method,
                            range: { start: { line: 2, character: 4 }, end: { line: 5, character: 5 } },
                            selectionRange: { start: { line: 2, character: 4 }, end: { line: 2, character: 12 } },
                            children: [],
                        },
                    ],
                },
            ];

            vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue({} as vscode.TextDocument);
            vi.mocked(vscode.commands.executeCommand).mockResolvedValue(mockSymbols);

            const service = getSymbolService();
            const result = await service.getDocumentSymbols('/path/to/file.ts');

            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('MyClass');
            expect(result[0].kind).toBe('class');
            expect(result[0].children).toHaveLength(1);
            expect(result[0].children?.[0].name).toBe('myMethod');
            expect(result[0].children?.[0].kind).toBe('method');
        });

        it('should return empty array when no symbols found', async () => {
            vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue({} as vscode.TextDocument);
            vi.mocked(vscode.commands.executeCommand).mockResolvedValue([]);

            const service = getSymbolService();
            const result = await service.getDocumentSymbols('/path/to/empty.ts');

            expect(result).toEqual([]);
        });

        it('should use cache for repeated calls', async () => {
            const mockSymbols = [
                {
                    name: 'TestFunc',
                    kind: vscode.SymbolKind.Function,
                    range: { start: { line: 0, character: 0 }, end: { line: 5, character: 1 } },
                    selectionRange: { start: { line: 0, character: 9 }, end: { line: 0, character: 17 } },
                    children: [],
                },
            ];

            vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue({} as vscode.TextDocument);
            vi.mocked(vscode.commands.executeCommand).mockResolvedValue(mockSymbols);

            const service = getSymbolService();

            // First call
            await service.getDocumentSymbols('/path/to/file.ts');
            // Second call (should use cache)
            await service.getDocumentSymbols('/path/to/file.ts');

            // executeCommand should only be called once due to caching
            expect(vscode.commands.executeCommand).toHaveBeenCalledTimes(1);
        });
    });

    describe('searchWorkspaceSymbols', () => {
        it('should search symbols across workspace', async () => {
            const mockSymbols = [
                {
                    name: 'createUser',
                    kind: vscode.SymbolKind.Function,
                    containerName: 'userService',
                    location: {
                        uri: { fsPath: '/path/to/userService.ts' },
                        range: { start: { line: 10, character: 0 }, end: { line: 20, character: 1 } },
                    },
                },
                {
                    name: 'createUserDto',
                    kind: vscode.SymbolKind.Class,
                    containerName: 'dto',
                    location: {
                        uri: { fsPath: '/path/to/dto.ts' },
                        range: { start: { line: 5, character: 0 }, end: { line: 15, character: 1 } },
                    },
                },
            ];

            vi.mocked(vscode.commands.executeCommand).mockResolvedValue(mockSymbols);

            const service = getSymbolService();
            const result = await service.searchWorkspaceSymbols('createUser');

            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('createUser');
            expect(result[0].kind).toBe('function');
            expect(result[1].name).toBe('createUserDto');
            expect(result[1].kind).toBe('class');
        });

        it('should apply kind filter', async () => {
            const mockSymbols = [
                {
                    name: 'MyClass',
                    kind: vscode.SymbolKind.Class,
                    location: {
                        uri: { fsPath: '/path/to/file.ts' },
                        range: { start: { line: 0, character: 0 }, end: { line: 10, character: 1 } },
                    },
                },
                {
                    name: 'myFunction',
                    kind: vscode.SymbolKind.Function,
                    location: {
                        uri: { fsPath: '/path/to/file.ts' },
                        range: { start: { line: 15, character: 0 }, end: { line: 20, character: 1 } },
                    },
                },
            ];

            vi.mocked(vscode.commands.executeCommand).mockResolvedValue(mockSymbols);

            const service = getSymbolService();
            const result = await service.searchWorkspaceSymbols('My', { kindFilter: ['class'] });

            expect(result).toHaveLength(1);
            expect(result[0].name).toBe('MyClass');
        });

        it('should apply limit', async () => {
            const mockSymbols = Array.from({ length: 100 }, (_, i) => ({
                name: `Symbol${i}`,
                kind: vscode.SymbolKind.Variable,
                location: {
                    uri: { fsPath: '/path/to/file.ts' },
                    range: { start: { line: i, character: 0 }, end: { line: i, character: 10 } },
                },
            }));

            vi.mocked(vscode.commands.executeCommand).mockResolvedValue(mockSymbols);

            const service = getSymbolService();
            const result = await service.searchWorkspaceSymbols('Symbol', { limit: 10 });

            expect(result).toHaveLength(10);
        });
    });

    describe('findReferences', () => {
        it('should find all references to a symbol', async () => {
            const mockLocations = [
                {
                    uri: { fsPath: '/path/to/file1.ts' },
                    range: { start: { line: 10, character: 5 }, end: { line: 10, character: 15 } },
                },
                {
                    uri: { fsPath: '/path/to/file2.ts' },
                    range: { start: { line: 20, character: 10 }, end: { line: 20, character: 20 } },
                },
            ];

            const mockDocument = {
                lineAt: vi.fn((_line: number) => ({ text: `  const result = myFunction();  ` })),
            };

            vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(mockDocument as unknown as vscode.TextDocument);
            vi.mocked(vscode.commands.executeCommand).mockResolvedValue(mockLocations);

            const service = getSymbolService();
            const result = await service.findReferences('/path/to/source.ts', 5, 10);

            expect(result).toHaveLength(2);
            expect(result[0].path).toBe('/path/to/file1.ts');
            expect(result[0].line).toBe(11); // 1-indexed
            expect(result[0].lineText).toBe('const result = myFunction();');
        });

        it('should return empty array when no references found', async () => {
            vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue({} as vscode.TextDocument);
            vi.mocked(vscode.commands.executeCommand).mockResolvedValue([]);

            const service = getSymbolService();
            const result = await service.findReferences('/path/to/file.ts', 5, 10);

            expect(result).toEqual([]);
        });
    });

    describe('getDefinition', () => {
        it('should return definition location', async () => {
            const mockDefinitions = [
                {
                    uri: { fsPath: '/path/to/definition.ts' },
                    range: { start: { line: 15, character: 0 }, end: { line: 25, character: 1 } },
                },
            ];

            const mockDocument = {
                lineAt: vi.fn(() => ({ text: 'export function myFunction() {' })),
            };

            vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue(mockDocument as unknown as vscode.TextDocument);
            vi.mocked(vscode.commands.executeCommand).mockResolvedValue(mockDefinitions);

            const service = getSymbolService();
            const result = await service.getDefinition('/path/to/usage.ts', 10, 15);

            expect(result).toHaveLength(1);
            expect(result[0].path).toBe('/path/to/definition.ts');
            expect(result[0].line).toBe(16); // 1-indexed
            expect(result[0].lineText).toBe('export function myFunction() {');
        });
    });

    describe('getCallHierarchy', () => {
        it('should return call hierarchy with callers and callees', async () => {
            const mockItem = {
                name: 'myFunction',
                kind: vscode.SymbolKind.Function,
                uri: { fsPath: '/path/to/file.ts' },
                range: { start: { line: 10, character: 0 }, end: { line: 20, character: 1 } },
                detail: 'function details',
            };

            const mockCallers = [
                {
                    from: {
                        name: 'caller1',
                        kind: vscode.SymbolKind.Function,
                        uri: { fsPath: '/path/to/caller.ts' },
                        range: { start: { line: 5, character: 0 }, end: { line: 15, character: 1 } },
                    },
                    fromRanges: [
                        { start: { line: 8, character: 10 }, end: { line: 8, character: 20 } },
                    ],
                },
            ];

            const mockCallees = [
                {
                    to: {
                        name: 'callee1',
                        kind: vscode.SymbolKind.Function,
                        uri: { fsPath: '/path/to/callee.ts' },
                        range: { start: { line: 30, character: 0 }, end: { line: 40, character: 1 } },
                    },
                    fromRanges: [
                        { start: { line: 15, character: 5 }, end: { line: 15, character: 12 } },
                    ],
                },
            ];

            vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue({} as vscode.TextDocument);
            vi.mocked(vscode.commands.executeCommand)
                .mockResolvedValueOnce([mockItem]) // prepareCallHierarchy
                .mockResolvedValueOnce(mockCallers) // provideIncomingCalls
                .mockResolvedValueOnce(mockCallees); // provideOutgoingCalls

            const service = getSymbolService();
            const result = await service.getCallHierarchy('/path/to/file.ts', 15, 10);

            expect(result).not.toBeNull();
            expect(result?.item.name).toBe('myFunction');
            expect(result?.callers).toHaveLength(1);
            expect(result?.callers[0].from.name).toBe('caller1');
            expect(result?.callees).toHaveLength(1);
            expect(result?.callees[0].to.name).toBe('callee1');
        });

        it('should return null when call hierarchy not available', async () => {
            vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue({} as vscode.TextDocument);
            vi.mocked(vscode.commands.executeCommand).mockResolvedValue([]);

            const service = getSymbolService();
            const result = await service.getCallHierarchy('/path/to/file.ts', 15, 10);

            expect(result).toBeNull();
        });
    });

    describe('singleton', () => {
        it('should return same instance', () => {
            const instance1 = getSymbolService();
            const instance2 = getSymbolService();
            expect(instance1).toBe(instance2);
        });

        it('should create new instance after reset', () => {
            const instance1 = getSymbolService();
            resetSymbolService();
            const instance2 = getSymbolService();
            expect(instance1).not.toBe(instance2);
        });
    });

    describe('cache management', () => {
        it('should clear all cache', async () => {
            const mockSymbols = [
                {
                    name: 'TestFunc',
                    kind: vscode.SymbolKind.Function,
                    range: { start: { line: 0, character: 0 }, end: { line: 5, character: 1 } },
                    selectionRange: { start: { line: 0, character: 9 }, end: { line: 0, character: 17 } },
                    children: [],
                },
            ];

            vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue({} as vscode.TextDocument);
            vi.mocked(vscode.commands.executeCommand).mockResolvedValue(mockSymbols);

            const service = getSymbolService();

            await service.getDocumentSymbols('/path/to/file.ts');
            service.clearCache();
            await service.getDocumentSymbols('/path/to/file.ts');

            // Should be called twice after cache clear
            expect(vscode.commands.executeCommand).toHaveBeenCalledTimes(2);
        });

        it('should clear cache for specific file', async () => {
            const mockSymbols = [
                {
                    name: 'TestFunc',
                    kind: vscode.SymbolKind.Function,
                    range: { start: { line: 0, character: 0 }, end: { line: 5, character: 1 } },
                    selectionRange: { start: { line: 0, character: 9 }, end: { line: 0, character: 17 } },
                    children: [],
                },
            ];

            vi.mocked(vscode.workspace.openTextDocument).mockResolvedValue({} as vscode.TextDocument);
            vi.mocked(vscode.commands.executeCommand).mockResolvedValue(mockSymbols);

            const service = getSymbolService();

            await service.getDocumentSymbols('/path/to/file1.ts');
            await service.getDocumentSymbols('/path/to/file2.ts');

            service.clearFileCache('/path/to/file1.ts');

            await service.getDocumentSymbols('/path/to/file1.ts'); // Should query again
            await service.getDocumentSymbols('/path/to/file2.ts'); // Should use cache

            // 2 initial + 1 after clear for file1
            expect(vscode.commands.executeCommand).toHaveBeenCalledTimes(3);
        });
    });
});
