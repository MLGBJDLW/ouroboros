/**
 * RustIndexer Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RustIndexer } from '../../../codeGraph/indexers/RustIndexer';
import type { TreeSitterManager } from '../../../codeGraph/parsers/TreeSitterManager';

describe('RustIndexer', () => {
    let indexer: RustIndexer;
    let mockTsManager: Partial<TreeSitterManager>;

    beforeEach(() => {
        mockTsManager = {
            loadLanguage: vi.fn().mockRejectedValue(new Error('Not available')),
            parse: vi.fn(),
        };

        indexer = new RustIndexer({
            workspaceRoot: '/workspace',
            include: ['**/*.rs'],
            exclude: [],
            maxFileSize: 1024 * 1024,
            treeSitterManager: mockTsManager as TreeSitterManager,
        });
    });

    describe('supports', () => {
        it('should support .rs files', () => {
            expect(indexer.supports('main.rs')).toBe(true);
            expect(indexer.supports('src/lib.rs')).toBe(true);
        });

        it('should not support other files', () => {
            expect(indexer.supports('test.py')).toBe(false);
            expect(indexer.supports('test.go')).toBe(false);
        });
    });

    describe('indexFile (fallback parsing)', () => {
        it('should extract use statements', async () => {
            const content = `
use std::collections::HashMap;
use crate::models::User;
use super::utils;

mod config;
            `;

            const result = await indexer.indexFile('main.rs', content);

            expect(result.edges.length).toBeGreaterThanOrEqual(4);
            expect(result.edges.some(e => e.meta?.importPath?.includes('std::collections'))).toBe(true);
            expect(result.edges.some(e => e.meta?.importPath?.includes('crate::models'))).toBe(true);
        });

        it('should extract mod declarations', async () => {
            const content = `
mod config;
mod utils;
            `;

            const result = await indexer.indexFile('lib.rs', content);

            expect(result.edges.some(e => e.meta?.importPath === 'config')).toBe(true);
            expect(result.edges.some(e => e.meta?.importPath === 'utils')).toBe(true);
        });

        it('should detect main entrypoint', async () => {
            const content = `
fn main() {
    println!("Hello, world!");
}
            `;

            const result = await indexer.indexFile('main.rs', content);

            expect(result.nodes.some(n => n.kind === 'entrypoint')).toBe(true);
            expect(result.nodes.some(n => n.meta?.entrypointType === 'main')).toBe(true);
        });

        it('should create file node', async () => {
            const content = 'use std::io;';
            const result = await indexer.indexFile('src/lib.rs', content);

            expect(result.nodes.some(n => n.id === 'file:src/lib.rs')).toBe(true);
            expect(result.nodes.some(n => n.meta?.language === 'rust')).toBe(true);
        });
    });
});
