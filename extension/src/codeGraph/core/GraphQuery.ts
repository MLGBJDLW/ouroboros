/**
 * Graph Query
 * High-level query interface with token-aware output
 * 
 * Enhanced with LSP integration for precise hotspot detection
 */

import type { GraphStore } from './GraphStore';
import type {
    DigestResult,
    IssueListResult,
    ImpactResult,
    PathResult,
    ModuleResult,
    IssueKind,
    IssueSeverity,
    GraphNode,
} from './types';
import { getLspEnhancer } from '../lsp';
import { createLogger } from '../../utils/logger';

const logger = createLogger('GraphQuery');
const CHARS_PER_TOKEN = 4;

export interface DigestOptions {
    scope?: string;
    limit?: number;
    useLspForHotspots?: boolean; // Use LSP reference counts for more accurate hotspots
}

export interface IssueQueryOptions {
    kind?: IssueKind;
    severity?: IssueSeverity;
    scope?: string;
    limit?: number;
}

export interface ImpactOptions {
    depth?: number;
    limit?: number;
    useLspRefs?: boolean; // Use LSP for precise reference counting
}

export interface PathQueryOptions {
    maxDepth?: number;
    maxPaths?: number;
}

export interface ModuleQueryOptions {
    includeTransitive?: boolean;
    includeSymbols?: boolean; // Include LSP symbols
}

export class GraphQuery {
    constructor(private store: GraphStore) {}

    // ============================================
    // Digest Query
    // ============================================

    digest(options?: DigestOptions): DigestResult {
        const scope = options?.scope ?? null;
        const limit = options?.limit ?? 10;

        const allNodes = this.store.getAllNodes();
        const filteredNodes = scope
            ? allNodes.filter((n) => n.path?.startsWith(scope))
            : allNodes;

        const files = filteredNodes.filter((n) => n.kind === 'file');
        const entrypoints = filteredNodes.filter((n) => n.kind === 'entrypoint');
        const modules = filteredNodes.filter((n) => n.kind === 'module');

        // Group entrypoints by type
        const entrypointsByType = this.groupEntrypointsByType(entrypoints);

        // Find hotspots (most imported files)
        const hotspots = this.findHotspots(files, limit);

        // Count issues by kind
        const issues = this.store.getIssues();
        const filteredIssues = scope
            ? issues.filter((i) => i.meta?.filePath?.startsWith(scope))
            : issues;

        const issuesByKind: Record<IssueKind, number> = {
            HANDLER_UNREACHABLE: 0,
            DYNAMIC_EDGE_UNKNOWN: 0,
            BROKEN_EXPORT_CHAIN: 0,
            CIRCULAR_REEXPORT: 0,
            CIRCULAR_DEPENDENCY: 0,
            ORPHAN_EXPORT: 0,
            ENTRY_MISSING_HANDLER: 0,
            NOT_REGISTERED: 0,
            CYCLE_RISK: 0,
            LAYER_VIOLATION: 0,
        };

        for (const issue of filteredIssues) {
            issuesByKind[issue.kind]++;
        }

        const result: DigestResult = {
            summary: {
                files: files.length,
                modules: modules.length,
                entrypoints: entrypoints.length,
                edges: this.store.edgeCount,
            },
            entrypoints: entrypointsByType,
            hotspots,
            issues: issuesByKind,
            meta: {
                lastIndexed: new Date(this.store.getMeta().lastIndexed).toISOString(),
                tokensEstimate: 0,
                truncated: false,
                scopeApplied: scope,
            },
        };

        result.meta.tokensEstimate = this.estimateTokens(result);
        return result;
    }


    // ============================================
    // Issues Query
    // ============================================

    issues(options?: IssueQueryOptions): IssueListResult {
        const limit = Math.min(options?.limit ?? 20, 50);
        let filtered = this.store.getIssues();

        if (options?.kind) {
            filtered = filtered.filter((i) => i.kind === options.kind);
        }

        if (options?.severity) {
            const minRank = this.severityRank(options.severity);
            filtered = filtered.filter((i) => this.severityRank(i.severity) >= minRank);
        }

        if (options?.scope) {
            const scope = options.scope;
            filtered = filtered.filter((i) => i.meta?.filePath?.startsWith(scope));
        }

        const total = filtered.length;
        const truncated = total > limit;
        const returned = filtered.slice(0, limit);

        // Count by kind and severity
        const byKind: Record<string, number> = {};
        const bySeverity: Record<string, number> = {};

        for (const issue of filtered) {
            byKind[issue.kind] = (byKind[issue.kind] ?? 0) + 1;
            bySeverity[issue.severity] = (bySeverity[issue.severity] ?? 0) + 1;
        }

        const result: IssueListResult = {
            issues: returned.map((i) => ({
                id: i.id,
                kind: i.kind,
                severity: i.severity,
                file: i.meta?.filePath ?? 'unknown',
                summary: i.title ?? '',
                evidence: Array.isArray(i.evidence) ? i.evidence : [],
                suggestedFix: Array.isArray(i.suggestedFix) ? i.suggestedFix : (i.suggestedFix ? [i.suggestedFix] : []),
            })),
            stats: {
                total,
                returned: returned.length,
                byKind,
                bySeverity,
            },
            meta: {
                tokensEstimate: 0,
                truncated,
                nextQuerySuggestion: truncated
                    ? `Use scope or kind filter to narrow results`
                    : null,
            },
        };

        result.meta.tokensEstimate = this.estimateTokens(result);
        return result;
    }

    // ============================================
    // Impact Query
    // ============================================

    impact(target: string, options?: ImpactOptions): ImpactResult {
        const depth = Math.min(options?.depth ?? 2, 4);
        const limit = Math.min(options?.limit ?? 30, 100);

        // Resolve target to node ID
        const nodeId = this.resolveTarget(target);
        const node = nodeId ? this.store.getNode(nodeId) : undefined;

        if (!nodeId || !node) {
            return this.emptyImpactResult(target);
        }

        // Find dependents at each depth level
        const dependentsByDepth = this.findDependentsByDepth(nodeId, depth);

        // Find affected entrypoints
        const allDependents = new Set<string>();
        for (const deps of Object.values(dependentsByDepth)) {
            for (const dep of deps) {
                allDependents.add(dep);
            }
        }

        const affectedEntrypoints = this.findAffectedEntrypoints(allDependents);

        // Assess risk
        const riskAssessment = this.assessRisk(
            dependentsByDepth,
            affectedEntrypoints.length
        );

        const result: ImpactResult = {
            target,
            targetType: node.kind === 'symbol' ? 'symbol' : 'file',
            directDependents: dependentsByDepth[1]?.slice(0, limit) ?? [],
            transitiveImpact: {
                depth1: dependentsByDepth[1]?.length ?? 0,
                depth2: dependentsByDepth[2]?.length ?? 0,
                depth3: dependentsByDepth[3]?.length ?? 0,
            },
            affectedEntrypoints: affectedEntrypoints.slice(0, 10),
            riskAssessment,
            meta: {
                tokensEstimate: 0,
                truncated: allDependents.size > limit,
                depthReached: depth,
            },
        };

        result.meta.tokensEstimate = this.estimateTokens(result);
        return result;
    }

    // ============================================
    // Helper Methods
    // ============================================

    private groupEntrypointsByType(entrypoints: GraphNode[]): DigestResult['entrypoints'] {
        const result: DigestResult['entrypoints'] = {
            routes: [],
            commands: [],
            pages: [],
            jobs: [],
        };

        for (const ep of entrypoints) {
            const type = ep.meta?.entrypointType;
            const name = ep.name;

            switch (type) {
                case 'route':
                case 'api':
                    if (result.routes.length < 5) result.routes.push(name);
                    break;
                case 'command':
                    if (result.commands.length < 5) result.commands.push(name);
                    break;
                case 'page':
                    if (result.pages.length < 5) result.pages.push(name);
                    break;
                case 'job':
                    if (result.jobs.length < 5) result.jobs.push(name);
                    break;
            }
        }

        return result;
    }

    private findHotspots(
        files: GraphNode[],
        limit: number
    ): DigestResult['hotspots'] {
        const hotspots: Array<{ path: string; importers: number; exports: number }> = [];

        // Build a map of file paths to their importer counts
        // We need to count edges where the 'to' field references this file
        const allEdges = this.store.getAllEdges();
        const importerCounts = new Map<string, number>();

        for (const edge of allEdges) {
            // edge.to could be:
            // - "file:path/to/file.ts" (TypeScript resolved)
            // - "file:path/to/file.py" (Python resolved relative import)
            // - "module:package-name" (external package - skip)
            
            const toValue = edge.to;
            
            // If it's a file reference, extract the path
            if (toValue.startsWith('file:')) {
                const targetPath = toValue.slice(5); // Remove "file:" prefix
                importerCounts.set(targetPath, (importerCounts.get(targetPath) || 0) + 1);
            }
            // Skip module: references - they are external packages
        }

        for (const file of files) {
            if (!file.path) continue;

            const importers = importerCounts.get(file.path) || 0;
            const exports = file.meta?.exports?.length ?? 0;

            if (importers > 0) {
                hotspots.push({
                    path: file.path,
                    importers,
                    exports,
                });
            }
        }

        // Sort by importers descending
        hotspots.sort((a, b) => b.importers - a.importers);

        // If no hotspots found (e.g., no resolved imports), fallback to files with most exports
        if (hotspots.length === 0) {
            const filesWithExports = files
                .filter(f => f.path && (f.meta?.exports?.length ?? 0) > 0)
                .map(f => ({
                    path: f.path as string,
                    importers: 0,
                    exports: f.meta?.exports?.length ?? 0,
                }))
                .sort((a, b) => b.exports - a.exports);
            
            return filesWithExports.slice(0, limit);
        }

        return hotspots.slice(0, limit);
    }

    /**
     * Find hotspots using LSP reference counts (more accurate)
     * Falls back to graph-based detection if LSP is unavailable
     */
    async findHotspotsWithLsp(
        files: GraphNode[],
        limit: number
    ): Promise<DigestResult['hotspots']> {
        const lspEnhancer = getLspEnhancer();
        
        if (!lspEnhancer) {
            logger.debug('LSP not available, using graph-based hotspot detection');
            return this.findHotspots(files, limit);
        }

        const hotspots: Array<{ path: string; importers: number; exports: number; lspRefs?: number }> = [];

        // First, get graph-based counts as baseline
        const graphHotspots = this.findHotspots(files, Math.min(limit * 2, 50));
        
        // Enhance top candidates with LSP reference counts
        for (const hotspot of graphHotspots.slice(0, 20)) {
            try {
                const exportRefs = await lspEnhancer.getExportReferences(hotspot.path);
                
                // Count total external references across all exports
                let totalLspRefs = 0;
                for (const ref of exportRefs) {
                    const externalRefs = ref.references.filter(r => r.path !== hotspot.path);
                    totalLspRefs += externalRefs.length;
                }

                hotspots.push({
                    ...hotspot,
                    lspRefs: totalLspRefs,
                    // Use LSP refs if available, otherwise fall back to graph importers
                    importers: totalLspRefs > 0 ? totalLspRefs : hotspot.importers,
                });
            } catch {
                // LSP failed for this file, use graph data
                hotspots.push(hotspot);
            }
        }

        // Sort by importers (which now includes LSP refs where available)
        hotspots.sort((a, b) => b.importers - a.importers);

        logger.debug('LSP-enhanced hotspot detection complete', {
            total: hotspots.length,
            withLspRefs: hotspots.filter(h => h.lspRefs !== undefined).length,
        });

        return hotspots.slice(0, limit);
    }

    /**
     * Get digest with optional LSP enhancement (async version)
     */
    async digestWithLsp(options?: DigestOptions): Promise<DigestResult> {
        const scope = options?.scope ?? null;
        const limit = options?.limit ?? 10;
        const useLsp = options?.useLspForHotspots ?? false;

        const allNodes = this.store.getAllNodes();
        const filteredNodes = scope
            ? allNodes.filter((n) => n.path?.startsWith(scope))
            : allNodes;

        const files = filteredNodes.filter((n) => n.kind === 'file');
        const entrypoints = filteredNodes.filter((n) => n.kind === 'entrypoint');
        const modules = filteredNodes.filter((n) => n.kind === 'module');

        // Group entrypoints by type
        const entrypointsByType = this.groupEntrypointsByType(entrypoints);

        // Find hotspots (with optional LSP enhancement)
        const hotspots = useLsp 
            ? await this.findHotspotsWithLsp(files, limit)
            : this.findHotspots(files, limit);

        // Count issues by kind
        const issues = this.store.getIssues();
        const filteredIssues = scope
            ? issues.filter((i) => i.meta?.filePath?.startsWith(scope))
            : issues;

        const issuesByKind: Record<IssueKind, number> = {
            HANDLER_UNREACHABLE: 0,
            DYNAMIC_EDGE_UNKNOWN: 0,
            BROKEN_EXPORT_CHAIN: 0,
            CIRCULAR_REEXPORT: 0,
            CIRCULAR_DEPENDENCY: 0,
            ORPHAN_EXPORT: 0,
            ENTRY_MISSING_HANDLER: 0,
            NOT_REGISTERED: 0,
            CYCLE_RISK: 0,
            LAYER_VIOLATION: 0,
        };

        for (const issue of filteredIssues) {
            issuesByKind[issue.kind]++;
        }

        const result: DigestResult = {
            summary: {
                files: files.length,
                modules: modules.length,
                entrypoints: entrypoints.length,
                edges: this.store.edgeCount,
            },
            entrypoints: entrypointsByType,
            hotspots,
            issues: issuesByKind,
            meta: {
                lastIndexed: new Date(this.store.getMeta().lastIndexed).toISOString(),
                tokensEstimate: 0,
                truncated: false,
                scopeApplied: scope,
                lspEnhanced: useLsp,
            },
        };

        result.meta.tokensEstimate = this.estimateTokens(result);
        return result;
    }

    private resolveTarget(target: string): string | null {
        // Try as node ID first
        if (this.store.getNode(target)) {
            return target;
        }

        // Try as file path
        const byPath = this.store.getNodeByPath(target);
        if (byPath) {
            return byPath.id;
        }

        // Try as file:path format
        const fileId = `file:${target}`;
        if (this.store.getNode(fileId)) {
            return fileId;
        }

        return null;
    }

    private findDependentsByDepth(
        nodeId: string,
        maxDepth: number
    ): Record<number, string[]> {
        const result: Record<number, string[]> = {};
        const visited = new Set<string>([nodeId]);
        let currentLevel = new Set<string>([nodeId]);

        for (let depth = 1; depth <= maxDepth; depth++) {
            const nextLevel = new Set<string>();

            for (const id of currentLevel) {
                const edges = this.store.getEdgesTo(id);
                for (const edge of edges) {
                    if (!visited.has(edge.from)) {
                        visited.add(edge.from);
                        nextLevel.add(edge.from);
                    }
                }
            }

            result[depth] = Array.from(nextLevel).map((id) => {
                const node = this.store.getNode(id);
                return node?.path ?? id;
            });

            currentLevel = nextLevel;
        }

        return result;
    }

    private findAffectedEntrypoints(
        dependents: Set<string>
    ): ImpactResult['affectedEntrypoints'] {
        const entrypoints = this.store.getNodesByKind('entrypoint');
        const affected: ImpactResult['affectedEntrypoints'] = [];

        for (const ep of entrypoints) {
            if (dependents.has(ep.id) || this.isReachableFrom(ep.id, dependents)) {
                affected.push({
                    type: ep.meta?.entrypointType ?? 'unknown',
                    name: ep.name,
                    path: ep.path ?? '',
                });
            }
        }

        return affected;
    }

    private isReachableFrom(startId: string, targets: Set<string>): boolean {
        const visited = new Set<string>();
        const queue = [startId];

        while (queue.length > 0) {
            const current = queue.shift();
            if (!current || visited.has(current)) continue;
            visited.add(current);

            if (targets.has(current)) return true;

            const edges = this.store.getEdgesFrom(current);
            for (const edge of edges) {
                if (edge.kind === 'imports' && edge.to !== 'unknown') {
                    queue.push(edge.to);
                }
            }
        }

        return false;
    }

    private assessRisk(
        dependentsByDepth: Record<number, string[]>,
        entrypointCount: number
    ): ImpactResult['riskAssessment'] {
        const totalDependents =
            (dependentsByDepth[1]?.length ?? 0) +
            (dependentsByDepth[2]?.length ?? 0) +
            (dependentsByDepth[3]?.length ?? 0);

        const factors: string[] = [];
        let level: 'low' | 'medium' | 'high' | 'critical' = 'low';

        if (totalDependents > 20) {
            factors.push(`${totalDependents} files affected transitively`);
            level = 'high';
        } else if (totalDependents > 10) {
            factors.push(`${totalDependents} files affected`);
            level = 'medium';
        }

        if (entrypointCount > 3) {
            factors.push(`${entrypointCount} entrypoints depend on this`);
            level = 'high';
        } else if (entrypointCount > 0) {
            factors.push(`${entrypointCount} entrypoint(s) affected`);
        }

        if (totalDependents > 30 && entrypointCount > 5) {
            level = 'critical';
        }

        const reasons: Record<typeof level, string> = {
            low: 'Limited impact, safe to modify',
            medium: 'Moderate impact, review dependents',
            high: 'Wide impact, careful review needed',
            critical: 'Critical module, extensive testing required',
        };

        return {
            level,
            reason: reasons[level],
            factors,
        };
    }

    private emptyImpactResult(target: string): ImpactResult {
        return {
            target,
            targetType: 'file',
            directDependents: [],
            transitiveImpact: { depth1: 0, depth2: 0, depth3: 0 },
            affectedEntrypoints: [],
            riskAssessment: {
                level: 'low',
                reason: 'Target not found in graph',
                factors: ['File may not be indexed'],
            },
            meta: {
                tokensEstimate: 100,
                truncated: false,
                depthReached: 0,
            },
        };
    }

    private severityRank(severity: IssueSeverity): number {
        const ranks: Record<IssueSeverity, number> = {
            info: 1,
            warning: 2,
            error: 3,
        };
        return ranks[severity];
    }

    private estimateTokens(data: unknown): number {
        const json = JSON.stringify(data);
        return Math.ceil(json.length / CHARS_PER_TOKEN);
    }

    // ============================================
    // Path Query (v0.2)
    // ============================================

    path(from: string, to: string, options?: PathQueryOptions): PathResult {
        const maxDepth = Math.min(options?.maxDepth ?? 5, 10);
        const maxPaths = Math.min(options?.maxPaths ?? 3, 10);

        const fromId = this.resolveTarget(from);
        const toId = this.resolveTarget(to);

        if (!fromId || !toId) {
            return {
                from,
                to,
                paths: [],
                connected: false,
                shortestPath: null,
                meta: {
                    tokensEstimate: 100,
                    truncated: false,
                    maxDepthReached: false,
                },
            };
        }

        const paths = this.findPaths(fromId, toId, maxDepth, maxPaths);
        const connected = paths.length > 0;
        const shortestPath = connected ? Math.min(...paths.map((p) => p.length)) : null;

        const result: PathResult = {
            from,
            to,
            paths: paths.map((p) => ({
                nodes: p.nodes.map((id) => {
                    const node = this.store.getNode(id);
                    return node?.path ?? id;
                }),
                edges: p.edges,
                length: p.length,
            })),
            connected,
            shortestPath,
            meta: {
                tokensEstimate: 0,
                truncated: paths.length >= maxPaths,
                maxDepthReached: paths.some((p) => p.length >= maxDepth),
            },
        };

        result.meta.tokensEstimate = this.estimateTokens(result);
        return result;
    }

    private findPaths(
        fromId: string,
        toId: string,
        maxDepth: number,
        maxPaths: number
    ): Array<{ nodes: string[]; edges: string[]; length: number }> {
        const paths: Array<{ nodes: string[]; edges: string[]; length: number }> = [];
        
        // BFS to find shortest paths
        const queue: Array<{ nodeId: string; path: string[]; edges: string[] }> = [
            { nodeId: fromId, path: [fromId], edges: [] },
        ];
        const visited = new Map<string, number>(); // nodeId -> shortest distance
        visited.set(fromId, 0);

        while (queue.length > 0 && paths.length < maxPaths) {
            const current = queue.shift();
            if (!current) continue;
            
            if (current.path.length > maxDepth) continue;

            if (current.nodeId === toId) {
                paths.push({
                    nodes: current.path,
                    edges: current.edges,
                    length: current.path.length - 1,
                });
                continue;
            }

            const edges = this.store.getEdgesFrom(current.nodeId);
            for (const edge of edges) {
                if (edge.to === 'unknown') continue;
                
                const newDist = current.path.length;
                const prevDist = visited.get(edge.to);
                
                // Allow revisiting if we found a path of same length (for multiple paths)
                if (prevDist === undefined || newDist <= prevDist + 1) {
                    visited.set(edge.to, newDist);
                    queue.push({
                        nodeId: edge.to,
                        path: [...current.path, edge.to],
                        edges: [...current.edges, edge.id],
                    });
                }
            }
        }

        return paths;
    }

    // ============================================
    // Module Query (v0.2)
    // ============================================

    module(target: string, _options?: ModuleQueryOptions): ModuleResult {
        const nodeId = this.resolveTarget(target);
        const node = nodeId ? this.store.getNode(nodeId) : undefined;

        if (!nodeId || !node) {
            return this.emptyModuleResult(target);
        }

        // Get imports (outgoing edges)
        const importEdges = this.store.getEdgesFrom(nodeId);
        const imports: ModuleResult['imports'] = importEdges
            .filter((e) => e.kind === 'imports' && e.to !== 'unknown')
            .map((e) => {
                const targetNode = this.store.getNode(e.to);
                return {
                    path: targetNode?.path ?? e.to,
                    kind: e.kind,
                    confidence: e.confidence,
                };
            });

        // Get importedBy (incoming edges)
        const importedByEdges = this.store.getEdgesTo(nodeId);
        const importedBy: ModuleResult['importedBy'] = importedByEdges
            .filter((e) => e.kind === 'imports')
            .map((e) => {
                const sourceNode = this.store.getNode(e.from);
                return {
                    path: sourceNode?.path ?? e.from,
                    kind: e.kind,
                };
            });

        // Get exports
        const exports = (node.meta?.exports as string[]) ?? [];

        // Get re-exports
        const reexportEdges = importEdges.filter((e) => e.kind === 'reexports');
        const reexports: ModuleResult['reexports'] = reexportEdges.map((e) => {
            const targetNode = this.store.getNode(e.to);
            return {
                source: targetNode?.path ?? e.to,
                symbols: '*', // Would need barrel analyzer for detailed info
            };
        });

        // Check if barrel file
        const isBarrel = node.meta?.entrypointType === 'barrel' ||
            (node.path?.endsWith('index.ts') && reexports.length > 0) || false;

        // Get related entrypoints
        const entrypoints = this.getRelatedEntrypoints(nodeId);

        const result: ModuleResult = {
            id: nodeId,
            path: node.path,
            name: node.name,
            kind: node.kind,
            imports,
            importedBy,
            exports,
            reexports,
            entrypoints,
            isBarrel,
            meta: {
                tokensEstimate: 0,
                framework: node.meta?.framework as string | undefined,
            },
        };

        result.meta.tokensEstimate = this.estimateTokens(result);
        return result;
    }

    private getRelatedEntrypoints(nodeId: string): ModuleResult['entrypoints'] {
        const entrypoints = this.store.getNodesByKind('entrypoint');
        const related: ModuleResult['entrypoints'] = [];

        for (const ep of entrypoints) {
            // Check if this entrypoint is for the same file
            if (ep.path === this.store.getNode(nodeId)?.path) {
                related.push({
                    type: (ep.meta?.entrypointType as string) ?? 'unknown',
                    name: ep.name,
                });
            }
        }

        return related;
    }

    private emptyModuleResult(target: string): ModuleResult {
        return {
            id: `file:${target}`,
            path: target,
            name: target.split('/').pop() ?? target,
            kind: 'file',
            imports: [],
            importedBy: [],
            exports: [],
            reexports: [],
            entrypoints: [],
            isBarrel: false,
            meta: {
                tokensEstimate: 100,
            },
        };
    }
}
