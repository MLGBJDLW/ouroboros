/**
 * TypeScript/JavaScript Indexer
 * Parses TS/JS files to extract imports, exports, and symbols
 */

import type { IndexResult, GraphNode, GraphEdge, Confidence, EntrypointType } from '../core/types';
import { BaseIndexer, type IndexerOptions } from './BaseIndexer';

// Simple regex-based parsing (no AST dependency for MVP)
const IMPORT_REGEX = /import\s+(?:(?:type\s+)?(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT_REGEX = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const REQUIRE_REGEX = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const EXPORT_NAMED_REGEX = /export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/g;
const EXPORT_DEFAULT_REGEX = /export\s+default\s+(?:function\s+)?(\w+)?/g;
const REEXPORT_REGEX = /export\s+(?:\{[^}]*\}|\*)\s+from\s+['"]([^'"]+)['"]/g;

// Framework detection patterns
const FRAMEWORK_PATTERNS: Array<{
    pattern: RegExp;
    framework: string;
    entrypointType: EntrypointType;
}> = [
    // Next.js
    { pattern: /export\s+(?:default\s+)?(?:async\s+)?function\s+(?:getServerSideProps|getStaticProps|getStaticPaths)/g, framework: 'nextjs', entrypointType: 'page' },
    { pattern: /export\s+(?:const|let)\s+(?:GET|POST|PUT|DELETE|PATCH)\s*=/g, framework: 'nextjs', entrypointType: 'api' },
    // Express/Koa/Fastify
    { pattern: /(?:app|router)\s*\.\s*(?:get|post|put|delete|patch|use)\s*\(/g, framework: 'express', entrypointType: 'route' },
    // NestJS
    { pattern: /@(?:Controller|Get|Post|Put|Delete|Patch)\s*\(/g, framework: 'nestjs', entrypointType: 'route' },
    // CLI
    { pattern: /\.command\s*\(|program\.(?:option|argument|action)/g, framework: 'cli', entrypointType: 'command' },
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
            // Create file node
            const fileName = filePath.split('/').pop() ?? filePath;
            const fileNode = this.createFileNode(filePath, fileName);

            // Detect framework and entrypoint type
            const detection = this.detectFramework(content, filePath);
            if (detection) {
                fileNode.meta = {
                    ...fileNode.meta,
                    framework: detection.framework,
                    entrypointType: detection.entrypointType,
                };
            }

            // Extract exports
            const exports = this.extractExports(content);
            fileNode.meta = { ...fileNode.meta, exports };

            nodes.push(fileNode);

            // Create entrypoint node if detected
            if (detection) {
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

            // Extract imports
            const imports = this.extractImports(content);
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
            const reexports = this.extractReexports(content);
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

    private extractImports(content: string): Array<{
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

        // Static imports
        let match: RegExpExecArray | null;
        while ((match = IMPORT_REGEX.exec(content)) !== null) {
            imports.push({
                path: match[1],
                confidence: 'high',
                reason: 'static import',
                isDynamic: false,
                line: this.getLineNumber(content, match.index),
            });
        }

        // Dynamic imports
        while ((match = DYNAMIC_IMPORT_REGEX.exec(content)) !== null) {
            imports.push({
                path: match[1],
                confidence: 'medium',
                reason: 'dynamic import',
                isDynamic: true,
                line: this.getLineNumber(content, match.index),
            });
        }

        // Require calls
        while ((match = REQUIRE_REGEX.exec(content)) !== null) {
            imports.push({
                path: match[1],
                confidence: 'high',
                reason: 'require',
                isDynamic: false,
                line: this.getLineNumber(content, match.index),
            });
        }

        return imports;
    }

    private extractExports(content: string): string[] {
        const exports: string[] = [];

        let match: RegExpExecArray | null;
        while ((match = EXPORT_NAMED_REGEX.exec(content)) !== null) {
            exports.push(match[1]);
        }

        while ((match = EXPORT_DEFAULT_REGEX.exec(content)) !== null) {
            exports.push(match[1] ?? 'default');
        }

        return exports;
    }

    private extractReexports(content: string): Array<{ path: string }> {
        const reexports: Array<{ path: string }> = [];

        let match: RegExpExecArray | null;
        while ((match = REEXPORT_REGEX.exec(content)) !== null) {
            reexports.push({ path: match[1] });
        }

        return reexports;
    }

    private detectFramework(
        content: string,
        filePath: string
    ): { framework: string; entrypointType: EntrypointType } | null {
        // Check file path patterns first
        if (filePath.includes('/pages/') || filePath.includes('/app/')) {
            if (filePath.includes('/api/')) {
                return { framework: 'nextjs', entrypointType: 'api' };
            }
            if (filePath.endsWith('page.tsx') || filePath.endsWith('page.ts')) {
                return { framework: 'nextjs', entrypointType: 'page' };
            }
        }

        // Check content patterns
        for (const { pattern, framework, entrypointType } of FRAMEWORK_PATTERNS) {
            pattern.lastIndex = 0; // Reset regex state
            if (pattern.test(content)) {
                return { framework, entrypointType };
            }
        }

        // Check for barrel files (index.ts with only exports)
        if (filePath.endsWith('index.ts') || filePath.endsWith('index.js')) {
            const hasOnlyExports = content.split('\n').every((line) => {
                const trimmed = line.trim();
                return (
                    trimmed === '' ||
                    trimmed.startsWith('//') ||
                    trimmed.startsWith('export') ||
                    trimmed.startsWith('import')
                );
            });
            if (hasOnlyExports) {
                return { framework: 'barrel', entrypointType: 'barrel' };
            }
        }

        return null;
    }

    private getLineNumber(content: string, index: number): number {
        return content.substring(0, index).split('\n').length;
    }
}
