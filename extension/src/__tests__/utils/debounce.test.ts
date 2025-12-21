/**
 * Tests for debounce utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce, throttle } from '../../utils/debounce';

describe('debounce', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('debounce()', () => {
        it('should delay function execution', () => {
            const fn = vi.fn();
            const debounced = debounce(fn, 100);

            debounced();
            expect(fn).not.toHaveBeenCalled();

            vi.advanceTimersByTime(100);
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should reset timer on subsequent calls', () => {
            const fn = vi.fn();
            const debounced = debounce(fn, 100);

            debounced();
            vi.advanceTimersByTime(50);
            debounced(); // Reset timer
            vi.advanceTimersByTime(50);
            expect(fn).not.toHaveBeenCalled();

            vi.advanceTimersByTime(50);
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should pass arguments to the function', () => {
            const fn = vi.fn();
            const debounced = debounce(fn, 100);

            debounced('arg1', 'arg2');
            vi.advanceTimersByTime(100);

            expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
        });

        it('should use the latest arguments', () => {
            const fn = vi.fn();
            const debounced = debounce(fn, 100);

            debounced('first');
            debounced('second');
            debounced('third');
            vi.advanceTimersByTime(100);

            expect(fn).toHaveBeenCalledTimes(1);
            expect(fn).toHaveBeenCalledWith('third');
        });
    });

    describe('throttle()', () => {
        it('should execute immediately on first call', () => {
            const fn = vi.fn();
            const throttled = throttle(fn, 100);

            throttled();
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should ignore calls within the wait period', () => {
            const fn = vi.fn();
            const throttled = throttle(fn, 100);

            throttled();
            throttled();
            throttled();
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('should execute after wait period expires', () => {
            const fn = vi.fn();
            const throttled = throttle(fn, 100);

            throttled();
            vi.advanceTimersByTime(100);
            throttled();
            expect(fn).toHaveBeenCalledTimes(2);
        });

        it('should schedule trailing call', () => {
            const fn = vi.fn();
            const throttled = throttle(fn, 100);

            throttled('first');
            throttled('second');
            expect(fn).toHaveBeenCalledTimes(1);
            expect(fn).toHaveBeenCalledWith('first');

            vi.advanceTimersByTime(100);
            expect(fn).toHaveBeenCalledTimes(2);
            expect(fn).toHaveBeenLastCalledWith('second');
        });

        it('should pass arguments correctly', () => {
            const fn = vi.fn();
            const throttled = throttle(fn, 100);

            throttled('arg1', 'arg2');
            expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
        });
    });
});
