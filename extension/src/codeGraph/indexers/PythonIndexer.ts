/**
 * Python Indexer
 * Parses Python files using tree-sitter for imports, exports, and entrypoints
 */

import { BaseIndexer, type IndexerOptions } from './BaseIndexer';
import type { GraphNode, GraphEdge, IndexResult, Confidence } from '../core/types';
import { TreeSitterManager, type ParsedNode, type SupportedLanguage } from '../parsers/TreeSitterManager';
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
            } catch (error) {
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
            fileNode.meta!.exports = exports;
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
                    edges.push(this.createImportEdge(
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
                    edges.push(this.createImportEdge(
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
    private extractExports(rootNode: ParsedNode, content: string): string[] {
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
    private detectEntrypoint(rootNode: ParsedNode, content: string, filePath: string): GraphNode | null {
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
     * Create import edge
     */
    private createImportEdge(
        fromFile: string,
        toModule: string,
        line: number,
        confidence: Confidence
    ): GraphEdge {
        return {
            id: `edge:${fromFile}:${toModule}:${line}`,
            from: `file:${fromFile}`,
            to: `module:${toModule}`,
            kind: 'imports',
            confidence,
            meta: {
                importPath: toModule,
                loc: { line, column: 0 },
                language: 'python',
            },
        };
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
                edges.push(this.createImportEdge(filePath, importMatch[1], i + 1, 'low'));
            }

            // from module import ...
            const fromMatch = line.match(/^from\s+([a-zA-Z_\.][a-zA-Z0-9_\.]*)\s+import/);
            if (fromMatch) {
                edges.push(this.createImportEdge(filePath, fromMatch[1], i + 1, 'low'));
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
