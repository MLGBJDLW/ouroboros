/**
 * Sidebar Webview Provider
 */

import * as vscode from 'vscode';
import { DisposableBase } from '../utils/disposable';
import { createLogger } from '../utils/logger';
import { handleMessage } from './messageHandler';
import { generateHtml } from './htmlGenerator';
import { TIMEOUTS } from '../constants';
import type { StateManager } from '../storage/stateManager';
import type {
    AskInput,
    AskOutput,
    MenuInput,
    MenuOutput,
    ConfirmInput,
    ConfirmOutput,
    PlanReviewInput,
    PlanReviewOutput,
    PhaseProgressInput,
    HandoffInput,
    PendingRequest,
} from '../tools/types';

const logger = createLogger('SidebarProvider');

type PendingRequestWithTimeout = PendingRequest & {
    timeoutHandle?: ReturnType<typeof setTimeout>;
};

/**
 * Sidebar Webview Provider for Ouroboros
 */
export class SidebarProvider
    extends DisposableBase
    implements vscode.WebviewViewProvider {
    private webviewView: vscode.WebviewView | undefined;
    private pendingRequests: Map<string, PendingRequestWithTimeout> = new Map();

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly stateManager: StateManager
    ) {
        super();

        // Listen to state changes
        this.register(
            this.stateManager.onStateChange((state) => {
                this.postMessage({ type: 'stateUpdate', payload: state });
            })
        );
    }

    /**
     * Resolve the webview view
     */
    resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void | Thenable<void> {
        logger.info('Resolving webview view');

        this.webviewView = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.extensionUri, 'dist'),
                vscode.Uri.joinPath(this.extensionUri, 'webview', 'dist'),
                vscode.Uri.joinPath(this.extensionUri, 'resources'),
            ],
        };

        webviewView.webview.html = generateHtml(
            webviewView.webview,
            this.extensionUri
        );

        // Handle messages from webview
        this.register(
            webviewView.webview.onDidReceiveMessage(async (message) => {
                await handleMessage(message, this, this.stateManager);
            })
        );

        // Send initial state
        this.postMessage({
            type: 'init',
            payload: {
                workspaceState: this.stateManager.getWorkspaceState(),
                history: this.stateManager.getInteractionHistory(),
                pendingRequests: Array.from(this.pendingRequests.values()).map(
                    (req) => ({
                        id: req.id,
                        type: req.type,
                        agentName: req.agentName,
                        agentLevel: req.agentLevel,
                        data: req.data,
                        timestamp: req.timestamp,
                    })
                ),
            },
        });
    }

    /**
     * Post a message to the webview
     */
    postMessage(message: unknown): void {
        if (this.webviewView) {
            this.webviewView.webview.postMessage(message);
        }
    }

    /**
     * Create an ask request
     */
    async createAskRequest(
        input: AskInput,
        token: vscode.CancellationToken
    ): Promise<AskOutput> {
        return this.createRequest<AskInput, AskOutput>('ask', input, token);
    }

    /**
     * Create a menu request
     */
    async createMenuRequest(
        input: MenuInput,
        token: vscode.CancellationToken
    ): Promise<MenuOutput> {
        return this.createRequest<MenuInput, MenuOutput>('menu', input, token);
    }

    /**
     * Create a confirm request
     */
    async createConfirmRequest(
        input: ConfirmInput,
        token: vscode.CancellationToken
    ): Promise<ConfirmOutput> {
        return this.createRequest<ConfirmInput, ConfirmOutput>(
            'confirm',
            input,
            token
        );
    }

    /**
     * Create a plan review request
     */
    async createPlanReviewRequest(
        input: PlanReviewInput,
        token: vscode.CancellationToken
    ): Promise<PlanReviewOutput> {
        return this.createRequest<PlanReviewInput, PlanReviewOutput>(
            'plan_review',
            input,
            token
        );
    }

    /**
     * Update phase progress
     */
    async updatePhaseProgress(input: PhaseProgressInput): Promise<void> {
        this.postMessage({
            type: 'phaseProgress',
            payload: input,
        });
    }

    /**
     * Update agent handoff
     */
    async updateAgentHandoff(input: HandoffInput): Promise<void> {
        this.postMessage({
            type: 'agentHandoff',
            payload: input,
        });
    }

    /**
     * Resolve a pending request
     */
    resolveRequest(requestId: string, response: unknown): void {
        const request = this.pendingRequests.get(requestId);
        if (request) {
            this.clearRequestTimeout(request);
            request.resolve(response);
            this.pendingRequests.delete(requestId);
            this.notifyPendingRequestsUpdate();
        }
    }

    /**
     * Cancel a pending request
     */
    cancelRequest(requestId: string): void {
        const request = this.pendingRequests.get(requestId);
        if (request) {
            this.clearRequestTimeout(request);
            request.resolve({ cancelled: true });
            this.pendingRequests.delete(requestId);
            this.notifyPendingRequestsUpdate();
        }
    }

    /**
     * Cancel the most recent pending request
     */
    cancelCurrentRequest(): boolean {
        const latestRequest = Array.from(this.pendingRequests.values()).sort(
            (a, b) => b.timestamp - a.timestamp
        )[0];

        if (!latestRequest) {
            return false;
        }

        this.cancelRequest(latestRequest.id);
        return true;
    }

    /**
     * Create a pending request and wait for response
     */
    private async createRequest<TInput, TOutput>(
        type: 'ask' | 'menu' | 'confirm' | 'plan_review',
        input: TInput,
        token: vscode.CancellationToken
    ): Promise<TOutput> {
        const requestId = this.generateRequestId();

        return new Promise<TOutput>((resolve, reject) => {
            const request: PendingRequestWithTimeout = {
                id: requestId,
                timestamp: Date.now(),
                type,
                agentName:
                    (input as { agentName?: string }).agentName ?? 'unknown',
                agentLevel:
                    ((input as { agentLevel?: number }).agentLevel as 0 | 1 | 2) ?? 0,
                data: input as AskInput | MenuInput | ConfirmInput | PlanReviewInput,
                resolve: resolve as (value: unknown) => void,
                reject,
            };

            this.pendingRequests.set(requestId, request);
            this.notifyPendingRequestsUpdate();

            request.timeoutHandle = setTimeout(() => {
                this.timeoutRequest(requestId);
            }, TIMEOUTS.USER_CONFIRMATION);

            // Post to webview
            this.postMessage({
                type: 'newRequest',
                payload: {
                    id: requestId,
                    type,
                    agentName: request.agentName,
                    agentLevel: request.agentLevel,
                    data: input,
                    timestamp: request.timestamp,
                },
            });

            // Handle cancellation
            token.onCancellationRequested(() => {
                this.cancelRequest(requestId);
            });

            // Reveal the sidebar
            if (this.webviewView) {
                this.webviewView.show(true);
            }
        });
    }

    /**
     * Handle request timeout
     */
    private timeoutRequest(requestId: string): void {
        const request = this.pendingRequests.get(requestId);
        if (!request) {
            return;
        }

        this.clearRequestTimeout(request);
        request.resolve({ cancelled: true, timeout: true });
        this.pendingRequests.delete(requestId);
        this.notifyPendingRequestsUpdate();
    }

    private clearRequestTimeout(
        request?: PendingRequestWithTimeout
    ): void {
        if (request?.timeoutHandle) {
            clearTimeout(request.timeoutHandle);
            request.timeoutHandle = undefined;
        }
    }

    /**
     * Notify webview of pending requests update
     */
    private notifyPendingRequestsUpdate(): void {
        this.postMessage({
            type: 'pendingRequestsUpdate',
            payload: Array.from(this.pendingRequests.values()).map((req) => ({
                id: req.id,
                type: req.type,
                agentName: req.agentName,
                agentLevel: req.agentLevel,
                data: req.data,
                timestamp: req.timestamp,
            })),
        });
    }

    /**
     * Generate unique request ID
     */
    private generateRequestId(): string {
        return `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }

    public override dispose(): void {
        logger.info('Disposing sidebar provider');

        // Cancel all pending requests
        for (const request of this.pendingRequests.values()) {
            this.clearRequestTimeout(request);
            request.resolve({ cancelled: true });
        }
        this.pendingRequests.clear();

        super.dispose();
    }
}
