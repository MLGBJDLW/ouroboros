/**
 * Base Indexer
 * Abstract base class for language-specific indexers
 */

import type { IndexResult, GraphNode, GraphEdge, IndexError, Confidence } from '../core/types';

export interface IndexerOptions {
    workspaceRoot: string;
    include?: string[];
    exclude?: string[];
    maxFileSize?: number;
}

export abstract class BaseIndexer {
    protected workspaceRoot: string;
    protected include: string[];
    protected exclude: string[];
    protected maxFileSize: number;

    constructor(options: IndexerOptions) {
        this.workspaceRoot = options.workspaceRoot;
        this.include = options.include ?? ['**/*'];
        this.exclude = options.exclude ?? ['**/node_modules/**', '**/dist/**', '**/.git/**'];
        this.maxFileSize = options.maxFileSize ?? 1024 * 1024; // 1MB default
    }

    /**
     * Index a single file
     */
    abstract indexFile(filePath: string, content: string): Promise<IndexResult>;

    /**
     * Check if this indexer supports the given file
     */
    abstract supports(filePath: string): boolean;

    /**
     * Get supported file extensions
     */
    abstract get extensions(): string[];

    /**
     * Create a file node
     */
    protected createFileNode(filePath: string, name: string): GraphNode {
        return {
            id: `file:${filePath}`,
            kind: 'file',
            name,
            path: filePath,
        };
    }

    /**
     * Create a symbol node
     */
    protected createSymbolNode(
        filePath: string,
        name: string,
        line?: number
    ): GraphNode {
        const id = line ? `symbol:${filePath}:${name}:${line}` : `symbol:${filePath}:${name}`;
        return {
            id,
            kind: 'symbol',
            name,
            path: filePath,
            meta: line ? { loc: { line, column: 0 } } : undefined,
        };
    }

    /**
     * Create an import edge
     */
    protected createImportEdge(
        fromFile: string,
        toFile: string,
        confidence: Confidence,
        reason: string,
        isDynamic = false,
        line?: number
    ): GraphEdge {
        return {
            id: `edge:${fromFile}:imports:${toFile}`,
            from: `file:${fromFile}`,
            to: `file:${toFile}`,
            kind: 'imports',
            confidence,
            reason,
            meta: {
                isDynamic,
                loc: line ? { line, column: 0 } : undefined,
            },
        };
    }

    /**
     * Create an export edge
     */
    protected createExportEdge(
        filePath: string,
        symbolName: string,
        confidence: Confidence = 'high'
    ): GraphEdge {
        return {
            id: `edge:${filePath}:exports:${symbolName}`,
            from: `file:${filePath}`,
            to: `symbol:${filePath}:${symbolName}`,
            kind: 'exports',
            confidence,
            reason: 'static export',
        };
    }

    /**
     * Create an index error
     */
    protected createError(
        file: string,
        message: string,
        line?: number,
        recoverable = true
    ): IndexError {
        return { file, message, line, recoverable };
    }

    /**
     * Normalize import path to absolute path
     */
    protected normalizeImportPath(
        importPath: string,
        fromFile: string
    ): string | null {
        // Handle relative imports
        if (importPath.startsWith('.')) {
            const fromDir = fromFile.substring(0, fromFile.lastIndexOf('/'));
            return this.resolvePath(fromDir, importPath);
        }

        // Handle absolute imports (node_modules or aliases)
        // Return null for external packages
        if (!importPath.startsWith('/') && !importPath.startsWith('@/')) {
            return null; // External package
        }

        return importPath;
    }

    /**
     * Simple path resolution
     */
    private resolvePath(base: string, relative: string): string {
        const parts = base.split('/').filter(Boolean);
        const relativeParts = relative.split('/');

        for (const part of relativeParts) {
            if (part === '..') {
                parts.pop();
            } else if (part !== '.') {
                parts.push(part);
            }
        }

        return parts.join('/');
    }
}
