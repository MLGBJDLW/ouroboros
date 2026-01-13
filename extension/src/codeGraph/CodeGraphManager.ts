/**
 * Code Graph Manager
 * Main entry point for the Code Graph system
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { GraphStore } from './core/GraphStore';
import { GraphQuery } from './core/GraphQuery';
import { PathResolver } from './core/PathResolver';
import { TypeScriptIndexer } from './indexers/TypeScriptIndexer';
import { PythonIndexer } from './indexers/PythonIndexer';
import { RustIndexer } from './indexers/RustIndexer';
import { GoIndexer } from './indexers/GoIndexer';
import { JavaIndexer } from './indexers/JavaIndexer';
import { GenericIndexer } from './indexers/GenericIndexer';
import { EntrypointDetector } from './indexers/EntrypointDetector';
import { BarrelAnalyzer } from './indexers/BarrelAnalyzer';
import { BaseIndexer } from './indexers/BaseIndexer';
import { IssueDetector } from './analyzers/IssueDetector';
import { IncrementalWatcher } from './watcher/IncrementalWatcher';
import { AnnotationManager } from './annotations/AnnotationManager';
import { getAdapterRegistry, registerBuiltinAdapters, DependencyCruiserAdapter, GoModGraphAdapter, JdepsAdapter } from './adapters';
import { getTreeSitterManager, type TreeSitterManager } from './parsers/TreeSitterManager';
import { CycleDetector } from './analyzers/CycleDetector';
import { LayerAnalyzer } from './analyzers/LayerAnalyzer';
import { QueryCache, getQueryCache } from './core/QueryCache';
import { ParallelIndexer } from './core/ParallelIndexer';
import type { AdapterRegistry } from './adapters';
import type { DigestResult, IssueListResult, ImpactResult, PathResult, ModuleResult, GraphConfig, FrameworkDetection, ExternalToolsConfig } from './core/types';
import { createLogger } from '../utils/logger';

const logger = createLogger('CodeGraphManager');

/**
 * Default external tools configuration
 * 
 * NOTE: dependency-cruiser is BUNDLED with the extension, so it's always available
 * for JS/TS projects. Other language tools (go, jdeps) require system installation.
 * 
 * Default behavior:
 * - JS/TS: Use bundled dependency-cruiser (auto)
 * - Go/Java: Use built-in indexers (system tools optional)
 * - Python/Rust: Use built-in indexers only
 */
const DEFAULT_EXTERNAL_TOOLS_CONFIG: ExternalToolsConfig = {
    preferExternal: true,  // Enable external tools by default
    javascript: { tool: 'auto' }, // Use bundled dependency-cruiser
    python: { tool: 'builtin' },  // No bundled tool available
    go: { tool: 'builtin' },      // Requires Go installation
    java: { tool: 'builtin' },    // Requires JDK installation
    rust: { tool: 'builtin' },    // No good external tool
};

const DEFAULT_CONFIG: GraphConfig = {
    indexing: {
        include: [
            // TypeScript/JavaScript
            '**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.mjs', '**/*.cjs',
            // Python
            '**/*.py', '**/*.pyi',
            // Rust, Go, Java, Kotlin, C#
            '**/*.rs', '**/*.go', '**/*.java', '**/*.kt', '**/*.kts', '**/*.cs',
            // Ruby, PHP
            '**/*.rb', '**/*.php',
            // C/C++
            '**/*.c', '**/*.h', '**/*.cpp', '**/*.hpp', '**/*.cc', '**/*.cxx', '**/*.hxx',
            // Swift, Scala
            '**/*.swift', '**/*.scala',
            // Shell
            '**/*.sh', '**/*.bash', '**/*.zsh',
            // Frontend single-file components
            '**/*.vue', '**/*.svelte', '**/*.astro',
        ],
        exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/coverage/**', '**/target/**', '**/vendor/**', '**/.wasp/**'],
        maxFileSize: 1024 * 1024, // 1MB
    },
    entrypoints: {
        patterns: [],
        frameworks: ['nextjs', 'express', 'nestjs', 'cli'],
    },
    output: {
        digestTokenLimit: 500,
        issuesTokenLimit: 1000,
        impactTokenLimit: 800,
    },
};

export class CodeGraphManager implements vscode.Disposable {
    private store: GraphStore;
    private query: GraphQuery;
    private pathResolver: PathResolver;
    private indexers: BaseIndexer[];
    private entrypointDetector: EntrypointDetector;
    private barrelAnalyzer: BarrelAnalyzer;
    private issueDetector: IssueDetector;
    private annotationManager: AnnotationManager;
    private adapterRegistry: AdapterRegistry;
    private treeSitterManager: TreeSitterManager;
    private cycleDetector: CycleDetector;
    private layerAnalyzer: LayerAnalyzer;
    private queryCache: QueryCache;
    private parallelIndexer: ParallelIndexer;
    private watcher: IncrementalWatcher | null = null;
    private config: GraphConfig;
    private externalToolsConfig: ExternalToolsConfig;
    private workspaceRoot: string;
    private extensionPath: string;
    private isIndexing = false;
    private disposables: vscode.Disposable[] = [];
    private detectedFrameworks: FrameworkDetection[] = [];
    
    // External tool adapters (v1.1)
    private dependencyCruiserAdapter: DependencyCruiserAdapter | null = null;
    private goModGraphAdapter: GoModGraphAdapter | null = null;
    private jdepsAdapter: JdepsAdapter | null = null;

    constructor(workspaceRoot: string, config?: Partial<GraphConfig>, extensionPath?: string) {
        this.workspaceRoot = workspaceRoot;
        this.extensionPath = extensionPath ?? workspaceRoot;
        const fileConfig = CodeGraphManager.loadGraphConfig(workspaceRoot);
        this.config = {
            ...DEFAULT_CONFIG,
            ...fileConfig,
            ...config,
            indexing: {
                ...DEFAULT_CONFIG.indexing,
                ...fileConfig?.indexing,
                ...config?.indexing,
            },
            entrypoints: {
                ...DEFAULT_CONFIG.entrypoints,
                ...fileConfig?.entrypoints,
                ...config?.entrypoints,
            },
            output: {
                ...DEFAULT_CONFIG.output,
                ...fileConfig?.output,
                ...config?.output,
            },
        };
        
        // v1.1: Initialize external tools config
        this.externalToolsConfig = {
            ...DEFAULT_EXTERNAL_TOOLS_CONFIG,
            ...fileConfig?.externalTools,
            ...config?.externalTools,
        };
        
        this.store = new GraphStore();
        this.query = new GraphQuery(this.store);
        this.pathResolver = new PathResolver(workspaceRoot);
        this.barrelAnalyzer = new BarrelAnalyzer(this.store);
        this.entrypointDetector = new EntrypointDetector();
        this.issueDetector = new IssueDetector(this.store);
        this.annotationManager = new AnnotationManager(workspaceRoot);
        
        // v0.5: Initialize architecture analyzers
        this.cycleDetector = new CycleDetector(this.store);
        this.layerAnalyzer = new LayerAnalyzer(this.store);
        
        // v1.0: Initialize performance optimizations
        this.queryCache = getQueryCache({ maxSize: 100, ttl: 5 * 60 * 1000 });
        this.parallelIndexer = new ParallelIndexer({ batchSize: 50, maxConcurrency: 4 });
        
        // v0.3: Initialize adapter registry
        registerBuiltinAdapters();
        this.adapterRegistry = getAdapterRegistry();
        
        // v1.1: Initialize external tool adapters
        this.initializeExternalToolAdapters();
        
        // v0.4: Initialize tree-sitter manager
        this.treeSitterManager = getTreeSitterManager(this.extensionPath);
        
        // Initialize indexers for all supported languages
        const indexerOptions = {
            workspaceRoot,
            include: this.config.indexing.include,
            exclude: this.config.indexing.exclude,
            maxFileSize: this.config.indexing.maxFileSize,
        };
        
        const treeSitterOptions = {
            ...indexerOptions,
            treeSitterManager: this.treeSitterManager,
        };
        
        this.indexers = [
            // TypeScript/JavaScript (uses TS Compiler API - highest accuracy)
            new TypeScriptIndexer(indexerOptions),
            // v0.4: Tree-sitter based indexers
            new PythonIndexer(treeSitterOptions),
            new RustIndexer(treeSitterOptions),
            new GoIndexer(treeSitterOptions),
            new JavaIndexer(treeSitterOptions),
            // Fallback for other languages
            new GenericIndexer(indexerOptions),
        ];

        logger.info('CodeGraphManager initialized');
    }

    private static loadGraphConfig(workspaceRoot: string): Partial<GraphConfig> | undefined {
        const configPath = path.join(workspaceRoot, '.ouroboros', 'graph', 'config.json');
        if (!fs.existsSync(configPath)) {
            return undefined;
        }

        try {
            const raw = fs.readFileSync(configPath, 'utf8');
            const parsed = JSON.parse(raw) as Partial<GraphConfig>;
            logger.info('Loaded graph config', { path: configPath });
            return parsed;
        } catch (error) {
            logger.warn('Failed to load graph config, using defaults', {
                path: configPath,
                error: error instanceof Error ? error.message : String(error),
            });
            return undefined;
        }
    }

    /**
     * Initialize external tool adapters (v1.1)
     */
    private initializeExternalToolAdapters(): void {
        const jsConfig = this.externalToolsConfig.javascript;
        const goConfig = this.externalToolsConfig.go;
        const javaConfig = this.externalToolsConfig.java;
        
        // Collect exclude patterns from all registered adapters
        const adapterExcludes: string[] = [];
        for (const adapter of this.adapterRegistry.getAdapters()) {
            if (adapter.excludePatterns) {
                adapterExcludes.push(...adapter.excludePatterns);
            }
        }
        
        // Initialize DependencyCruiserAdapter for JS/TS
        if (jsConfig.tool !== 'builtin') {
            this.dependencyCruiserAdapter = new DependencyCruiserAdapter(
                this.workspaceRoot,
                {
                    enabled: true,
                    include: ['src'],
                    exclude: [
                        ...this.config.indexing.exclude.map(p => 
                            p.replace(/^\*\*\//, '').replace(/\/\*\*$/, '')
                        ),
                        ...adapterExcludes,
                    ],
                }
            );
            logger.info('DependencyCruiserAdapter initialized');
        }

        // Initialize GoModGraphAdapter for Go
        if (goConfig.tool !== 'builtin') {
            this.goModGraphAdapter = new GoModGraphAdapter(this.workspaceRoot, {
                enabled: true,
            });
            logger.info('GoModGraphAdapter initialized');
        }

        // Initialize JdepsAdapter for Java
        if (javaConfig.tool !== 'builtin') {
            this.jdepsAdapter = new JdepsAdapter(this.workspaceRoot, {
                enabled: true,
            });
            logger.info('JdepsAdapter initialized');
        }
    }

    /**
     * Initialize and perform full index
     */
    async initialize(): Promise<void> {
        logger.info('Initializing Code Graph...');
        
        // Load tsconfig for path resolution
        const tsconfig = await PathResolver.loadTSConfig(this.workspaceRoot);
        this.pathResolver.updateConfig(tsconfig);
        
        // Load annotations
        await this.annotationManager.load();
        
        // v0.3: Detect frameworks
        this.detectedFrameworks = await this.adapterRegistry.detectFrameworks(this.workspaceRoot);
        if (this.detectedFrameworks.length > 0) {
            logger.info(`Detected frameworks: ${this.detectedFrameworks.map(f => f.displayName).join(', ')}`);
        }
        
        await this.fullIndex();
        this.startWatcher();
        logger.info('Code Graph initialized');
    }

    /**
     * Perform full index of the workspace
     */
    async fullIndex(): Promise<void> {
        if (this.isIndexing) {
            logger.warn('Indexing already in progress');
            return;
        }

        this.isIndexing = true;
        const startTime = Date.now();

        try {
            this.store.clear();
            this.queryCache.invalidate(); // v1.0: Invalidate cache on reindex

            // Find all files
            const uris = await this.findFiles();
            logger.info(`Found ${uris.length} files to index`);

            // v1.1: Try external tools first for supported languages
            const externalToolResult = await this.runExternalToolAnalysis();
            const jsFilesHandledByExternal = new Set<string>();
            const handledExtensions = externalToolResult?.handledExtensions ?? new Set<string>();
            
            if (externalToolResult) {
                logger.info(`External tools provided ${externalToolResult.nodes.length} nodes, ${externalToolResult.edges.length} edges`);
                
                // Add external tool results to store
                for (const node of externalToolResult.nodes) {
                    this.store.addNode(node);
                    if (node.path) {
                        jsFilesHandledByExternal.add(node.path);
                    }
                }
                for (const edge of externalToolResult.edges) {
                    this.store.addEdge(edge);
                }
                // External tool issues will be added later with other issues
            }

            // v1.0: Prepare files for parallel indexing (skip files handled by external tools)
            const filesToIndex: Array<{ path: string; content: string }> = [];
            for (const uri of uris) {
                const filePath = this.getRelativePath(uri);
                
                // v1.1: Skip files if already handled by external tool based on extension
                const ext = path.extname(filePath);
                if (handledExtensions.has(ext) && jsFilesHandledByExternal.has(filePath)) {
                    continue;
                }
                
                const indexer = this.indexers.find((i) => i.supports(filePath));
                if (!indexer) continue;

                try {
                    const content = await this.readFile(uri);
                    if (content.length > this.config.indexing.maxFileSize) {
                        logger.debug(`Skipping large file: ${filePath}`);
                        continue;
                    }
                    filesToIndex.push({ path: filePath, content });
                } catch {
                    logger.debug(`Could not read file: ${filePath}`);
                }
            }

            // v1.0: Use parallel indexer for better performance
            const indexResult = await this.parallelIndexer.indexAll(filesToIndex, this.indexers);
            
            for (const node of indexResult.nodes) {
                this.store.addNode(node);
            }
            
            for (const edge of indexResult.edges) {
                this.store.addEdge(edge);
            }

            const fileCount = indexResult.stats.successCount;

            // Detect issues
            const issues = this.issueDetector.detectAll();
            
            // Detect barrel-related issues
            const barrelIssues = this.barrelAnalyzer.detectCircularReexports();
            
            // v0.3: Run framework adapters
            const frameworkEntrypoints = await this.adapterRegistry.extractAllEntrypoints(this.store, this.workspaceRoot);
            for (const ep of frameworkEntrypoints) {
                this.store.addNode(ep);
            }
            
            const frameworkEdges = await this.adapterRegistry.extractAllRegistrations(this.store, this.workspaceRoot);
            for (const edge of frameworkEdges) {
                this.store.addEdge(edge);
            }
            
            const frameworkIssues = await this.adapterRegistry.detectAllIssues(this.store);
            
            // v0.5: Detect cycle and layer issues
            const cycleIssues = this.cycleDetector.detectCycleIssues();
            const layerIssues = this.layerAnalyzer.detectLayerIssues();
            
            // v1.1: Include external tool issues
            const externalToolIssues = externalToolResult?.issues ?? [];
            
            // Filter out ignored issues
            const allIssues = [...issues, ...barrelIssues, ...frameworkIssues, ...cycleIssues, ...layerIssues, ...externalToolIssues];
            const filteredIssues = [];
            for (const issue of allIssues) {
                const shouldIgnore = await this.annotationManager.shouldIgnore(
                    issue.kind,
                    issue.meta?.filePath ?? ''
                );
                if (!shouldIgnore) {
                    filteredIssues.push(issue);
                }
            }
            
            this.store.setIssues(filteredIssues);
            
            // Add annotation edges and entrypoints
            const annotationEdges = await this.annotationManager.getGraphEdges();
            for (const edge of annotationEdges) {
                this.store.addEdge(edge);
            }
            
            const annotationEntrypoints = await this.annotationManager.getGraphEntrypoints();
            for (const ep of annotationEntrypoints) {
                this.store.addNode(ep);
            }

            const duration = Date.now() - startTime;
            this.store.updateMeta({
                lastIndexed: Date.now(),
                indexDuration: duration,
                fileCount,
            });

            logger.info(`Indexed ${fileCount} files in ${duration}ms, found ${filteredIssues.length} issues`);
        } finally {
            this.isIndexing = false;
        }
    }

    /**
     * Run external tool analysis for supported languages (v1.1)
     * Returns results from external tools like dependency-cruiser, go mod graph, jdeps
     */
    private async runExternalToolAnalysis(): Promise<{
        nodes: import('./core/types').GraphNode[];
        edges: import('./core/types').GraphEdge[];
        issues: import('./core/types').GraphIssue[];
        handledExtensions: Set<string>;
    } | null> {
        const allNodes: import('./core/types').GraphNode[] = [];
        const allEdges: import('./core/types').GraphEdge[] = [];
        const allIssues: import('./core/types').GraphIssue[] = [];
        const handledExtensions = new Set<string>();

        // Check if we should use external tools
        if (!this.externalToolsConfig.preferExternal) {
            return null;
        }

        // Try dependency-cruiser for JS/TS
        const jsConfig = this.externalToolsConfig.javascript;
        if (this.dependencyCruiserAdapter && jsConfig.tool !== 'builtin') {
            try {
                const isAvailable = await this.dependencyCruiserAdapter.checkAvailability();
                
                if (jsConfig.tool === 'auto' && !isAvailable) {
                    logger.info('dependency-cruiser not available, falling back to built-in indexer for JS/TS');
                } else if (jsConfig.tool === 'external' && !isAvailable) {
                    logger.warn('dependency-cruiser required but not available');
                } else if (isAvailable) {
                    logger.info('Using dependency-cruiser for JS/TS analysis');
                    const result = await this.dependencyCruiserAdapter.analyze();
                    if (result) {
                        allNodes.push(...result.nodes);
                        allEdges.push(...result.edges);
                        allIssues.push(...result.issues);
                        // Mark JS/TS extensions as handled
                        ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts'].forEach(ext => handledExtensions.add(ext));
                    }
                }
            } catch (error) {
                logger.error('dependency-cruiser analysis failed:', error);
            }
        }

        // Try go mod graph for Go
        const goConfig = this.externalToolsConfig.go;
        if (this.goModGraphAdapter && goConfig.tool !== 'builtin') {
            try {
                const isAvailable = await this.goModGraphAdapter.checkAvailability();
                
                if (goConfig.tool === 'auto' && !isAvailable) {
                    logger.info('go mod graph not available, falling back to built-in indexer for Go');
                } else if (goConfig.tool === 'external' && !isAvailable) {
                    logger.warn('go mod graph required but not available');
                } else if (isAvailable) {
                    logger.info('Using go mod graph for Go analysis');
                    const result = await this.goModGraphAdapter.analyze();
                    if (result) {
                        allNodes.push(...result.nodes);
                        allEdges.push(...result.edges);
                        allIssues.push(...result.issues);
                        // Note: go mod graph provides module-level deps, still use GoIndexer for file-level
                    }
                }
            } catch (error) {
                logger.error('go mod graph analysis failed:', error);
            }
        }

        // Try jdeps for Java
        const javaConfig = this.externalToolsConfig.java;
        if (this.jdepsAdapter && javaConfig.tool !== 'builtin') {
            try {
                const isAvailable = await this.jdepsAdapter.checkAvailability();
                
                if (javaConfig.tool === 'auto' && !isAvailable) {
                    logger.info('jdeps not available, falling back to built-in indexer for Java');
                } else if (javaConfig.tool === 'external' && !isAvailable) {
                    logger.warn('jdeps required but not available');
                } else if (isAvailable) {
                    logger.info('Using jdeps for Java analysis');
                    const result = await this.jdepsAdapter.analyze();
                    if (result) {
                        allNodes.push(...result.nodes);
                        allEdges.push(...result.edges);
                        allIssues.push(...result.issues);
                        // Note: jdeps provides class-level deps, still use JavaIndexer for source analysis
                    }
                }
            } catch (error) {
                logger.error('jdeps analysis failed:', error);
            }
        }

        if (allNodes.length === 0 && allEdges.length === 0) {
            return null;
        }

        return { nodes: allNodes, edges: allEdges, issues: allIssues, handledExtensions };
    }

    /**
     * Start file watcher for incremental updates
     */
    startWatcher(): void {
        if (this.watcher) {
            this.watcher.dispose();
        }

        this.watcher = new IncrementalWatcher(
            this.store,
            this.indexers,
            this.workspaceRoot
        );
        this.watcher.start();
        this.disposables.push(this.watcher);
    }

    /**
     * Stop file watcher
     */
    stopWatcher(): void {
        if (this.watcher) {
            this.watcher.stop();
        }
    }

    // ============================================
    // Query Methods (for LM Tools) - v1.0: with caching
    // ============================================

    /**
     * Get graph digest
     */
    getDigest(scope?: string): DigestResult {
        const cacheKey = `digest:${scope ?? 'all'}`;
        return this.queryCache.getOrCompute(cacheKey, () => this.query.digest({ scope }));
    }

    /**
     * Get issues list
     */
    getIssues(options?: {
        kind?: string;
        severity?: string;
        scope?: string;
        limit?: number;
    }): IssueListResult {
        const cacheKey = `issues:${JSON.stringify(options ?? {})}`;
        return this.queryCache.getOrCompute(cacheKey, () => this.query.issues({
            kind: options?.kind as import('./core/types').IssueKind,
            severity: options?.severity as import('./core/types').IssueSeverity,
            scope: options?.scope,
            limit: options?.limit,
        }));
    }

    /**
     * Get full file index for UI (tree view)
     * Uses same hotspot logic as GraphQuery.findHotspots() for consistency
     */
    getFileIndex(options?: { hotspotLimit?: number }): {
        files: Array<{
            path: string;
            name: string;
            importers: number;
            exports: number;
            isEntrypoint: boolean;
            isHotspot: boolean;
            language?: string;
        }>;
        meta: { total: number; hotspotLimit: number };
    } {
        const fileNodes = this.store.getNodesByKind('file');
        const entrypointNodes = this.store.getNodesByKind('entrypoint');
        const entrypointPaths = new Set(entrypointNodes.map((n) => n.path).filter(Boolean) as string[]);

        // Count importers for each file (same logic as GraphQuery.findHotspots)
        const importerCounts = new Map<string, number>();
        for (const edge of this.store.getAllEdges()) {
            if (edge.to.startsWith('file:')) {
                const targetPath = edge.to.slice(5);
                importerCounts.set(targetPath, (importerCounts.get(targetPath) ?? 0) + 1);
            }
        }

        // Use same default limit as GraphQuery.digest (10)
        const hotspotLimit = Math.max(1, options?.hotspotLimit ?? 10);
        
        // Determine hotspots - files with most importers
        let hotspotPaths: Set<string>;
        const sortedByImporters = [...importerCounts.entries()]
            .filter(([, count]) => count > 0)
            .sort((a, b) => b[1] - a[1]);
        
        if (sortedByImporters.length > 0) {
            // Primary: files with most importers
            hotspotPaths = new Set(
                sortedByImporters
                    .slice(0, hotspotLimit)
                    .map(([path]) => path)
            );
        } else {
            // Fallback: files with most exports (same as GraphQuery.findHotspots)
            const sortedByExports = fileNodes
                .filter(n => n.path && ((n.meta?.exports as string[] | undefined)?.length ?? 0) > 0)
                .sort((a, b) => {
                    const aExports = (a.meta?.exports as string[] | undefined)?.length ?? 0;
                    const bExports = (b.meta?.exports as string[] | undefined)?.length ?? 0;
                    return bExports - aExports;
                })
                .slice(0, hotspotLimit)
                .map(n => n.path as string);
            hotspotPaths = new Set(sortedByExports);
        }

        const files = fileNodes
            .map((node) => {
                const filePath = node.path ?? '';
                const name = node.name;
                return {
                    path: filePath,
                    name,
                    importers: importerCounts.get(filePath) ?? 0,
                    exports: (node.meta?.exports as string[] | undefined)?.length ?? 0,
                    isEntrypoint: entrypointPaths.has(filePath),
                    isHotspot: hotspotPaths.has(filePath),
                    language: node.meta?.language as string | undefined,
                };
            })
            .filter((file) => file.path);

        return {
            files,
            meta: {
                total: files.length,
                hotspotLimit,
            },
        };
    }

    /**
     * Get impact analysis
     */
    getImpact(target: string, depth?: number): ImpactResult {
        const cacheKey = `impact:${target}:${depth ?? 2}`;
        return this.queryCache.getOrCompute(cacheKey, () => this.query.impact(target, { depth }));
    }

    /**
     * Get path between modules (v0.2)
     */
    getPath(from: string, to: string, maxDepth?: number): PathResult {
        const cacheKey = `path:${from}:${to}:${maxDepth ?? 5}`;
        return this.queryCache.getOrCompute(cacheKey, () => this.query.path(from, to, { maxDepth }));
    }

    /**
     * Get module details (v0.2)
     */
    getModule(target: string): ModuleResult {
        const cacheKey = `module:${target}`;
        return this.queryCache.getOrCompute(cacheKey, () => this.query.module(target));
    }

    /**
     * Get annotation manager (v0.2)
     */
    getAnnotationManager(): AnnotationManager {
        return this.annotationManager;
    }

    /**
     * Get path resolver (v0.2)
     */
    getPathResolver(): PathResolver {
        return this.pathResolver;
    }

    /**
     * Get barrel analyzer (v0.2)
     */
    getBarrelAnalyzer(): BarrelAnalyzer {
        return this.barrelAnalyzer;
    }

    /**
     * Get adapter registry (v0.3)
     */
    getAdapterRegistry(): AdapterRegistry {
        return this.adapterRegistry;
    }

    /**
     * Get detected frameworks (v0.3)
     */
    getDetectedFrameworks(): FrameworkDetection[] {
        return [...this.detectedFrameworks];
    }

    /**
     * Get cycle detector (v0.5)
     */
    getCycleDetector(): CycleDetector {
        return this.cycleDetector;
    }

    /**
     * Get layer analyzer (v0.5)
     */
    getLayerAnalyzer(): LayerAnalyzer {
        return this.layerAnalyzer;
    }

    /**
     * Get query instance (for tools)
     */
    getQuery(): GraphQuery {
        return this.query;
    }

    /**
     * Get query cache (v1.0)
     */
    getQueryCache(): QueryCache {
        return this.queryCache;
    }

    /**
     * Get cache statistics (v1.0)
     */
    getCacheStats(): ReturnType<QueryCache['getStats']> {
        return this.queryCache.getStats();
    }

    /**
     * Invalidate query cache (v1.0)
     */
    invalidateCache(): void {
        this.queryCache.invalidate();
    }

    /**
     * Get external tools configuration (v1.1)
     */
    getExternalToolsConfig(): ExternalToolsConfig {
        return { ...this.externalToolsConfig };
    }

    /**
     * Check external tool availability status (v1.1)
     */
    async getExternalToolStatus(): Promise<{
        dependencyCruiser: { available: boolean; path: string | null };
        goModGraph: { available: boolean };
        jdeps: { available: boolean };
    }> {
        let dcAvailable = false;
        let dcPath: string | null = null;
        let goAvailable = false;
        let jdepsAvailable = false;
        
        if (this.dependencyCruiserAdapter) {
            dcAvailable = await this.dependencyCruiserAdapter.checkAvailability();
            dcPath = dcAvailable ? 'available' : null;
        }

        if (this.goModGraphAdapter) {
            goAvailable = await this.goModGraphAdapter.checkAvailability();
        }

        if (this.jdepsAdapter) {
            jdepsAvailable = await this.jdepsAdapter.checkAvailability();
        }
        
        return {
            dependencyCruiser: { available: dcAvailable, path: dcPath },
            goModGraph: { available: goAvailable },
            jdeps: { available: jdepsAvailable },
        };
    }

    // ============================================
    // Store Access
    // ============================================

    /**
     * Get the graph store (for webview)
     */
    getStore(): GraphStore {
        return this.store;
    }

    /**
     * Get graph metadata
     */
    getMeta() {
        return this.store.getMeta();
    }

    /**
     * Check if currently indexing
     */
    isCurrentlyIndexing(): boolean {
        return this.isIndexing;
    }

    // ============================================
    // Private Helpers
    // ============================================

    private async findFiles(): Promise<vscode.Uri[]> {
        const includePattern = `{${this.config.indexing.include.join(',')}}`;
        const excludePattern = `{${this.config.indexing.exclude.join(',')}}`;
        
        // Use RelativePattern to limit search to the specific workspace folder
        // This is critical for multi-root workspaces and ensures we only index
        // files within the target workspace, not all open workspaces
        const workspaceFolder = vscode.workspace.workspaceFolders?.find(
            folder => this.workspaceRoot.startsWith(folder.uri.fsPath)
        );
        
        if (workspaceFolder) {
            // Use RelativePattern for precise workspace-scoped search
            const relativePattern = new vscode.RelativePattern(workspaceFolder, includePattern);
            return vscode.workspace.findFiles(relativePattern, excludePattern);
        }
        
        // Fallback: try using the workspaceRoot directly as a RelativePattern base
        // This handles cases where workspaceRoot might not match a workspace folder exactly
        try {
            const relativePattern = new vscode.RelativePattern(
                vscode.Uri.file(this.workspaceRoot),
                includePattern
            );
            return vscode.workspace.findFiles(relativePattern, excludePattern);
        } catch {
            // Final fallback: use global search (original behavior)
            logger.warn('Could not create RelativePattern, falling back to global search');
            return vscode.workspace.findFiles(includePattern, excludePattern);
        }
    }

    private async readFile(uri: vscode.Uri): Promise<string> {
        const content = await vscode.workspace.fs.readFile(uri);
        return new TextDecoder().decode(content);
    }

    private getRelativePath(uri: vscode.Uri): string {
        const fullPath = uri.fsPath.replace(/\\/g, '/');
        const rootPath = this.workspaceRoot.replace(/\\/g, '/');
        
        // Ensure rootPath ends without slash for consistent comparison
        const normalizedRoot = rootPath.endsWith('/') ? rootPath.slice(0, -1) : rootPath;
        
        if (fullPath.toLowerCase().startsWith(normalizedRoot.toLowerCase())) {
            // Handle both with and without trailing slash
            const relativePath = fullPath.substring(normalizedRoot.length);
            return relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
        }
        
        // If path doesn't start with workspace root, try to get relative path from VS Code
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        if (workspaceFolder) {
            const wsRoot = workspaceFolder.uri.fsPath.replace(/\\/g, '/');
            if (fullPath.toLowerCase().startsWith(wsRoot.toLowerCase())) {
                const relativePath = fullPath.substring(wsRoot.length);
                return relativePath.startsWith('/') ? relativePath.substring(1) : relativePath;
            }
        }
        
        // Last resort: return the full path
        logger.warn('Could not determine relative path', { fullPath, rootPath: normalizedRoot });
        return fullPath;
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.stopWatcher();
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables = [];
        logger.info('CodeGraphManager disposed');
    }
}
