/**
 * Tool Response Envelope
 * Unified response format for all Code Graph tools
 */

import * as vscode from 'vscode';

/**
 * Workspace context included in all responses
 */
export interface WorkspaceContext {
    root: string;
    repoName: string;
    rev?: string;
}

/**
 * Pagination info for list responses
 */
export interface PageInfo {
    cursor?: string;
    hasMore: boolean;
    total?: number;
}

/**
 * Next query suggestion for Copilot
 */
export interface NextQuerySuggestion {
    tool: string;
    args: Record<string, unknown>;
    reason?: string;
}

/**
 * Response metadata
 */
export interface ResponseMeta {
    approxTokens: number;
    truncated: boolean;
    limits: {
        maxItems?: number;
        maxDepth?: number;
        // Additional limit types for specific tools
        hotspotLimit?: number;
        entrypointLimit?: number;
        dependentLimit?: number;
        maxCycles?: number;
        importLimit?: number;
        exportLimit?: number;
        importedByLimit?: number;
        maxPaths?: number;
    };
    nextQuerySuggestion?: NextQuerySuggestion[];
    page?: PageInfo;
}

/**
 * Error details
 */
export interface ErrorResult {
    error: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
    };
}

/**
 * Success envelope
 */
export interface SuccessEnvelope<T> {
    success: true;
    data: {
        tool: string;
        version: string;
        requestId: string;
        generatedAt: string;
        workspace: WorkspaceContext;
        result: T;
        meta: ResponseMeta;
    };
}

/**
 * Error envelope
 */
export interface ErrorEnvelope {
    success: false;
    data: {
        tool: string;
        version: string;
        requestId: string;
        generatedAt: string;
        workspace: WorkspaceContext;
        result: ErrorResult;
        meta: ResponseMeta;
    };
}

export type ToolEnvelope<T> = SuccessEnvelope<T> | ErrorEnvelope;

const CHARS_PER_TOKEN = 4;

/**
 * Generate a short request ID
 */
function generateRequestId(): string {
    return Math.random().toString(36).substring(2, 10);
}

/**
 * Estimate tokens from data
 */
function estimateTokens(data: unknown): number {
    return Math.ceil(JSON.stringify(data).length / CHARS_PER_TOKEN);
}

/**
 * Create a success envelope
 */
export function createSuccessEnvelope<T>(
    toolName: string,
    result: T,
    workspace: WorkspaceContext,
    options: {
        truncated?: boolean;
        limits?: ResponseMeta['limits'];
        nextQuerySuggestion?: NextQuerySuggestion[];
        page?: PageInfo;
    } = {}
): SuccessEnvelope<T> {
    const envelope: SuccessEnvelope<T> = {
        success: true,
        data: {
            tool: toolName,
            version: '1.0',
            requestId: generateRequestId(),
            generatedAt: new Date().toISOString(),
            workspace,
            result,
            meta: {
                approxTokens: 0,
                truncated: options.truncated ?? false,
                limits: options.limits ?? {},
                nextQuerySuggestion: options.nextQuerySuggestion,
                page: options.page,
            },
        },
    };
    
    envelope.data.meta.approxTokens = estimateTokens(envelope);
    return envelope;
}

/**
 * Create an error envelope
 */
export function createErrorEnvelope(
    toolName: string,
    code: string,
    message: string,
    workspace: WorkspaceContext,
    details?: Record<string, unknown>,
    nextQuerySuggestion?: NextQuerySuggestion[]
): ErrorEnvelope {
    const envelope: ErrorEnvelope = {
        success: false,
        data: {
            tool: toolName,
            version: '1.0',
            requestId: generateRequestId(),
            generatedAt: new Date().toISOString(),
            workspace,
            result: {
                error: {
                    code,
                    message,
                    details,
                },
            },
            meta: {
                approxTokens: 0,
                truncated: false,
                limits: {},
                nextQuerySuggestion,
            },
        },
    };
    
    envelope.data.meta.approxTokens = estimateTokens(envelope);
    return envelope;
}

/**
 * Convert envelope to VS Code LanguageModelToolResult
 */
export function envelopeToResult<T>(envelope: ToolEnvelope<T>): vscode.LanguageModelToolResult {
    return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify(envelope, null, 2)),
    ]);
}

/**
 * Get workspace context from VS Code
 */
export function getWorkspaceContext(workspaceRoot?: string): WorkspaceContext {
    let root = workspaceRoot ?? '';
    
    // Try to get from VS Code workspace if available
    try {
        const folders = vscode.workspace?.workspaceFolders;
        if (!workspaceRoot && folders?.[0]?.uri?.fsPath) {
            root = folders[0].uri.fsPath;
        }
    } catch {
        // VS Code API not available (e.g., in tests)
    }
    
    const repoName = root.split(/[/\\]/).pop() ?? 'unknown';
    
    return {
        root,
        repoName,
        // rev could be populated from git if needed
    };
}
