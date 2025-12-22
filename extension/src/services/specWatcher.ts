/**
 * Spec File Watcher
 * Watches .ouroboros/specs folder for changes and triggers rescans
 */

import * as vscode from 'vscode';
import { DisposableBase } from '../utils/disposable';
import { createLogger } from '../utils/logger';
import { scanSpecsFolder, type SpecInfo } from './specScanner';
import { debounce } from '../utils/debounce';

const logger = createLogger('SpecWatcher');

/**
 * Event emitted when specs change
 */
export interface SpecChangeEvent {
    active: SpecInfo[];
    archived: SpecInfo[];
}

/**
 * Watches the specs folder and emits events on changes
 */
export class SpecWatcher extends DisposableBase {
    private readonly onSpecChangeEmitter = new vscode.EventEmitter<SpecChangeEvent>();
    public readonly onSpecChange = this.onSpecChangeEmitter.event;

    private watcher: vscode.FileSystemWatcher | undefined;
    private workspacePath: string | undefined;

    // Debounced rescan to avoid excessive updates
    private readonly debouncedRescan = debounce(() => this.rescan(), 500);

    constructor() {
        super();
        this.register(this.onSpecChangeEmitter);
    }

    /**
     * Start watching a workspace folder
     */
    async start(workspacePath: string): Promise<void> {
        this.workspacePath = workspacePath;

        // Stop existing watcher if any
        this.stopWatcher();

        // Create file system watcher for specs folder
        const pattern = new vscode.RelativePattern(
            vscode.Uri.file(workspacePath),
            '.ouroboros/specs/**/*'
        );

        this.watcher = vscode.workspace.createFileSystemWatcher(pattern);

        this.watcher.onDidCreate(() => this.debouncedRescan());
        this.watcher.onDidChange(() => this.debouncedRescan());
        this.watcher.onDidDelete(() => this.debouncedRescan());

        this.register(this.watcher);

        logger.info('Started watching specs folder', { workspacePath });

        // Initial scan
        await this.rescan();
    }

    /**
     * Stop the watcher
     */
    private stopWatcher(): void {
        if (this.watcher) {
            this.watcher.dispose();
            this.watcher = undefined;
        }
    }

    /**
     * Rescan the specs folder and emit event
     */
    private async rescan(): Promise<void> {
        if (!this.workspacePath) return;

        try {
            const specs = await scanSpecsFolder(this.workspacePath);
            this.onSpecChangeEmitter.fire(specs);
            logger.debug('Specs rescanned', {
                active: specs.active.length,
                archived: specs.archived.length,
            });
        } catch (error) {
            logger.error('Error rescanning specs', { error });
        }
    }

    /**
     * Force a rescan
     */
    async forceRescan(): Promise<SpecChangeEvent | null> {
        if (!this.workspacePath) return null;

        const specs = await scanSpecsFolder(this.workspacePath);
        this.onSpecChangeEmitter.fire(specs);
        return specs;
    }

    public override dispose(): void {
        logger.info('Disposing spec watcher');
        this.stopWatcher();
        super.dispose();
    }
}
