/**
 * Parallel Indexer
 * Batch processing for faster indexing of large codebases
 */

import { createLogger } from '../../utils/logger';
import type { BaseIndexer } from '../indexers/BaseIndexer';
import type { GraphNode, GraphEdge } from './types';

const logger = createLogger('ParallelIndexer');

export interface ParallelIndexerOptions {
    /** Batch size for parallel processing (default: 50) */
    batchSize?: number;
    /** Maximum concurrent batches (default: 4) */
    maxConcurrency?: number;
    /** Progress callback */
    onProgress?: (processed: number, total: number) => void;
}

export interface FileToIndex {
    path: string;
    content: string;
}

export interface ParallelIndexResult {
    nodes: GraphNode[];
    edges: GraphEdge[];
    errors: Array<{ file: string; error: string }>;
    stats: {
        totalFiles: number;
        successCount: number;
        errorCount: number;
        duration: number;
    };
}

export class ParallelIndexer {
    private batchSize: number;
    private maxConcurrency: number;
    private onProgress?: (processed: number, total: number) => void;

    constructor(options: ParallelIndexerOptions = {}) {
        this.batchSize = options.batchSize ?? 50;
        this.maxConcurrency = options.maxConcurrency ?? 4;
        this.onProgress = options.onProgress;
    }

    /**
     * Index multiple files in parallel batches
     */
    async indexAll(
        files: FileToIndex[],
        indexers: BaseIndexer[]
    ): Promise<ParallelIndexResult> {
        const startTime = Date.now();
        const allNodes: GraphNode[] = [];
        const allEdges: GraphEdge[] = [];
        const errors: Array<{ file: string; error: string }> = [];
        let processed = 0;

        // Split files into batches
        const batches = this.chunk(files, this.batchSize);
        logger.info(`Indexing ${files.length} files in ${batches.length} batches`);

        // Process batches with limited concurrency
        for (let i = 0; i < batches.length; i += this.maxConcurrency) {
            const concurrentBatches = batches.slice(i, i + this.maxConcurrency);
            
            const batchResults = await Promise.all(
                concurrentBatches.map(batch => this.processBatch(batch, indexers))
            );

            for (const result of batchResults) {
                allNodes.push(...result.nodes);
                allEdges.push(...result.edges);
                errors.push(...result.errors);
                processed += result.processedCount;
            }

            this.onProgress?.(processed, files.length);
        }

        const duration = Date.now() - startTime;
        logger.info(`Indexed ${files.length} files in ${duration}ms`);

        return {
            nodes: allNodes,
            edges: allEdges,
            errors,
            stats: {
                totalFiles: files.length,
                successCount: files.length - errors.length,
                errorCount: errors.length,
                duration,
            },
        };
    }

    /**
     * Process a single batch of files
     */
    private async processBatch(
        files: FileToIndex[],
        indexers: BaseIndexer[]
    ): Promise<{
        nodes: GraphNode[];
        edges: GraphEdge[];
        errors: Array<{ file: string; error: string }>;
        processedCount: number;
    }> {
        const nodes: GraphNode[] = [];
        const edges: GraphEdge[] = [];
        const errors: Array<{ file: string; error: string }> = [];

        await Promise.all(
            files.map(async file => {
                try {
                    const indexer = indexers.find(i => i.supports(file.path));
                    if (!indexer) return;

                    const result = await indexer.indexFile(file.path, file.content);
                    nodes.push(...result.nodes);
                    edges.push(...result.edges);
                } catch (error) {
                    errors.push({
                        file: file.path,
                        error: error instanceof Error ? error.message : String(error),
                    });
                }
            })
        );

        return { nodes, edges, errors, processedCount: files.length };
    }

    /**
     * Split array into chunks
     */
    private chunk<T>(array: T[], size: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }
}

/**
 * Create a parallel indexer with default options
 */
export function createParallelIndexer(options?: ParallelIndexerOptions): ParallelIndexer {
    return new ParallelIndexer(options);
}
