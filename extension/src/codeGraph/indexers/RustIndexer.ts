/**
 * Rust Indexer
 * Parses Rust files using tree-sitter for imports, exports, and entrypoints
 * 
 * Handles:
 * - crate::, super::, self:: module paths
 * - mod declarations (inline and file-based)
 * - pub exports (fn, struct, enum, trait, impl, type, const, static)
 * - Framework detection (Actix, Rocket, Axum, Warp, Tide)
 * - Test detection (#[test], #[cfg(test)])
 * - Async runtime detection (tokio, async-std)
 */

import { TreeSitterIndexer, type TreeSitterIndexerOptions } from './TreeSitterIndexer';
import type { GraphNode, GraphEdge, IndexResult } from '../core/types';
import type { ParsedNode, SupportedLanguage } from '../parsers/TreeSitterManager';

// Standard library and common external crates to skip
const EXTERNAL_CRATES = new Set([
    'std', 'core', 'alloc', 'proc_macro',
    // Common crates
    'serde', 'serde_json', 'serde_yaml', 'tokio', 'async_std', 'futures',
    'anyhow', 'thiserror', 'log', 'tracing', 'env_logger',
    'clap', 'structopt', 'argh',
    'reqwest', 'hyper', 'http', 'url',
    'regex', 'lazy_static', 'once_cell',
    'chrono', 'time', 'uuid',
    'rand', 'num', 'itertools',
    'diesel', 'sqlx', 'sea_orm', 'rusqlite',
    'actix', 'actix_web', 'actix_rt', 'rocket', 'axum', 'warp', 'tide',
    'tower', 'tonic', 'prost',
    'bytes', 'parking_lot', 'crossbeam',
    'rayon', 'dashmap', 'arc_swap',
]);

export class RustIndexer extends TreeSitterIndexer {
    readonly language: SupportedLanguage = 'rust';
    readonly supportedExtensions = ['.rs'];

    constructor(options: TreeSitterIndexerOptions) {
        super(options);
    }

    /**
     * Check if a crate is external (stdlib or common dependency)
     */
    private isExternalCrate(crateName: string): boolean {
        // Extract first segment of path (the crate name)
        const firstSegment = crateName.split('::')[0].replace(/_/g, '_');
        return EXTERNAL_CRATES.has(firstSegment) || EXTERNAL_CRATES.has(firstSegment.replace(/_/g, '-'));
    }

    /**
     * Resolve Rust import path to local file
     */
    protected override resolveImportPath(importPath: string, fromFile: string): string | null {
        // Normalize path separators
        const normalizedFromFile = fromFile.replace(/\\/g, '/');
        
        // crate:: imports - local crate modules
        if (importPath.startsWith('crate::')) {
            const modulePath = importPath.slice(7); // Remove "crate::"
            const parts = modulePath.split('::');
            // Remove the item name if it looks like a type/function (starts with uppercase or is a common item)
            const pathParts = this.extractModulePath(parts);
            // Convert to file path: crate::foo::bar -> src/foo/bar.rs or src/foo/bar/mod.rs
            return `src/${pathParts.join('/')}.rs`;
        }
        
        // super:: imports - parent module (can be chained: super::super::)
        if (importPath.startsWith('super::')) {
            let path = importPath;
            let currentDir = normalizedFromFile.substring(0, normalizedFromFile.lastIndexOf('/'));
            
            // Handle chained super::
            while (path.startsWith('super::')) {
                currentDir = currentDir.substring(0, currentDir.lastIndexOf('/'));
                path = path.slice(7); // Remove "super::"
            }
            
            if (path) {
                const parts = this.extractModulePath(path.split('::'));
                return `${currentDir}/${parts.join('/')}.rs`;
            }
            return null;
        }
        
        // self:: imports - current module
        if (importPath.startsWith('self::')) {
            const fromDir = normalizedFromFile.substring(0, normalizedFromFile.lastIndexOf('/'));
            const modulePath = importPath.slice(6); // Remove "self::"
            const parts = this.extractModulePath(modulePath.split('::'));
            return `${fromDir}/${parts.join('/')}.rs`;
        }
        
        // mod declarations - sibling file or directory
        if (!importPath.includes('::')) {
            const fromDir = normalizedFromFile.substring(0, normalizedFromFile.lastIndexOf('/'));
            // Could be module_name.rs or module_name/mod.rs
            return `${fromDir}/${importPath}.rs`;
        }
        
        // Check if it's an external crate
        if (this.isExternalCrate(importPath)) {
            return null;
        }
        
        // Might be a local crate without crate:: prefix (workspace member)
        const parts = importPath.split('::');
        const pathParts = this.extractModulePath(parts);
        // Try as workspace crate
        return `${pathParts[0]}/src/${pathParts.slice(1).join('/')}.rs`;
    }

    /**
     * Extract module path parts, removing item names (types, functions, etc.)
     */
    private extractModulePath(parts: string[]): string[] {
        // If last part starts with uppercase, it's likely a type/struct/enum
        // If it's a common item name, skip it
        const result: string[] = [];
        for (const part of parts) {
            // Skip if it looks like a type (PascalCase) or is a glob
            if (/^[A-Z]/.test(part) || part === '*' || part === '{') {
                break;
            }
            result.push(part);
        }
        return result.length > 0 ? result : parts.slice(0, 1);
    }

    protected parseTree(rootNode: ParsedNode, filePath: string, _content: string): IndexResult {
        const nodes: GraphNode[] = [];
        const edges: GraphEdge[] = [];
        const exports: string[] = [];
        const isTestFile = this.isTestFile(filePath);

        this.walkTree(rootNode, (node) => {
            // use crate::module::item;
            // use std::collections::HashMap;
            if (node.type === 'use_declaration') {
                const pathNode = this.findDescendant(node, 'scoped_identifier') ||
                                 this.findDescendant(node, 'identifier');
                if (pathNode) {
                    const modulePath = pathNode.text;
                    // Determine confidence based on import type
                    let confidence: 'high' | 'medium' | 'low' = 'medium';
                    if (modulePath.startsWith('crate::') || modulePath.startsWith('self::') || modulePath.startsWith('super::')) {
                        confidence = 'high';
                    } else if (this.isExternalCrate(modulePath)) {
                        confidence = 'low';
                    }
                    edges.push(this.createTsImportEdge(
                        filePath,
                        modulePath,
                        node.startPosition.row + 1,
                        confidence
                    ));
                }
            }

            // mod module_name; (file-based module)
            if (node.type === 'mod_item') {
                const nameNode = this.findChild(node, 'identifier');
                // Only track file-based mods (those ending with ;), not inline mods with {}
                const hasBlock = this.findChild(node, 'declaration_list') !== null;
                if (nameNode && !hasBlock) {
                    edges.push(this.createTsImportEdge(
                        filePath,
                        nameNode.text,
                        node.startPosition.row + 1,
                        'high'
                    ));
                }
            }

            // pub fn/struct/enum/trait/type/const/static (exports)
            if (node.type === 'function_item' || 
                node.type === 'struct_item' || 
                node.type === 'enum_item' ||
                node.type === 'trait_item' ||
                node.type === 'type_item' ||
                node.type === 'const_item' ||
                node.type === 'static_item') {
                
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

            // pub use re-exports
            if (node.type === 'use_declaration') {
                const visMarker = this.findChild(node, 'visibility_modifier');
                if (visMarker?.text.includes('pub')) {
                    // This is a re-export
                    const pathNode = this.findDescendant(node, 'identifier');
                    if (pathNode) {
                        exports.push(pathNode.text);
                    }
                }
            }
        });

        // Create file node
        nodes.push(this.createTsFileNode(filePath, exports));

        // Detect entrypoints
        const entrypoint = this.detectEntrypoint(rootNode, filePath, isTestFile);
        if (entrypoint) {
            nodes.push(entrypoint);
        }

        return { nodes, edges };
    }

    /**
     * Check if file is a test file
     */
    private isTestFile(filePath: string): boolean {
        const normalizedPath = filePath.replace(/\\/g, '/');
        return normalizedPath.includes('/tests/') ||
               normalizedPath.endsWith('_test.rs') ||
               normalizedPath.includes('/test_');
    }

    /**
     * Detect Rust entrypoints
     */
    private detectEntrypoint(rootNode: ParsedNode, filePath: string, isTestFile: boolean): GraphNode | null {
        let hasMain = false;
        let framework: string | null = null;
        let hasTestAttribute = false;
        let hasCfgTest = false;

        this.walkTree(rootNode, (node) => {
            // fn main()
            if (node.type === 'function_item') {
                const nameNode = this.findChild(node, 'identifier');
                if (nameNode?.text === 'main') {
                    hasMain = true;
                }
            }

            // Attribute items
            if (node.type === 'attribute_item') {
                const attrText = node.text;
                
                // Async runtime main attributes
                if (attrText.includes('tokio::main') || attrText.includes('async_std::main')) {
                    hasMain = true;
                }
                
                // Framework detection
                if (attrText.includes('actix_web::main') || attrText.includes('actix_rt::main')) {
                    framework = 'actix';
                    hasMain = true;
                }
                
                // Route attributes: #[get("/")], #[post("/")]
                if (/#\[(get|post|put|delete|patch|head|options)\s*\(/.test(attrText)) {
                    framework = framework || 'web';
                }
                
                // Rocket routes
                if (attrText.includes('rocket::')) {
                    framework = 'rocket';
                }
                
                // Axum
                if (attrText.includes('axum::')) {
                    framework = 'axum';
                }
                
                // Test attributes
                if (attrText.includes('#[test]') || attrText.includes('#[tokio::test]') || 
                    attrText.includes('#[async_std::test]')) {
                    hasTestAttribute = true;
                }
                
                // #[cfg(test)]
                if (attrText.includes('cfg(test)')) {
                    hasCfgTest = true;
                }
                
                // CLI frameworks
                if (attrText.includes('clap::') || attrText.includes('structopt::')) {
                    framework = framework || 'cli';
                }
            }
        });

        // Test files
        if (isTestFile || hasTestAttribute || hasCfgTest) {
            return this.createEntrypointNode(filePath, 'test', 'rust-test');
        }

        if (hasMain) {
            if (framework === 'cli') {
                return this.createEntrypointNode(filePath, 'command', 'clap');
            }
            if (framework) {
                return this.createEntrypointNode(filePath, 'api', framework);
            }
            return this.createEntrypointNode(filePath, 'main');
        }

        if (framework && framework !== 'cli') {
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
