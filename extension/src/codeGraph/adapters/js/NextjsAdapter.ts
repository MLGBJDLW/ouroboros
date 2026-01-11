/**
 * Next.js Adapter
 * Detects pages and API routes from file-based routing
 */

import * as path from 'path';
import type { GraphStore } from '../../core/GraphStore';
import type { GraphNode, GraphEdge, GraphIssue } from '../../core/types';
import type { FrameworkAdapter, PackageJson } from '../types';

export class NextjsAdapter implements FrameworkAdapter {
    name = 'nextjs';
    displayName = 'Next.js';
    category = 'fullstack' as const;
    filePatterns = [
        'pages/**/*.{ts,tsx,js,jsx}',
        'app/**/*.{ts,tsx,js,jsx}',
        'src/pages/**/*.{ts,tsx,js,jsx}',
        'src/app/**/*.{ts,tsx,js,jsx}',
    ];

    private isAppRouter = false;

    async detect(projectRoot: string, packageJson?: PackageJson): Promise<boolean> {
        if (!packageJson) return false;

        const deps = {
            ...packageJson.dependencies,
            ...packageJson.devDependencies,
        };

        return !!deps['next'];
    }

    async extractEntrypoints(store: GraphStore, projectRoot: string): Promise<GraphNode[]> {
        const entrypoints: GraphNode[] = [];
        const nodes = store.getAllNodes();

        for (const node of nodes) {
            if (node.kind !== 'file') continue;

            const filePath = node.path;
            const entrypoint = this.classifyFile(filePath);
            
            if (entrypoint) {
                entrypoints.push({
                    id: `entrypoint:${entrypoint.type}:${entrypoint.route}`,
                    kind: 'entrypoint',
                    name: entrypoint.name,
                    path: filePath,
                    meta: {
                        entrypointType: entrypoint.type,
                        route: entrypoint.route,
                        framework: 'nextjs',
                        isAppRouter: this.isAppRouter,
                    },
                });
            }
        }

        return entrypoints;
    }

    async extractRegistrations(_store: GraphStore, _projectRoot: string): Promise<GraphEdge[]> {
        // Next.js uses file-based routing, no explicit registrations
        return [];
    }

    async detectIssues(store: GraphStore): Promise<GraphIssue[]> {
        const issues: GraphIssue[] = [];
        const nodes = store.getAllNodes();

        for (const node of nodes) {
            if (node.kind !== 'file') continue;

            const filePath = node.path;
            const content = node.meta?.content as string | undefined;

            // Check for missing default export in pages
            if (this.isPageFile(filePath) && content) {
                if (!this.hasDefaultExport(content)) {
                    issues.push({
                        id: `issue:nextjs-missing-export:${filePath}`,
                        kind: 'BROKEN_EXPORT_CHAIN',
                        severity: 'error',
                        message: `Next.js page missing default export: ${filePath}`,
                        evidence: {
                            file: filePath,
                            expected: 'export default function Page() or export default Page',
                        },
                        suggestedFix: 'Add a default export to the page component',
                        meta: { filePath },
                    });
                }
            }

            // Check for API routes without handler
            if (this.isApiRoute(filePath) && content) {
                if (!this.hasApiHandler(content)) {
                    issues.push({
                        id: `issue:nextjs-missing-handler:${filePath}`,
                        kind: 'ENTRY_MISSING_HANDLER',
                        severity: 'error',
                        message: `Next.js API route missing handler: ${filePath}`,
                        evidence: {
                            file: filePath,
                            expected: 'export default handler or export { GET, POST, ... }',
                        },
                        suggestedFix: 'Add HTTP method handlers (GET, POST, etc.) or default export',
                        meta: { filePath },
                    });
                }
            }
        }

        return issues;
    }

    /**
     * Classify a file as page, api, layout, etc.
     */
    private classifyFile(filePath: string): { type: string; route: string; name: string } | null {
        const normalized = filePath.replace(/\\/g, '/');

        // App Router patterns (app/ or src/app/)
        if (normalized.includes('app/')) {
            this.isAppRouter = true;
            
            if (normalized.match(/page\.[jt]sx?$/)) {
                const route = this.extractAppRoute(normalized);
                return { type: 'page', route, name: `Page: ${route}` };
            }
            
            if (normalized.includes('/api/') && normalized.match(/route\.[jt]s$/)) {
                const route = this.extractAppRoute(normalized);
                return { type: 'api', route, name: `API: ${route}` };
            }
            
            if (normalized.match(/layout\.[jt]sx?$/)) {
                const route = this.extractAppRoute(normalized);
                return { type: 'layout', route, name: `Layout: ${route}` };
            }
        }

        // Pages Router patterns (pages/ or src/pages/)
        if (normalized.includes('pages/')) {
            if (normalized.includes('/api/')) {
                const route = this.extractPagesRoute(normalized);
                return { type: 'api', route, name: `API: ${route}` };
            }
            
            // Skip special files like _app, _document
            if (!normalized.includes('/_')) {
                const route = this.extractPagesRoute(normalized);
                return { type: 'page', route, name: `Page: ${route}` };
            }
        }

        return null;
    }

    /**
     * Extract route from App Router file path
     */
    private extractAppRoute(filePath: string): string {
        // Match app/... or src/app/...
        const match = filePath.match(/(?:^|\/|\\)app(.*)\/(?:page|route|layout)\.[jt]sx?$/);
        if (!match) return '/';
        
        let route = match[1] || '/';
        // Convert dynamic segments: [id] -> :id
        route = route.replace(/\[([^\]]+)\]/g, ':$1');
        // Convert catch-all: [...slug] -> *
        route = route.replace(/\[\.\.\.[^\]]+\]/g, '*');
        
        return route || '/';
    }

    /**
     * Extract route from Pages Router file path
     */
    private extractPagesRoute(filePath: string): string {
        // Match pages/... or src/pages/...
        const match = filePath.match(/(?:^|\/|\\)pages(.*)(?:\/index)?\.[jt]sx?$/);
        if (!match) return '/';
        
        let route = match[1] || '/';
        // Remove /index suffix
        route = route.replace(/\/index$/, '') || '/';
        // Convert dynamic segments
        route = route.replace(/\[([^\]]+)\]/g, ':$1');
        
        return route || '/';
    }

    /**
     * Check if file is a page file
     */
    private isPageFile(filePath: string): boolean {
        const normalized = filePath.replace(/\\/g, '/');
        return (
            (normalized.includes('pages/') && !normalized.includes('/api/') && !normalized.includes('/_')) ||
            normalized.match(/page\.[jt]sx?$/) !== null
        );
    }

    /**
     * Check if file is an API route
     */
    private isApiRoute(filePath: string): boolean {
        const normalized = filePath.replace(/\\/g, '/');
        return (
            normalized.includes('pages/api/') ||
            (normalized.includes('app/') && normalized.includes('/api/'))
        );
    }

    /**
     * Check if content has default export
     */
    private hasDefaultExport(content: string): boolean {
        return /export\s+default\s+/.test(content);
    }

    /**
     * Check if API route has handler
     */
    private hasApiHandler(content: string): boolean {
        // Pages Router: export default handler
        if (/export\s+default\s+/.test(content)) return true;
        // App Router: export { GET, POST, ... }
        if (/export\s+(async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)/.test(content)) return true;
        if (/export\s+const\s+(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)/.test(content)) return true;
        return false;
    }
}
