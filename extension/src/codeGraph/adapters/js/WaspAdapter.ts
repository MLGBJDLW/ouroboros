/**
 * Wasp Adapter
 * Detects pages, routes, queries, and actions from Wasp configuration files
 * 
 * Wasp uses string-based component references in its config:
 * - page Main { component: import Main from "@src/pages/Main" }
 * - route MainRoute { path: "/", to: MainPage }
 * - query getTasks { fn: import { getTasks } from "@src/queries" }
 * - action createTask { fn: import { createTask } from "@src/actions" }
 */

import * as fs from 'fs';
import * as path from 'path';
import type { GraphStore } from '../../core/GraphStore';
import type { GraphNode, GraphEdge, GraphIssue } from '../../core/types';
import type { FrameworkAdapter, PackageJson } from '../types';

interface WaspPage {
    name: string;
    component: string;
    authRequired?: boolean;
}

interface WaspRoute {
    name: string;
    path: string;
    to: string;
}

interface WaspQuery {
    name: string;
    fn: string;
    entities?: string[];
}

interface WaspAction {
    name: string;
    fn: string;
    entities?: string[];
}

interface WaspJob {
    name: string;
    executor: string;
    perform: string;
    schedule?: string;
}

interface WaspApi {
    name: string;
    fn: string;
    httpRoute: [string, string];
    entities?: string[];
}

interface WaspConfig {
    pages: WaspPage[];
    routes: WaspRoute[];
    queries: WaspQuery[];
    actions: WaspAction[];
    jobs: WaspJob[];
    apis: WaspApi[];
}

export class WaspAdapter implements FrameworkAdapter {
    name = 'wasp';
    displayName = 'Wasp';
    category = 'fullstack' as const;
    filePatterns = [
        'main.wasp',
        'main.wasp.ts',
        '*.wasp',
    ];
    
    /**
     * Directories that should be excluded from analysis
     * .wasp/out contains Wasp's compiled output - not user code
     */
    excludePatterns = [
        '.wasp',
        '.wasp/out',
    ];

    private config: WaspConfig | null = null;
    private projectRoot = '';

    async detect(projectRoot: string, packageJson?: PackageJson): Promise<boolean> {
        // Check for wasp config file
        const waspFile = path.join(projectRoot, 'main.wasp');
        const waspTsFile = path.join(projectRoot, 'main.wasp.ts');
        
        try {
            await fs.promises.access(waspFile);
            return true;
        } catch {
            try {
                await fs.promises.access(waspTsFile);
                return true;
            } catch {
                // Check package.json for wasp
                if (packageJson) {
                    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
                    return !!deps['wasp'];
                }
                return false;
            }
        }
    }

    async extractEntrypoints(store: GraphStore, projectRoot: string): Promise<GraphNode[]> {
        this.projectRoot = projectRoot;
        await this.parseWaspConfig(projectRoot);
        
        if (!this.config) return [];

        const entrypoints: GraphNode[] = [];

        // Mark the Wasp config files themselves as entrypoints
        // These are the root of the Wasp application and should not be reported as unreachable
        const waspConfigFiles = ['main.wasp', 'main.wasp.ts', 'main.wasp.js'];
        for (const configFile of waspConfigFiles) {
            const configPath = path.join(projectRoot, configFile);
            if (fs.existsSync(configPath)) {
                const relativePath = configFile;
                entrypoints.push({
                    id: `entrypoint:wasp-config:${configFile}`,
                    kind: 'entrypoint',
                    name: `Wasp Config: ${configFile}`,
                    path: relativePath,
                    meta: {
                        entrypointType: 'main',
                        framework: 'wasp',
                        isWaspConfig: true,
                    },
                });
            }
        }

        // Extract page entrypoints
        for (const page of this.config.pages) {
            const resolvedPath = this.resolveWaspImport(page.component);
            entrypoints.push({
                id: `entrypoint:page:${page.name}`,
                kind: 'entrypoint',
                name: `Page: ${page.name}`,
                path: resolvedPath,
                meta: {
                    entrypointType: 'page',
                    framework: 'wasp',
                    waspName: page.name,
                    authRequired: page.authRequired,
                },
            });
        }

        // Extract query entrypoints
        for (const query of this.config.queries) {
            const resolvedPath = this.resolveWaspImport(query.fn);
            entrypoints.push({
                id: `entrypoint:query:${query.name}`,
                kind: 'entrypoint',
                name: `Query: ${query.name}`,
                path: resolvedPath,
                meta: {
                    entrypointType: 'api',
                    framework: 'wasp',
                    waspName: query.name,
                    entities: query.entities,
                },
            });
        }

        // Extract action entrypoints
        for (const action of this.config.actions) {
            const resolvedPath = this.resolveWaspImport(action.fn);
            entrypoints.push({
                id: `entrypoint:action:${action.name}`,
                kind: 'entrypoint',
                name: `Action: ${action.name}`,
                path: resolvedPath,
                meta: {
                    entrypointType: 'api',
                    framework: 'wasp',
                    waspName: action.name,
                    entities: action.entities,
                },
            });
        }

        // Extract job entrypoints
        for (const job of this.config.jobs) {
            const resolvedPath = this.resolveWaspImport(job.perform);
            entrypoints.push({
                id: `entrypoint:job:${job.name}`,
                kind: 'entrypoint',
                name: `Job: ${job.name}`,
                path: resolvedPath,
                meta: {
                    entrypointType: 'job',
                    framework: 'wasp',
                    waspName: job.name,
                    schedule: job.schedule,
                },
            });
        }

        // Extract API entrypoints
        for (const api of this.config.apis) {
            const resolvedPath = this.resolveWaspImport(api.fn);
            const [method, route] = api.httpRoute;
            entrypoints.push({
                id: `entrypoint:api:${api.name}`,
                kind: 'entrypoint',
                name: `API: ${method} ${route}`,
                path: resolvedPath,
                meta: {
                    entrypointType: 'api',
                    framework: 'wasp',
                    waspName: api.name,
                    httpMethod: method,
                    httpRoute: route,
                    entities: api.entities,
                },
            });
        }

        return entrypoints;
    }

    async extractRegistrations(_store: GraphStore, _projectRoot: string): Promise<GraphEdge[]> {
        if (!this.config) return [];

        const edges: GraphEdge[] = [];

        // Create edges from routes to pages
        for (const route of this.config.routes) {
            const page = this.config.pages.find(p => p.name === route.to);
            if (page) {
                const pagePath = this.resolveWaspImport(page.component);
                edges.push({
                    id: `edge:wasp:route:${route.name}`,
                    from: `entrypoint:route:${route.name}`,
                    to: pagePath,
                    kind: 'registers',
                    confidence: 'high',
                    meta: {
                        framework: 'wasp',
                        routePath: route.path,
                    },
                });
            }
        }

        return edges;
    }

    async detectIssues(store: GraphStore): Promise<GraphIssue[]> {
        if (!this.config) return [];

        const issues: GraphIssue[] = [];
        const allNodes = store.getAllNodes();
        const nodePaths = new Set(allNodes.map(n => n.path).filter(Boolean));

        // Check for missing page components
        for (const page of this.config.pages) {
            const resolvedPath = this.resolveWaspImport(page.component);
            if (!this.fileExists(resolvedPath, nodePaths)) {
                issues.push({
                    id: `issue:wasp-missing-page:${page.name}`,
                    kind: 'ENTRY_MISSING_HANDLER',
                    severity: 'error',
                    message: `Wasp page "${page.name}" references missing component`,
                    evidence: {
                        waspName: page.name,
                        expectedPath: resolvedPath,
                        importString: page.component,
                    },
                    suggestedFix: `Create the component at ${resolvedPath}`,
                    meta: { filePath: resolvedPath },
                });
            }
        }

        // Check for missing query handlers
        for (const query of this.config.queries) {
            const resolvedPath = this.resolveWaspImport(query.fn);
            if (!this.fileExists(resolvedPath, nodePaths)) {
                issues.push({
                    id: `issue:wasp-missing-query:${query.name}`,
                    kind: 'ENTRY_MISSING_HANDLER',
                    severity: 'error',
                    message: `Wasp query "${query.name}" references missing handler`,
                    evidence: {
                        waspName: query.name,
                        expectedPath: resolvedPath,
                        importString: query.fn,
                    },
                    suggestedFix: `Create the query handler at ${resolvedPath}`,
                    meta: { filePath: resolvedPath },
                });
            }
        }

        // Check for missing action handlers
        for (const action of this.config.actions) {
            const resolvedPath = this.resolveWaspImport(action.fn);
            if (!this.fileExists(resolvedPath, nodePaths)) {
                issues.push({
                    id: `issue:wasp-missing-action:${action.name}`,
                    kind: 'ENTRY_MISSING_HANDLER',
                    severity: 'error',
                    message: `Wasp action "${action.name}" references missing handler`,
                    evidence: {
                        waspName: action.name,
                        expectedPath: resolvedPath,
                        importString: action.fn,
                    },
                    suggestedFix: `Create the action handler at ${resolvedPath}`,
                    meta: { filePath: resolvedPath },
                });
            }
        }

        // Check for routes pointing to non-existent pages
        for (const route of this.config.routes) {
            const page = this.config.pages.find(p => p.name === route.to);
            if (!page) {
                issues.push({
                    id: `issue:wasp-invalid-route:${route.name}`,
                    kind: 'NOT_REGISTERED',
                    severity: 'error',
                    message: `Wasp route "${route.name}" points to undefined page "${route.to}"`,
                    evidence: {
                        routeName: route.name,
                        routePath: route.path,
                        targetPage: route.to,
                    },
                    suggestedFix: `Define page "${route.to}" in main.wasp`,
                    meta: {},
                });
            }
        }

        return issues;
    }

    /**
     * Parse Wasp configuration file
     */
    private async parseWaspConfig(projectRoot: string): Promise<void> {
        this.config = {
            pages: [],
            routes: [],
            queries: [],
            actions: [],
            jobs: [],
            apis: [],
        };

        // Try main.wasp first, then main.wasp.ts
        let content = '';
        try {
            content = await fs.promises.readFile(path.join(projectRoot, 'main.wasp'), 'utf-8');
        } catch {
            try {
                content = await fs.promises.readFile(path.join(projectRoot, 'main.wasp.ts'), 'utf-8');
            } catch {
                return;
            }
        }

        // Parse pages
        this.config.pages = this.parseWaspPages(content);
        
        // Parse routes
        this.config.routes = this.parseWaspRoutes(content);
        
        // Parse queries
        this.config.queries = this.parseWaspQueries(content);
        
        // Parse actions
        this.config.actions = this.parseWaspActions(content);
        
        // Parse jobs
        this.config.jobs = this.parseWaspJobs(content);
        
        // Parse APIs
        this.config.apis = this.parseWaspApis(content);
    }

    /**
     * Parse page declarations from Wasp config
     */
    private parseWaspPages(content: string): WaspPage[] {
        const pages: WaspPage[] = [];
        
        // Match: page PageName { component: import ... from "..." }
        const pageRegex = /page\s+(\w+)\s*\{([^}]+)\}/g;
        let match;
        
        while ((match = pageRegex.exec(content)) !== null) {
            const name = match[1];
            const body = match[2];
            
            // Extract component import
            const componentMatch = body.match(/component:\s*import\s+(?:\w+|\{[^}]+\})\s+from\s+["']([^"']+)["']/);
            if (componentMatch) {
                const authMatch = body.match(/authRequired:\s*(true|false)/);
                pages.push({
                    name,
                    component: componentMatch[1],
                    authRequired: authMatch ? authMatch[1] === 'true' : undefined,
                });
            }
        }
        
        return pages;
    }

    /**
     * Parse route declarations from Wasp config
     */
    private parseWaspRoutes(content: string): WaspRoute[] {
        const routes: WaspRoute[] = [];
        
        // Match: route RouteName { path: "/...", to: PageName }
        const routeRegex = /route\s+(\w+)\s*\{([^}]+)\}/g;
        let match;
        
        while ((match = routeRegex.exec(content)) !== null) {
            const name = match[1];
            const body = match[2];
            
            const pathMatch = body.match(/path:\s*["']([^"']+)["']/);
            const toMatch = body.match(/to:\s*(\w+)/);
            
            if (pathMatch && toMatch) {
                routes.push({
                    name,
                    path: pathMatch[1],
                    to: toMatch[1],
                });
            }
        }
        
        return routes;
    }

    /**
     * Parse query declarations from Wasp config
     */
    private parseWaspQueries(content: string): WaspQuery[] {
        const queries: WaspQuery[] = [];
        
        // Use balanced brace matching for query declarations
        const queryStartRegex = /query\s+(\w+)\s*\{/g;
        let startMatch;
        
        while ((startMatch = queryStartRegex.exec(content)) !== null) {
            const name = startMatch[1];
            const startIndex = startMatch.index + startMatch[0].length;
            
            // Find the matching closing brace
            let braceCount = 1;
            let endIndex = startIndex;
            for (let i = startIndex; i < content.length && braceCount > 0; i++) {
                if (content[i] === '{') braceCount++;
                if (content[i] === '}') braceCount--;
                endIndex = i;
            }
            
            const body = content.substring(startIndex, endIndex);
            
            const fnMatch = body.match(/fn:\s*import\s+(?:\w+|\{[^}]+\})\s+from\s+["']([^"']+)["']/);
            if (fnMatch) {
                const entitiesMatch = body.match(/entities:\s*\[([^\]]+)\]/);
                queries.push({
                    name,
                    fn: fnMatch[1],
                    entities: entitiesMatch ? this.parseEntityList(entitiesMatch[1]) : undefined,
                });
            }
        }
        
        return queries;
    }

    /**
     * Parse action declarations from Wasp config
     */
    private parseWaspActions(content: string): WaspAction[] {
        const actions: WaspAction[] = [];
        
        // Use balanced brace matching for action declarations
        const actionStartRegex = /action\s+(\w+)\s*\{/g;
        let startMatch;
        
        while ((startMatch = actionStartRegex.exec(content)) !== null) {
            const name = startMatch[1];
            const startIndex = startMatch.index + startMatch[0].length;
            
            // Find the matching closing brace
            let braceCount = 1;
            let endIndex = startIndex;
            for (let i = startIndex; i < content.length && braceCount > 0; i++) {
                if (content[i] === '{') braceCount++;
                if (content[i] === '}') braceCount--;
                endIndex = i;
            }
            
            const body = content.substring(startIndex, endIndex);
            
            const fnMatch = body.match(/fn:\s*import\s+(?:\w+|\{[^}]+\})\s+from\s+["']([^"']+)["']/);
            if (fnMatch) {
                const entitiesMatch = body.match(/entities:\s*\[([^\]]+)\]/);
                actions.push({
                    name,
                    fn: fnMatch[1],
                    entities: entitiesMatch ? this.parseEntityList(entitiesMatch[1]) : undefined,
                });
            }
        }
        
        return actions;
    }

    /**
     * Parse job declarations from Wasp config
     * Jobs have nested braces: job name { perform: { fn: ... }, schedule: { cron: ... } }
     */
    private parseWaspJobs(content: string): WaspJob[] {
        const jobs: WaspJob[] = [];
        
        // Use a simpler approach: find job declarations and extract content between balanced braces
        const jobStartRegex = /job\s+(\w+)\s*\{/g;
        let startMatch;
        
        while ((startMatch = jobStartRegex.exec(content)) !== null) {
            const name = startMatch[1];
            const startIndex = startMatch.index + startMatch[0].length;
            
            // Find the matching closing brace
            let braceCount = 1;
            let endIndex = startIndex;
            for (let i = startIndex; i < content.length && braceCount > 0; i++) {
                if (content[i] === '{') braceCount++;
                if (content[i] === '}') braceCount--;
                endIndex = i;
            }
            
            const body = content.substring(startIndex, endIndex);
            
            const executorMatch = body.match(/executor:\s*(\w+)/);
            const performMatch = body.match(/fn:\s*import\s+(?:\w+|\{[^}]+\})\s+from\s+["']([^"']+)["']/);
            const scheduleMatch = body.match(/cron:\s*["']([^"']+)["']/);
            
            if (executorMatch && performMatch) {
                jobs.push({
                    name,
                    executor: executorMatch[1],
                    perform: performMatch[1],
                    schedule: scheduleMatch ? scheduleMatch[1] : undefined,
                });
            }
        }
        
        return jobs;
    }

    /**
     * Parse API declarations from Wasp config
     */
    private parseWaspApis(content: string): WaspApi[] {
        const apis: WaspApi[] = [];
        
        // Use balanced brace matching for api declarations
        const apiStartRegex = /api\s+(\w+)\s*\{/g;
        let startMatch;
        
        while ((startMatch = apiStartRegex.exec(content)) !== null) {
            const name = startMatch[1];
            const startIndex = startMatch.index + startMatch[0].length;
            
            // Find the matching closing brace
            let braceCount = 1;
            let endIndex = startIndex;
            for (let i = startIndex; i < content.length && braceCount > 0; i++) {
                if (content[i] === '{') braceCount++;
                if (content[i] === '}') braceCount--;
                endIndex = i;
            }
            
            const body = content.substring(startIndex, endIndex);
            
            const fnMatch = body.match(/fn:\s*import\s+(?:\w+|\{[^}]+\})\s+from\s+["']([^"']+)["']/);
            const httpRouteMatch = body.match(/httpRoute:\s*\(\s*(\w+)\s*,\s*["']([^"']+)["']\s*\)/);
            
            if (fnMatch && httpRouteMatch) {
                const entitiesMatch = body.match(/entities:\s*\[([^\]]+)\]/);
                apis.push({
                    name,
                    fn: fnMatch[1],
                    httpRoute: [httpRouteMatch[1], httpRouteMatch[2]],
                    entities: entitiesMatch ? this.parseEntityList(entitiesMatch[1]) : undefined,
                });
            }
        }
        
        return apis;
    }

    /**
     * Parse entity list from Wasp config
     */
    private parseEntityList(entityStr: string): string[] {
        return entityStr.split(',').map(e => e.trim()).filter(Boolean);
    }

    /**
     * Resolve Wasp import path to actual file path
     * @src/... -> src/...
     * @server/... -> src/server/...
     * @client/... -> src/client/...
     */
    private resolveWaspImport(importPath: string): string {
        let resolved = importPath;
        
        // Handle Wasp aliases
        if (resolved.startsWith('@src/')) {
            resolved = resolved.replace('@src/', 'src/');
        } else if (resolved.startsWith('@server/')) {
            resolved = resolved.replace('@server/', 'src/server/');
        } else if (resolved.startsWith('@client/')) {
            resolved = resolved.replace('@client/', 'src/client/');
        } else if (resolved.startsWith('@/')) {
            resolved = resolved.replace('@/', 'src/');
        }
        
        // Add extension if missing
        if (!resolved.match(/\.[jt]sx?$/)) {
            // Try common extensions
            const extensions = ['.tsx', '.ts', '.jsx', '.js'];
            for (const ext of extensions) {
                const fullPath = path.join(this.projectRoot, resolved + ext);
                try {
                    fs.accessSync(fullPath);
                    return resolved + ext;
                } catch {
                    // Try index file
                    const indexPath = path.join(this.projectRoot, resolved, 'index' + ext);
                    try {
                        fs.accessSync(indexPath);
                        return path.join(resolved, 'index' + ext);
                    } catch {
                        continue;
                    }
                }
            }
        }
        
        return resolved;
    }

    /**
     * Check if file exists in indexed nodes
     */
    private fileExists(filePath: string, nodePaths: Set<string | undefined>): boolean {
        // Normalize path for comparison
        const normalized = filePath.replace(/\\/g, '/');
        
        for (const nodePath of nodePaths) {
            if (!nodePath) continue;
            const nodeNormalized = nodePath.replace(/\\/g, '/');
            if (nodeNormalized.endsWith(normalized) || normalized.endsWith(nodeNormalized)) {
                return true;
            }
        }
        
        return false;
    }
}
