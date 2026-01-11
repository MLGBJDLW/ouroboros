/**
 * Express/Koa/Fastify/Hono Adapter
 * Detects routes from app.get(), router.use(), etc.
 */

import type { GraphStore } from '../../core/GraphStore';
import type { GraphNode, GraphEdge, GraphIssue } from '../../core/types';
import type { FrameworkAdapter, PackageJson, RouteInfo } from '../types';

const SUPPORTED_FRAMEWORKS = ['express', 'koa', 'fastify', 'hono'] as const;
type SupportedFramework = typeof SUPPORTED_FRAMEWORKS[number];

export class ExpressAdapter implements FrameworkAdapter {
    name = 'express';
    displayName = 'Express/Koa/Fastify/Hono';
    category = 'api' as const;
    filePatterns = ['**/*.ts', '**/*.js'];

    private detectedFramework: SupportedFramework = 'express';

    async detect(projectRoot: string, packageJson?: PackageJson): Promise<boolean> {
        if (!packageJson) return false;

        const deps = {
            ...packageJson.dependencies,
            ...packageJson.devDependencies,
        };

        for (const fw of SUPPORTED_FRAMEWORKS) {
            if (deps[fw]) {
                this.detectedFramework = fw;
                return true;
            }
        }

        return false;
    }

    async extractEntrypoints(store: GraphStore, _projectRoot: string): Promise<GraphNode[]> {
        const entrypoints: GraphNode[] = [];
        const routes = this.findRoutes(store);

        for (const route of routes) {
            entrypoints.push({
                id: `entrypoint:route:${route.method}:${route.path}`,
                kind: 'entrypoint',
                name: `${route.method} ${route.path}`,
                path: route.handlerFile,
                meta: {
                    entrypointType: 'route',
                    method: route.method,
                    routePath: route.path,
                    line: route.line,
                    framework: this.detectedFramework,
                },
            });
        }

        return entrypoints;
    }

    async extractRegistrations(store: GraphStore, _projectRoot: string): Promise<GraphEdge[]> {
        const edges: GraphEdge[] = [];
        const routes = this.findRoutes(store);

        for (const route of routes) {
            if (route.handlerName) {
                edges.push({
                    id: `edge:route:${route.handlerFile}:${route.handlerName}`,
                    from: `entrypoint:route:${route.method}:${route.path}`,
                    to: `file:${route.handlerFile}`,
                    kind: 'registers',
                    confidence: 'high',
                    meta: {
                        framework: this.detectedFramework,
                        handlerName: route.handlerName,
                    },
                });
            }
        }

        return edges;
    }

    async detectIssues(store: GraphStore): Promise<GraphIssue[]> {
        const issues: GraphIssue[] = [];
        const routes = this.findRoutes(store);

        for (const route of routes) {
            // Check if handler file exists in graph
            const handlerNode = store.getNode(`file:${route.handlerFile}`);
            if (!handlerNode) {
                issues.push({
                    id: `issue:entry-missing-handler:${route.method}:${route.path}`,
                    kind: 'ENTRY_MISSING_HANDLER',
                    severity: 'error',
                    message: `Route ${route.method} ${route.path} references missing handler`,
                    evidence: {
                        route: `${route.method} ${route.path}`,
                        expectedHandler: route.handlerFile,
                        framework: this.detectedFramework,
                    },
                    suggestedFix: `Create handler file at ${route.handlerFile} or fix the route registration`,
                    meta: {
                        filePath: route.handlerFile,
                    },
                });
            }
        }

        return issues;
    }

    /**
     * Find routes by scanning file content for route patterns
     */
    private findRoutes(store: GraphStore): RouteInfo[] {
        const routes: RouteInfo[] = [];
        const nodes = store.getAllNodes();

        // Route patterns for different frameworks
        const patterns = this.getRoutePatterns();

        for (const node of nodes) {
            if (node.kind !== 'file') continue;
            
            const content = node.meta?.content as string | undefined;
            if (!content) continue;

            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                
                for (const pattern of patterns) {
                    const match = line.match(pattern.regex);
                    if (match) {
                        routes.push({
                            method: (match[1]?.toUpperCase() || 'ALL') as RouteInfo['method'],
                            path: match[2] || '/',
                            handlerFile: node.path,
                            handlerName: match[3],
                            line: i + 1,
                        });
                    }
                }
            }
        }

        return routes;
    }

    /**
     * Get regex patterns for route detection
     */
    private getRoutePatterns(): Array<{ regex: RegExp; framework: string }> {
        return [
            // Express: app.get('/path', handler)
            { regex: /\.(get|post|put|delete|patch|all)\s*\(\s*['"`]([^'"`]+)['"`]/, framework: 'express' },
            // Express: router.get('/path', handler)
            { regex: /router\.(get|post|put|delete|patch|all)\s*\(\s*['"`]([^'"`]+)['"`]/, framework: 'express' },
            // Fastify: fastify.get('/path', handler)
            { regex: /fastify\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/, framework: 'fastify' },
            // Hono: app.get('/path', handler)
            { regex: /app\.(get|post|put|delete|patch|all)\s*\(\s*['"`]([^'"`]+)['"`]/, framework: 'hono' },
            // Koa Router: router.get('/path', handler)
            { regex: /router\.(get|post|put|delete|patch|all)\s*\(\s*['"`]([^'"`]+)['"`]/, framework: 'koa' },
        ];
    }
}
