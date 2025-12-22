/**
 * Tests for SpecWatcher service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';

// Mock specScanner
const mockScanSpecsFolder = vi.fn();
vi.mock('../../services/specScanner', () => ({
    scanSpecsFolder: (...args: unknown[]) => mockScanSpecsFolder(...args),
}));

// Mock debounce to execute immediately
vi.mock('../../utils/debounce', () => ({
    debounce: (fn: () => void) => fn,
}));

// Mock logger
vi.mock('../../utils/logger', () => ({
    createLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    }),
}));

describe('SpecWatcher', () => {
    let mockWatcher: {
        onDidCreate: ReturnType<typeof vi.fn>;
        onDidChange: ReturnType<typeof vi.fn>;
        onDidDelete: ReturnType<typeof vi.fn>;
        dispose: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        vi.resetAllMocks();

        mockWatcher = {
            onDidCreate: vi.fn().mockReturnValue({ dispose: vi.fn() }),
            onDidChange: vi.fn().mockReturnValue({ dispose: vi.fn() }),
            onDidDelete: vi.fn().mockReturnValue({ dispose: vi.fn() }),
            dispose: vi.fn(),
        };

        (vscode.workspace.createFileSystemWatcher as ReturnType<typeof vi.fn>).mockReturnValue(mockWatcher);

        mockScanSpecsFolder.mockResolvedValue({
            active: [],
            archived: [],
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should create watcher instance', async () => {
            const { SpecWatcher } = await import('../../services/specWatcher');
            const watcher = new SpecWatcher();

            expect(watcher).toBeDefined();
            expect(watcher.onSpecChange).toBeDefined();

            watcher.dispose();
        });
    });

    describe('start', () => {
        it('should create file system watcher for specs folder', async () => {
            const { SpecWatcher } = await import('../../services/specWatcher');
            const watcher = new SpecWatcher();

            await watcher.start('/test-workspace');

            expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalled();
            expect(mockWatcher.onDidCreate).toHaveBeenCalled();
            expect(mockWatcher.onDidChange).toHaveBeenCalled();
            expect(mockWatcher.onDidDelete).toHaveBeenCalled();

            watcher.dispose();
        });

        it('should perform initial scan', async () => {
            const { SpecWatcher } = await import('../../services/specWatcher');
            const watcher = new SpecWatcher();

            await watcher.start('/test-workspace');

            expect(mockScanSpecsFolder).toHaveBeenCalledWith('/test-workspace');

            watcher.dispose();
        });

        it('should emit specs on initial scan', async () => {
            const mockSpecs = {
                active: [{ name: 'test-spec', path: '/path' }],
                archived: [],
            };
            mockScanSpecsFolder.mockResolvedValue(mockSpecs);

            const { SpecWatcher } = await import('../../services/specWatcher');
            const watcher = new SpecWatcher();

            const eventHandler = vi.fn();
            watcher.onSpecChange(eventHandler);

            await watcher.start('/test-workspace');

            expect(eventHandler).toHaveBeenCalledWith(mockSpecs);

            watcher.dispose();
        });
    });

    describe('file change handling', () => {
        it('should rescan on file create', async () => {
            const { SpecWatcher } = await import('../../services/specWatcher');
            const watcher = new SpecWatcher();

            await watcher.start('/test-workspace');

            // Get the onCreate callback
            const onCreateCallback = mockWatcher.onDidCreate.mock.calls[0][0];

            // Simulate file creation
            mockScanSpecsFolder.mockClear();
            onCreateCallback();

            expect(mockScanSpecsFolder).toHaveBeenCalled();

            watcher.dispose();
        });

        it('should rescan on file change', async () => {
            const { SpecWatcher } = await import('../../services/specWatcher');
            const watcher = new SpecWatcher();

            await watcher.start('/test-workspace');

            const onChangeCallback = mockWatcher.onDidChange.mock.calls[0][0];

            mockScanSpecsFolder.mockClear();
            onChangeCallback();

            expect(mockScanSpecsFolder).toHaveBeenCalled();

            watcher.dispose();
        });

        it('should rescan on file delete', async () => {
            const { SpecWatcher } = await import('../../services/specWatcher');
            const watcher = new SpecWatcher();

            await watcher.start('/test-workspace');

            const onDeleteCallback = mockWatcher.onDidDelete.mock.calls[0][0];

            mockScanSpecsFolder.mockClear();
            onDeleteCallback();

            expect(mockScanSpecsFolder).toHaveBeenCalled();

            watcher.dispose();
        });
    });

    describe('forceRescan', () => {
        it('should rescan and return specs', async () => {
            const mockSpecs = {
                active: [{ name: 'spec1' }],
                archived: [{ name: 'archived1' }],
            };
            mockScanSpecsFolder.mockResolvedValue(mockSpecs);

            const { SpecWatcher } = await import('../../services/specWatcher');
            const watcher = new SpecWatcher();

            await watcher.start('/test-workspace');

            mockScanSpecsFolder.mockClear();
            mockScanSpecsFolder.mockResolvedValue(mockSpecs);

            const result = await watcher.forceRescan();

            expect(result).toEqual(mockSpecs);
            expect(mockScanSpecsFolder).toHaveBeenCalled();

            watcher.dispose();
        });

        it('should return null if workspace not set', async () => {
            const { SpecWatcher } = await import('../../services/specWatcher');
            const watcher = new SpecWatcher();

            // Don't call start()
            const result = await watcher.forceRescan();

            expect(result).toBeNull();

            watcher.dispose();
        });
    });

    describe('dispose', () => {
        it('should dispose file watcher', async () => {
            const { SpecWatcher } = await import('../../services/specWatcher');
            const watcher = new SpecWatcher();

            await watcher.start('/test-workspace');

            watcher.dispose();

            expect(mockWatcher.dispose).toHaveBeenCalled();
        });
    });
});
