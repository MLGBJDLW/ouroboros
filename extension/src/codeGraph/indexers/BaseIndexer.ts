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
     * Handles relative imports, tsconfig aliases, and filters external packages
     */
    protected normalizeImportPath(
        importPath: string,
        fromFile: string
    ): string | null {
        // Handle relative imports
        if (importPath.startsWith('.')) {
            const fromDir = fromFile.substring(0, fromFile.lastIndexOf('/'));
            const resolved = this.resolvePath(fromDir, importPath);
            // Add extension if missing (common in TS/JS imports)
            return this.addExtensionIfNeeded(resolved);
        }

        // Handle common path aliases that should be treated as internal
        // These are typically configured in tsconfig.json paths
        const aliasPatterns = [
            /^@\//, // @/components -> src/components
            /^@[a-z]/i, // @components, @utils (but not @org/package)
            /^~\//, // ~/utils
            /^src\//, // src/utils
            /^lib\//, // lib/utils
            /^app\//, // app/utils (Next.js app router)
            /^components\//, // components/Button
            /^utils\//, // utils/helpers
            /^hooks\//, // hooks/useAuth
            /^services\//, // services/api
            /^types\//, // types/index
            /^constants\//, // constants/config
            /^config\//, // config/settings
            /^styles\//, // styles/global
            /^assets\//, // assets/images
            /^pages\//, // pages/index (Next.js)
            /^api\//, // api/routes
        ];

        // Check if it matches any alias pattern
        for (const pattern of aliasPatterns) {
            if (pattern.test(importPath)) {
                // This looks like an internal alias, but we can't resolve it without tsconfig
                // Return the path as-is and let the graph handle it
                // The PathResolver in CodeGraphManager will handle proper resolution
                return this.addExtensionIfNeeded(importPath);
            }
        }

        // Check if it's clearly an external package
        // External packages: lodash, react, @org/package, node:fs
        if (this.isExternalPackage(importPath)) {
            return null;
        }

        // For anything else, assume it might be an internal path
        // This is a conservative approach - better to include than exclude
        return this.addExtensionIfNeeded(importPath);
    }

    /**
     * Check if import path is an external package
     */
    private isExternalPackage(importPath: string): boolean {
        // Node built-in modules
        if (importPath.startsWith('node:')) {
            return true;
        }

        // Common Node.js built-ins
        const builtins = new Set([
            'fs', 'path', 'os', 'util', 'events', 'stream', 'http', 'https',
            'crypto', 'buffer', 'url', 'querystring', 'child_process', 'cluster',
            'dgram', 'dns', 'net', 'readline', 'repl', 'tls', 'tty', 'v8', 'vm',
            'zlib', 'assert', 'async_hooks', 'console', 'constants', 'domain',
            'inspector', 'module', 'perf_hooks', 'process', 'punycode',
            'string_decoder', 'timers', 'trace_events', 'worker_threads',
        ]);
        
        const firstPart = importPath.split('/')[0];
        if (builtins.has(firstPart)) {
            return true;
        }

        // Scoped packages like @org/package (but not @/alias or @alias)
        if (importPath.startsWith('@') && importPath.includes('/')) {
            const scopePart = importPath.split('/')[0];
            // @org/package pattern (org is lowercase, typically npm scope)
            if (/^@[a-z0-9][\w.-]*$/i.test(scopePart) && scopePart !== '@') {
                // Check if it looks like a real npm scope vs an alias
                // Real scopes: @types, @babel, @testing-library
                // Aliases: @components, @utils (single word after @)
                const afterScope = importPath.split('/')[1];
                if (afterScope && !afterScope.includes('.')) {
                    // Likely a real scoped package
                    return true;
                }
            }
        }

        // Bare specifiers without path separators are likely external
        // e.g., 'lodash', 'react', 'express'
        if (!importPath.includes('/') && !importPath.startsWith('.') && !importPath.startsWith('@')) {
            return true;
        }

        return false;
    }

    /**
     * Add file extension if the path doesn't have one
     * This helps match imports like './utils' to 'utils.ts'
     */
    private addExtensionIfNeeded(filePath: string): string {
        // If already has an extension, return as-is
        const lastPart = filePath.split('/').pop() || '';
        if (lastPart.includes('.') && !lastPart.startsWith('.')) {
            return filePath;
        }
        // Return without extension - the graph will try to match with various extensions
        return filePath;
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
