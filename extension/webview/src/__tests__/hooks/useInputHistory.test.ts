/**
 * Tests for useInputHistory hook
 * Now uses History tab data (StoredInteraction) for persistence
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ReactNode } from 'react';
import { useInputHistory } from '../../hooks/useInputHistory';

// Mock AppContext
const mockHistory = [
    {
        id: '1',
        timestamp: Date.now() - 1000,
        type: 'ask',
        agentName: 'test-agent',
        agentLevel: 1 as const,
        question: 'Question 1',
        response: 'Response 1',
        status: 'responded' as const,
    },
    {
        id: '2',
        timestamp: Date.now() - 2000,
        type: 'ask',
        agentName: 'test-agent',
        agentLevel: 1 as const,
        question: 'Question 2',
        response: 'Response 2',
        status: 'responded' as const,
    },
    {
        id: '3',
        timestamp: Date.now() - 3000,
        type: 'menu',
        agentName: 'test-agent',
        agentLevel: 1 as const,
        question: 'Question 3',
        response: 'Menu Response',
        status: 'responded' as const,
    },
    {
        id: '4',
        timestamp: Date.now() - 4000,
        type: 'ask',
        agentName: 'test-agent',
        agentLevel: 1 as const,
        question: 'Question 4',
        response: '', // Empty response - should be filtered
        status: 'responded' as const,
    },
    {
        id: '5',
        timestamp: Date.now() - 5000,
        type: 'ask',
        agentName: 'test-agent',
        agentLevel: 1 as const,
        question: 'Question 5',
        response: 'Cancelled',
        status: 'cancelled' as const, // Cancelled - should be filtered
    },
];

let currentMockHistory = [...mockHistory];

vi.mock('../../context/AppContext', () => ({
    useAppContext: () => ({
        state: {
            history: currentMockHistory,
        },
    }),
}));

describe('useInputHistory', () => {
    beforeEach(() => {
        currentMockHistory = [...mockHistory];
        vi.clearAllMocks();
    });

    describe('getHistory', () => {
        it('should return responses from history tab', () => {
            const { result } = renderHook(() => useInputHistory());

            const history = result.current.getHistory();
            // Should have 3 valid responses (Response 1, Response 2, Menu Response)
            // Empty and cancelled responses should be filtered
            expect(history).toContain('Response 1');
            expect(history).toContain('Response 2');
            expect(history).toContain('Menu Response');
            expect(history).not.toContain('');
            expect(history).not.toContain('Cancelled');
        });

        it('should return most recent first', () => {
            const { result } = renderHook(() => useInputHistory());

            const history = result.current.getHistory();
            expect(history[0]).toBe('Response 1'); // Most recent
            expect(history[1]).toBe('Response 2');
        });

        it('should filter by type when specified', () => {
            const { result } = renderHook(() => useInputHistory({ filterType: 'menu' }));

            const history = result.current.getHistory();
            expect(history).toEqual(['Menu Response']);
        });

        it('should respect maxSize limit', () => {
            const { result } = renderHook(() => useInputHistory({ maxSize: 2 }));

            const history = result.current.getHistory();
            expect(history).toHaveLength(2);
        });

        it('should deduplicate responses', () => {
            // Add duplicate response
            currentMockHistory = [
                ...mockHistory,
                {
                    id: '6',
                    timestamp: Date.now(),
                    type: 'ask',
                    agentName: 'test-agent',
                    agentLevel: 1 as const,
                    question: 'Question 6',
                    response: 'Response 1', // Duplicate
                    status: 'responded' as const,
                },
            ];

            const { result } = renderHook(() => useInputHistory());

            const history = result.current.getHistory();
            const response1Count = history.filter(r => r === 'Response 1').length;
            expect(response1Count).toBe(1);
        });
    });

    describe('navigation', () => {
        it('should navigate up through history', () => {
            const { result } = renderHook(() => useInputHistory());

            let value: string | null;
            act(() => {
                value = result.current.navigateUp();
            });
            expect(value!).toBe('Response 1');

            act(() => {
                value = result.current.navigateUp();
            });
            expect(value!).toBe('Response 2');

            act(() => {
                value = result.current.navigateUp();
            });
            expect(value!).toBe('Menu Response');

            // Should return null at end
            act(() => {
                value = result.current.navigateUp();
            });
            expect(value!).toBeNull();
        });

        it('should navigate down through history', () => {
            const { result } = renderHook(() => useInputHistory());

            // Navigate up twice first
            act(() => {
                result.current.navigateUp();
            });
            act(() => {
                result.current.navigateUp();
            });

            let value: string | null;
            act(() => {
                value = result.current.navigateDown();
            });
            expect(value!).toBe('Response 1');
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
                result.current.navigateUp();
            });

            expect(result.current.navigationIndex).toBe(0);

            act(() => {
                result.current.resetNavigation();
            });

            expect(result.current.navigationIndex).toBe(-1);
        });
    });

    describe('handleKeyDown', () => {
        it('should handle ArrowUp key for input element', () => {
            const { result } = renderHook(() => useInputHistory());
            const setValue = vi.fn();

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
            expect(setValue).toHaveBeenCalledWith('Response 1');
        });

        it('should handle ArrowDown key', () => {
            const { result } = renderHook(() => useInputHistory());
            const setValue = vi.fn();

            // Navigate up twice
            const upEvent = {
                key: 'ArrowUp',
                preventDefault: vi.fn(),
                target: { tagName: 'INPUT' } as HTMLInputElement,
            } as unknown as React.KeyboardEvent<HTMLInputElement>;

            act(() => {
                result.current.handleKeyDown(upEvent, '', setValue);
            });
            act(() => {
                result.current.handleKeyDown(upEvent, 'Response 1', setValue);
            });

            // Navigate down
            const downEvent = {
                key: 'ArrowDown',
                preventDefault: vi.fn(),
                target: {
                    tagName: 'INPUT',
                    selectionStart: 10,  // At end of 'Response 2'
                    selectionEnd: 10,
                    value: 'Response 2',
                } as unknown as HTMLInputElement,
            } as unknown as React.KeyboardEvent<HTMLInputElement>;

            let handled: boolean;
            act(() => {
                handled = result.current.handleKeyDown(downEvent, 'Response 2', setValue);
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

        it('should return false when history is empty', () => {
            currentMockHistory = [];
            const { result } = renderHook(() => useInputHistory());
            const setValue = vi.fn();

            const mockEvent = {
                key: 'ArrowUp',
                preventDefault: vi.fn(),
                target: { tagName: 'INPUT' } as HTMLInputElement,
            } as unknown as React.KeyboardEvent<HTMLInputElement>;

            let handled: boolean;
            act(() => {
                handled = result.current.handleKeyDown(mockEvent, '', setValue);
            });

            expect(handled!).toBe(false);
        });
    });
});
