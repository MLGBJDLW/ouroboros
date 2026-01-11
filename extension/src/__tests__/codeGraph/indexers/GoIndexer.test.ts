/**
 * GoIndexer Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoIndexer } from '../../../codeGraph/indexers/GoIndexer';
import type { TreeSitterManager } from '../../../codeGraph/parsers/TreeSitterManager';

describe('GoIndexer', () => {
    let indexer: GoIndexer;
    let mockTsManager: Partial<TreeSitterManager>;

    beforeEach(() => {
        mockTsManager = {
            loadLanguage: vi.fn().mockRejectedValue(new Error('Not available')),
            parse: vi.fn(),
        };

        indexer = new GoIndexer({
            workspaceRoot: '/workspace',
            include: ['**/*.go'],
            exclude: [],
            maxFileSize: 1024 * 1024,
            treeSitterManager: mockTsManager as TreeSitterManager,
        });
    });

    describe('supports', () => {
        it('should support .go files', () => {
            expect(indexer.supports('main.go')).toBe(true);
            expect(indexer.supports('pkg/utils/helper.go')).toBe(true);
        });

        it('should not support other files', () => {
            expect(indexer.supports('test.py')).toBe(false);
            expect(indexer.supports('test.rs')).toBe(false);
        });
    });

    describe('indexFile (fallback parsing)', () => {
        it('should extract single import', async () => {
            const content = `
package main

import "fmt"

func main() {
    fmt.Println("Hello")
}
            `;

            const result = await indexer.indexFile('main.go', content);

            expect(result.edges.some(e => e.meta?.importPath === 'fmt')).toBe(true);
        });

        it('should extract grouped imports', async () => {
            const content = `
package main

import (
    "fmt"
    "os"
    "github.com/gin-gonic/gin"
)
            `;

            const result = await indexer.indexFile('main.go', content);

            expect(result.edges.length).toBeGreaterThanOrEqual(3);
            expect(result.edges.some(e => e.meta?.importPath === 'fmt')).toBe(true);
            expect(result.edges.some(e => e.meta?.importPath === 'os')).toBe(true);
        });

        it('should detect main entrypoint', async () => {
            const content = `
package main

func main() {
    // entry
}
            `;

            const result = await indexer.indexFile('main.go', content);

            expect(result.nodes.some(n => n.kind === 'entrypoint')).toBe(true);
            expect(result.nodes.some(n => n.meta?.entrypointType === 'main')).toBe(true);
        });

        it('should create file node', async () => {
            const content = 'package utils';
            const result = await indexer.indexFile('pkg/utils/helper.go', content);

            expect(result.nodes.some(n => n.id === 'file:pkg/utils/helper.go')).toBe(true);
            expect(result.nodes.some(n => n.meta?.language === 'go')).toBe(true);
        });
    });
});
