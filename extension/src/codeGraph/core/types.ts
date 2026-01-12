/**
 * Code Graph Core Types
 * Type definitions for nodes, edges, issues, and graph state
 */

// ============================================
// Confidence & Enums
// ============================================

export type Confidence = 'high' | 'medium' | 'low' | 'unknown';

export type NodeKind = 'file' | 'module' | 'symbol' | 'entrypoint';

export type EdgeKind =
    | 'imports'
    | 'exports'
    | 'reexports'
    | 'calls'
    | 'registers'
    | 'unknown';

export type IssueKind =
    | 'HANDLER_UNREACHABLE'
    | 'DYNAMIC_EDGE_UNKNOWN'
    | 'BROKEN_EXPORT_CHAIN'
    | 'CIRCULAR_REEXPORT'
    | 'CIRCULAR_DEPENDENCY'
    | 'ORPHAN_EXPORT'
    // v0.3 - Framework-specific issues
    | 'ENTRY_MISSING_HANDLER'
    | 'NOT_REGISTERED'
    // v0.5 - Architecture issues
    | 'CYCLE_RISK'
    | 'LAYER_VIOLATION';

export type IssueSeverity = 'info' | 'warning' | 'error';

export type EntrypointType = 'route' | 'page' | 'command' | 'job' | 'api' | 'barrel' | 'main' | 'module' | 'layout' | 'component' | 'test' | 'middleware' | 'story';

// ============================================
// Framework Detection (v0.3)
// ============================================

export interface FrameworkDetection {
    name: string;
    displayName: string;
    confidence: 'high' | 'medium' | 'low';
    version?: string;
}

// ============================================
// Graph Nodes
// ============================================

export interface NodeMeta {
    loc?: { line: number; column: number };
    framework?: string;
    entrypointType?: EntrypointType;
    confidence?: Confidence;
    exports?: string[];
    [key: string]: unknown;
}

export interface GraphNode {
    id: string;
    kind: NodeKind;
    name: string;
    path?: string;
    meta?: NodeMeta;
}

// ============================================
// Graph Edges
// ============================================

export interface EdgeMeta {
    importPath?: string;
    isTypeOnly?: boolean;
    isDynamic?: boolean;
    loc?: { line: number; column: number };
    [key: string]: unknown;
}

export interface GraphEdge {
    id: string;
    from: string;
    to: string;
    kind: EdgeKind;
    confidence: Confidence;
    reason?: string;
    meta?: EdgeMeta;
}


// ============================================
// Issues (Missing Links)
// ============================================

export interface IssueMeta {
    filePath?: string;
    line?: number;
    symbol?: string;
    affectedCount?: number;
    [key: string]: unknown;
}

export interface GraphIssue {
    id: string;
    kind: IssueKind;
    severity: IssueSeverity;
    nodeId?: string;
    entrypointId?: string;
    /** Short title for display */
    title?: string;
    /** Detailed message */
    message?: string;
    /** Evidence array for detailed display */
    evidence?: string[] | Record<string, unknown>;
    /** Suggested fix(es) */
    suggestedFix?: string | string[];
    meta?: IssueMeta;
}

// ============================================
// Graph State & Meta
// ============================================

export interface GraphMeta {
    version: string;
    lastIndexed: number;
    indexDuration: number;
    fileCount: number;
    nodeCount: number;
    edgeCount: number;
    issueCount: number;
}

export interface GraphState {
    nodes: Map<string, GraphNode>;
    edges: Map<string, GraphEdge>;
    issues: GraphIssue[];
    meta: GraphMeta;
}

// ============================================
// Indexer Types
// ============================================

export interface IndexResult {
    nodes: GraphNode[];
    edges: GraphEdge[];
    errors?: IndexError[];
}

export interface IndexError {
    file: string;
    line?: number;
    message: string;
    recoverable: boolean;
}

// ============================================
// Configuration Types
// ============================================

export interface EntrypointPattern {
    glob: string;
    type: EntrypointType;
    confidence: Confidence;
}

export interface GraphConfig {
    indexing: {
        include: string[];
        exclude: string[];
        maxFileSize: number;
    };
    entrypoints: {
        patterns: EntrypointPattern[];
        frameworks: string[];
    };
    output: {
        digestTokenLimit: number;
        issuesTokenLimit: number;
        impactTokenLimit: number;
    };
    /** External tools configuration (v1.1) */
    externalTools?: ExternalToolsConfig;
}

// ============================================
// External Tools Configuration (v1.1)
// ============================================

export type ExternalToolChoice = 'auto' | 'external' | 'builtin';

export interface ExternalToolsConfig {
    /** Whether to prefer external tools when available */
    preferExternal: boolean;
    /** JavaScript/TypeScript tool configuration */
    javascript: {
        tool: ExternalToolChoice;
        /** Path to dependency-cruiser config file */
        configPath?: string;
    };
    /** Python tool configuration */
    python: {
        tool: ExternalToolChoice;
    };
    /** Go tool configuration */
    go: {
        tool: ExternalToolChoice;
    };
    /** Java tool configuration */
    java: {
        tool: ExternalToolChoice;
    };
    /** Rust tool configuration */
    rust: {
        tool: ExternalToolChoice;
    };
}

// ============================================
// Query Result Types
// ============================================

export interface DigestResult {
    summary: {
        files: number;
        modules: number;
        entrypoints: number;
        edges: number;
    };
    entrypoints: {
        routes: string[];
        commands: string[];
        pages: string[];
        jobs: string[];
    };
    hotspots: Array<{
        path: string;
        importers: number;
        exports: number;
    }>;
    issues: Record<IssueKind, number>;
    meta: {
        lastIndexed: string;
        tokensEstimate: number;
        truncated: boolean;
        scopeApplied: string | null;
    };
}

export interface IssueListResult {
    issues: Array<{
        id: string;
        kind: IssueKind;
        severity: IssueSeverity;
        file: string;
        summary: string;
        evidence: string[];
        suggestedFix: string[];
    }>;
    stats: {
        total: number;
        returned: number;
        byKind: Record<string, number>;
        bySeverity: Record<string, number>;
    };
    meta: {
        tokensEstimate: number;
        truncated: boolean;
        nextQuerySuggestion: string | null;
    };
}

export interface ImpactResult {
    target: string;
    targetType: 'file' | 'symbol';
    directDependents: string[];
    transitiveImpact: {
        depth1: number;
        depth2: number;
        depth3: number;
    };
    affectedEntrypoints: Array<{
        type: string;
        name: string;
        path: string;
    }>;
    riskAssessment: {
        level: 'low' | 'medium' | 'high' | 'critical';
        reason: string;
        factors: string[];
    };
    meta: {
        tokensEstimate: number;
        truncated: boolean;
        depthReached: number;
    };
}

// ============================================
// v0.2 Query Result Types
// ============================================

export interface PathResult {
    from: string;
    to: string;
    paths: Array<{
        nodes: string[];
        edges: string[];
        length: number;
    }>;
    connected: boolean;
    shortestPath: number | null;
    meta: {
        tokensEstimate: number;
        truncated: boolean;
        maxDepthReached: boolean;
    };
}

export interface ModuleResult {
    id: string;
    path: string | undefined;
    name: string;
    kind: NodeKind;
    imports: Array<{
        path: string;
        kind: EdgeKind;
        confidence: Confidence;
    }>;
    importedBy: Array<{
        path: string;
        kind: EdgeKind;
    }>;
    exports: string[];
    reexports: Array<{
        source: string;
        symbols: string[] | '*';
    }>;
    entrypoints: Array<{
        type: string;
        name: string;
    }>;
    isBarrel: boolean;
    meta: {
        tokensEstimate: number;
        framework?: string;
    };
}

export interface AnnotationsResult {
    edges: Array<{
        from: string;
        to: string;
        kind: string;
        reason: string;
    }>;
    entrypoints: Array<{
        path: string;
        type: string;
        name: string;
    }>;
    ignores: Array<{
        issueKind: IssueKind;
        path: string;
        reason: string;
    }>;
    stats: {
        totalEdges: number;
        totalEntrypoints: number;
        totalIgnores: number;
    };
    meta: {
        tokensEstimate: number;
        filePath: string;
    };
}
