/**
 * Tests for ExtensionMapper
 * Verifies ESM-style extension mapping (.js → .ts) works correctly
 */

import { describe, it, expect } from 'vitest';
import {
    normalizeExtension,
    getPossibleSourcePaths,
    getPossibleNodeIds,
    isSameFile,
    createCanonicalNodeId,
    ExtensionMapper,
    EXTENSION_MAPPINGS,
    SOURCE_EXTENSIONS,
    INDEX_FILES,
} from '../../../codeGraph/core/ExtensionMapper';

describe('ExtensionMapper', () => {
    describe('normalizeExtension', () => {
        it('should remove .js extension', () => {
            expect(normalizeExtension('./utils/helper.js')).toBe('./utils/helper');
        });

        it('should remove .jsx extension', () => {
            expect(normalizeExtension('./components/Button.jsx')).toBe('./components/Button');
        });

        it('should remove .mjs extension', () => {
            expect(normalizeExtension('./lib/module.mjs')).toBe('./lib/module');
        });

        it('should remove .cjs extension', () => {
            expect(normalizeExtension('./config/settings.cjs')).toBe('./config/settings');
        });

        it('should keep .ts extension unchanged', () => {
            expect(normalizeExtension('./utils/helper.ts')).toBe('./utils/helper.ts');
        });

        it('should keep .tsx extension unchanged', () => {
            expect(normalizeExtension('./components/Button.tsx')).toBe('./components/Button.tsx');
        });

        it('should handle paths without extension', () => {
            expect(normalizeExtension('./utils/helper')).toBe('./utils/helper');
        });

        it('should handle dotfiles correctly', () => {
            expect(normalizeExtension('./.eslintrc')).toBe('./.eslintrc');
        });
    });

    describe('getPossibleSourcePaths', () => {
        it('should return TypeScript alternatives for .js import', () => {
            const paths = getPossibleSourcePaths('./utils/helper.js');
            expect(paths).toContain('./utils/helper.ts');
            expect(paths).toContain('./utils/helper.tsx');
            expect(paths).toContain('./utils/helper.mts');
            expect(paths).toContain('./utils/helper.js'); // Original also included
        });

        it('should return TypeScript alternatives for .jsx import', () => {
            const paths = getPossibleSourcePaths('./components/Button.jsx');
            expect(paths).toContain('./components/Button.tsx');
            expect(paths).toContain('./components/Button.ts');
            expect(paths).toContain('./components/Button.jsx');
        });

        it('should try all source extensions for extensionless import', () => {
            const paths = getPossibleSourcePaths('./utils/helper');
            for (const ext of SOURCE_EXTENSIONS) {
                expect(paths).toContain(`./utils/helper${ext}`);
            }
        });

        it('should try index files for directory-like imports', () => {
            const paths = getPossibleSourcePaths('./utils');
            for (const indexFile of INDEX_FILES) {
                expect(paths).toContain(`./utils/${indexFile}`);
            }
        });

        it('should include original path', () => {
            const paths = getPossibleSourcePaths('./utils/helper.js');
            expect(paths).toContain('./utils/helper.js');
        });
    });

    describe('getPossibleNodeIds', () => {
        it('should return node IDs with file: prefix', () => {
            const ids = getPossibleNodeIds('./utils/helper.js');
            expect(ids).toContain('file:./utils/helper.ts');
            expect(ids).toContain('file:./utils/helper.js');
        });
    });

    describe('createCanonicalNodeId', () => {
        it('should create normalized node ID for .js path', () => {
            expect(createCanonicalNodeId('./utils/helper.js')).toBe('file:./utils/helper');
        });

        it('should keep .ts path as-is', () => {
            expect(createCanonicalNodeId('./utils/helper.ts')).toBe('file:./utils/helper.ts');
        });
    });

    describe('isSameFile', () => {
        it('should return true for identical paths', () => {
            expect(isSameFile('./utils/helper.ts', './utils/helper.ts')).toBe(true);
        });

        it('should return true for .js and .ts versions of same file', () => {
            expect(isSameFile('./utils/helper.js', './utils/helper.ts')).toBe(true);
        });

        it('should return true for .jsx and .tsx versions', () => {
            expect(isSameFile('./components/Button.jsx', './components/Button.tsx')).toBe(true);
        });

        it('should return false for different files', () => {
            expect(isSameFile('./utils/helper.ts', './utils/other.ts')).toBe(false);
        });

        it('should handle extensionless paths', () => {
            expect(isSameFile('./utils/helper', './utils/helper.ts')).toBe(true);
        });
    });

    describe('ExtensionMapper class', () => {
        it('should normalize paths when ESM mapping is enabled', () => {
            const mapper = new ExtensionMapper({ enableEsmMapping: true });
            expect(mapper.normalize('./utils/helper.js')).toBe('./utils/helper');
        });

        it('should not normalize paths when ESM mapping is disabled', () => {
            const mapper = new ExtensionMapper({ enableEsmMapping: false });
            expect(mapper.normalize('./utils/helper.js')).toBe('./utils/helper.js');
        });

        it('should detect compiled extensions', () => {
            const mapper = new ExtensionMapper();
            expect(mapper.hasCompiledExtension('./utils/helper.js')).toBe(true);
            expect(mapper.hasCompiledExtension('./utils/helper.ts')).toBe(false);
        });

        it('should get source extensions for compiled extension', () => {
            const mapper = new ExtensionMapper();
            const sourceExts = mapper.getSourceExtensions('.js');
            expect(sourceExts).toContain('.ts');
            expect(sourceExts).toContain('.tsx');
        });

        it('should support custom mappings', () => {
            const mapper = new ExtensionMapper({
                customMappings: [['.custom', ['.source']]],
            });
            expect(mapper.hasCompiledExtension('./file.custom')).toBe(true);
            expect(mapper.getSourceExtensions('.custom')).toContain('.source');
        });
    });

    describe('constants', () => {
        it('should have correct extension mappings', () => {
            const mappingsMap = new Map(EXTENSION_MAPPINGS);
            expect(mappingsMap.get('.js')).toContain('.ts');
            expect(mappingsMap.get('.jsx')).toContain('.tsx');
            expect(mappingsMap.get('.mjs')).toContain('.mts');
            expect(mappingsMap.get('.cjs')).toContain('.cts');
        });

        it('should have TypeScript extensions first in SOURCE_EXTENSIONS', () => {
            expect(SOURCE_EXTENSIONS[0]).toBe('.ts');
            expect(SOURCE_EXTENSIONS[1]).toBe('.tsx');
        });

        it('should have TypeScript index files first in INDEX_FILES', () => {
            expect(INDEX_FILES[0]).toBe('index.ts');
            expect(INDEX_FILES[1]).toBe('index.tsx');
        });
    });
});
