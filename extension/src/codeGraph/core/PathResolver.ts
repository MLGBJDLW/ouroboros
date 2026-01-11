/**
 * Path Resolver
 * Resolves import paths using tsconfig paths, baseUrl, and standard resolution
 */

import * as path from 'path';
import * as fs from 'fs';

export interface TSConfigPaths {
    baseUrl?: string;
    paths?: Record<string, string[]>;
}

export interface ResolvedPath {
    resolved: string;
    confidence: 'high' | 'medium' | 'low';
    reason: string;
    isExternal: boolean;
}

export class PathResolver {
    private baseUrl: string;
    private paths: Record<string, string[]>;
    private workspaceRoot: string;
    private cache: Map<string, ResolvedPath | null> = new Map();

    constructor(workspaceRoot: string, tsconfig?: TSConfigPaths) {
        this.workspaceRoot = workspaceRoot;
        this.baseUrl = tsconfig?.baseUrl ?? '.';
        this.paths = tsconfig?.paths ?? {};
    }

    /**
     * Load tsconfig.json from workspace
     */
    static async loadTSConfig(workspaceRoot: string): Promise<TSConfigPaths> {
        const tsconfigPath = path.join(workspaceRoot, 'tsconfig.json');
        
        try {
            const content = await fs.promises.readFile(tsconfigPath, 'utf-8');
            const config = JSON.parse(content);
            
            return {
                baseUrl: config.compilerOptions?.baseUrl,
                paths: config.compilerOptions?.paths,
            };
        } catch {
            return {};
        }
    }

    /**
     * Resolve an import path to an absolute file path
     */
    resolve(importPath: string, fromFile: string): ResolvedPath | null {
        const cacheKey = `${fromFile}:${importPath}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey) ?? null;
        }

        const result = this.doResolve(importPath, fromFile);
        this.cache.set(cacheKey, result);
        return result;
    }

    private doResolve(importPath: string, fromFile: string): ResolvedPath | null {
        // 1. Check if external package
        if (this.isExternalPackage(importPath)) {
            return {
                resolved: importPath,
                confidence: 'high',
                reason: 'external package',
                isExternal: true,
            };
        }

        // 2. Try relative import
        if (importPath.startsWith('.')) {
            return this.resolveRelative(importPath, fromFile);
        }

        // 3. Try tsconfig paths aliases
        const aliasResult = this.resolveAlias(importPath);
        if (aliasResult) {
            return aliasResult;
        }

        // 4. Try baseUrl resolution
        if (this.baseUrl) {
            const baseUrlResult = this.resolveFromBaseUrl(importPath);
            if (baseUrlResult) {
                return baseUrlResult;
            }
        }

        // 5. Assume external if nothing matches
        return {
            resolved: importPath,
            confidence: 'low',
            reason: 'unresolved - assumed external',
            isExternal: true,
        };
    }

    /**
     * Check if import is an external package
     */
    private isExternalPackage(importPath: string): boolean {
        // Node built-ins
        const builtins = [
            'fs', 'path', 'os', 'util', 'events', 'stream', 'http', 'https',
            'crypto', 'buffer', 'url', 'querystring', 'child_process', 'cluster',
            'dgram', 'dns', 'net', 'readline', 'repl', 'tls', 'tty', 'v8', 'vm',
            'zlib', 'assert', 'async_hooks', 'console', 'constants', 'domain',
            'inspector', 'module', 'perf_hooks', 'process', 'punycode',
            'string_decoder', 'timers', 'trace_events', 'worker_threads',
        ];

        if (builtins.includes(importPath) || importPath.startsWith('node:')) {
            return true;
        }

        // Scoped packages (@org/package) or regular packages
        if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
            // Check if it looks like a package name
            const firstPart = importPath.split('/')[0];
            if (firstPart.startsWith('@') || !firstPart.includes('.')) {
                return true;
            }
        }

        return false;
    }

    /**
     * Resolve relative import
     */
    private resolveRelative(importPath: string, fromFile: string): ResolvedPath | null {
        const fromDir = path.dirname(fromFile);
        const resolved = this.normalizeAndResolve(path.join(fromDir, importPath));

        if (resolved) {
            return {
                resolved: this.toRelativePath(resolved),
                confidence: 'high',
                reason: 'relative import',
                isExternal: false,
            };
        }

        return null;
    }

    /**
     * Resolve using tsconfig paths aliases
     */
    private resolveAlias(importPath: string): ResolvedPath | null {
        for (const [pattern, targets] of Object.entries(this.paths)) {
            const match = this.matchPattern(importPath, pattern);
            if (match !== null) {
                for (const target of targets) {
                    const resolvedTarget = target.replace('*', match);
                    const fullPath = path.join(this.workspaceRoot, this.baseUrl, resolvedTarget);
                    const resolved = this.normalizeAndResolve(fullPath);

                    if (resolved) {
                        return {
                            resolved: this.toRelativePath(resolved),
                            confidence: 'high',
                            reason: `tsconfig paths: ${pattern}`,
                            isExternal: false,
                        };
                    }
                }
            }
        }

        return null;
    }

    /**
     * Resolve from baseUrl
     */
    private resolveFromBaseUrl(importPath: string): ResolvedPath | null {
        const fullPath = path.join(this.workspaceRoot, this.baseUrl, importPath);
        const resolved = this.normalizeAndResolve(fullPath);

        if (resolved) {
            return {
                resolved: this.toRelativePath(resolved),
                confidence: 'medium',
                reason: 'baseUrl resolution',
                isExternal: false,
            };
        }

        return null;
    }

    /**
     * Match import path against tsconfig pattern
     */
    private matchPattern(importPath: string, pattern: string): string | null {
        if (pattern.endsWith('*')) {
            const prefix = pattern.slice(0, -1);
            if (importPath.startsWith(prefix)) {
                return importPath.slice(prefix.length);
            }
        } else if (pattern === importPath) {
            return '';
        }

        return null;
    }

    /**
     * Try to resolve path with various extensions
     * Handles ESM-style imports where .js extension maps to .ts source files
     */
    private normalizeAndResolve(basePath: string): string | null {
        const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', ''];
        const indexFiles = ['index.ts', 'index.tsx', 'index.js', 'index.jsx'];

        // Handle ESM-style .js imports that should resolve to .ts files
        // e.g., import './foo.js' should resolve to './foo.ts' in TypeScript projects
        let normalizedBasePath = basePath;
        if (basePath.endsWith('.js')) {
            normalizedBasePath = basePath.slice(0, -3); // Remove .js
        } else if (basePath.endsWith('.jsx')) {
            normalizedBasePath = basePath.slice(0, -4); // Remove .jsx
        } else if (basePath.endsWith('.mjs')) {
            normalizedBasePath = basePath.slice(0, -4); // Remove .mjs
        } else if (basePath.endsWith('.cjs')) {
            normalizedBasePath = basePath.slice(0, -4); // Remove .cjs
        }

        // Try exact path with extensions (using normalized path without .js)
        for (const ext of extensions) {
            const fullPath = normalizedBasePath + ext;
            if (this.fileExists(fullPath)) {
                return fullPath;
            }
        }

        // Also try the original path if it was different (for actual .js files)
        if (normalizedBasePath !== basePath) {
            if (this.fileExists(basePath)) {
                return basePath;
            }
        }

        // Try as directory with index file
        for (const indexFile of indexFiles) {
            const fullPath = path.join(normalizedBasePath, indexFile);
            if (this.fileExists(fullPath)) {
                return fullPath;
            }
        }

        return null;
    }

    /**
     * Check if file exists (sync for simplicity in resolver)
     */
    private fileExists(filePath: string): boolean {
        try {
            return fs.statSync(filePath).isFile();
        } catch {
            return false;
        }
    }

    /**
     * Convert absolute path to workspace-relative path
     */
    private toRelativePath(absolutePath: string): string {
        return path.relative(this.workspaceRoot, absolutePath).replace(/\\/g, '/');
    }

    /**
     * Clear the resolution cache
     */
    clearCache(): void {
        this.cache.clear();
    }

    /**
     * Update tsconfig settings
     */
    updateConfig(tsconfig: TSConfigPaths): void {
        this.baseUrl = tsconfig.baseUrl ?? '.';
        this.paths = tsconfig.paths ?? {};
        this.clearCache();
    }
}
