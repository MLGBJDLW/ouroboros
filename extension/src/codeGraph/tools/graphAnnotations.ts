/**
 * Graph Annotations Tool
 * LM Tool for managing manual graph annotations
 */

import * as vscode from 'vscode';
import type { AnnotationManager } from '../annotations/AnnotationManager';
import type { AnnotationsResult, IssueKind, EntrypointType, Confidence } from '../core/types';
import {
    createSuccessEnvelope,
    createErrorEnvelope,
    getWorkspaceContext,
    type ToolEnvelope,
} from './envelope';
import { TOOLS } from '../../constants';

export type AnnotationAction = 'list' | 'addEdge' | 'addEntrypoint' | 'addIgnore' | 'remove';

export interface GraphAnnotationsInput {
    action: AnnotationAction;
    // For addEdge
    from?: string;
    to?: string;
    edgeKind?: 'imports' | 'calls' | 'registers';
    reason?: string;
    // For addEntrypoint
    path?: string;
    entrypointType?: EntrypointType;
    name?: string;
    // For addIgnore
    issueKind?: IssueKind;
    ignorePath?: string;
    ignoreReason?: string;
    // For remove
    removeType?: 'edge' | 'entrypoint' | 'ignore';
}

export interface GraphAnnotationsTool {
    name: string;
    description: string;
    inputSchema: object;
    execute: (input: GraphAnnotationsInput) => Promise<ToolEnvelope<AnnotationsResult | { success: boolean; message: string }>>;
}

export function createGraphAnnotationsTool(
    manager: { getAnnotationManager: () => AnnotationManager }
): GraphAnnotationsTool {
    return {
        name: 'ouroborosai_graph_annotations',
        description: `Manage manual annotations for the code graph.
Use this to add hints for dynamic imports, mark custom entrypoints, or ignore false positives.

Actions:
- list: Show all current annotations
- addEdge: Add a manual edge (for dynamic imports that can't be resolved)
- addEntrypoint: Mark a file as an entrypoint
- addIgnore: Ignore specific issues for a path

Examples:
- List annotations: action="list"
- Add dynamic import hint: action="addEdge", from="src/loader.ts", to="src/plugins/auth.ts", reason="dynamic require"
- Mark as entrypoint: action="addEntrypoint", path="src/workers/cleanup.ts", entrypointType="job", name="Cleanup Worker"
- Ignore issue: action="addIgnore", issueKind="HANDLER_UNREACHABLE", ignorePath="src/legacy/*", ignoreReason="Legacy code"`,

        inputSchema: {
            type: 'object',
            required: ['action'],
            properties: {
                action: {
                    type: 'string',
                    enum: ['list', 'addEdge', 'addEntrypoint', 'addIgnore', 'remove'],
                    description: 'Action to perform',
                },
                from: {
                    type: 'string',
                    description: 'Source file path (for addEdge)',
                },
                to: {
                    type: 'string',
                    description: 'Target file path (for addEdge)',
                },
                edgeKind: {
                    type: 'string',
                    enum: ['imports', 'calls', 'registers'],
                    description: 'Type of edge (for addEdge)',
                },
                reason: {
                    type: 'string',
                    description: 'Reason for the annotation',
                },
                path: {
                    type: 'string',
                    description: 'File path (for addEntrypoint)',
                },
                entrypointType: {
                    type: 'string',
                    enum: ['route', 'page', 'command', 'job', 'api', 'main'],
                    description: 'Type of entrypoint',
                },
                name: {
                    type: 'string',
                    description: 'Display name for entrypoint',
                },
                issueKind: {
                    type: 'string',
                    enum: ['HANDLER_UNREACHABLE', 'DYNAMIC_EDGE_UNKNOWN', 'BROKEN_EXPORT_CHAIN', 'CIRCULAR_REEXPORT', 'ORPHAN_EXPORT'],
                    description: 'Issue type to ignore',
                },
                ignorePath: {
                    type: 'string',
                    description: 'Path pattern to ignore (supports * wildcard)',
                },
                ignoreReason: {
                    type: 'string',
                    description: 'Reason for ignoring',
                },
                removeType: {
                    type: 'string',
                    enum: ['edge', 'entrypoint', 'ignore'],
                    description: 'Type of annotation to remove',
                },
            },
        },

        async execute(input: GraphAnnotationsInput): Promise<ToolEnvelope<AnnotationsResult | { success: boolean; message: string }>> {
            const workspace = getWorkspaceContext();
            const annotationManager = manager.getAnnotationManager();
            
            if (!annotationManager) {
                return createErrorEnvelope(
                    TOOLS.GRAPH_ANNOTATIONS,
                    'NOT_AVAILABLE',
                    'Annotation manager not available',
                    workspace
                );
            }

            switch (input.action) {
                case 'list': {
                    const result = await listAnnotations(annotationManager);
                    return createSuccessEnvelope(
                        TOOLS.GRAPH_ANNOTATIONS,
                        result,
                        workspace,
                        {
                            truncated: false,
                            limits: {},
                            nextQuerySuggestion: result.stats.totalEdges === 0 && result.stats.totalEntrypoints === 0
                                ? [{
                                    tool: TOOLS.GRAPH_ISSUES,
                                    args: { kind: 'DYNAMIC_EDGE_UNKNOWN', limit: 10 },
                                    reason: 'No annotations yet - check for dynamic edges to annotate',
                                }]
                                : undefined,
                        }
                    );
                }

                case 'addEdge':
                    if (!input.from || !input.to) {
                        return createErrorEnvelope(
                            TOOLS.GRAPH_ANNOTATIONS,
                            'MISSING_PARAMS',
                            'from and to are required for addEdge',
                            workspace,
                            { required: ['from', 'to'] }
                        );
                    }
                    await annotationManager.addEdge({
                        from: input.from,
                        to: input.to,
                        kind: input.edgeKind ?? 'imports',
                        confidence: 'high' as Confidence,
                        reason: input.reason ?? 'manual annotation',
                    });
                    return createSuccessEnvelope(
                        TOOLS.GRAPH_ANNOTATIONS,
                        { success: true, message: `Added edge: ${input.from} → ${input.to}` },
                        workspace,
                        { truncated: false, limits: {} }
                    );

                case 'addEntrypoint':
                    if (!input.path || !input.entrypointType || !input.name) {
                        return createErrorEnvelope(
                            TOOLS.GRAPH_ANNOTATIONS,
                            'MISSING_PARAMS',
                            'path, entrypointType, and name are required for addEntrypoint',
                            workspace,
                            { required: ['path', 'entrypointType', 'name'] }
                        );
                    }
                    await annotationManager.addEntrypoint({
                        path: input.path,
                        type: input.entrypointType,
                        name: input.name,
                    });
                    return createSuccessEnvelope(
                        TOOLS.GRAPH_ANNOTATIONS,
                        { success: true, message: `Added entrypoint: ${input.name} (${input.path})` },
                        workspace,
                        { truncated: false, limits: {} }
                    );

                case 'addIgnore':
                    if (!input.issueKind || !input.ignorePath) {
                        return createErrorEnvelope(
                            TOOLS.GRAPH_ANNOTATIONS,
                            'MISSING_PARAMS',
                            'issueKind and ignorePath are required for addIgnore',
                            workspace,
                            { required: ['issueKind', 'ignorePath'] }
                        );
                    }
                    await annotationManager.addIgnore({
                        issueKind: input.issueKind,
                        path: input.ignorePath,
                        reason: input.ignoreReason ?? 'manual ignore',
                    });
                    return createSuccessEnvelope(
                        TOOLS.GRAPH_ANNOTATIONS,
                        { success: true, message: `Added ignore rule: ${input.issueKind} for ${input.ignorePath}` },
                        workspace,
                        { truncated: false, limits: {} }
                    );

                case 'remove':
                    if (input.removeType === 'edge' && input.from && input.to) {
                        const removed = await annotationManager.removeEdge(input.from, input.to);
                        return createSuccessEnvelope(
                            TOOLS.GRAPH_ANNOTATIONS,
                            { success: removed, message: removed ? 'Edge removed' : 'Edge not found' },
                            workspace,
                            { truncated: false, limits: {} }
                        );
                    }
                    if (input.removeType === 'entrypoint' && input.path) {
                        const removed = await annotationManager.removeEntrypoint(input.path);
                        return createSuccessEnvelope(
                            TOOLS.GRAPH_ANNOTATIONS,
                            { success: removed, message: removed ? 'Entrypoint removed' : 'Entrypoint not found' },
                            workspace,
                            { truncated: false, limits: {} }
                        );
                    }
                    if (input.removeType === 'ignore' && input.issueKind && input.ignorePath) {
                        const removed = await annotationManager.removeIgnore(input.issueKind, input.ignorePath);
                        return createSuccessEnvelope(
                            TOOLS.GRAPH_ANNOTATIONS,
                            { success: removed, message: removed ? 'Ignore rule removed' : 'Ignore rule not found' },
                            workspace,
                            { truncated: false, limits: {} }
                        );
                    }
                    return createErrorEnvelope(
                        TOOLS.GRAPH_ANNOTATIONS,
                        'INVALID_PARAMS',
                        'Invalid remove parameters',
                        workspace,
                        { removeType: input.removeType }
                    );

                default:
                    return createErrorEnvelope(
                        TOOLS.GRAPH_ANNOTATIONS,
                        'UNKNOWN_ACTION',
                        `Unknown action: ${input.action}`,
                        workspace,
                        { action: input.action }
                    );
            }
        },
    };
}

async function listAnnotations(manager: AnnotationManager): Promise<AnnotationsResult> {
    const all = await manager.getAll();
    
    return {
        edges: all.edges.map((e) => ({
            from: e.from,
            to: e.to,
            kind: e.kind,
            reason: e.reason,
        })),
        entrypoints: all.entrypoints.map((e) => ({
            path: e.path,
            type: e.type,
            name: e.name,
        })),
        ignores: all.ignores.map((i) => ({
            issueKind: i.issueKind,
            path: i.path,
            reason: i.reason,
        })),
        stats: {
            totalEdges: all.edges.length,
            totalEntrypoints: all.entrypoints.length,
            totalIgnores: all.ignores.length,
        },
        meta: {
            tokensEstimate: Math.ceil(JSON.stringify(all).length / 4),
            filePath: manager.getFilePath(),
        },
    };
}

/**
 * Register the graph annotations tool with VS Code
 */
export function registerGraphAnnotationsTool(
    context: vscode.ExtensionContext,
    getAnnotationManager: () => AnnotationManager | null
): vscode.Disposable | undefined {
    const vscodeAny = vscode as typeof vscode & {
        lm?: {
            registerTool?: (
                name: string,
                tool: {
                    invoke: (
                        options: { input: GraphAnnotationsInput },
                        token: vscode.CancellationToken
                    ) => Promise<vscode.LanguageModelToolResult>;
                }
            ) => vscode.Disposable;
        };
    };

    if (!vscodeAny.lm?.registerTool) {
        return undefined;
    }

    const tool = createGraphAnnotationsTool(getAnnotationManager as unknown as { getAnnotationManager: () => AnnotationManager });

    return vscodeAny.lm.registerTool(tool.name, {
        async invoke(
            options: { input: GraphAnnotationsInput },
            _token: vscode.CancellationToken
        ): Promise<vscode.LanguageModelToolResult> {
            const result = await tool.execute(options.input);
            return new vscodeAny.LanguageModelToolResult([
                new vscodeAny.LanguageModelTextPart(JSON.stringify(result, null, 2)),
            ]);
        },
    });
}
