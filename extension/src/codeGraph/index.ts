/**
 * Code Graph Module
 * Exports all public APIs for the Code Graph system
 */

// Core
export { GraphStore } from './core/GraphStore';
export { GraphQuery } from './core/GraphQuery';
export { PathResolver, type TSConfigPaths, type ResolvedPath } from './core/PathResolver';
export type {
    GraphNode,
    GraphEdge,
    GraphIssue,
    GraphState,
    GraphMeta,
    GraphConfig,
    DigestResult,
    IssueListResult,
    ImpactResult,
    PathResult,
    ModuleResult,
    AnnotationsResult,
    Confidence,
    NodeKind,
    EdgeKind,
    IssueKind,
    IssueSeverity,
    EntrypointType,
    IndexResult,
    IndexError,
} from './core/types';

// Indexers
export { BaseIndexer, type IndexerOptions } from './indexers/BaseIndexer';
export { TypeScriptIndexer } from './indexers/TypeScriptIndexer';
export { EntrypointDetector, type EntrypointPattern } from './indexers/EntrypointDetector';
export { BarrelAnalyzer, type BarrelInfo, type ReexportInfo, type BarrelChain } from './indexers/BarrelAnalyzer';

// Analyzers
export { ReachabilityAnalyzer, type ReachabilityResult } from './analyzers/ReachabilityAnalyzer';
export { IssueDetector } from './analyzers/IssueDetector';

// Annotations
export { AnnotationManager, type ManualEdge, type ManualEntrypoint, type IgnoreRule, type AnnotationFile } from './annotations/AnnotationManager';

// Watcher
export { IncrementalWatcher, type WatcherOptions } from './watcher/IncrementalWatcher';

// Manager
export { CodeGraphManager } from './CodeGraphManager';
