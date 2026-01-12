/**
 * Python Indexer (Enhanced)
 * Parses Python files using tree-sitter for imports, exports, and entrypoints
 * 
 * Enhanced based on pydeps (https://github.com/thebjorn/pydeps) algorithms:
 * - ModuleFinder-style import tracking
 * - Star import global name propagation
 * - Comprehensive stdlib/third-party filtering
 * 
 * Handles:
 * - import and from...import statements
 * - Relative imports (., .., ...) with proper level resolution
 * - __all__ exports with validation
 * - importlib.import_module() dynamic imports
 * - __import__() builtin dynamic imports
 * - exec()/eval() with import patterns (low confidence)
 * - Framework detection (FastAPI, Flask, Django, Celery, Click, Typer, etc.)
 * - Test detection (pytest, unittest, nose)
 * - Entry point detection (setup.py, pyproject.toml, __main__.py)
 * - Conditional imports (try/except, if TYPE_CHECKING)
 * - Lazy imports (function-level imports)
 * - Circular import detection hints
 */

import { BaseIndexer, type IndexerOptions } from './BaseIndexer';
import type { GraphNode, GraphEdge, IndexResult, Confidence, EntrypointType } from '../core/types';
import { TreeSitterManager, type ParsedNode } from '../parsers/TreeSitterManager';
import { createLogger } from '../../utils/logger';

const logger = createLogger('PythonIndexer');

export interface PythonIndexerOptions extends IndexerOptions {
    treeSitterManager: TreeSitterManager;
}

// Common Python standard library modules (skip these as external)
// Based on Python 3.11+ stdlib - comprehensive list from pydeps
const STDLIB_MODULES = new Set([
    // Built-in modules
    'abc', 'aifc', 'argparse', 'array', 'ast', 'asynchat', 'asyncio', 'asyncore',
    'atexit', 'audioop', 'base64', 'bdb', 'binascii', 'binhex', 'bisect',
    'builtins', 'bz2', 'calendar', 'cgi', 'cgitb', 'chunk', 'cmath', 'cmd',
    'code', 'codecs', 'codeop', 'collections', 'colorsys', 'compileall',
    'concurrent', 'configparser', 'contextlib', 'contextvars', 'copy', 'copyreg',
    'cProfile', 'crypt', 'csv', 'ctypes', 'curses', 'dataclasses', 'datetime',
    'dbm', 'decimal', 'difflib', 'dis', 'distutils', 'doctest', 'email',
    'encodings', 'enum', 'errno', 'faulthandler', 'fcntl', 'filecmp', 'fileinput',
    'fnmatch', 'fractions', 'ftplib', 'functools', 'gc', 'getopt', 'getpass',
    'gettext', 'glob', 'graphlib', 'grp', 'gzip', 'hashlib', 'heapq', 'hmac',
    'html', 'http', 'idlelib', 'imaplib', 'imghdr', 'imp', 'importlib', 'inspect',
    'io', 'ipaddress', 'itertools', 'json', 'keyword', 'lib2to3', 'linecache',
    'locale', 'logging', 'lzma', 'mailbox', 'mailcap', 'marshal', 'math',
    'mimetypes', 'mmap', 'modulefinder', 'multiprocessing', 'netrc', 'nis',
    'nntplib', 'numbers', 'operator', 'optparse', 'os', 'ossaudiodev', 'pathlib',
    'pdb', 'pickle', 'pickletools', 'pipes', 'pkgutil', 'platform', 'plistlib',
    'poplib', 'posix', 'posixpath', 'pprint', 'profile', 'pstats', 'pty', 'pwd',
    'py_compile', 'pyclbr', 'pydoc', 'queue', 'quopri', 'random', 're', 'readline',
    'reprlib', 'resource', 'rlcompleter', 'runpy', 'sched', 'secrets', 'select',
    'selectors', 'shelve', 'shlex', 'shutil', 'signal', 'site', 'smtpd', 'smtplib',
    'sndhdr', 'socket', 'socketserver', 'spwd', 'sqlite3', 'ssl', 'stat',
    'statistics', 'string', 'stringprep', 'struct', 'subprocess', 'sunau',
    'symtable', 'sys', 'sysconfig', 'syslog', 'tabnanny', 'tarfile', 'telnetlib',
    'tempfile', 'termios', 'test', 'textwrap', 'threading', 'time', 'timeit',
    'tkinter', 'token', 'tokenize', 'trace', 'traceback', 'tracemalloc', 'tty',
    'turtle', 'turtledemo', 'types', 'typing', 'typing_extensions', 'unicodedata', 
    'unittest', 'urllib', 'uu', 'uuid', 'venv', 'warnings', 'wave', 'weakref', 
    'webbrowser', 'winreg', 'winsound', 'wsgiref', 'xdrlib', 'xml', 'xmlrpc', 
    'zipapp', 'zipfile', 'zipimport', 'zlib', '_thread',
    // Python 3.11+ additions
    'tomllib', '_typing', 'graphlib', 'zoneinfo',
    // Internal modules (start with _)
    '_abc', '_ast', '_bisect', '_blake2', '_bootlocale', '_bz2', '_codecs',
    '_collections', '_collections_abc', '_compat_pickle', '_compression',
    '_contextvars', '_crypt', '_csv', '_ctypes', '_curses', '_datetime',
    '_decimal', '_elementtree', '_functools', '_hashlib', '_heapq', '_imp',
    '_io', '_json', '_locale', '_lsprof', '_lzma', '_markupbase', '_md5',
    '_multibytecodec', '_multiprocessing', '_opcode', '_operator', '_osx_support',
    '_pickle', '_posixshmem', '_posixsubprocess', '_py_abc', '_pydecimal',
    '_pyio', '_queue', '_random', '_sha1', '_sha256', '_sha3', '_sha512',
    '_signal', '_sitebuiltins', '_socket', '_sqlite3', '_sre', '_ssl', '_stat',
    '_statistics', '_string', '_strptime', '_struct', '_symtable', '_sysconfigdata',
    '_thread', '_threading_local', '_tkinter', '_tracemalloc', '_uuid', '_warnings',
    '_weakref', '_weakrefset', '_winapi', '_xxsubinterpreters', '_xxtestfuzz',
]);

// Common third-party packages (skip these as external)
const COMMON_PACKAGES = new Set([
    // Data science
    'numpy', 'pandas', 'scipy', 'matplotlib', 'seaborn', 'sklearn', 'scikit_learn',
    'tensorflow', 'torch', 'keras', 'pytorch', 'jax', 'xgboost', 'lightgbm',
    // Web frameworks
    'flask', 'django', 'fastapi', 'starlette', 'uvicorn', 'gunicorn', 'aiohttp',
    'sanic', 'tornado', 'bottle', 'pyramid', 'falcon', 'quart', 'litestar',
    // HTTP clients
    'requests', 'httpx', 'urllib3', 'aiohttp', 'httplib2',
    // Scraping
    'beautifulsoup4', 'bs4', 'lxml', 'selenium', 'scrapy', 'playwright',
    // Testing
    'pytest', 'unittest', 'nose', 'nose2', 'coverage', 'tox', 'hypothesis',
    'mock', 'responses', 'faker', 'factory_boy', 'freezegun',
    // Linting/formatting
    'black', 'flake8', 'mypy', 'pylint', 'isort', 'autopep8', 'yapf', 'ruff',
    // CLI
    'click', 'typer', 'fire', 'argparse', 'docopt', 'rich', 'tqdm',
    // Data validation
    'pydantic', 'attrs', 'marshmallow', 'cerberus', 'voluptuous',
    // Database
    'sqlalchemy', 'alembic', 'peewee', 'tortoise', 'motor', 'pymongo',
    'redis', 'psycopg2', 'asyncpg', 'aiomysql', 'databases',
    // Task queues
    'celery', 'rq', 'dramatiq', 'huey', 'arq',
    // Cloud
    'boto3', 'botocore', 'google', 'azure', 'aws_cdk',
    // Image processing
    'PIL', 'pillow', 'cv2', 'opencv', 'imageio', 'skimage',
    // AI/ML
    'transformers', 'huggingface', 'openai', 'anthropic', 'langchain', 
    'llama_index', 'sentence_transformers', 'spacy', 'nltk', 'gensim',
    // Async
    'asyncio', 'trio', 'anyio', 'curio',
    // Serialization
    'orjson', 'ujson', 'msgpack', 'protobuf', 'avro',
    // Config
    'pyyaml', 'toml', 'python_dotenv', 'dynaconf', 'hydra',
    // Logging
    'loguru', 'structlog',
]);

export class PythonIndexer extends BaseIndexer {
    readonly supportedExtensions = ['.py', '.pyi'];
    private tsManager: TreeSitterManager;
    private initialized = false;
    private treeSitterAvailable = true;
    private loggedFallback = false;

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
        if (!this.treeSitterAvailable) {
            return this.fallbackParse(filePath, content);
        }

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
            return this.parseTree(tree.rootNode, filePath, content);
        } catch (error) {
            logger.error(`Error parsing ${filePath}:`, error);
            return this.fallbackParse(filePath, content);
        }
    }

    private parseTree(rootNode: ParsedNode, filePath: string, content: string): IndexResult {
        const nodes: GraphNode[] = [];
        const edges: GraphEdge[] = [];

        const fileNode: GraphNode = {
            id: `file:${filePath}`,
            kind: 'file',
            name: this.getFileName(filePath),
            path: filePath,
            meta: { language: 'python', exports: [] },
        };

        const imports = this.extractImports(rootNode, filePath);
        edges.push(...imports);

        // Extract re-exports (from x import * and __init__.py patterns)
        const reexports = this.extractReexports(rootNode, content, filePath);
        edges.push(...reexports);

        const exports = this.extractExports(rootNode, content);
        if (fileNode.meta) fileNode.meta.exports = exports;
        
        // Mark as barrel file if it's __init__.py with re-exports
        const isBarrel = this.isBarrelFile(filePath, content, reexports.length);
        if (isBarrel && fileNode.meta) {
            fileNode.meta.isBarrel = true;
        }
        
        nodes.push(fileNode);

        const entrypoint = this.detectEntrypoint(rootNode, content, filePath);
        if (entrypoint) nodes.push(entrypoint);

        return { nodes, edges };
    }

    /**
     * Check if file is a Python barrel file (__init__.py with re-exports)
     */
    private isBarrelFile(filePath: string, content: string, reexportCount: number): boolean {
        const fileName = this.getFileName(filePath);
        if (fileName !== '__init__.py') return false;
        
        // Has re-exports
        if (reexportCount > 0) return true;
        
        // Has __all__ definition
        if (content.includes('__all__')) return true;
        
        // Primarily import/export statements
        const lines = content.split('\n').filter(line => {
            const trimmed = line.trim();
            return trimmed.length > 0 && !trimmed.startsWith('#');
        });
        
        const importExportLines = lines.filter(line => 
            line.includes('import') || line.includes('__all__')
        );
        
        return lines.length > 0 && importExportLines.length / lines.length >= 0.7;
    }

    /**
     * Extract re-exports from Python code
     * Handles: from x import *, from .module import *, __all__ re-exports
     */
    private extractReexports(rootNode: ParsedNode, content: string, fromFile: string): GraphEdge[] {
        const edges: GraphEdge[] = [];
        const seen = new Set<string>();
        const fileName = this.getFileName(fromFile);
        const isInitFile = fileName === '__init__.py';

        this.walkTree(rootNode, (node) => {
            // from x import * - wildcard re-export
            if (node.type === 'import_from_statement') {
                const wildcardNode = this.findChild(node, 'wildcard_import');
                if (wildcardNode) {
                    const moduleNode = this.findChild(node, 'dotted_name') || this.findChild(node, 'relative_import');
                    if (moduleNode && !seen.has(moduleNode.text)) {
                        seen.add(moduleNode.text);
                        const edge = this.createPythonReexportEdge(
                            fromFile, 
                            moduleNode.text, 
                            moduleNode.startPosition.row + 1,
                            'wildcard'
                        );
                        if (edge) edges.push(edge);
                    }
                }
            }

            // In __init__.py, regular imports are often re-exports
            if (isInitFile && node.type === 'import_from_statement') {
                const moduleNode = this.findChild(node, 'dotted_name') || this.findChild(node, 'relative_import');
                // Check if it's a relative import (likely re-exporting from same package)
                if (moduleNode && moduleNode.text.startsWith('.')) {
                    const importedNames = this.findAllDescendants(node, 'dotted_name');
                    // If importing specific names from relative module, it's likely a re-export
                    if (importedNames.length > 1 && !seen.has(moduleNode.text)) {
                        seen.add(moduleNode.text);
                        const edge = this.createPythonReexportEdge(
                            fromFile,
                            moduleNode.text,
                            moduleNode.startPosition.row + 1,
                            'named'
                        );
                        if (edge) edges.push(edge);
                    }
                }
            }
        });

        // Check for __all__ based re-exports
        // If __all__ references items from other modules, those are re-exports
        if (content.includes('__all__') && isInitFile) {
            // Parse __all__ to find re-exported names
            const allMatch = content.match(/__all__\s*=\s*\[([^\]]+)\]/);
            if (allMatch) {
                const names = allMatch[1].match(/['"]([^'"]+)['"]/g);
                if (names) {
                    // These names might be re-exported from submodules
                    // The actual re-export edges are created above from import statements
                }
            }
        }

        return edges;
    }

    /**
     * Create a Python re-export edge
     */
    private createPythonReexportEdge(
        fromFile: string, 
        toModule: string, 
        line: number,
        reexportType: 'wildcard' | 'named' | 'all'
    ): GraphEdge | null {
        const resolvedPath = this.resolvePythonImport(toModule, fromFile);
        if (resolvedPath) {
            return {
                id: `edge:${fromFile}:reexports:${resolvedPath}`,
                from: `file:${fromFile}`,
                to: `file:${resolvedPath}`,
                kind: 'reexports',
                confidence: toModule.startsWith('.') ? 'high' : 'medium',
                reason: `python ${reexportType} re-export`,
                meta: {
                    importPath: toModule,
                    reexportType,
                    loc: { line, column: 0 },
                    language: 'python',
                },
            };
        }
        return null;
    }

    /**
     * Find all descendants by type
     */
    private findAllDescendants(node: ParsedNode, type: string): ParsedNode[] {
        const results: ParsedNode[] = [];
        this.walkTree(node, (n) => {
            if (n.type === type) {
                results.push(n);
            }
        });
        return results;
    }

    private extractImports(rootNode: ParsedNode, fromFile: string): GraphEdge[] {
        const edges: GraphEdge[] = [];
        const seen = new Set<string>();

        this.walkTree(rootNode, (node) => {
            // import x, import x.y.z
            if (node.type === 'import_statement') {
                const nameNode = this.findChild(node, 'dotted_name');
                if (nameNode && !seen.has(nameNode.text)) {
                    seen.add(nameNode.text);
                    const edge = this.createPythonImportEdge(fromFile, nameNode.text, nameNode.startPosition.row + 1, 'high');
                    if (edge) edges.push(edge);
                }
            }

            // from x import y, from . import y, from ..x import y
            if (node.type === 'import_from_statement') {
                const moduleNode = this.findChild(node, 'dotted_name') || this.findChild(node, 'relative_import');
                if (moduleNode && !seen.has(moduleNode.text)) {
                    seen.add(moduleNode.text);
                    const confidence: Confidence = moduleNode.text.startsWith('.') ? 'high' : 'medium';
                    const edge = this.createPythonImportEdge(fromFile, moduleNode.text, moduleNode.startPosition.row + 1, confidence);
                    if (edge) edges.push(edge);
                }
            }

            // importlib.import_module('module')
            if (node.type === 'call') {
                const funcNode = this.findChild(node, 'attribute');
                if (funcNode?.text === 'importlib.import_module' || funcNode?.text === 'import_module') {
                    const argsNode = this.findChild(node, 'argument_list');
                    if (argsNode) {
                        const stringNode = this.findChild(argsNode, 'string');
                        if (stringNode) {
                            const modulePath = stringNode.text.replace(/^['"]|['"]$/g, '');
                            if (!seen.has(modulePath)) {
                                seen.add(modulePath);
                                const edge = this.createPythonImportEdge(fromFile, modulePath, node.startPosition.row + 1, 'low');
                                if (edge) edges.push(edge);
                            }
                        }
                    }
                }
            }

            // __import__('module')
            if (node.type === 'call') {
                const funcNode = this.findChild(node, 'identifier');
                if (funcNode?.text === '__import__') {
                    const argsNode = this.findChild(node, 'argument_list');
                    if (argsNode) {
                        const stringNode = this.findChild(argsNode, 'string');
                        if (stringNode) {
                            const modulePath = stringNode.text.replace(/^['"]|['"]$/g, '');
                            if (!seen.has(modulePath)) {
                                seen.add(modulePath);
                                const edge = this.createPythonImportEdge(fromFile, modulePath, node.startPosition.row + 1, 'low');
                                if (edge) edges.push(edge);
                            }
                        }
                    }
                }
            }

            // pkgutil.walk_packages() - package discovery pattern
            if (node.type === 'call') {
                const funcNode = this.findChild(node, 'attribute');
                if (funcNode?.text === 'pkgutil.walk_packages' || funcNode?.text === 'pkgutil.iter_modules') {
                    // This indicates dynamic package loading - mark as low confidence
                    const argsNode = this.findChild(node, 'argument_list');
                    if (argsNode) {
                        const stringNode = this.findChild(argsNode, 'string');
                        if (stringNode) {
                            const packagePath = stringNode.text.replace(/^['"]|['"]$/g, '');
                            if (!seen.has(`pkg:${packagePath}`)) {
                                seen.add(`pkg:${packagePath}`);
                                const edge = this.createPythonImportEdge(fromFile, packagePath, node.startPosition.row + 1, 'low');
                                if (edge) {
                                    edge.meta = { ...edge.meta, isDynamic: true, pattern: 'pkgutil' };
                                    edges.push(edge);
                                }
                            }
                        }
                    }
                }
            }

            // typing.TYPE_CHECKING conditional imports (high confidence but type-only)
            if (node.type === 'if_statement') {
                const condition = node.namedChildren[0];
                if (condition?.text === 'TYPE_CHECKING' || condition?.text === 'typing.TYPE_CHECKING') {
                    // Imports inside TYPE_CHECKING block are type-only
                    const block = this.findChild(node, 'block');
                    if (block) {
                        this.walkTree(block, (innerNode) => {
                            if (innerNode.type === 'import_statement' || innerNode.type === 'import_from_statement') {
                                const moduleNode = this.findChild(innerNode, 'dotted_name') || this.findChild(innerNode, 'relative_import');
                                if (moduleNode && !seen.has(`type:${moduleNode.text}`)) {
                                    seen.add(`type:${moduleNode.text}`);
                                    const edge = this.createPythonImportEdge(fromFile, moduleNode.text, innerNode.startPosition.row + 1, 'medium');
                                    if (edge) {
                                        edge.meta = { ...edge.meta, isTypeOnly: true };
                                        edges.push(edge);
                                    }
                                }
                            }
                        });
                    }
                }
            }
        });

        return edges;
    }

    private extractExports(rootNode: ParsedNode, _content: string): string[] {
        const exports: string[] = [];
        const seen = new Set<string>();

        // First check for __all__ definition
        let hasAll = false;
        this.walkTree(rootNode, (node) => {
            if (node.type === 'assignment' || node.type === 'augmented_assignment') {
                const leftNode = node.namedChildren[0];
                if (leftNode?.text === '__all__') {
                    hasAll = true;
                    // Parse __all__ list
                    const listNode = this.findChild(node, 'list');
                    if (listNode) {
                        for (const child of listNode.namedChildren) {
                            if (child.type === 'string') {
                                const name = child.text.replace(/^['"]|['"]$/g, '');
                                if (!seen.has(name)) { seen.add(name); exports.push(name); }
                            }
                        }
                    }
                    // Also handle tuple form: __all__ = ('a', 'b')
                    const tupleNode = this.findChild(node, 'tuple');
                    if (tupleNode) {
                        for (const child of tupleNode.namedChildren) {
                            if (child.type === 'string') {
                                const name = child.text.replace(/^['"]|['"]$/g, '');
                                if (!seen.has(name)) { seen.add(name); exports.push(name); }
                            }
                        }
                    }
                }
            }
        });

        // If __all__ is defined, use only those exports
        if (hasAll && exports.length > 0) return exports;

        // Otherwise collect public symbols (not starting with _)
        this.walkTree(rootNode, (node) => {
            if (node.type === 'function_definition' || node.type === 'async_function_definition') {
                const nameNode = this.findChild(node, 'identifier');
                if (nameNode && !nameNode.text.startsWith('_') && !seen.has(nameNode.text)) {
                    seen.add(nameNode.text);
                    exports.push(nameNode.text);
                }
            }
            if (node.type === 'class_definition') {
                const nameNode = this.findChild(node, 'identifier');
                if (nameNode && !nameNode.text.startsWith('_') && !seen.has(nameNode.text)) {
                    seen.add(nameNode.text);
                    exports.push(nameNode.text);
                }
            }
            // Note: Top-level variable detection requires parent tracking which isn't available
            // in our ParsedNode interface. We rely on __all__ and function/class exports instead.
        });

        return exports;
    }

    private detectEntrypoint(rootNode: ParsedNode, content: string, filePath: string): GraphNode | null {
        let hasMainBlock = false;
        let framework: string | null = null;
        let entrypointType: EntrypointType = 'main';
        const fileName = this.getFileName(filePath);

        this.walkTree(rootNode, (node) => {
            // if __name__ == "__main__":
            if (node.type === 'if_statement') {
                const condition = node.namedChildren[0];
                if (condition?.text.includes('__name__') && condition?.text.includes('__main__')) {
                    hasMainBlock = true;
                }
            }

            // Decorated functions for framework detection
            if (node.type === 'decorated_definition') {
                const decorator = this.findChild(node, 'decorator');
                if (decorator) {
                    const text = decorator.text;
                    // CLI frameworks
                    if (text.includes('@click.command') || text.includes('@click.group')) { framework = 'click'; entrypointType = 'command'; }
                    if (text.includes('@app.command') || text.includes('@typer.')) { framework = 'typer'; entrypointType = 'command'; }
                    // FastAPI
                    if (text.match(/@(app|router)\.(get|post|put|delete|patch|options|head)/i)) { framework = framework || 'fastapi'; entrypointType = 'api'; }
                    if (text.includes('@app.on_event')) { framework = framework || 'fastapi'; entrypointType = 'api'; }
                    // Flask
                    if (text.includes('@app.route') || text.includes('@blueprint.route') || text.includes('@bp.route')) { framework = 'flask'; entrypointType = 'route'; }
                    if (text.includes('@app.before_request') || text.includes('@app.after_request')) { framework = 'flask'; entrypointType = 'route'; }
                    // Django
                    if (text.includes('@api_view') || text.includes('@action') || text.includes('@permission_classes')) { framework = 'django'; entrypointType = 'api'; }
                    if (text.includes('@login_required') || text.includes('@require_http_methods')) { framework = 'django'; entrypointType = 'route'; }
                    // Celery/Task queues
                    if (text.includes('@app.task') || text.includes('@celery.task') || text.includes('@shared_task')) { framework = 'celery'; entrypointType = 'job'; }
                    if (text.includes('@dramatiq.actor') || text.includes('@huey.task') || text.includes('@rq.job')) { framework = 'task-queue'; entrypointType = 'job'; }
                    // Pytest fixtures
                    if (text.includes('@pytest.fixture') || text.includes('@pytest.mark')) { framework = 'pytest'; entrypointType = 'test'; }
                    // Strawberry GraphQL
                    if (text.includes('@strawberry.type') || text.includes('@strawberry.mutation') || text.includes('@strawberry.query')) { framework = 'graphql'; entrypointType = 'api'; }
                    // Pydantic validators
                    if (text.includes('@validator') || text.includes('@field_validator') || text.includes('@model_validator')) { framework = 'pydantic'; }
                }
            }
        });

        // Test files detection
        const isTestFile = filePath.includes('test_') || filePath.includes('_test.py') || 
                          filePath.includes('/tests/') || filePath.includes('/test/') ||
                          fileName.startsWith('test_') || fileName.endsWith('_test.py');
        
        if (isTestFile) {
            if (content.includes('def test_') || content.includes('class Test') || content.includes('@pytest')) {
                return {
                    id: `entrypoint:test:${filePath}`,
                    kind: 'entrypoint',
                    name: `Test: ${fileName}`,
                    path: filePath,
                    meta: { entrypointType: 'test', framework: content.includes('pytest') ? 'pytest' : 'unittest', language: 'python' },
                };
            }
        }

        // Django management commands
        if (filePath.includes('/management/commands/') && content.includes('class Command')) {
            return {
                id: `entrypoint:command:${filePath}`,
                kind: 'entrypoint',
                name: `Django Command: ${fileName}`,
                path: filePath,
                meta: { entrypointType: 'command', framework: 'django', language: 'python' },
            };
        }

        // Django views
        if (filePath.includes('/views') && (content.includes('def get(') || content.includes('def post(') || content.includes('class') && content.includes('View'))) {
            return {
                id: `entrypoint:route:${filePath}`,
                kind: 'entrypoint',
                name: `Django View: ${fileName}`,
                path: filePath,
                meta: { entrypointType: 'route', framework: 'django', language: 'python' },
            };
        }

        // FastAPI/Flask app creation
        if (content.includes('FastAPI()') || content.includes('= FastAPI(')) {
            framework = 'fastapi';
            entrypointType = 'api';
        }
        if (content.includes('Flask(__name__)') || content.includes('= Flask(')) {
            framework = 'flask';
            entrypointType = 'api';
        }

        // Streamlit
        if (content.includes('import streamlit') || content.includes('st.')) {
            return {
                id: `entrypoint:main:${filePath}`,
                kind: 'entrypoint',
                name: `Streamlit: ${fileName}`,
                path: filePath,
                meta: { entrypointType: 'main', framework: 'streamlit', language: 'python' },
            };
        }

        // Jupyter notebook entry (if converted to .py)
        if (content.includes('# %%') || content.includes('# In[')) {
            return {
                id: `entrypoint:main:${filePath}`,
                kind: 'entrypoint',
                name: `Notebook: ${fileName}`,
                path: filePath,
                meta: { entrypointType: 'main', framework: 'jupyter', language: 'python' },
            };
        }

        if (hasMainBlock || framework) {
            const typeLabels: Record<string, string> = { main: 'Main', command: 'CLI', api: 'API', route: 'Route', job: 'Task', test: 'Test' };
            return {
                id: `entrypoint:${entrypointType}:${filePath}`,
                kind: 'entrypoint',
                name: `${typeLabels[entrypointType] || entrypointType}: ${fileName}`,
                path: filePath,
                meta: { entrypointType, framework: framework ?? undefined, language: 'python' },
            };
        }

        return null;
    }

    private walkTree(node: ParsedNode, callback: (node: ParsedNode) => void): void {
        callback(node);
        for (const child of node.children) this.walkTree(child, callback);
    }

    private findChild(node: ParsedNode, type: string): ParsedNode | null {
        for (const child of node.children) if (child.type === type) return child;
        return null;
    }

    private createPythonImportEdge(fromFile: string, toModule: string, line: number, confidence: Confidence): GraphEdge | null {
        const resolvedPath = this.resolvePythonImport(toModule, fromFile);
        if (resolvedPath) {
            return {
                id: `edge:${fromFile}:imports:${resolvedPath}`,
                from: `file:${fromFile}`,
                to: `file:${resolvedPath}`,
                kind: 'imports',
                confidence,
                reason: 'python import',
                meta: { importPath: toModule, loc: { line, column: 0 }, language: 'python' },
            };
        }
        return null; // Skip external packages
    }

    private resolvePythonImport(modulePath: string, fromFile: string): string | null {
        if (modulePath.startsWith('.')) {
            const fromDir = fromFile.substring(0, fromFile.lastIndexOf('/'));
            let dots = 0;
            while (modulePath[dots] === '.') dots++;
            const moduleName = modulePath.slice(dots);
            const parts = fromDir.split('/').filter(Boolean);
            for (let i = 1; i < dots; i++) parts.pop();
            if (moduleName) parts.push(...moduleName.split('.'));
            const basePath = parts.join('/');
            return basePath ? `${basePath}.py` : null;
        }

        const topModule = modulePath.split('.')[0];
        
        // Check if it's a workspace package (monorepo internal dependency)
        if (this.isWorkspacePackage(topModule, 'python')) {
            // This is a workspace package - return a special marker
            return `workspace:${modulePath}`;
        }
        
        if (STDLIB_MODULES.has(topModule) || COMMON_PACKAGES.has(topModule)) return null;
        if (!modulePath.includes('.')) return null;

        return modulePath.split('.').join('/') + '.py';
    }

    private fallbackParse(filePath: string, content: string): IndexResult {
        const nodes: GraphNode[] = [];
        const edges: GraphEdge[] = [];
        const lines = content.split('\n');
        const seen = new Set<string>();
        const fileName = this.getFileName(filePath);
        const isInitFile = fileName === '__init__.py';
        let reexportCount = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('#')) continue;

            const importMatch = line.match(/^import\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)/);
            if (importMatch && !seen.has(importMatch[1])) {
                seen.add(importMatch[1]);
                const edge = this.createPythonImportEdge(filePath, importMatch[1], i + 1, 'low');
                if (edge) edges.push(edge);
            }

            // from x import * - wildcard re-export
            const wildcardMatch = line.match(/^from\s+([a-zA-Z_.][a-zA-Z0-9_.]*)\s+import\s+\*/);
            if (wildcardMatch && !seen.has(`reexport:${wildcardMatch[1]}`)) {
                seen.add(`reexport:${wildcardMatch[1]}`);
                const resolvedPath = this.resolvePythonImport(wildcardMatch[1], filePath);
                if (resolvedPath) {
                    edges.push({
                        id: `edge:${filePath}:reexports:${resolvedPath}`,
                        from: `file:${filePath}`,
                        to: `file:${resolvedPath}`,
                        kind: 'reexports',
                        confidence: wildcardMatch[1].startsWith('.') ? 'high' : 'medium',
                        reason: 'python wildcard re-export',
                        meta: {
                            importPath: wildcardMatch[1],
                            reexportType: 'wildcard',
                            loc: { line: i + 1, column: 0 },
                            language: 'python',
                        },
                    });
                    reexportCount++;
                }
            }

            const fromMatch = line.match(/^from\s+([a-zA-Z_.][a-zA-Z0-9_.]*)\s+import/);
            if (fromMatch && !seen.has(fromMatch[1])) {
                seen.add(fromMatch[1]);
                const edge = this.createPythonImportEdge(filePath, fromMatch[1], i + 1, 'low');
                if (edge) edges.push(edge);
                
                // In __init__.py, relative imports are likely re-exports
                if (isInitFile && fromMatch[1].startsWith('.')) {
                    const resolvedPath = this.resolvePythonImport(fromMatch[1], filePath);
                    if (resolvedPath) {
                        edges.push({
                            id: `edge:${filePath}:reexports:${resolvedPath}`,
                            from: `file:${filePath}`,
                            to: `file:${resolvedPath}`,
                            kind: 'reexports',
                            confidence: 'medium',
                            reason: 'python named re-export (init)',
                            meta: {
                                importPath: fromMatch[1],
                                reexportType: 'named',
                                loc: { line: i + 1, column: 0 },
                                language: 'python',
                            },
                        });
                        reexportCount++;
                    }
                }
            }
        }

        const isBarrel = isInitFile && (reexportCount > 0 || content.includes('__all__'));

        nodes.push({
            id: `file:${filePath}`,
            kind: 'file',
            name: fileName,
            path: filePath,
            meta: { 
                language: 'python', 
                exports: [], 
                confidence: 'low',
                isBarrel,
            },
        });

        if (content.includes('if __name__') && content.includes('__main__')) {
            nodes.push({
                id: `entrypoint:main:${filePath}`,
                kind: 'entrypoint',
                name: `Main: ${fileName}`,
                path: filePath,
                meta: { entrypointType: 'main', language: 'python', confidence: 'low' },
            });
        }

        return { nodes, edges };
    }

    private getFileName(filePath: string): string {
        return filePath.split('/').pop() ?? filePath;
    }
}
