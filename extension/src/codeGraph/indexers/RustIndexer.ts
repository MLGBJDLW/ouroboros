/**
 * Rust Indexer
 * Parses Rust files using tree-sitter for imports, exports, and entrypoints
 */

import { TreeSitterIndexer, type TreeSitterIndexerOptions } from './TreeSitterIndexer';
import type { GraphNode, GraphEdge, IndexResult } from '../core/types';
import type { ParsedNode, SupportedLanguage } from '../parsers/TreeSitterManager';

export class RustIndexer extends TreeSitterIndexer {
    readonly language: SupportedLanguage = 'rust';
    readonly supportedExtensions = ['.rs'];

    constructor(options: TreeSitterIndexerOptions) {
        super(options);
    }

    /**
     * Resolve Rust import path to local file
     */
    protected override resolveImportPath(importPath: string, fromFile: string): string | null {
        // crate:: imports - local crate modules
        if (importPath.startsWith('crate::')) {
            const modulePath = importPath.slice(7); // Remove "crate::"
            const parts = modulePath.split('::');
            // Convert to file path: crate::foo::bar -> src/foo/bar.rs or src/foo/bar/mod.rs
            return `src/${parts.join('/')}.rs`;
        }
        
        // super:: imports - parent module
        if (importPath.startsWith('super::')) {
            const fromDir = fromFile.substring(0, fromFile.lastIndexOf('/'));
            const parentDir = fromDir.substring(0, fromDir.lastIndexOf('/'));
            const modulePath = importPath.slice(7); // Remove "super::"
            const parts = modulePath.split('::');
            return `${parentDir}/${parts.join('/')}.rs`;
        }
        
        // self:: imports - current module
        if (importPath.startsWith('self::')) {
            const fromDir = fromFile.substring(0, fromFile.lastIndexOf('/'));
            const modulePath = importPath.slice(6); // Remove "self::"
            const parts = modulePath.split('::');
            return `${fromDir}/${parts.join('/')}.rs`;
        }
        
        // mod declarations - sibling file or directory
        if (!importPath.includes('::')) {
            const fromDir = fromFile.substring(0, fromFile.lastIndexOf('/'));
            // Could be module_name.rs or module_name/mod.rs
            return `${fromDir}/${importPath}.rs`;
        }
        
        // External crates (std::, external packages) - return null
        return null;
    }

    protected parseTree(rootNode: ParsedNode, filePath: string, content: string): IndexResult {
        const nodes: GraphNode[] = [];
        const edges: GraphEdge[] = [];
        const exports: string[] = [];

        // Extract imports (use statements)
        this.walkTree(rootNode, (node) => {
            // use crate::module::item;
            // use std::collections::HashMap;
            if (node.type === 'use_declaration') {
                const pathNode = this.findDescendant(node, 'scoped_identifier') ||
                                 this.findDescendant(node, 'identifier');
                if (pathNode) {
                    const modulePath = pathNode.text;
                    const confidence = modulePath.startsWith('crate::') ? 'high' : 'medium';
                    edges.push(this.createTsImportEdge(
                        filePath,
                        modulePath,
                        node.startPosition.row + 1,
                        confidence
                    ));
                }
            }

            // mod module_name;
            if (node.type === 'mod_item') {
                const nameNode = this.findChild(node, 'identifier');
                if (nameNode) {
                    edges.push(this.createTsImportEdge(
                        filePath,
                        nameNode.text,
                        node.startPosition.row + 1,
                        'high'
                    ));
                }
            }

            // pub fn/struct/enum/trait (exports)
            if (node.type === 'function_item' || 
                node.type === 'struct_item' || 
                node.type === 'enum_item' ||
                node.type === 'trait_item' ||
                node.type === 'impl_item') {
                
                // Check if public
                const visMarker = this.findChild(node, 'visibility_modifier');
                if (visMarker?.text.includes('pub')) {
                    const nameNode = this.findChild(node, 'identifier') ||
                                     this.findChild(node, 'type_identifier');
                    if (nameNode) {
                        exports.push(nameNode.text);
                    }
                }
            }
        });

        // Create file node
        nodes.push(this.createTsFileNode(filePath, exports));

        // Detect entrypoints
        const entrypoint = this.detectEntrypoint(rootNode, content, filePath);
        if (entrypoint) {
            nodes.push(entrypoint);
        }

        return { nodes, edges };
    }

    /**
     * Detect Rust entrypoints
     */
    private detectEntrypoint(rootNode: ParsedNode, content: string, filePath: string): GraphNode | null {
        let hasMain = false;
        let framework: string | null = null;

        this.walkTree(rootNode, (node) => {
            // fn main()
            if (node.type === 'function_item') {
                const nameNode = this.findChild(node, 'identifier');
                if (nameNode?.text === 'main') {
                    hasMain = true;
                }
            }

            // #[tokio::main] or #[actix_web::main]
            if (node.type === 'attribute_item') {
                const attrText = node.text;
                if (attrText.includes('tokio::main') || attrText.includes('async_std::main')) {
                    hasMain = true;
                }
                if (attrText.includes('actix_web::main') || attrText.includes('actix_rt::main')) {
                    framework = 'actix';
                }
            }

            // Route attributes: #[get("/")], #[post("/")]
            if (node.type === 'attribute_item') {
                const attrText = node.text;
                if (attrText.match(/#\[(get|post|put|delete|patch|head|options)\s*\(/)) {
                    framework = framework || 'web';
                }
                // Rocket routes
                if (attrText.includes('rocket::')) {
                    framework = 'rocket';
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

            // use crate::module;
            const useMatch = line.match(/^use\s+([a-zA-Z_][a-zA-Z0-9_:]*)/);
            if (useMatch) {
                edges.push(this.createTsImportEdge(filePath, useMatch[1], i + 1, 'low'));
            }

            // mod module_name;
            const modMatch = line.match(/^mod\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*;/);
            if (modMatch) {
                edges.push(this.createTsImportEdge(filePath, modMatch[1], i + 1, 'low'));
            }
        }

        nodes.push(this.createTsFileNode(filePath));

        // Check for main function
        if (content.includes('fn main(')) {
            nodes.push(this.createEntrypointNode(filePath, 'main'));
        }

        return { nodes, edges };
    }
}
