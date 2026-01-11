/**
 * Go Indexer
 * Parses Go files using tree-sitter for imports, exports, and entrypoints
 * 
 * Handles:
 * - Standard library detection
 * - Relative imports (./pkg, ../pkg)
 * - Internal package detection (internal/)
 * - Exported identifiers (capitalized names)
 * - Framework detection (Gin, Echo, Fiber, Chi, Gorilla, gRPC)
 * - CLI detection (Cobra, urfave/cli)
 * - Test file detection (*_test.go)
 */

import { TreeSitterIndexer, type TreeSitterIndexerOptions } from './TreeSitterIndexer';
import type { GraphNode, GraphEdge, IndexResult } from '../core/types';
import type { ParsedNode, SupportedLanguage } from '../parsers/TreeSitterManager';

// Go standard library packages (partial list of common ones)
const GO_STDLIB = new Set([
    'fmt', 'os', 'io', 'bufio', 'bytes', 'strings', 'strconv',
    'errors', 'log', 'flag', 'time', 'math', 'rand', 'sort',
    'sync', 'atomic', 'context', 'reflect', 'unsafe',
    'net', 'http', 'url', 'html', 'template', 'json', 'xml', 'csv',
    'encoding', 'base64', 'hex', 'binary', 'gob',
    'path', 'filepath', 'regexp', 'unicode', 'utf8', 'utf16',
    'crypto', 'hash', 'md5', 'sha1', 'sha256', 'sha512', 'aes', 'rsa', 'tls',
    'database', 'sql', 'testing', 'debug', 'runtime', 'syscall',
    'archive', 'compress', 'container', 'embed', 'expvar', 'image',
    'index', 'mime', 'plugin', 'text', 'go',
]);

// Common external packages to skip
const GO_EXTERNAL_PACKAGES = new Set([
    'github.com', 'golang.org', 'google.golang.org', 'gopkg.in',
    'go.uber.org', 'go.etcd.io', 'k8s.io', 'sigs.k8s.io',
]);

export class GoIndexer extends TreeSitterIndexer {
    readonly language: SupportedLanguage = 'go';
    readonly supportedExtensions = ['.go'];

    constructor(options: TreeSitterIndexerOptions) {
        super(options);
    }

    /**
     * Check if import is from Go standard library
     */
    private isStdlib(importPath: string): boolean {
        // Standard library packages don't have dots in the first segment
        const firstSegment = importPath.split('/')[0];
        return GO_STDLIB.has(firstSegment) || !firstSegment.includes('.');
    }

    /**
     * Check if import is from a known external package host
     */
    private isExternalPackage(importPath: string): boolean {
        const firstSegment = importPath.split('/')[0];
        return GO_EXTERNAL_PACKAGES.has(firstSegment) || firstSegment.includes('.');
    }

    /**
     * Resolve Go import path to local file
     * Go uses package paths, not file paths directly
     */
    protected override resolveImportPath(importPath: string, fromFile: string): string | null {
        // Normalize path separators
        const normalizedFromFile = fromFile.replace(/\\/g, '/');
        
        // Relative imports (rare in Go but possible with go.mod replace)
        if (importPath.startsWith('./') || importPath.startsWith('../')) {
            const fromDir = normalizedFromFile.substring(0, normalizedFromFile.lastIndexOf('/'));
            // Go imports are directories, not files - return the directory
            return this.resolveRelativePath(fromDir, importPath);
        }
        
        // Skip standard library
        if (this.isStdlib(importPath)) {
            return null;
        }
        
        // Skip known external package hosts
        if (this.isExternalPackage(importPath)) {
            return null;
        }
        
        // Internal package imports (same module)
        // These typically look like: "myproject/pkg/utils" or "myproject/internal/service"
        // Try to resolve as local package
        const parts = importPath.split('/');
        
        // Check for internal/ packages (Go convention)
        const internalIdx = parts.indexOf('internal');
        if (internalIdx !== -1) {
            // internal packages are local
            return parts.slice(internalIdx).join('/');
        }
        
        // Check for pkg/ packages (common convention)
        const pkgIdx = parts.indexOf('pkg');
        if (pkgIdx !== -1) {
            return parts.slice(pkgIdx).join('/');
        }
        
        // Check for cmd/ packages
        const cmdIdx = parts.indexOf('cmd');
        if (cmdIdx !== -1) {
            return parts.slice(cmdIdx).join('/');
        }
        
        // Try the last few segments as local path
        if (parts.length >= 2) {
            // Could be "modulename/subpackage" - try subpackage
            return parts.slice(1).join('/');
        }
        
        return null;
    }

    protected parseTree(rootNode: ParsedNode, filePath: string, content: string): IndexResult {
        const nodes: GraphNode[] = [];
        const edges: GraphEdge[] = [];
        const exports: string[] = [];
        const isTestFile = this.isTestFile(filePath);

        this.walkTree(rootNode, (node) => {
            // import "package"
            // import ( "package1" "package2" )
            if (node.type === 'import_declaration') {
                const importSpecs = this.findAllDescendants(node, 'import_spec');
                for (const spec of importSpecs) {
                    const pathNode = this.findChild(spec, 'interpreted_string_literal');
                    if (pathNode) {
                        const importPath = pathNode.text.replace(/"/g, '');
                        // Determine confidence based on import type
                        let confidence: 'high' | 'medium' | 'low' = 'medium';
                        if (importPath.startsWith('.')) {
                            confidence = 'high';
                        } else if (this.isStdlib(importPath) || this.isExternalPackage(importPath)) {
                            confidence = 'low';
                        }
                        edges.push(this.createTsImportEdge(
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
                if (nameNode && this.isExportedName(nameNode.text)) {
                    exports.push(nameNode.text);
                }
            }

            // Method declarations (func (r *Receiver) Method())
            if (node.type === 'method_declaration') {
                const nameNode = this.findChild(node, 'field_identifier');
                if (nameNode && this.isExportedName(nameNode.text)) {
                    exports.push(nameNode.text);
                }
            }

            // Exported types (capitalized)
            if (node.type === 'type_declaration') {
                const typeSpecs = this.findAllDescendants(node, 'type_spec');
                for (const spec of typeSpecs) {
                    const nameNode = this.findChild(spec, 'type_identifier');
                    if (nameNode && this.isExportedName(nameNode.text)) {
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
                    if (nameNode && this.isExportedName(nameNode.text)) {
                        exports.push(nameNode.text);
                    }
                }
            }
        });

        // Create file node
        nodes.push(this.createTsFileNode(filePath, exports));

        // Detect entrypoints
        const entrypoint = this.detectEntrypoint(rootNode, content, filePath, isTestFile);
        if (entrypoint) {
            nodes.push(entrypoint);
        }

        return { nodes, edges };
    }

    /**
     * Check if file is a test file
     */
    private isTestFile(filePath: string): boolean {
        return filePath.endsWith('_test.go');
    }

    /**
     * Check if identifier is exported (starts with uppercase)
     */
    private isExportedName(name: string): boolean {
        return /^[A-Z]/.test(name);
    }

    /**
     * Detect Go entrypoints
     */
    private detectEntrypoint(rootNode: ParsedNode, content: string, filePath: string, isTestFile: boolean): GraphNode | null {
        let hasMain = false;
        let isMainPackage = false;
        let framework: string | null = null;
        let hasTestFunctions = false;

        this.walkTree(rootNode, (node) => {
            // package main
            if (node.type === 'package_clause') {
                const nameNode = this.findChild(node, 'package_identifier');
                if (nameNode?.text === 'main') {
                    isMainPackage = true;
                }
            }

            // func main() or func TestXxx()
            if (node.type === 'function_declaration') {
                const nameNode = this.findChild(node, 'identifier');
                if (nameNode?.text === 'main') {
                    hasMain = true;
                }
                // Test functions: TestXxx, BenchmarkXxx, ExampleXxx
                if (nameNode && /^(Test|Benchmark|Example)[A-Z]/.test(nameNode.text)) {
                    hasTestFunctions = true;
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
        } else if (content.includes('github.com/go-chi/chi')) {
            framework = 'chi';
        } else if (content.includes('github.com/gorilla/mux')) {
            framework = 'gorilla';
        } else if (content.includes('google.golang.org/grpc')) {
            framework = 'grpc';
        } else if (content.includes('github.com/spf13/cobra')) {
            framework = 'cobra';
        } else if (content.includes('github.com/urfave/cli')) {
            framework = 'urfave-cli';
        }

        // Test files
        if (isTestFile || hasTestFunctions) {
            return this.createEntrypointNode(filePath, 'test', 'go-test');
        }

        if (isMainPackage && hasMain) {
            if (framework === 'cobra' || framework === 'urfave-cli') {
                return this.createEntrypointNode(filePath, 'command', framework);
            }
            if (framework) {
                return this.createEntrypointNode(filePath, 'api', framework);
            }
            return this.createEntrypointNode(filePath, 'main');
        }

        // Route handlers (even without main)
        if (framework && ['gin', 'echo', 'fiber', 'chi', 'gorilla', 'grpc'].includes(framework)) {
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
                edges.push(this.createTsImportEdge(filePath, singleImport[1], i + 1, 'low'));
            }

            // Inside import block
            const importLine = line.match(/^\s*"([^"]+)"/);
            if (importLine && !line.includes('=')) {
                edges.push(this.createTsImportEdge(filePath, importLine[1], i + 1, 'low'));
            }
        }

        nodes.push(this.createTsFileNode(filePath));

        // Check for main
        if (content.includes('package main') && content.includes('func main(')) {
            nodes.push(this.createEntrypointNode(filePath, 'main'));
        }

        return { nodes, edges };
    }
}
