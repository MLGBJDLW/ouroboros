/**
 * DependencyCruiserAdapter Tests
 * 
 * Tests for the dependency-cruiser adapter.
 * dependency-cruiser must be installed in the user's project.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DependencyCruiserAdapter, shouldRecommendDependencyCruiser } from '../../../codeGraph/adapters/DependencyCruiserAdapter';
import * as fs from 'fs';

vi.mock('fs');

describe('DependencyCruiserAdapter', () => {
    const mockWorkspaceRoot = '/test/workspace';
    let adapter: DependencyCruiserAdapter;

    beforeEach(() => {
        vi.clearAllMocks();
        adapter = new DependencyCruiserAdapter(mockWorkspaceRoot);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should create adapter with default config', () => {
            expect(adapter).toBeDefined();
        });

        it('should merge custom config with defaults', () => {
            const customAdapter = new DependencyCruiserAdapter(mockWorkspaceRoot, {
                enabled: false,
                detectCircular: false,
            });
            expect(customAdapter).toBeDefined();
        });
    });

    describe('checkAvailability', () => {
        it('should check for local dependency-cruiser installation', async () => {
            // In test environment, dependency-cruiser may or may not be available
            const available = await adapter.checkAvailability();
            expect(typeof available).toBe('boolean');
        });

        it('should cache availability result', async () => {
            const result1 = await adapter.checkAvailability();
            const result2 = await adapter.checkAvailability();
            
            expect(result1).toBe(result2);
        });
    });

    describe('supportsFile', () => {
        it('should support TypeScript files', () => {
            expect(adapter.supportsFile('src/index.ts')).toBe(true);
            expect(adapter.supportsFile('src/component.tsx')).toBe(true);
            expect(adapter.supportsFile('src/module.mts')).toBe(true);
            expect(adapter.supportsFile('src/module.cts')).toBe(true);
        });

        it('should support JavaScript files', () => {
            expect(adapter.supportsFile('src/index.js')).toBe(true);
            expect(adapter.supportsFile('src/component.jsx')).toBe(true);
            expect(adapter.supportsFile('src/module.mjs')).toBe(true);
            expect(adapter.supportsFile('src/module.cjs')).toBe(true);
        });

        it('should not support other file types', () => {
            expect(adapter.supportsFile('src/main.py')).toBe(false);
            expect(adapter.supportsFile('src/main.rs')).toBe(false);
            expect(adapter.supportsFile('src/main.go')).toBe(false);
            expect(adapter.supportsFile('README.md')).toBe(false);
        });
    });

    describe('analyze', () => {
        it('should return null when disabled', async () => {
            const disabledAdapter = new DependencyCruiserAdapter(mockWorkspaceRoot, {
                enabled: false,
            });

            const result = await disabledAdapter.analyze();
            expect(result).toBeNull();
        });

        it('should return null when no source directories exist', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);

            const result = await adapter.analyze();
            expect(result).toBeNull();
        });
    });

    describe('getInstallInstructions', () => {
        it('should provide installation instructions', () => {
            const instructions = DependencyCruiserAdapter.getInstallInstructions();
            expect(instructions).toContain('npm install');
            expect(instructions).toContain('dependency-cruiser');
        });
    });
});

describe('shouldRecommendDependencyCruiser', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should return false for non-JS projects', () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);

        const result = shouldRecommendDependencyCruiser('/test/workspace');
        expect(result).toBe(false);
    });

    it('should return true for JS project with package.json', () => {
        vi.mocked(fs.existsSync).mockImplementation((path) => {
            return String(path).includes('package.json');
        });

        const result = shouldRecommendDependencyCruiser('/test/workspace');
        expect(result).toBe(true);
    });
});
