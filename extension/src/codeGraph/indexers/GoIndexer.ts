/**
 * Go Indexer
 * Parses Go files using tree-sitter for imports, exports, and entrypoints
 * 
 * Handles:
 * - Standard library detection
 * - Relative imports (./pkg, ../pkg)
 * - Internal package detection (internal/)
 * - Exported identifiers (capitalized names)
 * - go:embed directives
 * - go:generate directives
 * - Framework detection (Gin, Echo, Fiber, Chi, Gorilla, gRPC, GraphQL)
 * - CLI detection (Cobra, urfave/cli, kong)
 * - Test file detection (*_test.go)
 * - Benchmark detection (Benchmark*)
 * - Example detection (Example*)
 */

import { TreeSitterIndexer, type TreeSitterIndexerOptions } from './TreeSitterIndexer';
import type { GraphNode, GraphEdge, IndexResult } from '../core/types';
import type { ParsedNode, SupportedLanguage } from '../parsers/TreeSitterManager';

// Go standard library packages (comprehensive list)
const GO_STDLIB = new Set([
    // Core
    'fmt', 'os', 'io', 'bufio', 'bytes', 'strings', 'strconv',
    'errors', 'log', 'flag', 'time', 'math', 'rand', 'sort',
    'sync', 'atomic', 'context', 'reflect', 'unsafe',
    // IO
    'io/fs', 'io/ioutil', 'os/exec', 'os/signal', 'os/user',
    // Net
    'net', 'net/http', 'net/url', 'net/mail', 'net/smtp', 'net/rpc',
    'html', 'html/template', 'text/template',
    // Encoding
    'encoding', 'encoding/json', 'encoding/xml', 'encoding/csv', 'encoding/gob',
    'encoding/base64', 'encoding/hex', 'encoding/binary', 'encoding/pem',
    // Path
    'path', 'path/filepath',
    // Regexp
    'regexp',
    // Unicode
    'unicode', 'unicode/utf8', 'unicode/utf16',
    // Crypto
    'crypto', 'crypto/md5', 'crypto/sha1', 'crypto/sha256', 'crypto/sha512',
    'crypto/aes', 'crypto/rsa', 'crypto/tls', 'crypto/x509', 'crypto/rand',
    'crypto/hmac', 'crypto/cipher', 'crypto/ecdsa', 'crypto/ed25519',
    // Database
    'database', 'database/sql', 'database/sql/driver',
    // Testing
    'testing', 'testing/quick', 'testing/iotest',
    // Debug/runtime
    'debug', 'runtime', 'runtime/debug', 'runtime/pprof', 'runtime/trace',
    'syscall',
    // Archive/compress
    'archive', 'archive/tar', 'archive/zip',
    'compress', 'compress/gzip', 'compress/zlib', 'compress/bzip2', 'compress/flate',
    // Container
    'container', 'container/heap', 'container/list', 'container/ring',
    // Embed
    'embed',
    // Expvar
    'expvar',
    // Image
    'image', 'image/png', 'image/jpeg', 'image/gif', 'image/color',
    // Index
    'index', 'index/suffixarray',
    // Mime
    'mime', 'mime/multipart', 'mime/quotedprintable',
    // Plugin
    'plugin',
    // Text
    'text', 'text/scanner', 'text/tabwriter',
    // Go tooling
    'go', 'go/ast', 'go/build', 'go/doc', 'go/format', 'go/parser',
    'go/printer', 'go/scanner', 'go/token', 'go/types',
]);

// Common external packages to skip
const GO_EXTERNAL_PACKAGES = new Set([
    'github.com', 'golang.org', 'google.golang.org', 'gopkg.in',
    'go.uber.org', 'go.etcd.io', 'k8s.io', 'sigs.k8s.io',
    'cloud.google.com', 'go.opencensus.io', 'go.opentelemetry.io',
    'modernc.org', 'mvdan.cc', 'honnef.co', 'gotest.tools',
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
    private isGoExternalPackage(importPath: string): boolean {
        const firstSegment = importPath.split('/')[0];
        
        // Check if it's a workspace module (monorepo internal dependency)
        if (this.isWorkspacePackage(importPath, 'go')) {
            return false;
        }
        
        // Also check if any workspace module is a prefix of the import
        for (const mod of this.workspaceData.goModules) {
            if (importPath.startsWith(mod)) {
                return false;
            }
        }
        
        // Check vendor packages
        if (this.workspaceData.goVendor.has(importPath)) {
            return false;
        }
        
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
        if (this.isGoExternalPackage(importPath)) {
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
        
        // Check if this is a doc.go or main package file that might re-export
        const fileName = filePath.split('/').pop() ?? filePath;
        const isDocFile = fileName === 'doc.go';

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
                        } else if (this.isStdlib(importPath) || this.isGoExternalPackage(importPath)) {
                            confidence = 'low';
                        }
                        
                        // Check for dot import (import . "package") - this is Go's re-export mechanism
                        const dotImport = this.findChild(spec, 'dot');
                        if (dotImport) {
                            // Dot import - all exported symbols are re-exported
                            const reexportEdge = this.createGoReexportEdge(
                                filePath,
                                importPath,
                                spec.startPosition.row + 1,
                                'dot'
                            );
                            if (reexportEdge) {
                                edges.push(reexportEdge);
                            }
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
                        
                        // Check for type alias that re-exports from another package
                        // type MyType = otherpackage.Type
                        const typeAlias = this.findChild(spec, 'type_alias');
                        if (typeAlias) {
                            const qualifiedType = this.findDescendant(typeAlias, 'qualified_type');
                            if (qualifiedType) {
                                // This is a type alias re-export
                                // Note: We can't easily resolve the package here without more context
                            }
                        }
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
        const fileNode = this.createTsFileNode(filePath, exports);
        if (isDocFile) {
            fileNode.meta = { ...fileNode.meta, isDocFile: true };
        }
        nodes.push(fileNode);

        // Detect entrypoints
        const entrypoint = this.detectEntrypoint(rootNode, content, filePath, isTestFile);
        if (entrypoint) {
            nodes.push(entrypoint);
        }

        return { nodes, edges };
    }

    /**
     * Create a Go re-export edge for dot imports
     */
    private createGoReexportEdge(
        fromFile: string,
        toPackage: string,
        line: number,
        reexportType: 'dot' | 'alias'
    ): GraphEdge | null {
        const resolvedPath = this.resolveImportPath(toPackage, fromFile);
        if (resolvedPath) {
            return {
                id: `edge:${fromFile}:reexports:${resolvedPath}`,
                from: `file:${fromFile}`,
                to: `file:${resolvedPath}`,
                kind: 'reexports',
                confidence: 'high',
                reason: `go ${reexportType} import`,
                meta: {
                    importPath: toPackage,
                    reexportType,
                    loc: { line, column: 0 },
                    language: 'go',
                },
            };
        }
        return null;
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
        let hasBenchmarks = false;
        let hasExamples = false;
        let hasInit = false;
        // Track directives for potential future use
        const _hasGoEmbed = content.includes('//go:embed');
        const _hasGoGenerate = content.includes('//go:generate');

        this.walkTree(rootNode, (node) => {
            // package main
            if (node.type === 'package_clause') {
                const nameNode = this.findChild(node, 'package_identifier');
                if (nameNode?.text === 'main') {
                    isMainPackage = true;
                }
            }

            // func main(), func init(), func TestXxx(), func BenchmarkXxx(), func ExampleXxx()
            if (node.type === 'function_declaration') {
                const nameNode = this.findChild(node, 'identifier');
                if (nameNode?.text === 'main') {
                    hasMain = true;
                }
                if (nameNode?.text === 'init') {
                    hasInit = true;
                }
                // Test functions: TestXxx
                if (nameNode && /^Test[A-Z]/.test(nameNode.text)) {
                    hasTestFunctions = true;
                }
                // Benchmark functions: BenchmarkXxx
                if (nameNode && /^Benchmark[A-Z]/.test(nameNode.text)) {
                    hasBenchmarks = true;
                }
                // Example functions: ExampleXxx
                if (nameNode && /^Example[A-Z]?/.test(nameNode.text)) {
                    hasExamples = true;
                }
            }

            // Check for comments with go:embed or go:generate (handled above via content check)
            if (node.type === 'comment') {
                // Directives are tracked via content.includes() for reliability
            }
        });

        // Also check content for directives
        void _hasGoEmbed; // Tracked for potential future use
        void _hasGoGenerate; // Tracked for potential future use

        // Check for web frameworks in imports
        // Standard web frameworks
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
        }
        // Additional frameworks
        else if (content.includes('github.com/beego/beego')) {
            framework = 'beego';
        } else if (content.includes('github.com/revel/revel')) {
            framework = 'revel';
        } else if (content.includes('github.com/kataras/iris')) {
            framework = 'iris';
        } else if (content.includes('github.com/valyala/fasthttp')) {
            framework = 'fasthttp';
        } else if (content.includes('github.com/julienschmidt/httprouter')) {
            framework = 'httprouter';
        }
        // Microservice frameworks
        else if (content.includes('github.com/go-kit/kit')) {
            framework = 'go-kit';
        } else if (content.includes('github.com/go-micro/go-micro') || content.includes('go-micro.dev/v4')) {
            framework = 'go-micro';
        } else if (content.includes('github.com/go-kratos/kratos')) {
            framework = 'kratos';
        } else if (content.includes('github.com/gobuffalo/buffalo')) {
            framework = 'buffalo';
        }
        // GraphQL
        else if (content.includes('github.com/99designs/gqlgen')) {
            framework = 'gqlgen';
        } else if (content.includes('github.com/graphql-go/graphql')) {
            framework = 'graphql-go';
        }
        // AWS Lambda
        else if (content.includes('github.com/aws/aws-lambda-go')) {
            framework = 'lambda';
        }
        // CLI frameworks
        else if (content.includes('github.com/spf13/cobra')) {
            framework = 'cobra';
        } else if (content.includes('github.com/urfave/cli')) {
            framework = 'urfave-cli';
        } else if (content.includes('github.com/alecthomas/kong')) {
            framework = 'kong';
        } else if (content.includes('github.com/jessevdk/go-flags')) {
            framework = 'go-flags';
        }
        // Message queues / workers
        else if (content.includes('github.com/hibiken/asynq')) {
            framework = 'asynq';
        } else if (content.includes('github.com/RichardKnop/machinery')) {
            framework = 'machinery';
        } else if (content.includes('github.com/nsqio/go-nsq')) {
            framework = 'nsq';
        } else if (content.includes('github.com/nats-io/nats.go')) {
            framework = 'nats';
        } else if (content.includes('github.com/segmentio/kafka-go') || content.includes('github.com/Shopify/sarama')) {
            framework = 'kafka';
        }
        // Database migrations
        else if (content.includes('github.com/golang-migrate/migrate')) {
            framework = 'migrate';
        } else if (content.includes('github.com/pressly/goose')) {
            framework = 'goose';
        }

        // Test files - check for benchmarks and examples too
        if (isTestFile) {
            if (hasBenchmarks) {
                return this.createEntrypointNode(filePath, 'test', 'go-benchmark');
            }
            if (hasExamples) {
                return this.createEntrypointNode(filePath, 'test', 'go-example');
            }
            if (hasTestFunctions) {
                return this.createEntrypointNode(filePath, 'test', 'go-test');
            }
            // Generic test file
            return this.createEntrypointNode(filePath, 'test', 'go-test');
        }

        // Main package with main function
        if (isMainPackage && hasMain) {
            // CLI frameworks
            if (framework === 'cobra' || framework === 'urfave-cli' || framework === 'kong' || framework === 'go-flags') {
                return this.createEntrypointNode(filePath, 'command', framework);
            }
            // Lambda
            if (framework === 'lambda') {
                return this.createEntrypointNode(filePath, 'api', 'lambda');
            }
            // Web frameworks
            if (framework) {
                return this.createEntrypointNode(filePath, 'api', framework);
            }
            return this.createEntrypointNode(filePath, 'main');
        }

        // Route handlers (even without main)
        if (framework && ['gin', 'echo', 'fiber', 'chi', 'gorilla', 'grpc', 'beego', 'revel', 'iris', 
                          'fasthttp', 'httprouter', 'go-kit', 'go-micro', 'kratos', 'buffalo',
                          'gqlgen', 'graphql-go'].includes(framework)) {
            return this.createEntrypointNode(filePath, 'api', framework);
        }

        // Worker/job handlers
        if (framework && ['asynq', 'machinery', 'nsq', 'nats', 'kafka'].includes(framework)) {
            return this.createEntrypointNode(filePath, 'job', framework);
        }

        // Migration files
        if (framework && ['migrate', 'goose'].includes(framework)) {
            return this.createEntrypointNode(filePath, 'job', framework);
        }

        // Files with init() function (package initialization)
        if (hasInit && !isMainPackage) {
            // Could be important initialization code
            return null; // Don't mark as entrypoint, but could be tracked differently
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
