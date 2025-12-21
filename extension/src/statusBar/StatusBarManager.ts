/**
 * Status Bar Manager
 */

import * as vscode from 'vscode';
import { DisposableBase } from '../utils/disposable';
import { createLogger } from '../utils/logger';
import { CONFIG, COMMANDS } from '../constants';
import type { StateManager, WorkspaceState } from '../storage/stateManager';
import { formatStatusBarText } from './formatters';

const logger = createLogger('StatusBar');

/**
 * Manager for the Ouroboros status bar item
 */
export class StatusBarManager extends DisposableBase {
    private statusBarItem: vscode.StatusBarItem;

    constructor(private readonly stateManager: StateManager) {
        super();

        // Create status bar item
        this.statusBarItem = this.register(
            vscode.window.createStatusBarItem(
                vscode.StatusBarAlignment.Left,
                100
            )
        );

        this.statusBarItem.command = COMMANDS.OPEN_SIDEBAR;
        this.statusBarItem.tooltip = 'Click to open Ouroboros sidebar';

        // Check configuration
        const showStatusBar = vscode.workspace
            .getConfiguration('ouroboros')
            .get<boolean>('showStatusBar', true);

        if (showStatusBar) {
            this.updateStatusBar(this.stateManager.getWorkspaceState());
            this.statusBarItem.show();
        }

        // Listen to state changes
        this.register(
            this.stateManager.onStateChange((state) => {
                this.updateStatusBar(state);
            })
        );

        // Listen to configuration changes
        this.register(
            vscode.workspace.onDidChangeConfiguration((e) => {
                if (e.affectsConfiguration(CONFIG.SHOW_STATUS_BAR)) {
                    const show = vscode.workspace
                        .getConfiguration('ouroboros')
                        .get<boolean>('showStatusBar', true);

                    if (show) {
                        this.statusBarItem.show();
                    } else {
                        this.statusBarItem.hide();
                    }
                }
            })
        );

        logger.info('Status bar manager initialized');
    }

    /**
     * Update the status bar text
     */
    private updateStatusBar(state: WorkspaceState): void {
        this.statusBarItem.text = formatStatusBarText(state);
    }

    /**
     * Show a temporary message in the status bar
     */
    public showTemporaryMessage(
        message: string,
        durationMs: number = 3000
    ): void {
        const originalText = this.statusBarItem.text;
        this.statusBarItem.text = message;

        setTimeout(() => {
            this.statusBarItem.text = originalText;
        }, durationMs);
    }

    public override dispose(): void {
        logger.info('Disposing status bar manager');
        super.dispose();
    }
}
