/**
 * Disposable management utilities
 */

import * as vscode from 'vscode';

/**
 * Base class for disposable resources
 */
export abstract class DisposableBase implements vscode.Disposable {
    protected disposables: vscode.Disposable[] = [];
    private disposed = false;

    protected register<T extends vscode.Disposable>(disposable: T): T {
        if (this.disposed) {
            disposable.dispose();
            throw new Error('Cannot register disposable on disposed object');
        }
        this.disposables.push(disposable);
        return disposable;
    }

    public dispose(): void {
        if (this.disposed) {
            return;
        }
        this.disposed = true;

        const errors: Error[] = [];
        for (const disposable of this.disposables) {
            try {
                disposable.dispose();
            } catch (error) {
                errors.push(error instanceof Error ? error : new Error(String(error)));
            }
        }
        this.disposables = [];

        if (errors.length > 0) {
            throw new AggregateError(errors, 'Failed to dispose some resources');
        }
    }

    public get isDisposed(): boolean {
        return this.disposed;
    }
}

/**
 * Aggregate error for multiple disposal failures
 */
class AggregateError extends Error {
    constructor(
        public readonly errors: Error[],
        message: string
    ) {
        super(message);
        this.name = 'AggregateError';
    }
}
