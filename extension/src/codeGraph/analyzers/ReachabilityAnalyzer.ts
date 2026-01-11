/**
 * Reachability Analyzer
 * Analyzes code reachability from entrypoints to detect unreachable code
 */

import type { GraphStore } from '../core/GraphStore';
import type { GraphNode } from '../core/types';

export interface ReachabilityResult {
    reachable: Set<string>;
    unreachable: Set<string>;
    entrypointCoverage: Map<string, Set<string>>;
}

export class ReachabilityAnalyzer {
    constructor(private store: GraphStore) {}

    /**
     * Analyze reachability from all entrypoints
     */
    analyze(): ReachabilityResult {
        const entrypoints = this.store.getNodesByKind('entrypoint');
        const allFiles = this.store.getNodesByKind('file');
        
        const reachable = new Set<string>();
        const entrypointCoverage = new Map<string, Set<string>>();

        // BFS from each entrypoint
        for (const entrypoint of entrypoints) {
            const reachableFromEntry = this.bfsFromNode(entrypoint.id);
            entrypointCoverage.set(entrypoint.id, reachableFromEntry);
            
            for (const nodeId of reachableFromEntry) {
                reachable.add(nodeId);
            }
        }

        // Find unreachable files
        const unreachable = new Set<string>();
        for (const file of allFiles) {
            if (!reachable.has(file.id)) {
                unreachable.add(file.id);
            }
        }

        return { reachable, unreachable, entrypointCoverage };
    }

    /**
     * Check if a specific node is reachable from any entrypoint
     */
    isReachable(nodeId: string): boolean {
        const entrypoints = this.store.getNodesByKind('entrypoint');
        
        for (const entrypoint of entrypoints) {
            if (this.isReachableFrom(entrypoint.id, nodeId)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Find which entrypoints can reach a given node
     */
    findReachingEntrypoints(nodeId: string): GraphNode[] {
        const entrypoints = this.store.getNodesByKind('entrypoint');
        const reaching: GraphNode[] = [];

        for (const entrypoint of entrypoints) {
            if (this.isReachableFrom(entrypoint.id, nodeId)) {
                reaching.push(entrypoint);
            }
        }

        return reaching;
    }

    /**
     * BFS to find all nodes reachable from a starting node
     */
    private bfsFromNode(startId: string): Set<string> {
        const visited = new Set<string>();
        const queue = [startId];

        while (queue.length > 0) {
            const current = queue.shift();
            if (!current || visited.has(current)) continue;
            
            visited.add(current);

            // Follow outgoing edges (imports)
            const edges = this.store.getEdgesFrom(current);
            for (const edge of edges) {
                if (edge.kind === 'imports' || edge.kind === 'reexports') {
                    if (!visited.has(edge.to)) {
                        queue.push(edge.to);
                    }
                }
            }
        }

        return visited;
    }

    /**
     * Check if target is reachable from source
     */
    private isReachableFrom(sourceId: string, targetId: string): boolean {
        const visited = new Set<string>();
        const queue = [sourceId];

        while (queue.length > 0) {
            const current = queue.shift();
            if (!current || visited.has(current)) continue;
            
            if (current === targetId) return true;
            
            visited.add(current);

            const edges = this.store.getEdgesFrom(current);
            for (const edge of edges) {
                if (edge.kind === 'imports' || edge.kind === 'reexports') {
                    if (!visited.has(edge.to)) {
                        queue.push(edge.to);
                    }
                }
            }
        }

        return false;
    }

    /**
     * Get reachability statistics
     */
    getStats(): {
        totalFiles: number;
        reachableFiles: number;
        unreachableFiles: number;
        coveragePercent: number;
    } {
        const result = this.analyze();
        const totalFiles = this.store.getNodesByKind('file').length;
        const reachableFiles = result.reachable.size;
        const unreachableFiles = result.unreachable.size;

        return {
            totalFiles,
            reachableFiles,
            unreachableFiles,
            coveragePercent: totalFiles > 0 ? (reachableFiles / totalFiles) * 100 : 100,
        };
    }
}
