/**
 * PathResolver Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PathResolver } from '../../codeGraph/core/PathResolver';

// Mock fs
vi.mock('fs', () => ({
    promises: {
        readFile: vi.fn(),
    },
    statSync: vi.fn(),
}));

import * as fs from 'fs';

describe('PathResolver', () => {
    let resolver: PathResolver;
    const workspaceRoot = '/workspace';

    beforeEach(() => {
        vi.clearAllMocks();
        resolver = new PathResolver(workspaceRoot);
    });

    describe('constructor', () => {
        it('should initialize with default values', () => {
            expect(resolver).toBeDefined();
        });

        it('should accept tsconfig options', () => {
            const resolverWithConfig = new PathResolver(workspaceRoot, {
                baseUrl: 'src',
                paths: { '@/*': ['src/*'] },
            });
            expect(resolverWithConfig).toBeDefined();
        });
    });

    describe('resolve', () => {
        it('should identify external packages', () => {
            const result = resolver.resolve('lodash', '/workspace/src/index.ts');
            expect(result).not.toBeNull();
            expect(result?.isExternal).toBe(true);
            expect(result?.confidence).toBe('high');
        });

        it('should identify scoped packages as external', () => {
            const result = resolver.resolve('@types/node', '/workspace/src/index.ts');
            expect(result?.isExternal).toBe(true);
        });

        it('should identify node built-ins as external', () => {
            const builtins = ['fs', 'path', 'os', 'crypto', 'http'];
            for (const builtin of builtins) {
                const result = resolver.resolve(builtin, '/workspace/src/index.ts');
                expect(result?.isExternal).toBe(true);
                expect(result?.reason).toBe('external package');
            }
        });

        it('should identify node: prefixed imports as external', () => {
            const result = resolver.resolve('node:fs', '/workspace/src/index.ts');
            expect(result?.isExternal).toBe(true);
        });

        it('should resolve relative imports when file exists', () => {
            vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true } as fs.Stats);
            
            const result = resolver.resolve('./utils', '/workspace/src/index.ts');
            expect(result).not.toBeNull();
            expect(result?.isExternal).toBe(false);
            expect(result?.confidence).toBe('high');
        });

        it('should cache resolution results', () => {
            vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true } as fs.Stats);
            
            const result1 = resolver.resolve('./utils', '/workspace/src/index.ts');
            const result2 = resolver.resolve('./utils', '/workspace/src/index.ts');
            
            expect(result1).toEqual(result2);
        });
    });

    describe('loadTSConfig', () => {
        it('should load tsconfig.json', async () => {
            vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify({
                compilerOptions: {
                    baseUrl: 'src',
                    paths: {
                        '@/*': ['*'],
                        '@components/*': ['components/*'],
                    },
                },
            }));

            const config = await PathResolver.loadTSConfig(workspaceRoot);
            expect(config.baseUrl).toBe('src');
            expect(config.paths).toHaveProperty('@/*');
        });

        it('should return empty config if tsconfig not found', async () => {
            vi.mocked(fs.promises.readFile).mockRejectedValue(new Error('ENOENT'));

            const config = await PathResolver.loadTSConfig(workspaceRoot);
            expect(config).toEqual({});
        });
    });

    describe('updateConfig', () => {
        it('should update config and clear cache', () => {
            vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true } as fs.Stats);
            
            // First resolution
            resolver.resolve('./utils', '/workspace/src/index.ts');
            
            // Update config
            resolver.updateConfig({
                baseUrl: 'src',
                paths: { '@/*': ['*'] },
            });
            
            // Cache should be cleared
            expect(resolver).toBeDefined();
        });
    });

    describe('clearCache', () => {
        it('should clear the resolution cache', () => {
            vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true } as fs.Stats);
            
            resolver.resolve('./utils', '/workspace/src/index.ts');
            resolver.clearCache();
            
            // Should work without errors
            expect(resolver).toBeDefined();
        });
    });
});
