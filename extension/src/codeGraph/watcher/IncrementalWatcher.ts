/**
 * Incremental Watcher
 * Watches for file changes and triggers incremental re-indexing
 */

import * as vscode from 'vscode';
import type { GraphStore } from '../core/GraphStore';
import type { BaseIndexer } from '../indexers/BaseIndexer';
import { createLogger } from '../../utils/logger';

const logger = createLogger('IncrementalWatcher');

export interface WatcherOptions {
    debounceMs?: number;
    include?: string[];
    exclude?: string[];
}

export class IncrementalWatcher implements vscode.Disposable {
    private watcher: vscode.FileSystemWatcher | null = null;
    private debounceTimer: NodeJS.Timeout | null = null;
    private pendingChanges: Set<string> = new Set();
    private debounceMs: number;
    private disposables: vscode.Disposable[] = [];

    constructor(
        private store: GraphStore,
        private indexers: BaseIndexer[],
        private workspaceRoot: string,
        options?: WatcherOptions
    ) {
        this.debounceMs = options?.debounceMs ?? 500;
    }

    /**
     * Start watching for file changes
     */
    start(): void {
        if (this.watcher) {
            logger.warn('Watcher already started');
            return;
        }

        // Watch TypeScript/JavaScript files
        const pattern = new vscode.RelativePattern(
            this.workspaceRoot,
            '**/*.{ts,tsx,js,jsx,mjs,cjs}'
        );

        this.watcher = vscode.workspace.createFileSystemWatcher(pattern);

        this.watcher.onDidCreate((uri) => this.handleChange(uri, 'create'));
        this.watcher.onDidChange((uri) => this.handleChange(uri, 'change'));
        this.watcher.onDidDelete((uri) => this.handleChange(uri, 'delete'));

        this.disposables.push(this.watcher);
        logger.info('File watcher started');
    }

    /**
     * Stop watching
     */
    stop(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        this.pendingChanges.clear();
        logger.info('File watcher stopped');
    }

    /**
     * Handle file change event
     */
    private handleChange(uri: vscode.Uri, type: 'create' | 'change' | 'delete'): void {
        const filePath = this.getRelativePath(uri);
        
        // Skip excluded paths
        if (this.shouldExclude(filePath)) {
            return;
        }

        logger.debug(`File ${type}: ${filePath}`);
        this.pendingChanges.add(`${type}:${filePath}`);
        this.scheduleProcessing();
    }

    /**
     * Schedule debounced processing of changes
     */
    private scheduleProcessing(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
            this.processChanges();
        }, this.debounceMs);
    }

    /**
     * Process pending changes
     */
    private async processChanges(): Promise<void> {
        const changes = Array.from(this.pendingChanges);
        this.pendingChanges.clear();

        logger.info(`Processing ${changes.length} file changes`);

        for (const change of changes) {
            const [type, filePath] = change.split(':');
            
            try {
                if (type === 'delete') {
                    await this.handleDelete(filePath);
                } else {
                    await this.handleCreateOrChange(filePath);
                }
            } catch (error) {
                logger.error(`Error processing ${change}:`, error);
            }
        }

        logger.info('File changes processed');
    }

    /**
     * Handle file deletion
     */
    private async handleDelete(filePath: string): Promise<void> {
        const nodeId = `file:${filePath}`;
        this.store.removeNode(nodeId);
        logger.debug(`Removed node: ${nodeId}`);
    }

    /**
     * Handle file creation or modification
     */
    private async handleCreateOrChange(filePath: string): Promise<void> {
        // Find appropriate indexer
        const indexer = this.indexers.find((i) => i.supports(filePath));
        if (!indexer) {
            logger.debug(`No indexer for: ${filePath}`);
            return;
        }

        // Read file content
        const uri = vscode.Uri.file(`${this.workspaceRoot}/${filePath}`);
        try {
            const content = await vscode.workspace.fs.readFile(uri);
            const text = new TextDecoder().decode(content);

            // Index file
            const result = await indexer.indexFile(filePath, text);

            // Update store
            this.store.updateFile(filePath, result.nodes, result.edges);
            logger.debug(`Updated: ${filePath} (${result.nodes.length} nodes, ${result.edges.length} edges)`);
        } catch (error) {
            logger.error(`Failed to read/index ${filePath}:`, error);
        }
    }

    /**
     * Get relative path from URI
     */
    private getRelativePath(uri: vscode.Uri): string {
        const fullPath = uri.fsPath.replace(/\\/g, '/');
        const rootPath = this.workspaceRoot.replace(/\\/g, '/');
        
        if (fullPath.startsWith(rootPath)) {
            return fullPath.substring(rootPath.length + 1);
        }
        
        return fullPath;
    }

    /**
     * Check if path should be excluded
     */
    private shouldExclude(filePath: string): boolean {
        const excludePatterns = [
            /node_modules/,
            /\.git/,
            /dist\//,
            /build\//,
            /\.next\//,
            /coverage\//,
        ];

        return excludePatterns.some((pattern) => pattern.test(filePath));
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.stop();
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables = [];
    }
}
