/**
 * TypeScript/JavaScript Indexer
 * Parses TS/JS files to extract imports, exports, and symbols
 * 
 * Handles:
 * - ES6 imports (static, dynamic, side-effect)
 * - CommonJS require()
 * - Re-exports (named, default, barrel)
 * - Vite import.meta.glob()
 * - Webpack require.context()
 * - CSS/SCSS imports
 * - Monorepo workspace imports (@org/package)
 * - Path aliases (@/, ~/, src/)
 * - Framework detection (Next.js, Express, NestJS, Vue, React, Svelte)
 * - Test detection (Jest, Vitest, Mocha, Cypress)
 */

import type { IndexResult, GraphNode, GraphEdge, Confidence, EntrypointType } from '../core/types';
import { BaseIndexer, type IndexerOptions } from './BaseIndexer';

// Improved regex patterns for import detection
const IMPORT_PATTERNS = [
    // Standard imports with from clause
    /import\s+(?:type\s+)?(?:\{[\s\S]*?\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[\s\S]*?\}|\*\s+as\s+\w+|\w+))*\s+from\s+['"]([^'"]+)['"]/g,
    // Side-effect imports: import 'module'
    /import\s+['"]([^'"]+)['"]/g,
];

// Dynamic imports: import('module') or import("module")
const DYNAMIC_IMPORT_REGEX = /import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;

// Require calls: require('module') or require("module")
const REQUIRE_REGEX = /(?:^|[^.\w])require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

// Vite import.meta.glob patterns
const VITE_GLOB_REGEX = /import\.meta\.glob(?:Eager)?\s*\(\s*['"`]([^'"`]+)['"`]/g;

// Webpack require.context
const WEBPACK_CONTEXT_REGEX = /require\.context\s*\(\s*['"]([^'"]+)['"]/g;

// CSS/SCSS imports
const CSS_IMPORT_REGEX = /@import\s+['"]([^'"]+)['"]/g;

// Export patterns
const EXPORT_NAMED_REGEX = /export\s+(?:const|let|var|function|class|interface|type|enum|abstract\s+class)\s+(\w+)/g;
const EXPORT_DEFAULT_REGEX = /export\s+default\s+(?:function\s+|class\s+|abstract\s+class\s+)?(\w+)?/g;
const EXPORT_DESTRUCTURE_REGEX = /export\s+(?:const|let|var)\s+\{([^}]+)\}/g;
const EXPORT_LIST_REGEX = /export\s+\{([^}]+)\}(?!\s+from)/g;

// Re-export patterns
const REEXPORT_REGEX = /export\s+(?:\{[\s\S]*?\}|\*(?:\s+as\s+\w+)?)\s+from\s+['"]([^'"]+)['"]/g;
const REEXPORT_DEFAULT_REGEX = /export\s+\{\s*default(?:\s+as\s+\w+)?\s*\}\s+from\s+['"]([^'"]+)['"]/g;
// Barrel re-export: export * from './module'
const REEXPORT_ALL_REGEX = /export\s+\*\s+from\s+['"]([^'"]+)['"]/g;
// Namespace re-export: export * as ns from './module'
const REEXPORT_NAMESPACE_REGEX = /export\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g;

// Monorepo workspace patterns
const WORKSPACE_PATTERNS = [
    /^@[\w-]+\/[\w-]+/,  // @org/package
    /^@[\w-]+$/,         // @alias
];

// Framework detection patterns
const FRAMEWORK_PATTERNS: Array<{
    pattern: RegExp;
    framework: string;
    entrypointType: EntrypointType;
}> = [
    // Next.js App Router
    { pattern: /export\s+(?:default\s+)?(?:async\s+)?function\s+(?:Page|Layout|Loading|Error|NotFound|Template)\b/g, framework: 'nextjs', entrypointType: 'page' },
    { pattern: /export\s+(?:const|let|function)\s+(?:generateMetadata|generateStaticParams|generateViewport)\b/g, framework: 'nextjs', entrypointType: 'page' },
    { pattern: /export\s+const\s+(?:dynamic|revalidate|runtime|preferredRegion|maxDuration)\s*=/g, framework: 'nextjs', entrypointType: 'page' },
    // Next.js Pages Router
    { pattern: /export\s+(?:default\s+)?(?:async\s+)?function\s+(?:getServerSideProps|getStaticProps|getStaticPaths)\b/g, framework: 'nextjs', entrypointType: 'page' },
    // Next.js API Routes (App Router)
    { pattern: /export\s+(?:async\s+)?function\s+(?:GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s*\(/g, framework: 'nextjs', entrypointType: 'api' },
    // Next.js API Routes (Pages Router)
    { pattern: /export\s+default\s+(?:async\s+)?function\s+handler/g, framework: 'nextjs', entrypointType: 'api' },
    // Next.js Middleware
    { pattern: /export\s+(?:async\s+)?function\s+middleware\s*\(/g, framework: 'nextjs', entrypointType: 'middleware' },
    // Express/Koa/Fastify routes
    { pattern: /(?:app|router|server)\s*\.\s*(?:get|post|put|delete|patch|use|all)\s*\(/g, framework: 'express', entrypointType: 'route' },
    // NestJS decorators
    { pattern: /@(?:Controller|Get|Post|Put|Delete|Patch|Module|Injectable|Guard|Interceptor|Pipe|ExceptionFilter)\s*\(/g, framework: 'nestjs', entrypointType: 'route' },
    // CLI frameworks
    { pattern: /\.command\s*\(|program\.(?:option|argument|action|parse)|yargs\.|commander\./g, framework: 'cli', entrypointType: 'command' },
    // React components
    { pattern: /export\s+(?:default\s+)?(?:function|const)\s+\w+.*?(?:React\.FC|JSX\.Element|ReactNode|ReactElement)/g, framework: 'react', entrypointType: 'component' },
    { pattern: /export\s+default\s+function\s+\w+\s*\([^)]*\)\s*(?::\s*(?:JSX\.Element|React\.))?/g, framework: 'react', entrypointType: 'component' },
    // Vue components
    { pattern: /defineComponent\s*\(|<script\s+setup|export\s+default\s+\{[^}]*(?:setup|render)\s*[:(]/g, framework: 'vue', entrypointType: 'component' },
    // Svelte components
    { pattern: /<script(?:\s+lang="ts")?>|export\s+let\s+\w+/g, framework: 'svelte', entrypointType: 'component' },
    // Test files - multiple frameworks
    { pattern: /(?:describe|it|test|expect)\s*\(|jest\.|vitest\.|@testing-library|cy\.|Cypress\./g, framework: 'test', entrypointType: 'test' },
    // Storybook
    { pattern: /export\s+(?:default|const)\s+(?:meta|default)\s*[=:]\s*\{[^}]*(?:title|component)\s*:/g, framework: 'storybook', entrypointType: 'story' },
    // GraphQL resolvers
    { pattern: /(?:Query|Mutation|Subscription)\s*:\s*\{|@Resolver\s*\(/g, framework: 'graphql', entrypointType: 'api' },
    // tRPC routers
    { pattern: /createTRPCRouter|publicProcedure|protectedProcedure/g, framework: 'trpc', entrypointType: 'api' },
    // Serverless functions
    { pattern: /export\s+(?:const|async\s+function)\s+handler\s*[=:]/g, framework: 'serverless', entrypointType: 'api' },
    // Electron
    { pattern: /(?:ipcMain|ipcRenderer|BrowserWindow|app\.on)/g, framework: 'electron', entrypointType: 'main' },
];

export class TypeScriptIndexer extends BaseIndexer {
    constructor(options: IndexerOptions) {
        super(options);
    }

    get extensions(): string[] {
        return ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts'];
    }

    supports(filePath: string): boolean {
        return this.extensions.some((ext) => filePath.endsWith(ext));
    }

    async indexFile(filePath: string, content: string): Promise<IndexResult> {
        const nodes: GraphNode[] = [];
        const edges: GraphEdge[] = [];
        const errors: Array<{ file: string; message: string; line?: number; recoverable: boolean }> = [];

        try {
            // Remove comments to avoid false positives
            const cleanContent = this.removeComments(content);
            
            // Create file node
            const fileName = filePath.split('/').pop() ?? filePath;
            const fileNode = this.createFileNode(filePath, fileName);

            // Detect language
            const language = this.detectLanguage(filePath);
            fileNode.meta = { ...fileNode.meta, language };

            // Detect framework and entrypoint type
            const detection = this.detectFramework(cleanContent, filePath);
            if (detection) {
                fileNode.meta = {
                    ...fileNode.meta,
                    framework: detection.framework,
                    entrypointType: detection.entrypointType,
                };
            }

            // Extract exports
            const exports = this.extractExports(cleanContent);
            fileNode.meta = { ...fileNode.meta, exports };

            // Check if barrel file
            const isBarrel = this.isBarrelFile(cleanContent, filePath);
            if (isBarrel) {
                fileNode.meta = { ...fileNode.meta, isBarrel: true };
            }

            nodes.push(fileNode);

            // Create entrypoint node if detected
            if (detection && !['test', 'component', 'story'].includes(detection.entrypointType)) {
                nodes.push({
                    id: `entrypoint:${filePath}`,
                    kind: 'entrypoint',
                    name: fileName,
                    path: filePath,
                    meta: {
                        entrypointType: detection.entrypointType,
                        framework: detection.framework,
                    },
                });
            }

            // Extract imports (use original content for line numbers)
            const imports = this.extractImports(content, cleanContent, filePath);
            for (const imp of imports) {
                const resolvedPath = this.normalizeImportPath(imp.path, filePath);
                if (resolvedPath) {
                    edges.push(
                        this.createImportEdge(
                            filePath,
                            resolvedPath,
                            imp.confidence,
                            imp.reason,
                            imp.isDynamic,
                            imp.line
                        )
                    );
                }
            }

            // Extract re-exports with improved handling
            const reexports = this.extractReexports(content, cleanContent, filePath);
            for (const reexp of reexports) {
                const resolvedPath = this.normalizeImportPath(reexp.path, filePath);
                if (resolvedPath) {
                    edges.push({
                        id: `edge:${filePath}:reexports:${resolvedPath}`,
                        from: `file:${filePath}`,
                        to: `file:${resolvedPath}`,
                        kind: 'reexports',
                        confidence: reexp.confidence,
                        reason: reexp.reason,
                        meta: {
                            importPath: reexp.path,
                            reexportType: reexp.type,
                            loc: reexp.line ? { line: reexp.line, column: 0 } : undefined,
                        },
                    });
                }
            }
        } catch (error) {
            errors.push(
                this.createError(
                    filePath,
                    error instanceof Error ? error.message : 'Unknown error',
                    undefined,
                    true
                )
            );
        }

        return { nodes, edges, errors: errors.length > 0 ? errors : undefined };
    }

    /**
     * Remove comments from source code to avoid false positives
     */
    private removeComments(content: string): string {
        // Remove single-line comments
        let result = content.replace(/\/\/.*$/gm, '');
        // Remove multi-line comments
        result = result.replace(/\/\*[\s\S]*?\*\//g, '');
        // Remove template literal comments (basic)
        result = result.replace(/`[^`]*`/g, (match) => '`' + ' '.repeat(match.length - 2) + '`');
        return result;
    }

    /**
     * Detect language from file extension
     */
    private detectLanguage(filePath: string): string {
        if (filePath.endsWith('.tsx')) return 'tsx';
        if (filePath.endsWith('.ts') || filePath.endsWith('.mts') || filePath.endsWith('.cts')) return 'typescript';
        if (filePath.endsWith('.jsx')) return 'jsx';
        if (filePath.endsWith('.mjs')) return 'esm';
        if (filePath.endsWith('.cjs')) return 'commonjs';
        return 'javascript';
    }

    /**
     * Check if file is a barrel file (index with only exports)
     */
    private isBarrelFile(content: string, filePath: string): boolean {
        if (!filePath.match(/index\.(tsx?|jsx?|mjs)$/)) return false;
        
        const lines = content.split('\n');
        const hasOnlyExportsAndImports = lines.every((line) => {
            const trimmed = line.trim();
            return (
                trimmed === '' ||
                trimmed.startsWith('//') ||
                trimmed.startsWith('/*') ||
                trimmed.startsWith('*') ||
                trimmed.startsWith('export') ||
                trimmed.startsWith('import') ||
                trimmed.startsWith("'use") ||
                trimmed.startsWith('"use')
            );
        });
        return hasOnlyExportsAndImports && content.includes('export');
    }

    /**
     * Determine import confidence based on path type
     */
    private getImportConfidence(importPath: string): Confidence {
        // Relative imports are high confidence
        if (importPath.startsWith('.')) return 'high';
        // Workspace/monorepo imports
        if (WORKSPACE_PATTERNS.some(p => p.test(importPath))) return 'medium';
        // Path aliases
        if (importPath.startsWith('@/') || importPath.startsWith('~/') || importPath.startsWith('src/')) return 'high';
        // Node built-ins and external packages
        return 'low';
    }

    private extractImports(originalContent: string, cleanContent: string, _filePath: string): Array<{
        path: string;
        confidence: Confidence;
        reason: string;
        isDynamic: boolean;
        line?: number;
    }> {
        const imports: Array<{
            path: string;
            confidence: Confidence;
            reason: string;
            isDynamic: boolean;
            line?: number;
        }> = [];
        const seenPaths = new Set<string>();

        // Static imports using multiple patterns
        for (const pattern of IMPORT_PATTERNS) {
            pattern.lastIndex = 0;
            let match: RegExpExecArray | null;
            while ((match = pattern.exec(cleanContent)) !== null) {
                const importPath = match[1];
                if (!seenPaths.has(importPath)) {
                    seenPaths.add(importPath);
                    imports.push({
                        path: importPath,
                        confidence: this.getImportConfidence(importPath),
                        reason: 'static import',
                        isDynamic: false,
                        line: this.getLineNumber(originalContent, match.index),
                    });
                }
            }
        }

        // Dynamic imports
        DYNAMIC_IMPORT_REGEX.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = DYNAMIC_IMPORT_REGEX.exec(cleanContent)) !== null) {
            const importPath = match[1];
            if (!seenPaths.has(importPath)) {
                seenPaths.add(importPath);
                imports.push({
                    path: importPath,
                    confidence: 'medium',
                    reason: 'dynamic import',
                    isDynamic: true,
                    line: this.getLineNumber(originalContent, match.index),
                });
            }
        }

        // Require calls
        REQUIRE_REGEX.lastIndex = 0;
        while ((match = REQUIRE_REGEX.exec(cleanContent)) !== null) {
            const importPath = match[1];
            if (!seenPaths.has(importPath)) {
                seenPaths.add(importPath);
                imports.push({
                    path: importPath,
                    confidence: this.getImportConfidence(importPath),
                    reason: 'require',
                    isDynamic: false,
                    line: this.getLineNumber(originalContent, match.index),
                });
            }
        }

        // Vite import.meta.glob
        VITE_GLOB_REGEX.lastIndex = 0;
        while ((match = VITE_GLOB_REGEX.exec(cleanContent)) !== null) {
            const globPattern = match[1];
            // Extract base directory from glob pattern
            const basePath = globPattern.replace(/\/\*.*$/, '').replace(/^\.\/?/, '');
            if (basePath && !seenPaths.has(basePath)) {
                seenPaths.add(basePath);
                imports.push({
                    path: './' + basePath,
                    confidence: 'low',
                    reason: 'vite glob',
                    isDynamic: true,
                    line: this.getLineNumber(originalContent, match.index),
                });
            }
        }

        // Webpack require.context
        WEBPACK_CONTEXT_REGEX.lastIndex = 0;
        while ((match = WEBPACK_CONTEXT_REGEX.exec(cleanContent)) !== null) {
            const contextPath = match[1];
            if (!seenPaths.has(contextPath)) {
                seenPaths.add(contextPath);
                imports.push({
                    path: contextPath,
                    confidence: 'low',
                    reason: 'webpack context',
                    isDynamic: true,
                    line: this.getLineNumber(originalContent, match.index),
                });
            }
        }

        // CSS imports in CSS/SCSS files
        CSS_IMPORT_REGEX.lastIndex = 0;
        while ((match = CSS_IMPORT_REGEX.exec(cleanContent)) !== null) {
            const cssPath = match[1];
            if (!seenPaths.has(cssPath)) {
                seenPaths.add(cssPath);
                imports.push({
                    path: cssPath,
                    confidence: 'medium',
                    reason: 'css import',
                    isDynamic: false,
                    line: this.getLineNumber(originalContent, match.index),
                });
            }
        }

        return imports;
    }

    private extractExports(content: string): string[] {
        const exports: string[] = [];
        const seen = new Set<string>();

        let match: RegExpExecArray | null;
        
        // Named exports
        EXPORT_NAMED_REGEX.lastIndex = 0;
        while ((match = EXPORT_NAMED_REGEX.exec(content)) !== null) {
            if (!seen.has(match[1])) {
                seen.add(match[1]);
                exports.push(match[1]);
            }
        }

        // Default exports
        EXPORT_DEFAULT_REGEX.lastIndex = 0;
        while ((match = EXPORT_DEFAULT_REGEX.exec(content)) !== null) {
            const name = match[1] ?? 'default';
            if (!seen.has(name)) {
                seen.add(name);
                exports.push(name);
            }
        }

        // Destructured exports: export const { a, b } = ...
        EXPORT_DESTRUCTURE_REGEX.lastIndex = 0;
        while ((match = EXPORT_DESTRUCTURE_REGEX.exec(content)) !== null) {
            const names = match[1].split(',').map(n => n.trim().split(':')[0].trim());
            for (const name of names) {
                if (name && !seen.has(name)) {
                    seen.add(name);
                    exports.push(name);
                }
            }
        }

        // Export list: export { a, b, c }
        EXPORT_LIST_REGEX.lastIndex = 0;
        while ((match = EXPORT_LIST_REGEX.exec(content)) !== null) {
            const names = match[1].split(',').map(n => {
                const parts = n.trim().split(/\s+as\s+/);
                return parts[parts.length - 1].trim();
            });
            for (const name of names) {
                if (name && !seen.has(name)) {
                    seen.add(name);
                    exports.push(name);
                }
            }
        }

        return exports;
    }

    private extractReexports(
        originalContent: string,
        cleanContent: string,
        _filePath: string
    ): Array<{
        path: string;
        confidence: Confidence;
        reason: string;
        type: 'all' | 'namespace' | 'named' | 'default';
        line?: number;
    }> {
        const reexports: Array<{
            path: string;
            confidence: Confidence;
            reason: string;
            type: 'all' | 'namespace' | 'named' | 'default';
            line?: number;
        }> = [];
        const seen = new Set<string>();

        let match: RegExpExecArray | null;
        
        // export * from './module' - barrel re-exports (highest priority)
        REEXPORT_ALL_REGEX.lastIndex = 0;
        while ((match = REEXPORT_ALL_REGEX.exec(cleanContent)) !== null) {
            const importPath = match[1];
            if (!seen.has(importPath)) {
                seen.add(importPath);
                reexports.push({
                    path: importPath,
                    confidence: 'high',
                    reason: 'barrel re-export (export *)',
                    type: 'all',
                    line: this.getLineNumber(originalContent, match.index),
                });
            }
        }

        // export * as ns from './module' - namespace re-exports
        REEXPORT_NAMESPACE_REGEX.lastIndex = 0;
        while ((match = REEXPORT_NAMESPACE_REGEX.exec(cleanContent)) !== null) {
            const importPath = match[2];
            if (!seen.has(importPath)) {
                seen.add(importPath);
                reexports.push({
                    path: importPath,
                    confidence: 'high',
                    reason: `namespace re-export (export * as ${match[1]})`,
                    type: 'namespace',
                    line: this.getLineNumber(originalContent, match.index),
                });
            }
        }

        // export { a, b } from './module' - named re-exports
        REEXPORT_REGEX.lastIndex = 0;
        while ((match = REEXPORT_REGEX.exec(cleanContent)) !== null) {
            const importPath = match[1];
            // Skip if already captured by more specific patterns
            if (!seen.has(importPath)) {
                seen.add(importPath);
                reexports.push({
                    path: importPath,
                    confidence: 'high',
                    reason: 'named re-export',
                    type: 'named',
                    line: this.getLineNumber(originalContent, match.index),
                });
            }
        }

        // export { default } from './module' or export { default as X } from './module'
        REEXPORT_DEFAULT_REGEX.lastIndex = 0;
        while ((match = REEXPORT_DEFAULT_REGEX.exec(cleanContent)) !== null) {
            const importPath = match[1];
            if (!seen.has(importPath)) {
                seen.add(importPath);
                reexports.push({
                    path: importPath,
                    confidence: 'high',
                    reason: 'default re-export',
                    type: 'default',
                    line: this.getLineNumber(originalContent, match.index),
                });
            }
        }

        return reexports;
    }

    private detectFramework(
        content: string,
        filePath: string
    ): { framework: string; entrypointType: EntrypointType } | null {
        // Check file path patterns first (more reliable than content)
        
        // Next.js App Router
        if (filePath.includes('/app/') && !filePath.includes('node_modules')) {
            if (filePath.includes('/api/') && filePath.match(/route\.(ts|js)$/)) {
                return { framework: 'nextjs', entrypointType: 'api' };
            }
            if (filePath.match(/page\.(tsx?|jsx?)$/)) {
                return { framework: 'nextjs', entrypointType: 'page' };
            }
            if (filePath.match(/layout\.(tsx?|jsx?)$/)) {
                return { framework: 'nextjs', entrypointType: 'layout' };
            }
            if (filePath.match(/loading\.(tsx?|jsx?)$/)) {
                return { framework: 'nextjs', entrypointType: 'page' };
            }
            if (filePath.match(/error\.(tsx?|jsx?)$/)) {
                return { framework: 'nextjs', entrypointType: 'page' };
            }
            if (filePath.match(/middleware\.(ts|js)$/)) {
                return { framework: 'nextjs', entrypointType: 'middleware' };
            }
        }

        // Next.js Pages Router
        if (filePath.includes('/pages/') && !filePath.includes('node_modules')) {
            if (filePath.includes('/api/')) {
                return { framework: 'nextjs', entrypointType: 'api' };
            }
            if (!filePath.includes('_app') && !filePath.includes('_document') && !filePath.includes('_error')) {
                return { framework: 'nextjs', entrypointType: 'page' };
            }
        }

        // Nuxt pages
        if (filePath.includes('/pages/') && filePath.endsWith('.vue')) {
            return { framework: 'nuxt', entrypointType: 'page' };
        }

        // SvelteKit routes
        if (filePath.includes('/routes/') && filePath.match(/\+(?:page|layout|server|error)\.(svelte|ts|js)$/)) {
            if (filePath.includes('+server')) {
                return { framework: 'sveltekit', entrypointType: 'api' };
            }
            return { framework: 'sveltekit', entrypointType: 'page' };
        }

        // Test files
        if (filePath.match(/\.(test|spec)\.(tsx?|jsx?)$/) || 
            filePath.includes('__tests__') ||
            filePath.includes('.stories.')) {
            if (filePath.includes('.stories.')) {
                return { framework: 'storybook', entrypointType: 'story' };
            }
            return { framework: 'test', entrypointType: 'test' };
        }

        // Cypress tests
        if (filePath.includes('/cypress/') && filePath.match(/\.(cy|spec)\.(tsx?|jsx?)$/)) {
            return { framework: 'cypress', entrypointType: 'test' };
        }

        // Check content patterns
        for (const { pattern, framework, entrypointType } of FRAMEWORK_PATTERNS) {
            pattern.lastIndex = 0;
            if (pattern.test(content)) {
                return { framework, entrypointType };
            }
        }

        // Check for barrel files (index.ts with only exports)
        if (this.isBarrelFile(content, filePath)) {
            return { framework: 'barrel', entrypointType: 'barrel' };
        }

        // Main entry files
        if (filePath.match(/(?:^|\/)(?:main|index|app|server)\.(tsx?|jsx?|mjs)$/)) {
            if (content.includes('createServer') || content.includes('listen(') || content.includes('createApp')) {
                return { framework: 'server', entrypointType: 'main' };
            }
            if (content.includes('createRoot') || content.includes('ReactDOM') || content.includes('hydrateRoot')) {
                return { framework: 'react', entrypointType: 'main' };
            }
            if (content.includes('createApp') && content.includes('vue')) {
                return { framework: 'vue', entrypointType: 'main' };
            }
        }

        return null;
    }

    private getLineNumber(content: string, index: number): number {
        return content.substring(0, index).split('\n').length;
    }
}
