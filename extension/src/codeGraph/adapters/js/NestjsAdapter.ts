/**
 * NestJS Adapter
 * Detects controllers and routes from decorators
 */

import type { GraphStore } from '../../core/GraphStore';
import type { GraphNode, GraphEdge, GraphIssue } from '../../core/types';
import type { FrameworkAdapter, PackageJson } from '../types';

export class NestjsAdapter implements FrameworkAdapter {
    name = 'nestjs';
    displayName = 'NestJS';
    category = 'api' as const;
    filePatterns = ['**/*.controller.ts', '**/*.module.ts', '**/*.service.ts'];

    async detect(_projectRoot: string, packageJson?: PackageJson): Promise<boolean> {
        if (!packageJson) return false;

        const deps = {
            ...packageJson.dependencies,
            ...packageJson.devDependencies,
        };

        return !!deps['@nestjs/core'];
    }

    async extractEntrypoints(store: GraphStore, _projectRoot: string): Promise<GraphNode[]> {
        const entrypoints: GraphNode[] = [];
        const nodes = store.getAllNodes();

        for (const node of nodes) {
            if (node.kind !== 'file' || !node.path) continue;
            
            const content = node.meta?.content as string | undefined;
            if (!content) continue;

            // Find @Controller decorator
            const controllerMatch = content.match(/@Controller\s*\(\s*['"`]?([^'"`)\s]*)['"`]?\s*\)/);
            if (controllerMatch) {
                const basePath = controllerMatch[1] || '';
                const routes = this.extractRoutes(content, basePath, node.path);
                
                for (const route of routes) {
                    entrypoints.push({
                        id: `entrypoint:route:${route.method}:${route.path}`,
                        kind: 'entrypoint',
                        name: `${route.method} ${route.path}`,
                        path: node.path,
                        meta: {
                            entrypointType: 'route',
                            method: route.method,
                            routePath: route.path,
                            handlerName: route.handler,
                            line: route.line,
                            framework: 'nestjs',
                        },
                    });
                }
            }

            // Find @Module decorator for module entrypoints
            if (content.includes('@Module(')) {
                entrypoints.push({
                    id: `entrypoint:module:${node.path}`,
                    kind: 'entrypoint',
                    name: `Module: ${this.getModuleName(node.path)}`,
                    path: node.path,
                    meta: {
                        entrypointType: 'module',
                        framework: 'nestjs',
                    },
                });
            }
        }

        return entrypoints;
    }

    async extractRegistrations(store: GraphStore, _projectRoot: string): Promise<GraphEdge[]> {
        const edges: GraphEdge[] = [];
        const nodes = store.getAllNodes();

        for (const node of nodes) {
            if (node.kind !== 'file') continue;
            
            const content = node.meta?.content as string | undefined;
            if (!content) continue;

            // Find module imports/providers/controllers
            const moduleMatch = content.match(/@Module\s*\(\s*\{([^}]+)\}\s*\)/s);
            if (moduleMatch) {
                const moduleConfig = moduleMatch[1];
                
                // Extract controllers
                const controllersMatch = moduleConfig.match(/controllers\s*:\s*\[([^\]]+)\]/);
                if (controllersMatch) {
                    const controllers = this.extractArrayItems(controllersMatch[1]);
                    for (const ctrl of controllers) {
                        edges.push({
                            id: `edge:module-controller:${node.path}:${ctrl}`,
                            from: `entrypoint:module:${node.path}`,
                            to: `symbol:${ctrl}`,
                            kind: 'registers',
                            confidence: 'high',
                            meta: { framework: 'nestjs', type: 'controller' },
                        });
                    }
                }

                // Extract providers
                const providersMatch = moduleConfig.match(/providers\s*:\s*\[([^\]]+)\]/);
                if (providersMatch) {
                    const providers = this.extractArrayItems(providersMatch[1]);
                    for (const prov of providers) {
                        edges.push({
                            id: `edge:module-provider:${node.path}:${prov}`,
                            from: `entrypoint:module:${node.path}`,
                            to: `symbol:${prov}`,
                            kind: 'registers',
                            confidence: 'high',
                            meta: { framework: 'nestjs', type: 'provider' },
                        });
                    }
                }
            }
        }

        return edges;
    }

    async detectIssues(store: GraphStore): Promise<GraphIssue[]> {
        const issues: GraphIssue[] = [];
        const nodes = store.getAllNodes();
        const registeredControllers = new Set<string>();
        const definedControllers = new Set<string>();

        // First pass: collect all registered and defined controllers
        for (const node of nodes) {
            if (node.kind !== 'file') continue;
            
            const content = node.meta?.content as string | undefined;
            if (!content) continue;

            // Find defined controllers
            if (content.includes('@Controller(')) {
                const classMatch = content.match(/class\s+(\w+)/);
                if (classMatch) {
                    definedControllers.add(classMatch[1]);
                }
            }

            // Find registered controllers in modules
            const moduleMatch = content.match(/@Module\s*\(\s*\{([^}]+)\}\s*\)/s);
            if (moduleMatch) {
                const controllersMatch = moduleMatch[1].match(/controllers\s*:\s*\[([^\]]+)\]/);
                if (controllersMatch) {
                    const controllers = this.extractArrayItems(controllersMatch[1]);
                    controllers.forEach(c => registeredControllers.add(c));
                }
            }
        }

        // Check for unregistered controllers
        for (const ctrl of definedControllers) {
            if (!registeredControllers.has(ctrl)) {
                issues.push({
                    id: `issue:not-registered:${ctrl}`,
                    kind: 'NOT_REGISTERED',
                    severity: 'warning',
                    message: `Controller ${ctrl} is defined but not registered in any module`,
                    evidence: {
                        controller: ctrl,
                        suggestion: 'Add to controllers array in a @Module decorator',
                    },
                    suggestedFix: `Add ${ctrl} to the controllers array in the appropriate module`,
                    meta: {},
                });
            }
        }

        return issues;
    }

    /**
     * Extract routes from controller content
     */
    private extractRoutes(
        content: string,
        basePath: string,
        _filePath: string
    ): Array<{ method: string; path: string; handler: string; line: number }> {
        const routes: Array<{ method: string; path: string; handler: string; line: number }> = [];
        const lines = content.split('\n');

        const decoratorPattern = /@(Get|Post|Put|Delete|Patch|All|Head|Options)\s*\(\s*['"`]?([^'"`)\s]*)['"`]?\s*\)/g;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            let match;
            
            while ((match = decoratorPattern.exec(line)) !== null) {
                const method = match[1].toUpperCase();
                const routePath = match[2] || '';
                const fullPath = this.joinPaths(basePath, routePath);
                
                // Try to find handler name on next line
                const nextLine = lines[i + 1] || '';
                const handlerMatch = nextLine.match(/(?:async\s+)?(\w+)\s*\(/);
                
                routes.push({
                    method,
                    path: fullPath,
                    handler: handlerMatch?.[1] || 'unknown',
                    line: i + 1,
                });
            }
            
            decoratorPattern.lastIndex = 0;
        }

        return routes;
    }

    /**
     * Join path segments
     */
    private joinPaths(base: string, route: string): string {
        const cleanBase = base.replace(/^\/|\/$/g, '');
        const cleanRoute = route.replace(/^\/|\/$/g, '');
        
        if (!cleanBase && !cleanRoute) return '/';
        if (!cleanBase) return `/${cleanRoute}`;
        if (!cleanRoute) return `/${cleanBase}`;
        return `/${cleanBase}/${cleanRoute}`;
    }

    /**
     * Extract items from array literal
     */
    private extractArrayItems(arrayContent: string): string[] {
        return arrayContent
            .split(',')
            .map(item => item.trim())
            .filter(item => item && !item.startsWith('//'));
    }

    /**
     * Get module name from file path
     */
    private getModuleName(filePath: string): string {
        const match = filePath.match(/([^/\\]+)\.module\.[jt]s$/);
        return match ? match[1] : filePath;
    }
}
