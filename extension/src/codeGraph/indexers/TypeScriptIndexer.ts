/**
 * TypeScript/JavaScript Indexer
 * Parses TS/JS files to extract imports, exports, and symbols
 */

import type { IndexResult, GraphNode, GraphEdge, Confidence, EntrypointType } from '../core/types';
import { BaseIndexer, type IndexerOptions } from './BaseIndexer';

// Improved regex patterns for import detection
// These handle more edge cases while avoiding false positives in comments/strings

// Static imports - handles multiline and various formats
// import x from 'y'
// import { x } from 'y'
// import * as x from 'y'
// import type { x } from 'y'
// import 'y' (side-effect import)
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

// Export patterns
const EXPORT_NAMED_REGEX = /export\s+(?:const|let|var|function|class|interface|type|enum|abstract\s+class)\s+(\w+)/g;
const EXPORT_DEFAULT_REGEX = /export\s+default\s+(?:function\s+|class\s+|abstract\s+class\s+)?(\w+)?/g;
const EXPORT_DESTRUCTURE_REGEX = /export\s+(?:const|let|var)\s+\{([^}]+)\}/g;

// Re-export patterns
const REEXPORT_REGEX = /export\s+(?:\{[\s\S]*?\}|\*(?:\s+as\s+\w+)?)\s+from\s+['"]([^'"]+)['"]/g;
const REEXPORT_DEFAULT_REGEX = /export\s+\{\s*default(?:\s+as\s+\w+)?\s*\}\s+from\s+['"]([^'"]+)['"]/g;

// Framework detection patterns
const FRAMEWORK_PATTERNS: Array<{
    pattern: RegExp;
    framework: string;
    entrypointType: EntrypointType;
}> = [
    // Next.js App Router
    { pattern: /export\s+(?:default\s+)?(?:async\s+)?function\s+(?:Page|Layout|Loading|Error|NotFound)\b/g, framework: 'nextjs', entrypointType: 'page' },
    { pattern: /export\s+(?:const|let|function)\s+(?:generateMetadata|generateStaticParams)\b/g, framework: 'nextjs', entrypointType: 'page' },
    // Next.js Pages Router
    { pattern: /export\s+(?:default\s+)?(?:async\s+)?function\s+(?:getServerSideProps|getStaticProps|getStaticPaths)\b/g, framework: 'nextjs', entrypointType: 'page' },
    // Next.js API Routes (App Router)
    { pattern: /export\s+(?:async\s+)?function\s+(?:GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s*\(/g, framework: 'nextjs', entrypointType: 'api' },
    // Next.js API Routes (Pages Router)
    { pattern: /export\s+default\s+(?:async\s+)?function\s+handler/g, framework: 'nextjs', entrypointType: 'api' },
    // Express/Koa/Fastify routes
    { pattern: /(?:app|router|server)\s*\.\s*(?:get|post|put|delete|patch|use|all)\s*\(/g, framework: 'express', entrypointType: 'route' },
    // NestJS decorators
    { pattern: /@(?:Controller|Get|Post|Put|Delete|Patch|Module|Injectable)\s*\(/g, framework: 'nestjs', entrypointType: 'route' },
    // CLI frameworks
    { pattern: /\.command\s*\(|program\.(?:option|argument|action|parse)|yargs\.|commander\./g, framework: 'cli', entrypointType: 'command' },
    // React components (for component detection)
    { pattern: /export\s+(?:default\s+)?(?:function|const)\s+\w+.*?(?:React\.FC|JSX\.Element|ReactNode)/g, framework: 'react', entrypointType: 'component' },
    // Vue components
    { pattern: /defineComponent\s*\(|<script\s+setup/g, framework: 'vue', entrypointType: 'component' },
    // Test files
    { pattern: /(?:describe|it|test|expect)\s*\(|jest\.|vitest\.|@testing-library/g, framework: 'test', entrypointType: 'test' },
];

export class TypeScriptIndexer extends BaseIndexer {
    constructor(options: IndexerOptions) {
        super(options);
    }

    get extensions(): string[] {
        return ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
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

            nodes.push(fileNode);

            // Create entrypoint node if detected
            if (detection && detection.entrypointType !== 'test' && detection.entrypointType !== 'component') {
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
            const imports = this.extractImports(content, cleanContent);
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

            // Extract re-exports
            const reexports = this.extractReexports(cleanContent);
            for (const reexp of reexports) {
                const resolvedPath = this.normalizeImportPath(reexp.path, filePath);
                if (resolvedPath) {
                    edges.push({
                        id: `edge:${filePath}:reexports:${resolvedPath}`,
                        from: `file:${filePath}`,
                        to: `file:${resolvedPath}`,
                        kind: 'reexports',
                        confidence: 'high',
                        reason: 'static re-export',
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
        return result;
    }

    /**
     * Detect language from file extension
     */
    private detectLanguage(filePath: string): string {
        if (filePath.endsWith('.tsx')) return 'tsx';
        if (filePath.endsWith('.ts')) return 'typescript';
        if (filePath.endsWith('.jsx')) return 'jsx';
        if (filePath.endsWith('.mjs')) return 'esm';
        if (filePath.endsWith('.cjs')) return 'commonjs';
        return 'javascript';
    }

    private extractImports(originalContent: string, cleanContent: string): Array<{
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
                        confidence: 'high',
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
                    confidence: 'high',
                    reason: 'require',
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

        return exports;
    }

    private extractReexports(content: string): Array<{ path: string }> {
        const reexports: Array<{ path: string }> = [];
        const seen = new Set<string>();

        let match: RegExpExecArray | null;
        
        REEXPORT_REGEX.lastIndex = 0;
        while ((match = REEXPORT_REGEX.exec(content)) !== null) {
            if (!seen.has(match[1])) {
                seen.add(match[1]);
                reexports.push({ path: match[1] });
            }
        }

        REEXPORT_DEFAULT_REGEX.lastIndex = 0;
        while ((match = REEXPORT_DEFAULT_REGEX.exec(content)) !== null) {
            if (!seen.has(match[1])) {
                seen.add(match[1]);
                reexports.push({ path: match[1] });
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
        }

        // Next.js Pages Router
        if (filePath.includes('/pages/') && !filePath.includes('node_modules')) {
            if (filePath.includes('/api/')) {
                return { framework: 'nextjs', entrypointType: 'api' };
            }
            if (!filePath.includes('_app') && !filePath.includes('_document')) {
                return { framework: 'nextjs', entrypointType: 'page' };
            }
        }

        // Test files
        if (filePath.match(/\.(test|spec)\.(tsx?|jsx?)$/) || filePath.includes('__tests__')) {
            return { framework: 'test', entrypointType: 'test' };
        }

        // Check content patterns
        for (const { pattern, framework, entrypointType } of FRAMEWORK_PATTERNS) {
            pattern.lastIndex = 0;
            if (pattern.test(content)) {
                return { framework, entrypointType };
            }
        }

        // Check for barrel files (index.ts with only exports)
        if (filePath.match(/index\.(tsx?|jsx?)$/)) {
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
            if (hasOnlyExportsAndImports && content.includes('export')) {
                return { framework: 'barrel', entrypointType: 'barrel' };
            }
        }

        // Main entry files
        if (filePath.match(/(?:^|\/)(?:main|index|app|server)\.(tsx?|jsx?|mjs)$/)) {
            if (content.includes('createServer') || content.includes('listen(')) {
                return { framework: 'server', entrypointType: 'main' };
            }
            if (content.includes('createRoot') || content.includes('ReactDOM')) {
                return { framework: 'react', entrypointType: 'main' };
            }
        }

        return null;
    }

    private getLineNumber(content: string, index: number): number {
        return content.substring(0, index).split('\n').length;
    }
}
