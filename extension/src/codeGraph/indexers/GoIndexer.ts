/**
 * Go Indexer
 * Parses Go files using tree-sitter for imports, exports, and entrypoints
 */

import { TreeSitterIndexer, type TreeSitterIndexerOptions } from './TreeSitterIndexer';
import type { GraphNode, GraphEdge, IndexResult } from '../core/types';
import type { ParsedNode, SupportedLanguage } from '../parsers/TreeSitterManager';

export class GoIndexer extends TreeSitterIndexer {
    readonly language: SupportedLanguage = 'go';
    readonly supportedExtensions = ['.go'];

    constructor(options: TreeSitterIndexerOptions) {
        super(options);
    }

    protected parseTree(rootNode: ParsedNode, filePath: string, content: string): IndexResult {
        const nodes: GraphNode[] = [];
        const edges: GraphEdge[] = [];
        const exports: string[] = [];

        this.walkTree(rootNode, (node) => {
            // import "package"
            // import ( "package1" "package2" )
            if (node.type === 'import_declaration') {
                const importSpecs = this.findAllDescendants(node, 'import_spec');
                for (const spec of importSpecs) {
                    const pathNode = this.findChild(spec, 'interpreted_string_literal');
                    if (pathNode) {
                        const importPath = pathNode.text.replace(/"/g, '');
                        const confidence = importPath.startsWith('.') ? 'high' : 'medium';
                        edges.push(this.createImportEdge(
                            filePath,
                            importPath,
                            spec.startPosition.row + 1,
                            confidence
                        ));
                    }
                }
            }

            // Exported functions (capitalized)
            if (node.type === 'function_declaration') {
                const nameNode = this.findChild(node, 'identifier');
                if (nameNode && this.isExported(nameNode.text)) {
                    exports.push(nameNode.text);
                }
            }

            // Exported types (capitalized)
            if (node.type === 'type_declaration') {
                const typeSpecs = this.findAllDescendants(node, 'type_spec');
                for (const spec of typeSpecs) {
                    const nameNode = this.findChild(spec, 'type_identifier');
                    if (nameNode && this.isExported(nameNode.text)) {
                        exports.push(nameNode.text);
                    }
                }
            }

            // Exported variables/constants
            if (node.type === 'var_declaration' || node.type === 'const_declaration') {
                const specs = this.findAllDescendants(node, 'var_spec') || 
                              this.findAllDescendants(node, 'const_spec');
                for (const spec of specs) {
                    const nameNode = this.findChild(spec, 'identifier');
                    if (nameNode && this.isExported(nameNode.text)) {
                        exports.push(nameNode.text);
                    }
                }
            }
        });

        // Create file node
        nodes.push(this.createFileNode(filePath, exports));

        // Detect entrypoints
        const entrypoint = this.detectEntrypoint(rootNode, content, filePath);
        if (entrypoint) {
            nodes.push(entrypoint);
        }

        return { nodes, edges };
    }

    /**
     * Check if identifier is exported (starts with uppercase)
     */
    private isExported(name: string): boolean {
        return /^[A-Z]/.test(name);
    }

    /**
     * Detect Go entrypoints
     */
    private detectEntrypoint(rootNode: ParsedNode, content: string, filePath: string): GraphNode | null {
        let hasMain = false;
        let isMainPackage = false;
        let framework: string | null = null;

        this.walkTree(rootNode, (node) => {
            // package main
            if (node.type === 'package_clause') {
                const nameNode = this.findChild(node, 'package_identifier');
                if (nameNode?.text === 'main') {
                    isMainPackage = true;
                }
            }

            // func main()
            if (node.type === 'function_declaration') {
                const nameNode = this.findChild(node, 'identifier');
                if (nameNode?.text === 'main') {
                    hasMain = true;
                }
            }
        });

        // Check for web frameworks in imports
        if (content.includes('github.com/gin-gonic/gin')) {
            framework = 'gin';
        } else if (content.includes('github.com/labstack/echo')) {
            framework = 'echo';
        } else if (content.includes('github.com/gofiber/fiber')) {
            framework = 'fiber';
        } else if (content.includes('github.com/spf13/cobra')) {
            framework = 'cobra';
        }

        if (isMainPackage && hasMain) {
            if (framework === 'cobra') {
                return this.createEntrypointNode(filePath, 'command', framework);
            }
            if (framework) {
                return this.createEntrypointNode(filePath, 'api', framework);
            }
            return this.createEntrypointNode(filePath, 'main');
        }

        // Route handlers (even without main)
        if (framework && ['gin', 'echo', 'fiber'].includes(framework)) {
            return this.createEntrypointNode(filePath, 'api', framework);
        }

        return null;
    }

    protected fallbackParse(filePath: string, content: string): IndexResult {
        const nodes: GraphNode[] = [];
        const edges: GraphEdge[] = [];
        const lines = content.split('\n');

        // Simple regex-based parsing
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // import "package"
            const singleImport = line.match(/^import\s+"([^"]+)"/);
            if (singleImport) {
                edges.push(this.createImportEdge(filePath, singleImport[1], i + 1, 'low'));
            }

            // Inside import block
            const importLine = line.match(/^\s*"([^"]+)"/);
            if (importLine && !line.includes('=')) {
                edges.push(this.createImportEdge(filePath, importLine[1], i + 1, 'low'));
            }
        }

        nodes.push(this.createFileNode(filePath));

        // Check for main
        if (content.includes('package main') && content.includes('func main(')) {
            nodes.push(this.createEntrypointNode(filePath, 'main'));
        }

        return { nodes, edges };
    }
}
