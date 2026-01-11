/**
 * ParallelIndexer Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ParallelIndexer, createParallelIndexer } from '../../../codeGraph/core/ParallelIndexer';
import type { BaseIndexer } from '../../../codeGraph/indexers/BaseIndexer';

describe('ParallelIndexer', () => {
    let indexer: ParallelIndexer;
    let mockIndexer: BaseIndexer;

    beforeEach(() => {
        indexer = new ParallelIndexer({ batchSize: 2, maxConcurrency: 2 });
        
        mockIndexer = {
            supports: vi.fn().mockReturnValue(true),
            indexFile: vi.fn().mockResolvedValue({
                nodes: [{ id: 'file:test.ts', kind: 'file', name: 'test.ts' }],
                edges: [],
            }),
        } as unknown as BaseIndexer;
    });

    describe('indexAll', () => {
        it('should index all files', async () => {
            const files = [
                { path: 'a.ts', content: 'const a = 1;' },
                { path: 'b.ts', content: 'const b = 2;' },
            ];

            const result = await indexer.indexAll(files, [mockIndexer]);

            expect(result.stats.totalFiles).toBe(2);
            expect(result.stats.successCount).toBe(2);
            expect(result.stats.errorCount).toBe(0);
            expect(result.nodes.length).toBe(2);
        });

        it('should handle empty file list', async () => {
            const result = await indexer.indexAll([], [mockIndexer]);

            expect(result.stats.totalFiles).toBe(0);
            expect(result.nodes).toHaveLength(0);
            expect(result.edges).toHaveLength(0);
        });

        it('should handle indexer errors gracefully', async () => {
            const errorIndexer = {
                supports: vi.fn().mockReturnValue(true),
                indexFile: vi.fn().mockRejectedValue(new Error('Parse error')),
            } as unknown as BaseIndexer;

            const files = [
                { path: 'a.ts', content: 'invalid' },
            ];

            const result = await indexer.indexAll(files, [errorIndexer]);

            expect(result.stats.errorCount).toBe(1);
            expect(result.errors[0].file).toBe('a.ts');
            expect(result.errors[0].error).toBe('Parse error');
        });

        it('should skip files without matching indexer', async () => {
            const selectiveIndexer = {
                supports: vi.fn().mockImplementation((path: string) => path.endsWith('.ts')),
                indexFile: vi.fn().mockResolvedValue({ nodes: [], edges: [] }),
            } as unknown as BaseIndexer;

            const files = [
                { path: 'a.ts', content: 'ts' },
                { path: 'b.py', content: 'py' },
            ];

            const result = await indexer.indexAll(files, [selectiveIndexer]);

            expect(selectiveIndexer.indexFile).toHaveBeenCalledTimes(1);
        });

        it('should process files in batches', async () => {
            const batchIndexer = new ParallelIndexer({ batchSize: 2, maxConcurrency: 1 });
            const callOrder: number[] = [];
            
            const trackingIndexer = {
                supports: vi.fn().mockReturnValue(true),
                indexFile: vi.fn().mockImplementation(async (path: string) => {
                    const num = parseInt(path.replace('.ts', ''));
                    callOrder.push(num);
                    return { nodes: [], edges: [] };
                }),
            } as unknown as BaseIndexer;

            const files = [
                { path: '1.ts', content: '' },
                { path: '2.ts', content: '' },
                { path: '3.ts', content: '' },
                { path: '4.ts', content: '' },
            ];

            await batchIndexer.indexAll(files, [trackingIndexer]);

            expect(trackingIndexer.indexFile).toHaveBeenCalledTimes(4);
        });

        it('should call progress callback', async () => {
            const onProgress = vi.fn();
            const progressIndexer = new ParallelIndexer({ 
                batchSize: 2, 
                maxConcurrency: 1,
                onProgress,
            });

            const files = [
                { path: 'a.ts', content: '' },
                { path: 'b.ts', content: '' },
                { path: 'c.ts', content: '' },
            ];

            await progressIndexer.indexAll(files, [mockIndexer]);

            expect(onProgress).toHaveBeenCalled();
        });

        it('should report duration in stats', async () => {
            const files = [{ path: 'a.ts', content: '' }];

            const result = await indexer.indexAll(files, [mockIndexer]);

            expect(result.stats.duration).toBeGreaterThanOrEqual(0);
        });

        it('should collect nodes and edges from all files', async () => {
            const richIndexer = {
                supports: vi.fn().mockReturnValue(true),
                indexFile: vi.fn().mockImplementation((path: string) => ({
                    nodes: [{ id: `file:${path}`, kind: 'file', name: path }],
                    edges: [{ id: `edge:${path}`, from: `file:${path}`, to: 'file:other', kind: 'imports', confidence: 'high' }],
                })),
            } as unknown as BaseIndexer;

            const files = [
                { path: 'a.ts', content: '' },
                { path: 'b.ts', content: '' },
            ];

            const result = await indexer.indexAll(files, [richIndexer]);

            expect(result.nodes.length).toBe(2);
            expect(result.edges.length).toBe(2);
        });
    });
});

describe('createParallelIndexer', () => {
    it('should create indexer with default options', () => {
        const indexer = createParallelIndexer();
        expect(indexer).toBeInstanceOf(ParallelIndexer);
    });

    it('should create indexer with custom options', () => {
        const indexer = createParallelIndexer({ batchSize: 100 });
        expect(indexer).toBeInstanceOf(ParallelIndexer);
    });
});
