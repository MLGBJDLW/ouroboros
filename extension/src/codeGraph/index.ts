/**
 * Code Graph Module
 * Exports all public APIs for the Code Graph system
 */

// Core
export { GraphStore } from './core/GraphStore';
export { GraphQuery } from './core/GraphQuery';
export { PathResolver, type TSConfigPaths, type ResolvedPath } from './core/PathResolver';
export { QueryCache, getQueryCache, resetQueryCache, type QueryCacheOptions } from './core/QueryCache';
export { ParallelIndexer, createParallelIndexer, type ParallelIndexerOptions, type FileToIndex, type ParallelIndexResult } from './core/ParallelIndexer';
export { 
    ExtensionMapper,
    normalizeExtension,
    getPossibleSourcePaths,
    getPossibleNodeIds,
    isSameFile,
    createCanonicalNodeId,
    EXTENSION_MAPPINGS,
    LANGUAGE_EXTENSION_MAPPINGS,
    SOURCE_EXTENSIONS,
    INDEX_FILES,
    DEFAULT_CONFIG as DEFAULT_EXTENSION_MAPPER_CONFIG,
    type ExtensionMapperConfig,
} from './core/ExtensionMapper';
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
    FrameworkDetection,
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
export { TreeSitterIndexer, type TreeSitterIndexerOptions } from './indexers/TreeSitterIndexer';
export { TypeScriptIndexer } from './indexers/TypeScriptIndexer';
export { PythonIndexer, type PythonIndexerOptions } from './indexers/PythonIndexer';
export { RustIndexer } from './indexers/RustIndexer';
export { GoIndexer } from './indexers/GoIndexer';
export { JavaIndexer } from './indexers/JavaIndexer';
export { GenericIndexer } from './indexers/GenericIndexer';
export { EntrypointDetector, type EntrypointPattern } from './indexers/EntrypointDetector';
export { BarrelAnalyzer, type BarrelInfo, type ReexportInfo, type BarrelChain } from './indexers/BarrelAnalyzer';

// Parsers (v0.4)
export { 
    TreeSitterManager, 
    getTreeSitterManager, 
    resetTreeSitterManager,
    type SupportedLanguage,
    type ParsedNode,
    type ParseTree,
} from './parsers/TreeSitterManager';

// Analyzers
export { ReachabilityAnalyzer, type ReachabilityResult } from './analyzers/ReachabilityAnalyzer';
export { IssueDetector } from './analyzers/IssueDetector';
export { CycleDetector, type Cycle, type CycleDetectorOptions } from './analyzers/CycleDetector';
export { LayerAnalyzer, type LayerRule, type LayerViolation, type LayerAnalyzerOptions, COMMON_LAYER_RULES } from './analyzers/LayerAnalyzer';

// Annotations
export { AnnotationManager, type ManualEdge, type ManualEntrypoint, type IgnoreRule, type AnnotationFile } from './annotations/AnnotationManager';

// Adapters (v0.3)
export { 
    AdapterRegistry, 
    getAdapterRegistry, 
    resetAdapterRegistry,
    registerBuiltinAdapters,
    ExpressAdapter,
    NextjsAdapter,
    NestjsAdapter,
    CliAdapter,
} from './adapters';
export type { FrameworkAdapter, PackageJson, RouteInfo, CommandInfo } from './adapters';

// Watcher
export { IncrementalWatcher, type WatcherOptions } from './watcher/IncrementalWatcher';

// Manager
export { CodeGraphManager } from './CodeGraphManager';
