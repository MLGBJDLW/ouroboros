/**
 * Tests for attachmentHelper
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import {
    base64ToUint8Array,
    base64ToText,
    attachmentsToDataParts,
    buildToolResult,
} from '../../tools/attachmentHelper';
import type { SerializedAttachment } from '../../tools/types';

describe('attachmentHelper', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('base64ToUint8Array', () => {
        it('should convert base64 string to Uint8Array', () => {
            const base64 = btoa('hello');
            const result = base64ToUint8Array(base64);
            expect(result).toBeInstanceOf(Uint8Array);
            expect(result.length).toBe(5);
        });

        it('should handle data URL format', () => {
            const dataUrl = 'data:image/png;base64,' + btoa('test');
            const result = base64ToUint8Array(dataUrl);
            expect(result).toBeInstanceOf(Uint8Array);
            expect(result.length).toBe(4);
        });

        it('should handle empty string', () => {
            const result = base64ToUint8Array(btoa(''));
            expect(result).toBeInstanceOf(Uint8Array);
            expect(result.length).toBe(0);
        });
    });

    describe('base64ToText', () => {
        it('should convert base64 to text', () => {
            const base64 = btoa('hello world');
            const result = base64ToText(base64);
            expect(result).toBe('hello world');
        });

        it('should handle data URL format', () => {
            const dataUrl = 'data:text/plain;base64,' + btoa('test content');
            const result = base64ToText(dataUrl);
            expect(result).toBe('test content');
        });
    });

    describe('attachmentsToDataParts', () => {
        it('should return empty array for undefined attachments', () => {
            const result = attachmentsToDataParts(undefined);
            expect(result).toEqual([]);
        });

        it('should return empty array for empty attachments', () => {
            const result = attachmentsToDataParts([]);
            expect(result).toEqual([]);
        });

        it('should convert image attachment to LanguageModelDataPart', () => {
            const attachment: SerializedAttachment = {
                id: 'test-1',
                type: 'image',
                name: 'test.png',
                data: 'data:image/png;base64,' + btoa('fake image data'),
                mimeType: 'image/png',
                size: 100,
            };

            const result = attachmentsToDataParts([attachment]);
            expect(result.length).toBe(1);
            expect(result[0]).toBeInstanceOf(vscode.LanguageModelDataPart);
        });

        it('should convert code attachment to LanguageModelTextPart', () => {
            const attachment: SerializedAttachment = {
                id: 'test-2',
                type: 'code',
                name: 'test.ts',
                data: 'data:text/plain;base64,' + btoa('const x = 1;'),
                mimeType: 'text/plain',
                size: 12,
                language: 'typescript',
            };

            const result = attachmentsToDataParts([attachment]);
            expect(result.length).toBe(1);
            expect(result[0]).toBeInstanceOf(vscode.LanguageModelTextPart);
            expect((result[0] as vscode.LanguageModelTextPart).value).toContain('test.ts');
            expect((result[0] as vscode.LanguageModelTextPart).value).toContain('const x = 1;');
        });

        it('should convert file attachment to LanguageModelTextPart', () => {
            const attachment: SerializedAttachment = {
                id: 'test-3',
                type: 'file',
                name: 'readme.txt',
                data: 'data:text/plain;base64,' + btoa('Hello'),
                mimeType: 'text/plain',
                size: 5,
            };

            const result = attachmentsToDataParts([attachment]);
            expect(result.length).toBe(1);
            expect(result[0]).toBeInstanceOf(vscode.LanguageModelTextPart);
        });

        it('should handle multiple attachments', () => {
            const attachments: SerializedAttachment[] = [
                {
                    id: 'img-1',
                    type: 'image',
                    name: 'photo.jpg',
                    data: 'data:image/jpeg;base64,' + btoa('img'),
                    mimeType: 'image/jpeg',
                },
                {
                    id: 'code-1',
                    type: 'code',
                    name: 'app.js',
                    data: btoa('console.log("hi")'),
                    language: 'javascript',
                },
            ];

            const result = attachmentsToDataParts(attachments);
            expect(result.length).toBe(2);
        });

        it('should skip image without mimeType', () => {
            const attachment: SerializedAttachment = {
                id: 'test-4',
                type: 'image',
                name: 'test.png',
                data: btoa('data'),
            };

            const result = attachmentsToDataParts([attachment]);
            expect(result.length).toBe(0);
        });
    });

    describe('buildToolResult', () => {
        it('should build result with text output only', () => {
            const output = { response: 'hello', cancelled: false };
            const result = buildToolResult(output) as unknown as { parts: vscode.LanguageModelTextPart[] };

            expect(result).toBeInstanceOf(vscode.LanguageModelToolResult);
            expect(result.parts.length).toBe(1);
        });

        it('should build result with attachments', () => {
            const output = { response: 'hello', cancelled: false };
            const attachments: SerializedAttachment[] = [
                {
                    id: 'img-1',
                    type: 'image',
                    name: 'test.png',
                    data: 'data:image/png;base64,' + btoa('img'),
                    mimeType: 'image/png',
                },
            ];

            const result = buildToolResult(output, attachments) as unknown as { parts: unknown[] };
            expect(result.parts.length).toBe(2);
        });

        it('should serialize output to JSON', () => {
            const output = { foo: 'bar', num: 42 };
            const result = buildToolResult(output) as unknown as { parts: vscode.LanguageModelTextPart[] };

            const textPart = result.parts[0] as vscode.LanguageModelTextPart;
            expect(JSON.parse(textPart.value)).toEqual(output);
        });
    });
});
