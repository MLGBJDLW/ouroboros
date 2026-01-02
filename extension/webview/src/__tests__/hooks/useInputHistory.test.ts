/**
 * Tests for useInputHistory hook
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useInputHistory } from '../../hooks/useInputHistory';

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: vi.fn((key: string) => store[key] || null),
        setItem: vi.fn((key: string, value: string) => {
            store[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
            delete store[key];
        }),
        clear: vi.fn(() => {
            store = {};
        }),
    };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('useInputHistory', () => {
    beforeEach(() => {
        localStorageMock.clear();
        vi.clearAllMocks();
    });

    describe('addToHistory', () => {
        it('should add new entry to history', () => {
            const { result } = renderHook(() => useInputHistory());

            act(() => {
                result.current.addToHistory('test input');
            });

            expect(result.current.getHistory()).toContain('test input');
        });

        it('should not add empty strings', () => {
            const { result } = renderHook(() => useInputHistory());

            act(() => {
                result.current.addToHistory('');
                result.current.addToHistory('   ');
            });

            expect(result.current.getHistory()).toHaveLength(0);
        });

        it('should trim whitespace', () => {
            const { result } = renderHook(() => useInputHistory());

            act(() => {
                result.current.addToHistory('  test  ');
            });

            expect(result.current.getHistory()).toContain('test');
        });

        it('should remove duplicates and add to front', () => {
            const { result } = renderHook(() => useInputHistory());

            act(() => {
                result.current.addToHistory('first');
                result.current.addToHistory('second');
                result.current.addToHistory('first'); // duplicate
            });

            const history = result.current.getHistory();
            expect(history).toEqual(['first', 'second']);
        });

        it('should respect maxSize limit', () => {
            const { result } = renderHook(() => useInputHistory({ maxSize: 3 }));

            act(() => {
                result.current.addToHistory('one');
                result.current.addToHistory('two');
                result.current.addToHistory('three');
                result.current.addToHistory('four');
            });

            const history = result.current.getHistory();
            expect(history).toHaveLength(3);
            expect(history).toEqual(['four', 'three', 'two']);
        });

        it('should persist to localStorage', () => {
            const { result } = renderHook(() => useInputHistory({ storageKey: 'test-key' }));

            act(() => {
                result.current.addToHistory('persisted');
            });

            expect(localStorageMock.setItem).toHaveBeenCalledWith(
                'test-key',
                JSON.stringify(['persisted'])
            );
        });
    });

    describe('navigation', () => {
        it('should navigate up through history', () => {
            const { result } = renderHook(() => useInputHistory());

            act(() => {
                result.current.addToHistory('first');
                result.current.addToHistory('second');
                result.current.addToHistory('third');
            });

            let value: string | null;
            act(() => {
                value = result.current.navigateUp();
            });
            expect(value!).toBe('third');

            act(() => {
                value = result.current.navigateUp();
            });
            expect(value!).toBe('second');

            act(() => {
                value = result.current.navigateUp();
            });
            expect(value!).toBe('first');

            // Should return null at end
            act(() => {
                value = result.current.navigateUp();
            });
            expect(value!).toBeNull();
        });

        it('should navigate down through history', () => {
            const { result } = renderHook(() => useInputHistory());

            act(() => {
                result.current.addToHistory('first');
                result.current.addToHistory('second');
            });

            // Navigate up twice first (separate acts for state updates)
            act(() => {
                result.current.navigateUp(); // -> second (index 0)
            });
            act(() => {
                result.current.navigateUp(); // -> first (index 1)
            });

            let value: string | null;
            act(() => {
                value = result.current.navigateDown(); // -> second (index 0)
            });
            expect(value!).toBe('second');
        });

        it('should return null when navigating down from start', () => {
            const { result } = renderHook(() => useInputHistory());

            let value: string | null;
            act(() => {
                value = result.current.navigateDown();
            });
            expect(value!).toBeNull();
        });

        it('should reset navigation index', () => {
            const { result } = renderHook(() => useInputHistory());

            act(() => {
                result.current.addToHistory('test');
            });
            
            act(() => {
                result.current.navigateUp();
            });

            expect(result.current.navigationIndex).toBe(0);

            act(() => {
                result.current.resetNavigation();
            });

            expect(result.current.navigationIndex).toBe(-1);
        });
    });

    describe('clearHistory', () => {
        it('should clear all history', () => {
            const { result } = renderHook(() => useInputHistory({ storageKey: 'clear-test' }));

            act(() => {
                result.current.addToHistory('one');
                result.current.addToHistory('two');
            });

            expect(result.current.getHistory()).toHaveLength(2);

            act(() => {
                result.current.clearHistory();
            });

            expect(result.current.getHistory()).toHaveLength(0);
            expect(localStorageMock.removeItem).toHaveBeenCalledWith('clear-test');
        });
    });

    describe('handleKeyDown', () => {
        it('should handle ArrowUp key for input element', () => {
            const { result } = renderHook(() => useInputHistory());
            const setValue = vi.fn();

            act(() => {
                result.current.addToHistory('previous input');
            });

            const mockEvent = {
                key: 'ArrowUp',
                preventDefault: vi.fn(),
                target: {
                    tagName: 'INPUT',
                } as HTMLInputElement,
            } as unknown as React.KeyboardEvent<HTMLInputElement>;

            let handled: boolean;
            act(() => {
                handled = result.current.handleKeyDown(mockEvent, '', setValue);
            });

            expect(handled!).toBe(true);
            expect(mockEvent.preventDefault).toHaveBeenCalled();
            expect(setValue).toHaveBeenCalledWith('previous input');
        });

        it('should handle ArrowDown key', () => {
            const { result } = renderHook(() => useInputHistory());
            const setValue = vi.fn();

            act(() => {
                result.current.addToHistory('old');
                result.current.addToHistory('new');
            });

            // Navigate up twice
            const upEvent = {
                key: 'ArrowUp',
                preventDefault: vi.fn(),
                target: { tagName: 'INPUT' } as HTMLInputElement,
            } as unknown as React.KeyboardEvent<HTMLInputElement>;

            act(() => {
                result.current.handleKeyDown(upEvent, '', setValue);
                result.current.handleKeyDown(upEvent, 'new', setValue);
            });

            // Navigate down
            const downEvent = {
                key: 'ArrowDown',
                preventDefault: vi.fn(),
                target: { tagName: 'INPUT' } as HTMLInputElement,
            } as unknown as React.KeyboardEvent<HTMLInputElement>;

            let handled: boolean;
            act(() => {
                handled = result.current.handleKeyDown(downEvent, 'old', setValue);
            });

            expect(handled!).toBe(true);
            expect(downEvent.preventDefault).toHaveBeenCalled();
        });

        it('should return false for non-arrow keys', () => {
            const { result } = renderHook(() => useInputHistory());
            const setValue = vi.fn();

            const mockEvent = {
                key: 'Enter',
                preventDefault: vi.fn(),
                target: { tagName: 'INPUT' } as HTMLInputElement,
            } as unknown as React.KeyboardEvent<HTMLInputElement>;

            let handled: boolean;
            act(() => {
                handled = result.current.handleKeyDown(mockEvent, '', setValue);
            });

            expect(handled!).toBe(false);
            expect(mockEvent.preventDefault).not.toHaveBeenCalled();
        });
    });

    describe('localStorage loading', () => {
        it('should load history from localStorage on init', () => {
            localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(['saved1', 'saved2']));

            const { result } = renderHook(() => useInputHistory({ storageKey: 'load-test' }));

            expect(result.current.getHistory()).toEqual(['saved1', 'saved2']);
        });

        it('should handle invalid localStorage data', () => {
            localStorageMock.getItem.mockReturnValueOnce('invalid json');

            const { result } = renderHook(() => useInputHistory({ storageKey: 'invalid-test' }));

            expect(result.current.getHistory()).toEqual([]);
        });
    });
});
