/**
 * Code Graph Manager
 * Main entry point for the Code Graph system
 */

import * as vscode from 'vscode';
import { GraphStore } from './core/GraphStore';
import { GraphQuery } from './core/GraphQuery';
import { TypeScriptIndexer } from './indexers/TypeScriptIndexer';
import { EntrypointDetector } from './indexers/EntrypointDetector';
import { IssueDetector } from './analyzers/IssueDetector';
import { IncrementalWatcher } from './watcher/IncrementalWatcher';
import type { DigestResult, IssueListResult, ImpactResult, GraphConfig } from './core/types';
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
    private indexers: TypeScriptIndexer[];
    private entrypointDetector: EntrypointDetector;
    private issueDetector: IssueDetector;
    private watcher: IncrementalWatcher | null = null;
    private config: GraphConfig;
    private workspaceRoot: string;
    private isIndexing = false;
    private disposables: vscode.Disposable[] = [];

    constructor(workspaceRoot: string, config?: Partial<GraphConfig>) {
        this.workspaceRoot = workspaceRoot;
        this.config = { ...DEFAULT_CONFIG, ...config };
        
        this.store = new GraphStore();
        this.query = new GraphQuery(this.store);
        this.entrypointDetector = new EntrypointDetector();
        this.issueDetector = new IssueDetector(this.store);
        
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
            this.store.setIssues(issues);

            const duration = Date.now() - startTime;
            this.store.updateMeta({
                lastIndexed: Date.now(),
                indexDuration: duration,
                fileCount,
            });

            logger.info(`Indexed ${fileCount} files in ${duration}ms, found ${issues.length} issues`);
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
