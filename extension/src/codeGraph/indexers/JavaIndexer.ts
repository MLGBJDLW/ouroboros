/**
 * Java Indexer
 * Parses Java files using tree-sitter for imports, exports, and entrypoints
 */

import { TreeSitterIndexer, type TreeSitterIndexerOptions } from './TreeSitterIndexer';
import type { GraphNode, GraphEdge, IndexResult } from '../core/types';
import type { ParsedNode, SupportedLanguage } from '../parsers/TreeSitterManager';

export class JavaIndexer extends TreeSitterIndexer {
    readonly language: SupportedLanguage = 'java';
    readonly supportedExtensions = ['.java'];

    constructor(options: TreeSitterIndexerOptions) {
        super(options);
    }

    protected parseTree(rootNode: ParsedNode, filePath: string, content: string): IndexResult {
        const nodes: GraphNode[] = [];
        const edges: GraphEdge[] = [];
        const exports: string[] = [];

        this.walkTree(rootNode, (node) => {
            // import statements
            if (node.type === 'import_declaration') {
                const pathNode = this.findDescendant(node, 'scoped_identifier');
                if (pathNode) {
                    edges.push(this.createImportEdge(
                        filePath,
                        pathNode.text,
                        node.startPosition.row + 1,
                        'high'
                    ));
                }
            }

            // Public classes
            if (node.type === 'class_declaration') {
                const modifiers = this.findChild(node, 'modifiers');
                if (modifiers?.text.includes('public')) {
                    const nameNode = this.findChild(node, 'identifier');
                    if (nameNode) {
                        exports.push(nameNode.text);
                    }
                }
            }

            // Public interfaces
            if (node.type === 'interface_declaration') {
                const modifiers = this.findChild(node, 'modifiers');
                if (modifiers?.text.includes('public')) {
                    const nameNode = this.findChild(node, 'identifier');
                    if (nameNode) {
                        exports.push(nameNode.text);
                    }
                }
            }

            // Public enums
            if (node.type === 'enum_declaration') {
                const modifiers = this.findChild(node, 'modifiers');
                if (modifiers?.text.includes('public')) {
                    const nameNode = this.findChild(node, 'identifier');
                    if (nameNode) {
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
     * Detect Java entrypoints
     */
    private detectEntrypoint(rootNode: ParsedNode, content: string, filePath: string): GraphNode | null {
        let hasMain = false;
        let framework: string | null = null;

        this.walkTree(rootNode, (node) => {
            // public static void main(String[] args)
            if (node.type === 'method_declaration') {
                const nameNode = this.findChild(node, 'identifier');
                if (nameNode?.text === 'main') {
                    const modifiers = this.findChild(node, 'modifiers');
                    if (modifiers?.text.includes('public') && modifiers?.text.includes('static')) {
                        hasMain = true;
                    }
                }
            }

            // Spring annotations
            if (node.type === 'marker_annotation' || node.type === 'annotation') {
                const annotationText = node.text;
                
                // @SpringBootApplication
                if (annotationText.includes('SpringBootApplication')) {
                    framework = 'spring-boot';
                }
                // @RestController, @Controller
                if (annotationText.includes('RestController') || annotationText.includes('Controller')) {
                    framework = framework || 'spring';
                }
                // @RequestMapping, @GetMapping, etc.
                if (annotationText.match(/@(Request|Get|Post|Put|Delete|Patch)Mapping/)) {
                    framework = framework || 'spring';
                }
            }
        });

        if (hasMain) {
            if (framework) {
                return this.createEntrypointNode(filePath, 'api', framework);
            }
            return this.createEntrypointNode(filePath, 'main');
        }

        if (framework) {
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

            // import package.Class;
            const importMatch = line.match(/^import\s+([a-zA-Z_][a-zA-Z0-9_\.]*);/);
            if (importMatch) {
                edges.push(this.createImportEdge(filePath, importMatch[1], i + 1, 'low'));
            }
        }

        nodes.push(this.createFileNode(filePath));

        // Check for main method
        if (content.includes('public static void main')) {
            nodes.push(this.createEntrypointNode(filePath, 'main'));
        }

        // Check for Spring annotations
        if (content.includes('@SpringBootApplication')) {
            nodes.push(this.createEntrypointNode(filePath, 'api', 'spring-boot'));
        } else if (content.includes('@RestController') || content.includes('@Controller')) {
            nodes.push(this.createEntrypointNode(filePath, 'api', 'spring'));
        }

        return { nodes, edges };
    }
}
