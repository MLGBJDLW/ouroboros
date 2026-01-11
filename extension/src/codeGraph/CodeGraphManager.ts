/**
 * Code Graph Manager
 * Main entry point for the Code Graph system
 */

import * as vscode from 'vscode';
import { GraphStore } from './core/GraphStore';
import { GraphQuery } from './core/GraphQuery';
import { PathResolver } from './core/PathResolver';
import { TypeScriptIndexer } from './indexers/TypeScriptIndexer';
import { EntrypointDetector } from './indexers/EntrypointDetector';
import { BarrelAnalyzer } from './indexers/BarrelAnalyzer';
import { IssueDetector } from './analyzers/IssueDetector';
import { IncrementalWatcher } from './watcher/IncrementalWatcher';
import { AnnotationManager } from './annotations/AnnotationManager';
import { getAdapterRegistry, registerBuiltinAdapters } from './adapters';
import type { AdapterRegistry } from './adapters';
import type { DigestResult, IssueListResult, ImpactResult, PathResult, ModuleResult, GraphConfig, FrameworkDetection } from './core/types';
import { createLogger } from '../utils/logger';

const logger = createLogger('CodeGraphManager');

const DEFAULT_CONFIG: GraphConfig = {
    indexing: {
        include: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
        exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/coverage/**'],
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
    private indexers: TypeScriptIndexer[];
    private entrypointDetector: EntrypointDetector;
    private barrelAnalyzer: BarrelAnalyzer;
    private issueDetector: IssueDetector;
    private annotationManager: AnnotationManager;
    private adapterRegistry: AdapterRegistry;
    private watcher: IncrementalWatcher | null = null;
    private config: GraphConfig;
    private workspaceRoot: string;
    private isIndexing = false;
    private disposables: vscode.Disposable[] = [];
    private detectedFrameworks: FrameworkDetection[] = [];

    constructor(workspaceRoot: string, config?: Partial<GraphConfig>) {
        this.workspaceRoot = workspaceRoot;
        this.config = { ...DEFAULT_CONFIG, ...config };
        
        this.store = new GraphStore();
        this.query = new GraphQuery(this.store);
        this.pathResolver = new PathResolver(workspaceRoot);
        this.barrelAnalyzer = new BarrelAnalyzer(this.store);
        this.entrypointDetector = new EntrypointDetector();
        this.issueDetector = new IssueDetector(this.store);
        this.annotationManager = new AnnotationManager(workspaceRoot);
        
        // v0.3: Initialize adapter registry
        registerBuiltinAdapters();
        this.adapterRegistry = getAdapterRegistry();
        
        this.indexers = [
            new TypeScriptIndexer({
                workspaceRoot,
                include: this.config.indexing.include,
                exclude: this.config.indexing.exclude,
                maxFileSize: this.config.indexing.maxFileSize,
            }),
        ];

        logger.info('CodeGraphManager initialized');
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

            // Find all files
            const files = await this.findFiles();
            logger.info(`Found ${files.length} files to index`);

            let fileCount = 0;
            for (const file of files) {
                const filePath = this.getRelativePath(file);
                const indexer = this.indexers.find((i) => i.supports(filePath));
                
                if (!indexer) continue;

                try {
                    const content = await this.readFile(file);
                    if (content.length > this.config.indexing.maxFileSize) {
                        logger.debug(`Skipping large file: ${filePath}`);
                        continue;
                    }

                    const result = await indexer.indexFile(filePath, content);
                    
                    for (const node of result.nodes) {
                        this.store.addNode(node);
                    }
                    
                    for (const edge of result.edges) {
                        this.store.addEdge(edge);
                    }

                    fileCount++;
                } catch (error) {
                    logger.error(`Error indexing ${filePath}:`, error);
                }
            }

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
            
            // Filter out ignored issues
            const allIssues = [...issues, ...barrelIssues, ...frameworkIssues];
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
    // Query Methods (for LM Tools)
    // ============================================

    /**
     * Get graph digest
     */
    getDigest(scope?: string): DigestResult {
        return this.query.digest({ scope });
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
        return this.query.issues({
            kind: options?.kind as import('./core/types').IssueKind,
            severity: options?.severity as import('./core/types').IssueSeverity,
            scope: options?.scope,
            limit: options?.limit,
        });
    }

    /**
     * Get impact analysis
     */
    getImpact(target: string, depth?: number): ImpactResult {
        return this.query.impact(target, { depth });
    }

    /**
     * Get path between modules (v0.2)
     */
    getPath(from: string, to: string, maxDepth?: number): PathResult {
        return this.query.path(from, to, { maxDepth });
    }

    /**
     * Get module details (v0.2)
     */
    getModule(target: string): ModuleResult {
        return this.query.module(target);
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
     * Get query instance (for tools)
     */
    getQuery(): GraphQuery {
        return this.query;
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
        
        return vscode.workspace.findFiles(includePattern, excludePattern);
    }

    private async readFile(uri: vscode.Uri): Promise<string> {
        const content = await vscode.workspace.fs.readFile(uri);
        return new TextDecoder().decode(content);
    }

    private getRelativePath(uri: vscode.Uri): string {
        const fullPath = uri.fsPath.replace(/\\/g, '/');
        const rootPath = this.workspaceRoot.replace(/\\/g, '/');
        
        if (fullPath.startsWith(rootPath)) {
            return fullPath.substring(rootPath.length + 1);
        }
        
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
