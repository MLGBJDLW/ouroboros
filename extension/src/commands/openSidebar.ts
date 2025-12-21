/**
 * Open Sidebar Command
 */

import * as vscode from 'vscode';
import { SIDEBAR_VIEW_ID } from '../constants';
import { createLogger } from '../utils/logger';

const logger = createLogger('OpenSidebar');

/**
 * Create the open sidebar command handler
 */
export function createOpenSidebarCommand(): () => Promise<void> {
    return async () => {
        logger.info('Opening sidebar...');

        try {
            // Focus the sidebar view
            await vscode.commands.executeCommand(
                `${SIDEBAR_VIEW_ID}.focus`
            );
            logger.info('Sidebar opened');
        } catch (error) {
            logger.error('Failed to open sidebar:', error);
            vscode.window.showErrorMessage('Failed to open Ouroboros sidebar.');
        }
    };
}
