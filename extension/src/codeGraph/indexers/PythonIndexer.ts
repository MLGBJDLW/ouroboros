/**
 * Python Indexer
 * Parses Python files using tree-sitter for imports, exports, and entrypoints
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
const STDLIB_MODULES = new Set([
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
    'turtle', 'turtledemo', 'types', 'typing', 'unicodedata', 'unittest', 'urllib',
    'uu', 'uuid', 'venv', 'warnings', 'wave', 'weakref', 'webbrowser', 'winreg',
    'winsound', 'wsgiref', 'xdrlib', 'xml', 'xmlrpc', 'zipapp', 'zipfile',
    'zipimport', 'zlib', '_thread',
]);

// Common third-party packages (skip these as external)
const COMMON_PACKAGES = new Set([
    'numpy', 'pandas', 'scipy', 'matplotlib', 'seaborn', 'sklearn', 'tensorflow',
    'torch', 'keras', 'flask', 'django', 'fastapi', 'starlette', 'uvicorn',
    'requests', 'httpx', 'aiohttp', 'beautifulsoup4', 'bs4', 'lxml', 'selenium',
    'pytest', 'unittest', 'nose', 'coverage', 'tox', 'black', 'flake8', 'mypy',
    'pylint', 'isort', 'autopep8', 'yapf', 'click', 'typer', 'fire',
    'pydantic', 'attrs', 'marshmallow', 'cerberus', 'sqlalchemy',
    'alembic', 'peewee', 'tortoise', 'motor', 'pymongo', 'redis', 'celery',
    'rq', 'dramatiq', 'boto3', 'botocore', 'google', 'azure', 'aws_cdk',
    'PIL', 'pillow', 'cv2', 'opencv', 'imageio', 'skimage', 'transformers',
    'huggingface', 'openai', 'anthropic', 'langchain', 'llama_index',
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

        const exports = this.extractExports(rootNode);
        if (fileNode.meta) fileNode.meta.exports = exports;
        nodes.push(fileNode);

        const entrypoint = this.detectEntrypoint(rootNode, content, filePath);
        if (entrypoint) nodes.push(entrypoint);

        return { nodes, edges };
    }

    private extractImports(rootNode: ParsedNode, fromFile: string): GraphEdge[] {
        const edges: GraphEdge[] = [];
        const seen = new Set<string>();

        this.walkTree(rootNode, (node) => {
            if (node.type === 'import_statement') {
                const nameNode = this.findChild(node, 'dotted_name');
                if (nameNode && !seen.has(nameNode.text)) {
                    seen.add(nameNode.text);
                    const edge = this.createPythonImportEdge(fromFile, nameNode.text, nameNode.startPosition.row + 1, 'high');
                    if (edge) edges.push(edge);
                }
            }

            if (node.type === 'import_from_statement') {
                const moduleNode = this.findChild(node, 'dotted_name') || this.findChild(node, 'relative_import');
                if (moduleNode && !seen.has(moduleNode.text)) {
                    seen.add(moduleNode.text);
                    const confidence: Confidence = moduleNode.text.startsWith('.') ? 'high' : 'medium';
                    const edge = this.createPythonImportEdge(fromFile, moduleNode.text, moduleNode.startPosition.row + 1, confidence);
                    if (edge) edges.push(edge);
                }
            }
        });

        return edges;
    }

    private extractExports(rootNode: ParsedNode): string[] {
        const exports: string[] = [];
        const seen = new Set<string>();

        // Check __all__ first
        this.walkTree(rootNode, (node) => {
            if (node.type === 'assignment') {
                const leftNode = node.namedChildren[0];
                if (leftNode?.text === '__all__') {
                    const listNode = this.findChild(node, 'list');
                    if (listNode) {
                        for (const child of listNode.namedChildren) {
                            if (child.type === 'string') {
                                const name = child.text.replace(/^['"]|['"]$/g, '');
                                if (!seen.has(name)) { seen.add(name); exports.push(name); }
                            }
                        }
                    }
                }
            }
        });

        if (exports.length > 0) return exports;

        // Collect public symbols
        this.walkTree(rootNode, (node) => {
            if (node.type === 'function_definition' || node.type === 'class_definition') {
                const nameNode = this.findChild(node, 'identifier');
                if (nameNode && !nameNode.text.startsWith('_') && !seen.has(nameNode.text)) {
                    seen.add(nameNode.text);
                    exports.push(nameNode.text);
                }
            }
        });

        return exports;
    }

    private detectEntrypoint(rootNode: ParsedNode, content: string, filePath: string): GraphNode | null {
        let hasMainBlock = false;
        let framework: string | null = null;
        let entrypointType: EntrypointType = 'main';

        this.walkTree(rootNode, (node) => {
            if (node.type === 'if_statement') {
                const condition = node.namedChildren[0];
                if (condition?.text.includes('__name__') && condition?.text.includes('__main__')) {
                    hasMainBlock = true;
                }
            }

            if (node.type === 'decorated_definition') {
                const decorator = this.findChild(node, 'decorator');
                if (decorator) {
                    const text = decorator.text;
                    if (text.includes('@click.command') || text.includes('@click.group')) { framework = 'click'; entrypointType = 'command'; }
                    if (text.includes('@app.command') || text.includes('@typer.')) { framework = 'typer'; entrypointType = 'command'; }
                    if (text.match(/@(app|router)\.(get|post|put|delete|patch)/i)) { framework = framework || 'fastapi'; entrypointType = 'api'; }
                    if (text.includes('@app.route') || text.includes('@blueprint.route')) { framework = 'flask'; entrypointType = 'route'; }
                    if (text.includes('@api_view') || text.includes('@action')) { framework = 'django'; entrypointType = 'api'; }
                    if (text.includes('@app.task') || text.includes('@celery.task') || text.includes('@shared_task')) { framework = 'celery'; entrypointType = 'job'; }
                }
            }
        });

        // Test files
        if (filePath.includes('test_') || filePath.includes('_test.py') || filePath.includes('/tests/')) {
            if (content.includes('def test_') || content.includes('class Test')) {
                return {
                    id: `entrypoint:test:${filePath}`,
                    kind: 'entrypoint',
                    name: `Test: ${this.getFileName(filePath)}`,
                    path: filePath,
                    meta: { entrypointType: 'test', framework: content.includes('pytest') ? 'pytest' : 'unittest', language: 'python' },
                };
            }
        }

        if (hasMainBlock || framework) {
            const typeLabels: Record<string, string> = { main: 'Main', command: 'CLI', api: 'API', route: 'Route', job: 'Task' };
            return {
                id: `entrypoint:${entrypointType}:${filePath}`,
                kind: 'entrypoint',
                name: `${typeLabels[entrypointType] || entrypointType}: ${this.getFileName(filePath)}`,
                path: filePath,
                meta: { entrypointType, framework, language: 'python' },
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
        if (STDLIB_MODULES.has(topModule) || COMMON_PACKAGES.has(topModule)) return null;
        if (!modulePath.includes('.')) return null;

        return modulePath.split('.').join('/') + '.py';
    }

    private fallbackParse(filePath: string, content: string): IndexResult {
        const nodes: GraphNode[] = [];
        const edges: GraphEdge[] = [];
        const lines = content.split('\n');
        const seen = new Set<string>();

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('#')) continue;

            const importMatch = line.match(/^import\s+([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)/);
            if (importMatch && !seen.has(importMatch[1])) {
                seen.add(importMatch[1]);
                const edge = this.createPythonImportEdge(filePath, importMatch[1], i + 1, 'low');
                if (edge) edges.push(edge);
            }

            const fromMatch = line.match(/^from\s+([a-zA-Z_.][a-zA-Z0-9_.]*)\s+import/);
            if (fromMatch && !seen.has(fromMatch[1])) {
                seen.add(fromMatch[1]);
                const edge = this.createPythonImportEdge(filePath, fromMatch[1], i + 1, 'low');
                if (edge) edges.push(edge);
            }
        }

        nodes.push({
            id: `file:${filePath}`,
            kind: 'file',
            name: this.getFileName(filePath),
            path: filePath,
            meta: { language: 'python', exports: [], confidence: 'low' },
        });

        if (content.includes('if __name__') && content.includes('__main__')) {
            nodes.push({
                id: `entrypoint:main:${filePath}`,
                kind: 'entrypoint',
                name: `Main: ${this.getFileName(filePath)}`,
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
