/**
 * GoModGraphAdapter Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GoModGraphAdapter, shouldRecommendGoModGraph } from '../../../codeGraph/adapters/GoModGraphAdapter';
import * as fs from 'fs';
import * as child_process from 'child_process';

vi.mock('fs');
vi.mock('child_process');

describe('GoModGraphAdapter', () => {
    const mockWorkspaceRoot = '/test/workspace';
    let adapter: GoModGraphAdapter;

    beforeEach(() => {
        vi.clearAllMocks();
        adapter = new GoModGraphAdapter(mockWorkspaceRoot);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should create adapter with default config', () => {
            expect(adapter).toBeDefined();
        });

        it('should merge custom config with defaults', () => {
            const customAdapter = new GoModGraphAdapter(mockWorkspaceRoot, {
                enabled: false,
                timeout: 15000,
            });
            expect(customAdapter).toBeDefined();
        });
    });

    describe('checkAvailability', () => {
        it('should return false when no go.mod exists', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);

            const available = await adapter.checkAvailability();
            expect(available).toBe(false);
        });

        it('should return true when go.mod exists and Go is installed', async () => {
            vi.mocked(fs.existsSync).mockImplementation((path) => {
                return String(path).includes('go.mod');
            });
            vi.mocked(child_process.execSync).mockReturnValue(Buffer.from('go version go1.21.0'));

            const available = await adapter.checkAvailability();
            expect(available).toBe(true);
        });

        it('should return false when Go is not installed', async () => {
            vi.mocked(fs.existsSync).mockImplementation((path) => {
                return String(path).includes('go.mod');
            });
            vi.mocked(child_process.execSync).mockImplementation(() => {
                throw new Error('Command not found');
            });

            const available = await adapter.checkAvailability();
            expect(available).toBe(false);
        });

        it('should cache availability result', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);

            await adapter.checkAvailability();
            await adapter.checkAvailability();

            // fs.existsSync should only be called once due to caching
            expect(fs.existsSync).toHaveBeenCalledTimes(1);
        });
    });

    describe('supportsFile', () => {
        it('should support Go files', () => {
            expect(adapter.supportsFile('main.go')).toBe(true);
            expect(adapter.supportsFile('src/handler.go')).toBe(true);
        });

        it('should not support other file types', () => {
            expect(adapter.supportsFile('main.ts')).toBe(false);
            expect(adapter.supportsFile('main.py')).toBe(false);
            expect(adapter.supportsFile('go.mod')).toBe(false);
        });
    });

    describe('analyze', () => {
        it('should return null when disabled', async () => {
            const disabledAdapter = new GoModGraphAdapter(mockWorkspaceRoot, {
                enabled: false,
            });

            const result = await disabledAdapter.analyze();
            expect(result).toBeNull();
        });

        it('should return null when not available', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);

            const result = await adapter.analyze();
            expect(result).toBeNull();
        });
    });

    describe('getInstallInstructions', () => {
        it('should return installation instructions', () => {
            const instructions = GoModGraphAdapter.getInstallInstructions();
            expect(instructions).toContain('Go');
            expect(instructions).toContain('go.mod');
        });
    });
});

describe('shouldRecommendGoModGraph', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return true when go.mod exists', () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);

        const result = shouldRecommendGoModGraph('/test/workspace');
        expect(result).toBe(true);
    });

    it('should return false when go.mod does not exist', () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);

        const result = shouldRecommendGoModGraph('/test/workspace');
        expect(result).toBe(false);
    });
});
