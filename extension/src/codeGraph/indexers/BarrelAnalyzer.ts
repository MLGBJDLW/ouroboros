/**
 * Barrel Analyzer
 * Analyzes barrel files (index.ts) for re-export chains and validates export integrity
 */

import type { GraphStore } from '../core/GraphStore';
import type { GraphNode, GraphEdge, GraphIssue, Confidence } from '../core/types';

export interface BarrelInfo {
    path: string;
    reexports: ReexportInfo[];
    isBarrel: boolean;
    depth: number;
}

export interface ReexportInfo {
    source: string;
    symbols: string[] | '*';
    resolved: boolean;
    resolvedPath?: string;
    confidence: Confidence;
}

export interface BarrelChain {
    start: string;
    chain: string[];
    isCircular: boolean;
    depth: number;
}

// Regex patterns for re-export detection
const REEXPORT_ALL_REGEX = /export\s+\*\s+from\s+['"]([^'"]+)['"]/g;
const REEXPORT_NAMED_REGEX = /export\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;
const REEXPORT_AS_REGEX = /export\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g;

export class BarrelAnalyzer {
    private barrelCache: Map<string, BarrelInfo> = new Map();

    constructor(private store: GraphStore) {}

    /**
     * Analyze a file to determine if it's a barrel and extract re-export info
     */
    analyzeFile(filePath: string, content: string): BarrelInfo {
        if (this.barrelCache.has(filePath)) {
            const cached = this.barrelCache.get(filePath);
            if (cached) return cached;
        }

        const reexports = this.extractReexports(content);
        const isBarrel = this.isBarrelFile(filePath, content, reexports);

        const info: BarrelInfo = {
            path: filePath,
            reexports,
            isBarrel,
            depth: 0,
        };

        this.barrelCache.set(filePath, info);
        return info;
    }

    /**
     * Extract all re-exports from file content
     */
    private extractReexports(content: string): ReexportInfo[] {
        const reexports: ReexportInfo[] = [];

        // export * from './module'
        let match: RegExpExecArray | null;
        REEXPORT_ALL_REGEX.lastIndex = 0;
        while ((match = REEXPORT_ALL_REGEX.exec(content)) !== null) {
            reexports.push({
                source: match[1],
                symbols: '*',
                resolved: false,
                confidence: 'high',
            });
        }

        // export { a, b, c } from './module'
        REEXPORT_NAMED_REGEX.lastIndex = 0;
        while ((match = REEXPORT_NAMED_REGEX.exec(content)) !== null) {
            const symbols = match[1]
                .split(',')
                .map((s) => s.trim())
                .map((s) => {
                    // Handle 'x as y' syntax
                    const asMatch = s.match(/(\w+)\s+as\s+(\w+)/);
                    return asMatch ? asMatch[1] : s;
                })
                .filter((s) => s.length > 0);

            reexports.push({
                source: match[2],
                symbols,
                resolved: false,
                confidence: 'high',
            });
        }

        // export * as namespace from './module'
        REEXPORT_AS_REGEX.lastIndex = 0;
        while ((match = REEXPORT_AS_REGEX.exec(content)) !== null) {
            reexports.push({
                source: match[2],
                symbols: '*',
                resolved: false,
                confidence: 'high',
            });
        }

        return reexports;
    }

    /**
     * Determine if a file is a barrel file
     */
    private isBarrelFile(
        filePath: string,
        content: string,
        reexports: ReexportInfo[]
    ): boolean {
        // Must be an index file
        if (!filePath.endsWith('index.ts') && 
            !filePath.endsWith('index.tsx') &&
            !filePath.endsWith('index.js') &&
            !filePath.endsWith('index.jsx')) {
            return false;
        }

        // Must have at least one re-export
        if (reexports.length === 0) {
            return false;
        }

        // Check if file is primarily re-exports
        const lines = content.split('\n').filter((line) => {
            const trimmed = line.trim();
            return trimmed.length > 0 && !trimmed.startsWith('//') && !trimmed.startsWith('/*');
        });

        const exportLines = lines.filter(
            (line) => line.includes('export') || line.includes('import')
        );

        // If more than 80% of lines are exports/imports, it's a barrel
        return exportLines.length / lines.length >= 0.8;
    }

    /**
     * Trace re-export chain to find the original source
     */
    traceReexportChain(
        startPath: string,
        symbol: string,
        maxDepth = 10
    ): BarrelChain {
        const chain: string[] = [startPath];
        const visited = new Set<string>([startPath]);
        let currentPath = startPath;
        let depth = 0;

        while (depth < maxDepth) {
            const node = this.store.getNodeByPath(currentPath);
            if (!node) break;

            // Get re-export edges from this file
            const edges = this.store.getEdgesFrom(node.id);
            const reexportEdge = edges.find(
                (e) => e.kind === 'reexports' && e.to !== 'unknown'
            );

            if (!reexportEdge) break;

            // Extract target path from edge
            const targetId = reexportEdge.to;
            const targetNode = this.store.getNode(targetId);
            if (!targetNode?.path) break;

            // Check for circular reference
            if (visited.has(targetNode.path)) {
                chain.push(targetNode.path);
                return {
                    start: startPath,
                    chain,
                    isCircular: true,
                    depth: depth + 1,
                };
            }

            visited.add(targetNode.path);
            chain.push(targetNode.path);
            currentPath = targetNode.path;
            depth++;
        }

        return {
            start: startPath,
            chain,
            isCircular: false,
            depth,
        };
    }

    /**
     * Validate that all re-exported symbols exist in source
     */
    validateReexports(barrelPath: string, content: string): GraphIssue[] {
        const issues: GraphIssue[] = [];
        const barrelInfo = this.analyzeFile(barrelPath, content);

        for (const reexport of barrelInfo.reexports) {
            if (reexport.symbols === '*') {
                // Can't validate wildcard re-exports without parsing source
                continue;
            }

            // Find the source file
            const sourceNode = this.findSourceNode(barrelPath, reexport.source);
            if (!sourceNode) {
                issues.push({
                    id: `issue:broken-reexport:${barrelPath}:${reexport.source}`,
                    kind: 'BROKEN_EXPORT_CHAIN',
                    severity: 'error',
                    nodeId: `file:${barrelPath}`,
                    title: `Re-export source not found: ${reexport.source}`,
                    evidence: [
                        `Barrel file re-exports from '${reexport.source}'`,
                        `Source file could not be resolved`,
                    ],
                    suggestedFix: [
                        'Check if the source file exists',
                        'Verify the import path is correct',
                    ],
                    meta: {
                        filePath: barrelPath,
                        symbol: reexport.source,
                    },
                });
                continue;
            }

            // Check if source exports the required symbols
            const sourceExports = sourceNode.meta?.exports as string[] | undefined;
            if (sourceExports && Array.isArray(reexport.symbols)) {
                for (const symbol of reexport.symbols) {
                    if (!sourceExports.includes(symbol)) {
                        issues.push({
                            id: `issue:missing-export:${barrelPath}:${symbol}`,
                            kind: 'BROKEN_EXPORT_CHAIN',
                            severity: 'error',
                            nodeId: `file:${barrelPath}`,
                            title: `Re-exported symbol '${symbol}' not found in source`,
                            evidence: [
                                `Barrel re-exports '${symbol}' from '${reexport.source}'`,
                                `Source file does not export '${symbol}'`,
                                `Available exports: ${sourceExports.slice(0, 5).join(', ')}${sourceExports.length > 5 ? '...' : ''}`,
                            ],
                            suggestedFix: [
                                `Add 'export { ${symbol} }' to source file`,
                                'Fix the symbol name in the re-export',
                            ],
                            meta: {
                                filePath: barrelPath,
                                symbol,
                            },
                        });
                    }
                }
            }
        }

        return issues;
    }

    /**
     * Detect circular re-export chains
     */
    detectCircularReexports(): GraphIssue[] {
        const issues: GraphIssue[] = [];
        const visited = new Set<string>();

        for (const node of this.store.getNodesByKind('file')) {
            if (!node.path || visited.has(node.path)) continue;

            const chain = this.traceReexportChain(node.path, '*');
            
            // Mark all nodes in chain as visited
            for (const p of chain.chain) {
                visited.add(p);
            }

            if (chain.isCircular) {
                issues.push({
                    id: `issue:circular-reexport:${node.path}`,
                    kind: 'BROKEN_EXPORT_CHAIN',
                    severity: 'warning',
                    nodeId: node.id,
                    title: 'Circular re-export chain detected',
                    evidence: [
                        `Re-export chain: ${chain.chain.join(' → ')}`,
                        `Chain length: ${chain.depth}`,
                    ],
                    suggestedFix: [
                        'Break the circular dependency',
                        'Move shared exports to a separate module',
                    ],
                    meta: {
                        filePath: node.path,
                        affectedCount: chain.chain.length,
                    },
                });
            }
        }

        return issues;
    }

    /**
     * Find source node for a re-export path
     */
    private findSourceNode(fromPath: string, _importPath: string): GraphNode | null {
        // Try to find the resolved edge
        const fromNode = this.store.getNodeByPath(fromPath);
        if (!fromNode) return null;

        const edges = this.store.getEdgesFrom(fromNode.id);
        for (const edge of edges) {
            if (edge.kind === 'reexports' || edge.kind === 'imports') {
                const targetNode = this.store.getNode(edge.to);
                if (targetNode) return targetNode;
            }
        }

        return null;
    }

    /**
     * Get all barrel files in the graph
     */
    getAllBarrels(): BarrelInfo[] {
        return Array.from(this.barrelCache.values()).filter((b) => b.isBarrel);
    }

    /**
     * Clear the barrel cache
     */
    clearCache(): void {
        this.barrelCache.clear();
    }

    /**
     * Create edges for barrel re-exports
     */
    createBarrelEdges(barrelPath: string, content: string): GraphEdge[] {
        const edges: GraphEdge[] = [];
        const barrelInfo = this.analyzeFile(barrelPath, content);

        for (const reexport of barrelInfo.reexports) {
            edges.push({
                id: `edge:${barrelPath}:reexports:${reexport.source}`,
                from: `file:${barrelPath}`,
                to: `file:${reexport.resolvedPath ?? reexport.source}`,
                kind: 'reexports',
                confidence: reexport.confidence,
                reason: reexport.symbols === '*' ? 'wildcard re-export' : 'named re-export',
                meta: {
                    importPath: reexport.source,
                },
            });
        }

        return edges;
    }
}
