/**
 * LM Tools registration entry point
 */

import * as vscode from 'vscode';
import { TOOLS } from '../constants';
import type { StateManager } from '../storage/stateManager';
import type { SidebarProvider } from '../webview/SidebarProvider';
import { createAskTool } from './ask';
import { createMenuTool } from './menu';
import { createConfirmTool } from './confirm';
import { createPlanReviewTool } from './planReview';
import { createPhaseProgressTool } from './phaseProgress';
import { createHandoffTool } from './handoff';
import { createLogger } from '../utils/logger';

const logger = createLogger('Tools');

/**
 * Register all LM Tools with VS Code
 */
export function registerTools(
    stateManager: StateManager,
    sidebarProvider: SidebarProvider
): vscode.Disposable[] {
    const disposables: vscode.Disposable[] = [];

    logger.info('Registering LM Tools...');

    // Register ouroboros_ask
    const askTool = createAskTool(stateManager, sidebarProvider);
    disposables.push(vscode.lm.registerTool(TOOLS.ASK, askTool));
    logger.info(`Registered tool: ${TOOLS.ASK}`);

    // Register ouroboros_menu
    const menuTool = createMenuTool(stateManager, sidebarProvider);
    disposables.push(vscode.lm.registerTool(TOOLS.MENU, menuTool));
    logger.info(`Registered tool: ${TOOLS.MENU}`);

    // Register ouroboros_confirm
    const confirmTool = createConfirmTool(stateManager, sidebarProvider);
    disposables.push(vscode.lm.registerTool(TOOLS.CONFIRM, confirmTool));
    logger.info(`Registered tool: ${TOOLS.CONFIRM}`);

    // Register ouroboros_plan_review
    const planReviewTool = createPlanReviewTool(stateManager, sidebarProvider);
    disposables.push(vscode.lm.registerTool(TOOLS.PLAN_REVIEW, planReviewTool));
    logger.info(`Registered tool: ${TOOLS.PLAN_REVIEW}`);

    // Register ouroboros_phase_progress
    const phaseProgressTool = createPhaseProgressTool(stateManager, sidebarProvider);
    disposables.push(vscode.lm.registerTool(TOOLS.PHASE_PROGRESS, phaseProgressTool));
    logger.info(`Registered tool: ${TOOLS.PHASE_PROGRESS}`);

    // Register ouroboros_agent_handoff
    const handoffTool = createHandoffTool(stateManager, sidebarProvider);
    disposables.push(vscode.lm.registerTool(TOOLS.AGENT_HANDOFF, handoffTool));
    logger.info(`Registered tool: ${TOOLS.AGENT_HANDOFF}`);

    logger.info('All LM Tools registered successfully');

    return disposables;
}

export * from './types';
export * from './schemas';
