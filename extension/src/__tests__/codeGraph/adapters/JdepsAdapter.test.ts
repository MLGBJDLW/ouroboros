/**
 * JdepsAdapter Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JdepsAdapter, shouldRecommendJdeps } from '../../../codeGraph/adapters/JdepsAdapter';
import * as fs from 'fs';
import * as child_process from 'child_process';

vi.mock('fs');
vi.mock('child_process');

describe('JdepsAdapter', () => {
    const mockWorkspaceRoot = '/test/workspace';
    let adapter: JdepsAdapter;

    beforeEach(() => {
        vi.clearAllMocks();
        adapter = new JdepsAdapter(mockWorkspaceRoot);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should create adapter with default config', () => {
            expect(adapter).toBeDefined();
        });

        it('should merge custom config with defaults', () => {
            const customAdapter = new JdepsAdapter(mockWorkspaceRoot, {
                enabled: false,
                timeout: 30000,
                includeJdkInternals: true,
            });
            expect(customAdapter).toBeDefined();
        });
    });

    describe('checkAvailability', () => {
        it('should return false when no Java project detected', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);

            const available = await adapter.checkAvailability();
            expect(available).toBe(false);
        });

        it('should return true when pom.xml exists and jdeps is installed', async () => {
            vi.mocked(fs.existsSync).mockImplementation((path) => {
                return String(path).includes('pom.xml');
            });
            vi.mocked(child_process.execSync).mockReturnValue('jdeps 17.0.1');

            const available = await adapter.checkAvailability();
            expect(available).toBe(true);
        });

        it('should return true when build.gradle exists and jdeps is installed', async () => {
            vi.mocked(fs.existsSync).mockImplementation((path) => {
                return String(path).includes('build.gradle');
            });
            vi.mocked(child_process.execSync).mockReturnValue('jdeps 11.0.2');

            const available = await adapter.checkAvailability();
            expect(available).toBe(true);
        });

        it('should return false when jdeps is not installed', async () => {
            vi.mocked(fs.existsSync).mockImplementation((path) => {
                return String(path).includes('pom.xml');
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

            // Should be cached after first call
            expect(fs.existsSync).toHaveBeenCalled();
        });
    });

    describe('supportsFile', () => {
        it('should support Java files', () => {
            expect(adapter.supportsFile('Main.java')).toBe(true);
            expect(adapter.supportsFile('src/main/java/com/example/Service.java')).toBe(true);
        });

        it('should not support other file types', () => {
            expect(adapter.supportsFile('main.ts')).toBe(false);
            expect(adapter.supportsFile('main.kt')).toBe(false);
            expect(adapter.supportsFile('pom.xml')).toBe(false);
        });
    });

    describe('analyze', () => {
        it('should return null when disabled', async () => {
            const disabledAdapter = new JdepsAdapter(mockWorkspaceRoot, {
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

        it('should return null when no compiled classes found', async () => {
            vi.mocked(fs.existsSync).mockImplementation((path) => {
                // pom.xml exists but no target/classes
                return String(path).includes('pom.xml');
            });
            vi.mocked(child_process.execSync).mockReturnValue('jdeps 17.0.1');

            const result = await adapter.analyze();
            expect(result).toBeNull();
        });
    });

    describe('getInstallInstructions', () => {
        it('should return installation instructions', () => {
            const instructions = JdepsAdapter.getInstallInstructions();
            expect(instructions).toContain('JDK');
            expect(instructions).toContain('jdeps');
            expect(instructions).toContain('mvn compile');
        });
    });
});

describe('shouldRecommendJdeps', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return true when pom.xml exists', () => {
        vi.mocked(fs.existsSync).mockImplementation((path) => {
            return String(path).includes('pom.xml');
        });

        const result = shouldRecommendJdeps('/test/workspace');
        expect(result).toBe(true);
    });

    it('should return true when build.gradle exists', () => {
        vi.mocked(fs.existsSync).mockImplementation((path) => {
            return String(path).includes('build.gradle');
        });

        const result = shouldRecommendJdeps('/test/workspace');
        expect(result).toBe(true);
    });

    it('should return false when no Java build file exists', () => {
        vi.mocked(fs.existsSync).mockReturnValue(false);

        const result = shouldRecommendJdeps('/test/workspace');
        expect(result).toBe(false);
    });
});
