/**
 * Python Indexer
 * Parses Python files using tree-sitter for imports, exports, and entrypoints
 */

import { BaseIndexer, type IndexerOptions } from './BaseIndexer';
import type { GraphNode, GraphEdge, IndexResult, Confidence } from '../core/types';
import { TreeSitterManager, type ParsedNode } from '../parsers/TreeSitterManager';
import { createLogger } from '../../utils/logger';

const logger = createLogger('PythonIndexer');

export interface PythonIndexerOptions extends IndexerOptions {
    treeSitterManager: TreeSitterManager;
}

export class PythonIndexer extends BaseIndexer {
    readonly supportedExtensions = ['.py', '.pyi'];
    private tsManager: TreeSitterManager;
    private initialized = false;
    private treeSitterAvailable = true; // Track if tree-sitter works
    private loggedFallback = false; // Only log once

    constructor(options: PythonIndexerOptions) {
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
        const nodes: GraphNode[] = [];
        const edges: GraphEdge[] = [];

        // If tree-sitter already failed, use fallback directly
        if (!this.treeSitterAvailable) {
            return this.fallbackParse(filePath, content);
        }

        // Initialize tree-sitter if needed
        if (!this.initialized) {
            try {
                await this.tsManager.loadLanguage('python');
                this.initialized = true;
            } catch {
                this.treeSitterAvailable = false;
                if (!this.loggedFallback) {
                    logger.warn('Tree-sitter not available for Python, using fallback parsing');
                    this.loggedFallback = true;
                }
                return this.fallbackParse(filePath, content);
            }
        }

        try {
            const tree = await this.tsManager.parse(content, 'python');
            const rootNode = tree.rootNode;

            // Add file node
            const fileNode: GraphNode = {
                id: `file:${filePath}`,
                kind: 'file',
                name: this.getFileName(filePath),
                path: filePath,
                meta: {
                    language: 'python',
                    exports: [],
                },
            };

            // Extract imports
            const imports = this.extractImports(rootNode, filePath);
            edges.push(...imports);

            // Extract exports
            const exports = this.extractExports(rootNode, content);
            if (fileNode.meta) {
                fileNode.meta.exports = exports;
            }
            nodes.push(fileNode);

            // Detect entrypoints
            const entrypoint = this.detectEntrypoint(rootNode, content, filePath);
            if (entrypoint) {
                nodes.push(entrypoint);
            }

            return { nodes, edges };
        } catch (error) {
            logger.error(`Error parsing ${filePath}:`, error);
            return this.fallbackParse(filePath, content);
        }
    }

    /**
     * Extract import statements using tree-sitter AST
     */
    private extractImports(rootNode: ParsedNode, fromFile: string): GraphEdge[] {
        const edges: GraphEdge[] = [];

        // Find all import statements
        this.walkTree(rootNode, (node) => {
            // import_statement: import module
            if (node.type === 'import_statement') {
                const nameNode = this.findChild(node, 'dotted_name');
                if (nameNode) {
                    edges.push(this.createPythonImportEdge(
                        fromFile,
                        nameNode.text,
                        nameNode.startPosition.row + 1,
                        'high'
                    ));
                }
            }

            // import_from_statement: from module import ...
            if (node.type === 'import_from_statement') {
                const moduleNode = this.findChild(node, 'dotted_name') || 
                                   this.findChild(node, 'relative_import');
                if (moduleNode) {
                    const modulePath = moduleNode.text;
                    const confidence: Confidence = modulePath.startsWith('.') ? 'high' : 'medium';
                    edges.push(this.createPythonImportEdge(
                        fromFile,
                        modulePath,
                        moduleNode.startPosition.row + 1,
                        confidence
                    ));
                }
            }
        });

        return edges;
    }

    /**
     * Extract exports using tree-sitter AST
     */
    private extractExports(rootNode: ParsedNode, _content: string): string[] {
        const exports: string[] = [];

        // Check for __all__ first
        this.walkTree(rootNode, (node) => {
            if (node.type === 'assignment') {
                const leftNode = node.namedChildren[0];
                if (leftNode?.text === '__all__') {
                    const listNode = this.findChild(node, 'list');
                    if (listNode) {
                        for (const child of listNode.namedChildren) {
                            if (child.type === 'string') {
                                // Remove quotes
                                const name = child.text.replace(/^['"]|['"]$/g, '');
                                exports.push(name);
                            }
                        }
                    }
                }
            }
        });

        // If __all__ found, use it
        if (exports.length > 0) {
            return exports;
        }

        // Otherwise, collect public functions and classes
        this.walkTree(rootNode, (node) => {
            // Function definitions at module level
            if (node.type === 'function_definition') {
                const nameNode = this.findChild(node, 'identifier');
                if (nameNode && !nameNode.text.startsWith('_')) {
                    exports.push(nameNode.text);
                }
            }

            // Class definitions at module level
            if (node.type === 'class_definition') {
                const nameNode = this.findChild(node, 'identifier');
                if (nameNode && !nameNode.text.startsWith('_')) {
                    exports.push(nameNode.text);
                }
            }
        });

        return exports;
    }

    /**
     * Detect if file is an entrypoint
     */
    private detectEntrypoint(rootNode: ParsedNode, _content: string, filePath: string): GraphNode | null {
        let hasMainBlock = false;
        let framework: string | null = null;

        this.walkTree(rootNode, (node) => {
            // if __name__ == "__main__":
            if (node.type === 'if_statement') {
                const condition = node.namedChildren[0];
                if (condition?.text.includes('__name__') && condition?.text.includes('__main__')) {
                    hasMainBlock = true;
                }
            }

            // Decorator-based entrypoints
            if (node.type === 'decorated_definition') {
                const decorator = this.findChild(node, 'decorator');
                if (decorator) {
                    const decoratorText = decorator.text;
                    
                    // Click CLI
                    if (decoratorText.includes('@click.command') || decoratorText.includes('@click.group')) {
                        framework = 'click';
                    }
                    // Typer CLI
                    if (decoratorText.includes('@app.command')) {
                        framework = 'typer';
                    }
                    // FastAPI routes
                    if (decoratorText.match(/@(app|router)\.(get|post|put|delete|patch)/)) {
                        framework = 'fastapi';
                    }
                    // Flask routes
                    if (decoratorText.includes('@app.route') || decoratorText.includes('@blueprint.route')) {
                        framework = 'flask';
                    }
                }
            }
        });

        if (hasMainBlock) {
            return {
                id: `entrypoint:main:${filePath}`,
                kind: 'entrypoint',
                name: `Main: ${this.getFileName(filePath)}`,
                path: filePath,
                meta: {
                    entrypointType: 'main',
                    language: 'python',
                },
            };
        }

        if (framework) {
            const type = ['click', 'typer'].includes(framework) ? 'command' : 'api';
            return {
                id: `entrypoint:${type}:${filePath}`,
                kind: 'entrypoint',
                name: `${type === 'command' ? 'CLI' : 'API'}: ${this.getFileName(filePath)}`,
                path: filePath,
                meta: {
                    entrypointType: type,
                    framework,
                    language: 'python',
                },
            };
        }

        return null;
    }

    /**
     * Walk the AST tree
     */
    private walkTree(node: ParsedNode, callback: (node: ParsedNode) => void): void {
        callback(node);
        for (const child of node.children) {
            this.walkTree(child, callback);
        }
    }

    /**
     * Find child node by type
     */
    private findChild(node: ParsedNode, type: string): ParsedNode | null {
        for (const child of node.children) {
            if (child.type === type) {
                return child;
            }
        }
        return null;
    }

    /**
     * Create import edge with path resolution for relative imports
     */
    private createPythonImportEdge(
        fromFile: string,
        toModule: string,
        line: number,
        confidence: Confidence
    ): GraphEdge {
        // Try to resolve relative imports to file paths
        const resolvedPath = this.resolvePythonImport(toModule, fromFile);
        
        if (resolvedPath) {
            // Resolved to a local file - use file: prefix
            return {
                id: `edge:${fromFile}:imports:${resolvedPath}`,
                from: `file:${fromFile}`,
                to: `file:${resolvedPath}`,
                kind: 'imports',
                confidence,
                reason: 'python import',
                meta: {
                    importPath: toModule,
                    loc: { line, column: 0 },
                    language: 'python',
                },
            };
        }
        
        // External package or unresolvable - use module: prefix
        return {
            id: `edge:${fromFile}:${toModule}:${line}`,
            from: `file:${fromFile}`,
            to: `module:${toModule}`,
            kind: 'imports',
            confidence: 'low', // Lower confidence for unresolved
            reason: 'external package',
            meta: {
                importPath: toModule,
                loc: { line, column: 0 },
                language: 'python',
                isExternal: true,
            },
        };
    }

    /**
     * Resolve Python import to file path
     * Returns null for external packages
     */
    private resolvePythonImport(modulePath: string, fromFile: string): string | null {
        // Handle relative imports (starting with .)
        if (modulePath.startsWith('.')) {
            const fromDir = fromFile.substring(0, fromFile.lastIndexOf('/'));
            
            // Count leading dots to determine parent level
            let dots = 0;
            while (modulePath[dots] === '.') dots++;
            
            // Get the module name after dots
            const moduleName = modulePath.slice(dots);
            
            // Navigate up directories based on dot count
            const parts = fromDir.split('/').filter(Boolean);
            for (let i = 1; i < dots; i++) {
                parts.pop();
            }
            
            // Add module path (convert dots to slashes)
            if (moduleName) {
                const moduleParts = moduleName.split('.');
                parts.push(...moduleParts);
            }
            
            // Return as .py file path
            const basePath = parts.join('/');
            return basePath ? `${basePath}.py` : null;
        }
        
        // Handle package-style imports (e.g., mypackage.submodule)
        // These could be local packages - try to resolve
        if (!modulePath.includes('.')) {
            // Single module name - likely external (flask, os, etc.)
            return null;
        }
        
        // Multi-part import (e.g., myapp.utils.helpers)
        // Could be local package - convert to path
        const parts = modulePath.split('.');
        const possiblePath = parts.join('/') + '.py';
        
        // Return the path - the graph will validate if file exists
        return possiblePath;
    }

    /**
     * Fallback regex-based parsing when tree-sitter is unavailable
     */
    private fallbackParse(filePath: string, content: string): IndexResult {
        const nodes: GraphNode[] = [];
        const edges: GraphEdge[] = [];
        const lines = content.split('\n');

        const fileNode: GraphNode = {
            id: `file:${filePath}`,
            kind: 'file',
            name: this.getFileName(filePath),
            path: filePath,
            meta: {
                language: 'python',
                exports: [],
                confidence: 'low',
            },
        };

        // Simple regex-based import extraction
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // import module
            const importMatch = line.match(/^import\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)/);
            if (importMatch) {
                edges.push(this.createPythonImportEdge(filePath, importMatch[1], i + 1, 'low'));
            }

            // from module import ...
            const fromMatch = line.match(/^from\s+([a-zA-Z_.][a-zA-Z0-9_.]*)\s+import/);
            if (fromMatch) {
                edges.push(this.createPythonImportEdge(filePath, fromMatch[1], i + 1, 'low'));
            }
        }

        nodes.push(fileNode);

        // Check for main block
        if (content.includes('if __name__') && content.includes('__main__')) {
            nodes.push({
                id: `entrypoint:main:${filePath}`,
                kind: 'entrypoint',
                name: `Main: ${this.getFileName(filePath)}`,
                path: filePath,
                meta: {
                    entrypointType: 'main',
                    language: 'python',
                    confidence: 'low',
                },
            });
        }

        return { nodes, edges };
    }

    /**
     * Get file name from path
     */
    private getFileName(filePath: string): string {
        return filePath.split('/').pop() ?? filePath;
    }
}
