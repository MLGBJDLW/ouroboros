/**
 * Tests for disposable utilities
 */

import { describe, it, expect, vi } from 'vitest';
import { DisposableBase } from '../../utils/disposable';

// Concrete implementation for testing
class TestDisposable extends DisposableBase {
    public testRegister<T extends { dispose: () => void }>(disposable: T): T {
        return this.register(disposable);
    }

    public getDisposablesCount(): number {
        return this.disposables.length;
    }
}

describe('DisposableBase', () => {
    it('should register disposables', () => {
        const instance = new TestDisposable();
        const mockDisposable = { dispose: vi.fn() };

        const result = instance.testRegister(mockDisposable);

        expect(result).toBe(mockDisposable);
        expect(instance.getDisposablesCount()).toBe(1);
    });

    it('should dispose all registered disposables', () => {
        const instance = new TestDisposable();
        const disposable1 = { dispose: vi.fn() };
        const disposable2 = { dispose: vi.fn() };

        instance.testRegister(disposable1);
        instance.testRegister(disposable2);
        instance.dispose();

        expect(disposable1.dispose).toHaveBeenCalled();
        expect(disposable2.dispose).toHaveBeenCalled();
    });

    it('should track disposed state', () => {
        const instance = new TestDisposable();

        expect(instance.isDisposed).toBe(false);
        instance.dispose();
        expect(instance.isDisposed).toBe(true);
    });

    it('should not dispose twice', () => {
        const instance = new TestDisposable();
        const disposable = { dispose: vi.fn() };

        instance.testRegister(disposable);
        instance.dispose();
        instance.dispose(); // Second call should be no-op

        expect(disposable.dispose).toHaveBeenCalledTimes(1);
    });

    it('should throw when registering on disposed object', () => {
        const instance = new TestDisposable();
        instance.dispose();

        const disposable = { dispose: vi.fn() };
        expect(() => instance.testRegister(disposable)).toThrow(
            'Cannot register disposable on disposed object'
        );
        expect(disposable.dispose).toHaveBeenCalled(); // Should dispose the passed disposable
    });

    it('should clear disposables array after dispose', () => {
        const instance = new TestDisposable();
        instance.testRegister({ dispose: vi.fn() });
        instance.testRegister({ dispose: vi.fn() });

        instance.dispose();

        expect(instance.getDisposablesCount()).toBe(0);
    });

    it('should handle disposable errors and aggregate them', () => {
        const instance = new TestDisposable();
        const error1 = new Error('Error 1');
        const error2 = new Error('Error 2');

        instance.testRegister({
            dispose: () => {
                throw error1;
            },
        });
        instance.testRegister({
            dispose: () => {
                throw error2;
            },
        });

        expect(() => instance.dispose()).toThrow('Failed to dispose some resources');
    });

    it('should continue disposing even if one fails', () => {
        const instance = new TestDisposable();
        const successDisposable = { dispose: vi.fn() };

        instance.testRegister({
            dispose: () => {
                throw new Error('First fails');
            },
        });
        instance.testRegister(successDisposable);

        try {
            instance.dispose();
        } catch {
            // Expected
        }

        expect(successDisposable.dispose).toHaveBeenCalled();
    });
});
