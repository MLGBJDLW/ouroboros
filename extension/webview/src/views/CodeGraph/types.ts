/**
 * Code Graph Types
 * Type definitions for the enhanced Code Graph UI
 */

// Graph Node for visualization
export interface GraphNode {
    id: string;
    path: string;
    name: string;
    type: 'file' | 'directory' | 'entrypoint' | 'hotspot';
    language?: string;
    issueCount: number;
    importers: number;
    exports: number;
    isEntrypoint: boolean;
    isHotspot: boolean;
    depth: number;
    // For force graph
    x?: number;
    y?: number;
    fx?: number | null;
    fy?: number | null;
    color?: string;
    val?: number;
}

// Graph Edge for visualization
export interface GraphEdge {
    source: string;
    target: string;
    type: 'import' | 'export' | 'reexport' | 'dynamic';
    weight: number;
}

// Graph data structure
export interface GraphData {
    nodes: GraphNode[];
    links: GraphEdge[];
}

// Digest from backend
export interface GraphDigest {
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
    hotspots: HotspotInfo[];
    issues: Record<string, number>;
    meta: {
        lastIndexed: string;
        tokensEstimate: number;
    };
}

// Hotspot info
export interface HotspotInfo {
    path: string;
    importers: number;
    exports: number;
}

// Issue from backend
export interface GraphIssue {
    id: string;
    kind: IssueKind;
    severity: 'info' | 'warning' | 'error';
    file: string;
    summary: string;
    evidence: string[];
    suggestedFix: string[];
}

// Issue types
export type IssueKind = 
    | 'HANDLER_UNREACHABLE'
    | 'DYNAMIC_EDGE_UNKNOWN'
    | 'BROKEN_EXPORT_CHAIN'
    | 'CIRCULAR_REEXPORT'
    | 'ORPHAN_EXPORT'
    | 'ENTRY_MISSING_HANDLER'
    | 'NOT_REGISTERED'
    | 'CYCLE_RISK'
    | 'LAYER_VIOLATION';

// Impact analysis result
export interface ImpactResult {
    target: string;
    depth: number;
    affectedFiles: AffectedFile[];
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    summary: string;
}

export interface AffectedFile {
    path: string;
    distance: number;
    reason: string;
    isEntrypoint: boolean;
}

// Module info
export interface ModuleInfo {
    path: string;
    imports: string[];
    exports: string[];
    dependents: string[];
    isEntrypoint: boolean;
    entrypointType?: string;
    issues: GraphIssue[];
}

// File tree node
export interface FileTreeNode {
    id: string;
    name: string;
    path: string;
    type: 'file' | 'directory';
    children?: FileTreeNode[];
    issueCount: number;
    isEntrypoint: boolean;
    isHotspot: boolean;
    expanded?: boolean;
}

// View mode
export type ViewMode = 'overview' | 'graph' | 'tree' | 'issues' | 'hotspots';

// Graph view settings
export interface GraphSettings {
    showLabels: boolean;
    showEdges: boolean;
    highlightEntrypoints: boolean;
    highlightHotspots: boolean;
    nodeSize: 'small' | 'medium' | 'large';
    layout: 'force' | 'radial' | 'tree';
}

// Selection state
export interface SelectionState {
    selectedNode: string | null;
    hoveredNode: string | null;
    impactTarget: string | null;
    highlightedNodes: Set<string>;
}

// Context item for Copilot
export interface GraphContextItem {
    type: 'issue' | 'hotspot' | 'digest' | 'impact' | 'module';
    data: unknown;
    timestamp: number;
}
