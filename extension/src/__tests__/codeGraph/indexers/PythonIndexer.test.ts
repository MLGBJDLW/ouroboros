/**
 * PythonIndexer Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PythonIndexer } from '../../../codeGraph/indexers/PythonIndexer';
import type { TreeSitterManager } from '../../../codeGraph/parsers/TreeSitterManager';

describe('PythonIndexer', () => {
    let indexer: PythonIndexer;
    let mockTsManager: Partial<TreeSitterManager>;

    beforeEach(() => {
        // Mock tree-sitter manager to use fallback parsing
        mockTsManager = {
            loadLanguage: vi.fn().mockRejectedValue(new Error('Not available')),
            parse: vi.fn(),
        };

        indexer = new PythonIndexer({
            workspaceRoot: '/workspace',
            include: ['**/*.py'],
            exclude: [],
            maxFileSize: 1024 * 1024,
            treeSitterManager: mockTsManager as TreeSitterManager,
        });
    });

    describe('supports', () => {
        it('should support .py files', () => {
            expect(indexer.supports('test.py')).toBe(true);
            expect(indexer.supports('src/main.py')).toBe(true);
        });

        it('should support .pyi files', () => {
            expect(indexer.supports('types.pyi')).toBe(true);
        });

        it('should not support other files', () => {
            expect(indexer.supports('test.js')).toBe(false);
            expect(indexer.supports('test.ts')).toBe(false);
        });
    });

    describe('indexFile (fallback parsing)', () => {
        it('should extract import statements', async () => {
            const content = `
import os
import sys
from pathlib import Path
from .utils import helper
from ..models import User
from myapp.services import UserService
            `;

            const result = await indexer.indexFile('src/test.py', content);

            // Should have edges for relative imports and local packages (stdlib is filtered)
            // Relative imports: .utils, ..models
            // Local packages: myapp.services (has dot, not in stdlib/common)
            expect(result.edges.length).toBeGreaterThanOrEqual(1);
            // Local package import should be tracked
            expect(result.edges.some(e => e.meta?.importPath === 'myapp.services')).toBe(true);
        });

        it('should create file node', async () => {
            const content = 'import os';
            const result = await indexer.indexFile('src/main.py', content);

            expect(result.nodes.some(n => n.id === 'file:src/main.py')).toBe(true);
            expect(result.nodes.some(n => n.meta?.language === 'python')).toBe(true);
        });

        it('should detect main entrypoint', async () => {
            const content = `
def main():
    pass

if __name__ == "__main__":
    main()
            `;

            const result = await indexer.indexFile('main.py', content);

            expect(result.nodes.some(n => n.kind === 'entrypoint')).toBe(true);
            expect(result.nodes.some(n => n.meta?.entrypointType === 'main')).toBe(true);
        });

        it('should handle empty files', async () => {
            const result = await indexer.indexFile('empty.py', '');

            expect(result.nodes).toHaveLength(1);
            expect(result.edges).toHaveLength(0);
        });

        it('should handle files with only comments', async () => {
            const content = `
# This is a comment
# Another comment
"""
Docstring
"""
            `;

            const result = await indexer.indexFile('comments.py', content);

            expect(result.nodes).toHaveLength(1);
            expect(result.edges).toHaveLength(0);
        });
    });
});
