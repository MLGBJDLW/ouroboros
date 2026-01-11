/**
 * Tree-Sitter Base Indexer
 * Base class for language indexers using tree-sitter
 */

import { BaseIndexer, type IndexerOptions } from './BaseIndexer';
import type { GraphNode, GraphEdge, IndexResult, Confidence } from '../core/types';
import { TreeSitterManager, type ParsedNode, type SupportedLanguage } from '../parsers/TreeSitterManager';
import { createLogger } from '../../utils/logger';

const logger = createLogger('TreeSitterIndexer');

export interface TreeSitterIndexerOptions extends IndexerOptions {
    treeSitterManager: TreeSitterManager;
}

export abstract class TreeSitterIndexer extends BaseIndexer {
    protected tsManager: TreeSitterManager;
    protected initialized = false;
    protected treeSitterAvailable = true; // Track if tree-sitter works
    private static loggedLanguages = new Set<string>(); // Only log once per language
    
    abstract readonly language: SupportedLanguage;
    abstract readonly supportedExtensions: string[];

    constructor(options: TreeSitterIndexerOptions) {
        super(options);
        this.tsManager = options.treeSitterManager;
    }

    get extensions(): string[] {
        return this.supportedExtensions;
    }

    supports(filePath: string): boolean {
        return this.supportedExtensions.some(ext => filePath.endsWith(ext));
    }

    async indexFile(filePath: string, content: string): Promise<IndexResult> {
        // If tree-sitter already failed for this language, use fallback directly
        if (!this.treeSitterAvailable) {
            return this.fallbackParse(filePath, content);
        }

        // Initialize tree-sitter if needed
        if (!this.initialized) {
            try {
                await this.tsManager.loadLanguage(this.language);
                this.initialized = true;
            } catch {
                this.treeSitterAvailable = false;
                if (!TreeSitterIndexer.loggedLanguages.has(this.language)) {
                    logger.warn(`Tree-sitter not available for ${this.language}, using fallback`);
                    TreeSitterIndexer.loggedLanguages.add(this.language);
                }
                return this.fallbackParse(filePath, content);
            }
        }

        try {
            const tree = await this.tsManager.parse(content, this.language);
            return this.parseTree(tree.rootNode, filePath, content);
        } catch (error) {
            logger.error(`Error parsing ${filePath}:`, error);
            return this.fallbackParse(filePath, content);
        }
    }

    /**
     * Parse the AST tree - implemented by subclasses
     */
    protected abstract parseTree(
        rootNode: ParsedNode,
        filePath: string,
        content: string
    ): IndexResult;

    /**
     * Fallback parsing when tree-sitter is unavailable
     */
    protected abstract fallbackParse(filePath: string, content: string): IndexResult;

    // ============================================
    // Helper Methods
    // ============================================

    /**
     * Walk the AST tree
     */
    protected walkTree(node: ParsedNode, callback: (node: ParsedNode) => void): void {
        callback(node);
        for (const child of node.children) {
            this.walkTree(child, callback);
        }
    }

    /**
     * Find child node by type
     */
    protected findChild(node: ParsedNode, type: string): ParsedNode | null {
        for (const child of node.children) {
            if (child.type === type) {
                return child;
            }
        }
        return null;
    }

    /**
     * Find all children by type
     */
    protected findChildren(node: ParsedNode, type: string): ParsedNode[] {
        return node.children.filter(child => child.type === type);
    }

    /**
     * Find descendant by type (recursive)
     */
    protected findDescendant(node: ParsedNode, type: string): ParsedNode | null {
        if (node.type === type) return node;
        for (const child of node.children) {
            const found = this.findDescendant(child, type);
            if (found) return found;
        }
        return null;
    }

    /**
     * Find all descendants by type
     */
    protected findAllDescendants(node: ParsedNode, type: string): ParsedNode[] {
        const results: ParsedNode[] = [];
        this.walkTree(node, (n) => {
            if (n.type === type) {
                results.push(n);
            }
        });
        return results;
    }

    /**
     * Create import edge with optional path resolution
     * Override base class to use language-specific resolution
     */
    protected override createImportEdge(
        fromFile: string,
        toModule: string,
        confidence: Confidence,
        reason: string,
        isDynamic = false,
        line?: number
    ): GraphEdge {
        // Try to resolve to a local file path
        const resolvedPath = this.resolveImportPath(toModule, fromFile);
        
        if (resolvedPath) {
            // Resolved to a local file - use file: prefix
            return {
                id: `edge:${fromFile}:imports:${resolvedPath}`,
                from: `file:${fromFile}`,
                to: `file:${resolvedPath}`,
                kind: 'imports',
                confidence,
                reason: reason || `${this.language} import`,
                meta: {
                    importPath: toModule,
                    isDynamic,
                    loc: line ? { line, column: 0 } : undefined,
                    language: this.language,
                },
            };
        }
        
        // External package - use module: prefix
        return {
            id: `edge:${fromFile}:${toModule}:${line || 0}`,
            from: `file:${fromFile}`,
            to: `module:${toModule}`,
            kind: 'imports',
            confidence: 'low', // Lower confidence for unresolved
            reason: 'external package',
            meta: {
                importPath: toModule,
                isDynamic,
                loc: line ? { line, column: 0 } : undefined,
                language: this.language,
                isExternal: true,
            },
        };
    }

    /**
     * Helper to create import edge with simpler signature for tree-sitter indexers
     */
    protected createTsImportEdge(
        fromFile: string,
        toModule: string,
        line: number,
        confidence: Confidence
    ): GraphEdge {
        return this.createImportEdge(fromFile, toModule, confidence, `${this.language} import`, false, line);
    }

    /**
     * Resolve import path to local file path
     * Override in subclasses for language-specific resolution
     */
    protected resolveImportPath(importPath: string, fromFile: string): string | null {
        // Default implementation - subclasses can override
        // Handle relative imports starting with .
        if (importPath.startsWith('.')) {
            const fromDir = fromFile.substring(0, fromFile.lastIndexOf('/'));
            return this.resolveRelativePath(fromDir, importPath);
        }
        return null;
    }

    /**
     * Simple path resolution for relative imports
     */
    protected resolveRelativePath(base: string, relative: string): string {
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

    /**
     * Create file node with exports
     */
    protected createTsFileNode(filePath: string, exports: string[] = []): GraphNode {
        return {
            id: `file:${filePath}`,
            kind: 'file',
            name: this.getFileName(filePath),
            path: filePath,
            meta: {
                language: this.language,
                exports,
            },
        };
    }

    /**
     * Create entrypoint node
     */
    protected createEntrypointNode(
        filePath: string,
        type: 'main' | 'api' | 'command',
        framework?: string
    ): GraphNode {
        const typeLabels = { main: 'Main', api: 'API', command: 'CLI' };
        return {
            id: `entrypoint:${type}:${filePath}`,
            kind: 'entrypoint',
            name: `${typeLabels[type]}: ${this.getFileName(filePath)}`,
            path: filePath,
            meta: {
                entrypointType: type,
                framework,
                language: this.language,
            },
        };
    }

    /**
     * Get file name from path
     */
    protected getFileName(filePath: string): string {
        return filePath.split('/').pop() ?? filePath;
    }
}
