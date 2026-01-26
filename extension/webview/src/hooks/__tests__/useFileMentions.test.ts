/**
 * Tests for useFileMentions hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFileMentions } from '../useFileMentions';

// Mock the vscodeApi module
const mockPostMessage = vi.fn();
vi.mock('../../utils/vscodeApi', () => ({
    postMessage: (message: unknown) => mockPostMessage(message),
}));

// Helper to simulate file list response
function simulateFileListResponse(files: Array<{ path: string; name: string; isDirectory: boolean }>) {
    const event = new MessageEvent('message', {
        data: { type: 'fileListResponse', payload: files },
    });
    window.dispatchEvent(event);
}

describe('useFileMentions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('initial state', () => {
        it('should start inactive with no matches', () => {
            const { result } = renderHook(() => useFileMentions());

            expect(result.current.isActive).toBe(false);
            expect(result.current.matches).toEqual([]);
            expect(result.current.selectedIndex).toBe(0);
        });

        it('should request file list on mount', () => {
            renderHook(() => useFileMentions());

            expect(mockPostMessage).toHaveBeenCalledWith({ type: 'getFileList' });
        });

        it('should start in loading state', () => {
            const { result } = renderHook(() => useFileMentions());

            expect(result.current.isLoading).toBe(true);
        });
    });

    describe('file list handling', () => {
        it('should update files when response received', async () => {
            const { result } = renderHook(() => useFileMentions());

            const testFiles = [
                { path: 'src/index.ts', name: 'index.ts', isDirectory: false },
                { path: 'src/utils/helper.ts', name: 'helper.ts', isDirectory: false },
            ];

            act(() => {
                simulateFileListResponse(testFiles);
            });

            expect(result.current.isLoading).toBe(false);
        });
    });

    describe('update - @ detection', () => {
        it('should activate when @ is typed', () => {
            const { result } = renderHook(() => useFileMentions());

            // Simulate files loaded
            act(() => {
                simulateFileListResponse([
                    { path: 'src/index.ts', name: 'index.ts', isDirectory: false },
                ]);
            });

            act(() => {
                result.current.update('@', 1);
            });

            expect(result.current.isActive).toBe(true);
        });

        it('should not activate for text without @', () => {
            const { result } = renderHook(() => useFileMentions());

            act(() => {
                result.current.update('hello world', 11);
            });

            expect(result.current.isActive).toBe(false);
        });

        it('should activate for @ in middle of text', () => {
            const { result } = renderHook(() => useFileMentions());

            act(() => {
                simulateFileListResponse([
                    { path: 'src/index.ts', name: 'index.ts', isDirectory: false },
                ]);
            });

            act(() => {
                result.current.update('check @', 7);
            });

            expect(result.current.isActive).toBe(true);
        });

        it('should not activate if @ is followed by space before cursor', () => {
            const { result } = renderHook(() => useFileMentions());

            act(() => {
                result.current.update('@ something', 11);
            });

            expect(result.current.isActive).toBe(false);
        });
    });

    describe('fuzzy matching', () => {
        const testFiles = [
            { path: 'src/index.ts', name: 'index.ts', isDirectory: false },
            { path: 'src/utils/helper.ts', name: 'helper.ts', isDirectory: false },
            { path: 'src/utils/format.ts', name: 'format.ts', isDirectory: false },
            { path: 'src/components/Button.tsx', name: 'Button.tsx', isDirectory: false },
            { path: 'package.json', name: 'package.json', isDirectory: false },
        ];

        it('should show all files when just @ is typed', () => {
            const { result } = renderHook(() => useFileMentions());

            act(() => {
                simulateFileListResponse(testFiles);
            });

            act(() => {
                result.current.update('@', 1);
            });

            expect(result.current.matches.length).toBe(testFiles.length);
        });

        it('should filter by file name', () => {
            const { result } = renderHook(() => useFileMentions());

            act(() => {
                simulateFileListResponse(testFiles);
            });

            act(() => {
                result.current.update('@helper', 7);
            });

            expect(result.current.matches.length).toBe(1);
            expect(result.current.matches[0].name).toBe('helper.ts');
        });

        it('should filter by path', () => {
            const { result } = renderHook(() => useFileMentions());

            act(() => {
                simulateFileListResponse(testFiles);
            });

            act(() => {
                result.current.update('@utils', 6);
            });

            expect(result.current.matches.length).toBe(2);
            expect(result.current.matches.every(m => m.path.includes('utils'))).toBe(true);
        });

        it('should be case insensitive', () => {
            const { result } = renderHook(() => useFileMentions());

            act(() => {
                simulateFileListResponse(testFiles);
            });

            act(() => {
                result.current.update('@BUTTON', 7);
            });

            expect(result.current.matches.length).toBe(1);
            expect(result.current.matches[0].name).toBe('Button.tsx');
        });

        it('should prioritize exact name matches', () => {
            const { result } = renderHook(() => useFileMentions());

            act(() => {
                simulateFileListResponse(testFiles);
            });

            act(() => {
                result.current.update('@index', 6);
            });

            expect(result.current.matches[0].name).toBe('index.ts');
        });
    });

    describe('navigation', () => {
        const testFiles = [
            { path: 'file1.ts', name: 'file1.ts', isDirectory: false },
            { path: 'file2.ts', name: 'file2.ts', isDirectory: false },
            { path: 'file3.ts', name: 'file3.ts', isDirectory: false },
        ];

        it('should move selection down', () => {
            const { result } = renderHook(() => useFileMentions());

            act(() => {
                simulateFileListResponse(testFiles);
            });

            act(() => {
                result.current.update('@', 1);
            });

            expect(result.current.selectedIndex).toBe(0);

            act(() => {
                result.current.moveDown();
            });

            expect(result.current.selectedIndex).toBe(1);
        });

        it('should move selection up', () => {
            const { result } = renderHook(() => useFileMentions());

            act(() => {
                simulateFileListResponse(testFiles);
            });

            act(() => {
                result.current.update('@', 1);
            });

            act(() => {
                result.current.moveDown();
                result.current.moveDown();
            });

            expect(result.current.selectedIndex).toBe(2);

            act(() => {
                result.current.moveUp();
            });

            expect(result.current.selectedIndex).toBe(1);
        });

        it('should not go below 0', () => {
            const { result } = renderHook(() => useFileMentions());

            act(() => {
                simulateFileListResponse(testFiles);
            });

            act(() => {
                result.current.update('@', 1);
                result.current.moveUp();
            });

            expect(result.current.selectedIndex).toBe(0);
        });

        it('should not exceed matches length', () => {
            const { result } = renderHook(() => useFileMentions());

            act(() => {
                simulateFileListResponse(testFiles);
            });

            act(() => {
                result.current.update('@', 1);
            });

            // Move down many times
            act(() => {
                for (let i = 0; i < 10; i++) {
                    result.current.moveDown();
                }
            });

            expect(result.current.selectedIndex).toBe(testFiles.length - 1);
        });
    });

    describe('complete', () => {
        const testFiles = [
            { path: 'src/index.ts', name: 'index.ts', isDirectory: false },
            { path: 'src/utils/helper.ts', name: 'helper.ts', isDirectory: false },
        ];

        it('should replace @ mention with full path', () => {
            const { result } = renderHook(() => useFileMentions());

            act(() => {
                simulateFileListResponse(testFiles);
            });

            act(() => {
                result.current.update('@ind', 4);
            });

            let completed: { text: string; newCursor: number } = { text: '', newCursor: 0 };
            act(() => {
                completed = result.current.complete('@ind', 4);
            });

            expect(completed.text).toBe('@src/index.ts ');
            expect(completed.newCursor).toBe('@src/index.ts '.length);
            expect(result.current.isActive).toBe(false);
        });

        it('should preserve text before @ mention', () => {
            const { result } = renderHook(() => useFileMentions());

            act(() => {
                simulateFileListResponse(testFiles);
            });

            act(() => {
                result.current.update('check @ind', 10);
            });

            let completed: { text: string; newCursor: number } = { text: '', newCursor: 0 };
            act(() => {
                completed = result.current.complete('check @ind', 10);
            });

            expect(completed.text).toBe('check @src/index.ts ');
        });

        it('should preserve text after @ mention', () => {
            const { result } = renderHook(() => useFileMentions());

            act(() => {
                simulateFileListResponse(testFiles);
            });

            act(() => {
                result.current.update('@ind please', 4);
            });

            let completed: { text: string; newCursor: number } = { text: '', newCursor: 0 };
            act(() => {
                completed = result.current.complete('@ind please', 4);
            });

            expect(completed.text).toBe('@src/index.ts  please');
        });

        it('should return original value if no matches', () => {
            const { result } = renderHook(() => useFileMentions());

            act(() => {
                simulateFileListResponse(testFiles);
            });

            act(() => {
                result.current.update('@xyz123', 7);
            });

            let completed: { text: string; newCursor: number } = { text: '', newCursor: 0 };
            act(() => {
                completed = result.current.complete('@xyz123', 7);
            });

            expect(completed.text).toBe('@xyz123');
        });
    });

    describe('cancel', () => {
        it('should reset state', () => {
            const { result } = renderHook(() => useFileMentions());

            act(() => {
                simulateFileListResponse([
                    { path: 'file.ts', name: 'file.ts', isDirectory: false },
                ]);
            });

            act(() => {
                result.current.update('@', 1);
                result.current.moveDown();
            });

            expect(result.current.isActive).toBe(true);

            act(() => {
                result.current.cancel();
            });

            expect(result.current.isActive).toBe(false);
            expect(result.current.matches).toEqual([]);
            expect(result.current.selectedIndex).toBe(0);
        });
    });

    describe('getCurrentMention', () => {
        it('should return mention info when active', () => {
            const { result } = renderHook(() => useFileMentions());

            act(() => {
                simulateFileListResponse([
                    { path: 'file.ts', name: 'file.ts', isDirectory: false },
                ]);
            });

            act(() => {
                result.current.update('check @file', 11);
            });

            const mention = result.current.getCurrentMention();
            expect(mention).not.toBeNull();
            expect(mention?.start).toBe(6);
            expect(mention?.query).toBe('file');
        });

        it('should return null when not active', () => {
            const { result } = renderHook(() => useFileMentions());

            act(() => {
                result.current.update('no mention here', 15);
            });

            expect(result.current.getCurrentMention()).toBeNull();
        });
    });
});
