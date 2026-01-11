/**
 * Cycle Detector
 * Detects circular dependencies using Tarjan's strongly connected components algorithm
 */

import type { GraphStore } from '../core/GraphStore';
import type { GraphIssue } from '../core/types';
import { createLogger } from '../../utils/logger';

const logger = createLogger('CycleDetector');

export interface Cycle {
    /** Nodes involved in the cycle */
    nodes: string[];
    /** Cycle length */
    length: number;
    /** Severity based on length and node types */
    severity: 'warning' | 'error';
    /** Suggested places to break the cycle */
    breakPoints: string[];
    /** Human-readable description */
    description: string;
}

export interface CycleDetectorOptions {
    /** Minimum cycle length to report (default: 2) */
    minLength?: number;
    /** Maximum cycles to return (default: 20) */
    maxCycles?: number;
    /** Scope to limit detection (glob pattern) */
    scope?: string;
}

export class CycleDetector {
    private store: GraphStore;

    constructor(store: GraphStore) {
        this.store = store;
    }

    /**
     * Find all cycles in the dependency graph using Tarjan's algorithm
     */
    findCycles(options: CycleDetectorOptions = {}): Cycle[] {
        const { minLength = 2, maxCycles = 20, scope } = options;
        
        // Build adjacency list from edges
        const adjacency = this.buildAdjacencyList(scope);
        
        // Run Tarjan's algorithm to find strongly connected components
        const sccs = this.tarjanSCC(adjacency);
        
        // Filter SCCs to get cycles (components with more than 1 node or self-loops)
        const cycles: Cycle[] = [];
        
        for (const scc of sccs) {
            if (scc.length >= minLength) {
                // Check if it's a real cycle (has internal edges)
                if (this.hasInternalEdges(scc, adjacency)) {
                    const cycle = this.createCycle(scc, adjacency);
                    cycles.push(cycle);
                    
                    if (cycles.length >= maxCycles) break;
                }
            } else if (scc.length === 1) {
                // Check for self-loop
                const node = scc[0];
                if (adjacency.get(node)?.includes(node)) {
                    cycles.push({
                        nodes: [node],
                        length: 1,
                        severity: 'error',
                        breakPoints: [node],
                        description: `Self-referencing import in ${this.getNodeName(node)}`,
                    });
                }
            }
        }

        // Sort by severity (errors first) then by length
        cycles.sort((a, b) => {
            if (a.severity !== b.severity) {
                return a.severity === 'error' ? -1 : 1;
            }
            return b.length - a.length;
        });

        logger.info(`Found ${cycles.length} cycles`);
        return cycles;
    }

    /**
     * Convert cycles to GraphIssues
     */
    detectCycleIssues(options: CycleDetectorOptions = {}): GraphIssue[] {
        const cycles = this.findCycles(options);
        
        return cycles.map((cycle, index) => ({
            id: `issue:cycle:${index}`,
            kind: 'CYCLE_RISK' as const,
            severity: cycle.severity,
            title: `Circular dependency detected (${cycle.length} files)`,
            message: cycle.description,
            evidence: cycle.nodes.map(n => this.getNodeName(n)),
            suggestedFix: [
                `Break the cycle at one of: ${cycle.breakPoints.map(n => this.getNodeName(n)).join(', ')}`,
                'Consider extracting shared code to a separate module',
                'Use dependency injection to invert the dependency',
            ],
            meta: {
                cycleLength: cycle.length,
                breakPoints: cycle.breakPoints,
            },
        }));
    }

    /**
     * Build adjacency list from graph edges
     */
    private buildAdjacencyList(scope?: string): Map<string, string[]> {
        const adjacency = new Map<string, string[]>();
        const edges = this.store.getAllEdges();

        for (const edge of edges) {
            // Only consider import edges
            if (edge.kind !== 'imports') continue;

            // Apply scope filter
            if (scope) {
                const fromPath = edge.from.replace('file:', '');
                if (!this.matchesScope(fromPath, scope)) continue;
            }

            const from = edge.from;
            const to = edge.to;

            if (!adjacency.has(from)) {
                adjacency.set(from, []);
            }
            const fromList = adjacency.get(from);
            if (fromList) {
                fromList.push(to);
            }

            // Ensure 'to' node exists in adjacency
            if (!adjacency.has(to)) {
                adjacency.set(to, []);
            }
        }

        return adjacency;
    }

    /**
     * Tarjan's strongly connected components algorithm
     */
    private tarjanSCC(adjacency: Map<string, string[]>): string[][] {
        const index = new Map<string, number>();
        const lowlink = new Map<string, number>();
        const onStack = new Set<string>();
        const stack: string[] = [];
        const sccs: string[][] = [];
        let currentIndex = 0;

        const strongConnect = (node: string) => {
            index.set(node, currentIndex);
            lowlink.set(node, currentIndex);
            currentIndex++;
            stack.push(node);
            onStack.add(node);

            const neighbors = adjacency.get(node) ?? [];
            for (const neighbor of neighbors) {
                if (!index.has(neighbor)) {
                    // Neighbor not yet visited
                    strongConnect(neighbor);
                    const nodeLowlink = lowlink.get(node);
                    const neighborLowlink = lowlink.get(neighbor);
                    if (nodeLowlink !== undefined && neighborLowlink !== undefined) {
                        lowlink.set(node, Math.min(nodeLowlink, neighborLowlink));
                    }
                } else if (onStack.has(neighbor)) {
                    // Neighbor is on stack, part of current SCC
                    const nodeLowlink = lowlink.get(node);
                    const neighborIndex = index.get(neighbor);
                    if (nodeLowlink !== undefined && neighborIndex !== undefined) {
                        lowlink.set(node, Math.min(nodeLowlink, neighborIndex));
                    }
                }
            }

            // If node is a root node, pop the stack and generate SCC
            if (lowlink.get(node) === index.get(node)) {
                const scc: string[] = [];
                let w: string | undefined;
                do {
                    w = stack.pop();
                    if (w) {
                        onStack.delete(w);
                        scc.push(w);
                    }
                } while (w && w !== node);
                sccs.push(scc);
            }
        };

        // Run for all nodes
        for (const node of adjacency.keys()) {
            if (!index.has(node)) {
                strongConnect(node);
            }
        }

        return sccs;
    }

    /**
     * Check if SCC has internal edges (is a real cycle)
     */
    private hasInternalEdges(scc: string[], adjacency: Map<string, string[]>): boolean {
        const sccSet = new Set(scc);
        
        for (const node of scc) {
            const neighbors = adjacency.get(node) ?? [];
            for (const neighbor of neighbors) {
                if (sccSet.has(neighbor) && neighbor !== node) {
                    return true;
                }
            }
        }
        
        return false;
    }

    /**
     * Create Cycle object from SCC
     */
    private createCycle(scc: string[], adjacency: Map<string, string[]>): Cycle {
        // Find the actual cycle path
        const cyclePath = this.findCyclePath(scc, adjacency);
        
        // Determine severity
        const severity = scc.length > 3 ? 'error' : 'warning';
        
        // Find best break points (nodes with most external dependencies)
        const breakPoints = this.findBreakPoints(scc, adjacency);
        
        // Create description
        const nodeNames = cyclePath.map(n => this.getNodeName(n));
        const description = `Circular dependency: ${nodeNames.join(' → ')} → ${nodeNames[0]}`;

        return {
            nodes: cyclePath,
            length: cyclePath.length,
            severity,
            breakPoints,
            description,
        };
    }

    /**
     * Find the actual cycle path within an SCC
     */
    private findCyclePath(scc: string[], adjacency: Map<string, string[]>): string[] {
        if (scc.length <= 1) return scc;

        const sccSet = new Set(scc);
        const visited = new Set<string>();
        const path: string[] = [];

        // DFS to find a cycle
        const dfs = (node: string, target: string): boolean => {
            if (visited.has(node)) {
                return node === target && path.length > 0;
            }
            
            visited.add(node);
            path.push(node);

            const neighbors = adjacency.get(node) ?? [];
            for (const neighbor of neighbors) {
                if (sccSet.has(neighbor)) {
                    if (neighbor === target && path.length > 1) {
                        return true;
                    }
                    if (!visited.has(neighbor) && dfs(neighbor, target)) {
                        return true;
                    }
                }
            }

            path.pop();
            visited.delete(node);
            return false;
        };

        // Start from first node
        const start = scc[0];
        dfs(start, start);

        return path.length > 0 ? path : scc;
    }

    /**
     * Find best nodes to break the cycle
     */
    private findBreakPoints(scc: string[], adjacency: Map<string, string[]>): string[] {
        const sccSet = new Set(scc);
        const scores = new Map<string, number>();

        // Score each node by how many external dependencies it has
        for (const node of scc) {
            let externalDeps = 0;
            const neighbors = adjacency.get(node) ?? [];
            
            for (const neighbor of neighbors) {
                if (!sccSet.has(neighbor)) {
                    externalDeps++;
                }
            }
            
            scores.set(node, externalDeps);
        }

        // Sort by score (higher = better break point)
        const sorted = [...scc].sort((a, b) => (scores.get(b) ?? 0) - (scores.get(a) ?? 0));
        
        // Return top 3 break points
        return sorted.slice(0, 3);
    }

    /**
     * Check if path matches scope pattern
     */
    private matchesScope(path: string, scope: string): boolean {
        // Simple glob matching
        if (scope.endsWith('/**')) {
            const prefix = scope.slice(0, -3);
            return path.startsWith(prefix);
        }
        if (scope.endsWith('/*')) {
            const prefix = scope.slice(0, -2);
            return path.startsWith(prefix) && !path.slice(prefix.length + 1).includes('/');
        }
        return path.startsWith(scope);
    }

    /**
     * Get human-readable node name
     */
    private getNodeName(nodeId: string): string {
        return nodeId.replace(/^(file|module):/, '');
    }
}
