/**
 * Graph Store
 * Central storage for the code graph with indexed lookups
 */

import type {
    GraphNode,
    GraphEdge,
    GraphIssue,
    GraphMeta,
    GraphState,
    NodeKind,
    IssueKind,
} from './types';

const GRAPH_VERSION = '1.0.0';

export class GraphStore {
    // Primary storage
    private nodes: Map<string, GraphNode> = new Map();
    private edges: Map<string, GraphEdge> = new Map();
    private issues: GraphIssue[] = [];

    // Indexes for fast lookup
    private edgesByFrom: Map<string, Set<string>> = new Map();
    private edgesByTo: Map<string, Set<string>> = new Map();
    private nodesByKind: Map<NodeKind, Set<string>> = new Map();
    private nodesByPath: Map<string, string> = new Map();

    // Metadata
    private meta: GraphMeta = {
        version: GRAPH_VERSION,
        lastIndexed: 0,
        indexDuration: 0,
        fileCount: 0,
        nodeCount: 0,
        edgeCount: 0,
        issueCount: 0,
    };

    // ============================================
    // Node Operations
    // ============================================

    addNode(node: GraphNode): void {
        this.nodes.set(node.id, node);

        // Update kind index
        if (!this.nodesByKind.has(node.kind)) {
            this.nodesByKind.set(node.kind, new Set());
        }
        this.nodesByKind.get(node.kind)?.add(node.id);

        // Update path index
        if (node.path) {
            this.nodesByPath.set(node.path, node.id);
        }

        this.meta.nodeCount = this.nodes.size;
    }

    getNode(id: string): GraphNode | undefined {
        return this.nodes.get(id);
    }

    getNodeByPath(path: string): GraphNode | undefined {
        const id = this.nodesByPath.get(path);
        return id ? this.nodes.get(id) : undefined;
    }

    getNodesByKind(kind: NodeKind): GraphNode[] {
        const ids = this.nodesByKind.get(kind);
        if (!ids) return [];
        return Array.from(ids)
            .map((id) => this.nodes.get(id))
            .filter((n): n is GraphNode => n !== undefined);
    }


    getAllNodes(): GraphNode[] {
        return Array.from(this.nodes.values());
    }

    removeNode(id: string): void {
        const node = this.nodes.get(id);
        if (!node) return;

        // Remove from kind index
        this.nodesByKind.get(node.kind)?.delete(id);

        // Remove from path index
        if (node.path) {
            this.nodesByPath.delete(node.path);
        }

        // Remove associated edges
        this.removeEdgesForNode(id);

        this.nodes.delete(id);
        this.meta.nodeCount = this.nodes.size;
    }

    // ============================================
    // Edge Operations
    // ============================================

    addEdge(edge: GraphEdge): void {
        this.edges.set(edge.id, edge);

        // Update from index
        if (!this.edgesByFrom.has(edge.from)) {
            this.edgesByFrom.set(edge.from, new Set());
        }
        this.edgesByFrom.get(edge.from)?.add(edge.id);

        // Update to index
        if (!this.edgesByTo.has(edge.to)) {
            this.edgesByTo.set(edge.to, new Set());
        }
        this.edgesByTo.get(edge.to)?.add(edge.id);

        this.meta.edgeCount = this.edges.size;
    }

    getEdge(id: string): GraphEdge | undefined {
        return this.edges.get(id);
    }

    getEdgesFrom(nodeId: string): GraphEdge[] {
        const ids = this.edgesByFrom.get(nodeId);
        if (!ids) return [];
        return Array.from(ids)
            .map((id) => this.edges.get(id))
            .filter((e): e is GraphEdge => e !== undefined);
    }

    getEdgesTo(nodeId: string): GraphEdge[] {
        const ids = this.edgesByTo.get(nodeId);
        if (!ids) return [];
        return Array.from(ids)
            .map((id) => this.edges.get(id))
            .filter((e): e is GraphEdge => e !== undefined);
    }

    getAllEdges(): GraphEdge[] {
        return Array.from(this.edges.values());
    }

    removeEdge(id: string): void {
        const edge = this.edges.get(id);
        if (!edge) return;

        this.edgesByFrom.get(edge.from)?.delete(id);
        this.edgesByTo.get(edge.to)?.delete(id);
        this.edges.delete(id);
        this.meta.edgeCount = this.edges.size;
    }

    removeEdgesForNode(nodeId: string): void {
        // Remove outgoing edges
        const outgoing = this.edgesByFrom.get(nodeId);
        if (outgoing) {
            for (const edgeId of outgoing) {
                const edge = this.edges.get(edgeId);
                if (edge) {
                    this.edgesByTo.get(edge.to)?.delete(edgeId);
                    this.edges.delete(edgeId);
                }
            }
            this.edgesByFrom.delete(nodeId);
        }

        // Remove incoming edges
        const incoming = this.edgesByTo.get(nodeId);
        if (incoming) {
            for (const edgeId of incoming) {
                const edge = this.edges.get(edgeId);
                if (edge) {
                    this.edgesByFrom.get(edge.from)?.delete(edgeId);
                    this.edges.delete(edgeId);
                }
            }
            this.edgesByTo.delete(nodeId);
        }

        this.meta.edgeCount = this.edges.size;
    }

    // ============================================
    // Issue Operations
    // ============================================

    setIssues(issues: GraphIssue[]): void {
        this.issues = issues;
        this.meta.issueCount = issues.length;
    }

    getIssues(): GraphIssue[] {
        return this.issues;
    }

    getIssuesByKind(kind: IssueKind): GraphIssue[] {
        return this.issues.filter((i) => i.kind === kind);
    }

    addIssue(issue: GraphIssue): void {
        this.issues.push(issue);
        this.meta.issueCount = this.issues.length;
    }

    clearIssues(): void {
        this.issues = [];
        this.meta.issueCount = 0;
    }

    // ============================================
    // Batch Operations
    // ============================================

    updateFile(filePath: string, nodes: GraphNode[], edges: GraphEdge[]): void {
        // Remove old data for this file
        const existingNodeId = this.nodesByPath.get(filePath);
        if (existingNodeId) {
            this.removeNode(existingNodeId);
        }

        // Add new nodes
        for (const node of nodes) {
            this.addNode(node);
        }

        // Add new edges
        for (const edge of edges) {
            this.addEdge(edge);
        }
    }

    // ============================================
    // Metadata
    // ============================================

    getMeta(): GraphMeta {
        return { ...this.meta };
    }

    updateMeta(updates: Partial<GraphMeta>): void {
        this.meta = { ...this.meta, ...updates };
    }

    // ============================================
    // Serialization
    // ============================================

    toJSON(): GraphState {
        return {
            nodes: this.nodes,
            edges: this.edges,
            issues: this.issues,
            meta: this.meta,
        };
    }

    toSerializable(): {
        nodes: GraphNode[];
        edges: GraphEdge[];
        issues: GraphIssue[];
        meta: GraphMeta;
    } {
        return {
            nodes: Array.from(this.nodes.values()),
            edges: Array.from(this.edges.values()),
            issues: this.issues,
            meta: this.meta,
        };
    }

    fromSerializable(data: {
        nodes: GraphNode[];
        edges: GraphEdge[];
        issues: GraphIssue[];
        meta: GraphMeta;
    }): void {
        this.clear();

        for (const node of data.nodes) {
            this.addNode(node);
        }

        for (const edge of data.edges) {
            this.addEdge(edge);
        }

        this.issues = data.issues;
        this.meta = data.meta;
    }

    // ============================================
    // Utility
    // ============================================

    clear(): void {
        this.nodes.clear();
        this.edges.clear();
        this.issues = [];
        this.edgesByFrom.clear();
        this.edgesByTo.clear();
        this.nodesByKind.clear();
        this.nodesByPath.clear();
        this.meta = {
            version: GRAPH_VERSION,
            lastIndexed: 0,
            indexDuration: 0,
            fileCount: 0,
            nodeCount: 0,
            edgeCount: 0,
            issueCount: 0,
        };
    }

    get nodeCount(): number {
        return this.nodes.size;
    }

    get edgeCount(): number {
        return this.edges.size;
    }

    get issueCount(): number {
        return this.issues.length;
    }
}
