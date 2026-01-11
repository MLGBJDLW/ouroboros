/**
 * LM Tools registration entry point
 */

import * as vscode from 'vscode';
import { TOOLS } from '../constants';
import type { StateManager } from '../storage/stateManager';
import type { SidebarProvider } from '../webview/SidebarProvider';
import type { CodeGraphManager } from '../codeGraph/CodeGraphManager';
import { createAskTool } from './ask';
import { createMenuTool } from './menu';
import { createConfirmTool } from './confirm';
import { createPlanReviewTool } from './planReview';
import { createHandoffTool } from './handoff';
import { createGraphDigestTool } from '../codeGraph/tools/graphDigest';
import { createGraphIssuesTool } from '../codeGraph/tools/graphIssues';
import { createGraphImpactTool } from '../codeGraph/tools/graphImpact';
import { createGraphPathTool } from '../codeGraph/tools/graphPath';
import { createGraphModuleTool } from '../codeGraph/tools/graphModule';
import { createGraphAnnotationsTool } from '../codeGraph/tools/graphAnnotations';
import { createGraphCyclesTool } from '../codeGraph/tools/graphCycles';
import { createGraphLayersTool } from '../codeGraph/tools/graphLayers';
import { createLogger } from '../utils/logger';

const logger = createLogger('Tools');

/**
 * Register all LM Tools with VS Code
 */
export function registerTools(
    stateManager: StateManager,
    sidebarProvider: SidebarProvider,
    codeGraphManager?: CodeGraphManager
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

    // Register ouroboros_agent_handoff
    const handoffTool = createHandoffTool(stateManager, sidebarProvider);
    disposables.push(vscode.lm.registerTool(TOOLS.AGENT_HANDOFF, handoffTool));
    logger.info(`Registered tool: ${TOOLS.AGENT_HANDOFF}`);

    // Register Code Graph tools (if manager provided)
    if (codeGraphManager) {
        // MVP tools
        const digestTool = createGraphDigestTool(codeGraphManager);
        disposables.push(vscode.lm.registerTool(TOOLS.GRAPH_DIGEST, digestTool));
        logger.info(`Registered tool: ${TOOLS.GRAPH_DIGEST}`);

        const issuesTool = createGraphIssuesTool(codeGraphManager);
        disposables.push(vscode.lm.registerTool(TOOLS.GRAPH_ISSUES, issuesTool));
        logger.info(`Registered tool: ${TOOLS.GRAPH_ISSUES}`);

        const impactTool = createGraphImpactTool(codeGraphManager);
        disposables.push(vscode.lm.registerTool(TOOLS.GRAPH_IMPACT, impactTool));
        logger.info(`Registered tool: ${TOOLS.GRAPH_IMPACT}`);

        // v0.2 tools
        const pathTool = createGraphPathTool(codeGraphManager);
        disposables.push(vscode.lm.registerTool(TOOLS.GRAPH_PATH, pathTool));
        logger.info(`Registered tool: ${TOOLS.GRAPH_PATH}`);

        const moduleTool = createGraphModuleTool(codeGraphManager);
        disposables.push(vscode.lm.registerTool(TOOLS.GRAPH_MODULE, moduleTool));
        logger.info(`Registered tool: ${TOOLS.GRAPH_MODULE}`);

        const annotationsTool = createGraphAnnotationsTool(codeGraphManager);
        disposables.push(vscode.lm.registerTool(TOOLS.GRAPH_ANNOTATIONS, annotationsTool));
        logger.info(`Registered tool: ${TOOLS.GRAPH_ANNOTATIONS}`);

        // v0.5 tools
        const cyclesTool = createGraphCyclesTool(() => codeGraphManager.getCycleDetector());
        disposables.push(vscode.lm.registerTool(TOOLS.GRAPH_CYCLES, cyclesTool));
        logger.info(`Registered tool: ${TOOLS.GRAPH_CYCLES}`);

        const layersTool = createGraphLayersTool(() => codeGraphManager.getLayerAnalyzer());
        disposables.push(vscode.lm.registerTool(TOOLS.GRAPH_LAYERS, layersTool));
        logger.info(`Registered tool: ${TOOLS.GRAPH_LAYERS}`);
    }

    logger.info('All LM Tools registered successfully');

    return disposables;
}

export * from './types';
export * from './schemas';
