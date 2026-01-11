/**
 * GenericIndexer Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GenericIndexer } from '../../../codeGraph/indexers/GenericIndexer';

describe('GenericIndexer', () => {
    let indexer: GenericIndexer;

    beforeEach(() => {
        indexer = new GenericIndexer({
            workspaceRoot: '/workspace',
            include: ['**/*'],
            exclude: [],
            maxFileSize: 1024 * 1024,
        });
    });

    describe('supports', () => {
        it('should support code files', () => {
            expect(indexer.supports('test.rb')).toBe(true);
            expect(indexer.supports('test.php')).toBe(true);
            expect(indexer.supports('test.swift')).toBe(true);
            expect(indexer.supports('test.scala')).toBe(true);
        });

        it('should not support binary files', () => {
            expect(indexer.supports('image.png')).toBe(false);
            expect(indexer.supports('font.woff')).toBe(false);
            expect(indexer.supports('archive.zip')).toBe(false);
        });

        it('should not support lock files', () => {
            expect(indexer.supports('package-lock.json')).toBe(true); // JSON is ok
            expect(indexer.supports('Cargo.lock')).toBe(false);
            expect(indexer.supports('go.sum')).toBe(false);
        });
    });

    describe('indexFile', () => {
        it('should extract Ruby requires', async () => {
            const content = `
require 'json'
require_relative 'utils'
            `;

            const result = await indexer.indexFile('app.rb', content);

            expect(result.edges.some(e => e.meta?.importPath === 'json')).toBe(true);
            expect(result.edges.some(e => e.meta?.importPath === 'utils')).toBe(true);
        });

        it('should extract PHP use statements', async () => {
            const content = `
<?php
use App\\Models\\User;
require 'vendor/autoload.php';
            `;

            const result = await indexer.indexFile('index.php', content);

            expect(result.edges.length).toBeGreaterThanOrEqual(1);
        });

        it('should extract C includes', async () => {
            const content = `
#include <stdio.h>
#include "myheader.h"
            `;

            const result = await indexer.indexFile('main.c', content);

            expect(result.edges.some(e => e.meta?.importPath === 'stdio.h')).toBe(true);
            expect(result.edges.some(e => e.meta?.importPath === 'myheader.h')).toBe(true);
        });

        it('should extract C# using statements', async () => {
            const content = `
using System;
using System.Collections.Generic;
            `;

            const result = await indexer.indexFile('Program.cs', content);

            expect(result.edges.some(e => e.meta?.importPath === 'System')).toBe(true);
        });

        it('should detect main entrypoints', async () => {
            const content = `
int main(int argc, char *argv[]) {
    return 0;
}
            `;

            const result = await indexer.indexFile('main.c', content);

            expect(result.nodes.some(n => n.kind === 'entrypoint')).toBe(true);
        });

        it('should mark confidence as low', async () => {
            const content = 'import something';
            const result = await indexer.indexFile('test.unknown', content);

            expect(result.nodes.some(n => n.meta?.confidence === 'low')).toBe(true);
            expect(result.edges.every(e => e.confidence === 'low')).toBe(true);
        });

        it('should detect language from extension', async () => {
            const result = await indexer.indexFile('test.rb', '');
            expect(result.nodes.some(n => n.meta?.language === 'ruby')).toBe(true);

            const result2 = await indexer.indexFile('test.php', '');
            expect(result2.nodes.some(n => n.meta?.language === 'php')).toBe(true);
        });
    });
});
