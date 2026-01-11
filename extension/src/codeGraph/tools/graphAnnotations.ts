/**
 * Graph Annotations Tool
 * LM Tool for managing manual graph annotations
 */

import * as vscode from 'vscode';
import { z } from 'zod';
import type { CodeGraphManager } from '../CodeGraphManager';
import type { AnnotationsResult, IssueKind, EntrypointType, Confidence } from '../core/types';
import { createLogger } from '../../utils/logger';
import {
    createSuccessEnvelope,
    createErrorEnvelope,
    envelopeToResult,
    getWorkspaceContext,
} from './envelope';
import { TOOLS } from '../../constants';

const logger = createLogger('GraphAnnotationsTool');

const ANNOTATION_ACTIONS = ['list', 'addEdge', 'addEntrypoint', 'addIgnore', 'remove'] as const;
const EDGE_KINDS = ['imports', 'calls', 'registers'] as const;
const ENTRYPOINT_TYPES = ['route', 'page', 'command', 'job', 'api', 'main'] as const;
const ISSUE_KINDS = ['HANDLER_UNREACHABLE', 'DYNAMIC_EDGE_UNKNOWN', 'BROKEN_EXPORT_CHAIN', 'CIRCULAR_REEXPORT', 'ORPHAN_EXPORT'] as const;
const REMOVE_TYPES = ['edge', 'entrypoint', 'ignore'] as const;

export const GraphAnnotationsInputSchema = z.object({
    action: z
        .enum(ANNOTATION_ACTIONS)
        .describe('Action to perform'),
    // For addEdge
    from: z
        .string()
        .optional()
        .describe('Source file path (for addEdge)'),
    to: z
        .string()
        .optional()
        .describe('Target file path (for addEdge)'),
    edgeKind: z
        .enum(EDGE_KINDS)
        .optional()
        .describe('Type of edge (for addEdge)'),
    reason: z
        .string()
        .optional()
        .describe('Reason for the annotation'),
    // For addEntrypoint
    path: z
        .string()
        .optional()
        .describe('File path (for addEntrypoint)'),
    entrypointType: z
        .enum(ENTRYPOINT_TYPES)
        .optional()
        .describe('Type of entrypoint'),
    name: z
        .string()
        .optional()
        .describe('Display name for entrypoint'),
    // For addIgnore
    issueKind: z
        .enum(ISSUE_KINDS)
        .optional()
        .describe('Issue type to ignore'),
    ignorePath: z
        .string()
        .optional()
        .describe('Path pattern to ignore (supports * wildcard)'),
    ignoreReason: z
        .string()
        .optional()
        .describe('Reason for ignoring'),
    // For remove
    removeType: z
        .enum(REMOVE_TYPES)
        .optional()
        .describe('Type of annotation to remove'),
});

export type GraphAnnotationsInput = z.infer<typeof GraphAnnotationsInputSchema>;

export function createGraphAnnotationsTool(
    manager: CodeGraphManager
): vscode.LanguageModelTool<GraphAnnotationsInput> {
    return {
        async invoke(
            options: vscode.LanguageModelToolInvocationOptions<GraphAnnotationsInput>,
            _token: vscode.CancellationToken
        ): Promise<vscode.LanguageModelToolResult> {
            const input = options.input;
            const workspace = getWorkspaceContext();

            logger.info('Graph annotations requested', { action: input.action });

            try {
                // Validate input
                const parsed = GraphAnnotationsInputSchema.safeParse(input);
                if (!parsed.success) {
                    const envelope = createErrorEnvelope(
                        TOOLS.GRAPH_ANNOTATIONS,
                        'INVALID_INPUT',
                        'Invalid input: ' + parsed.error.message,
                        workspace,
                        { errors: parsed.error.errors }
                    );
                    return envelopeToResult(envelope);
                }

                const annotationManager = manager.getAnnotationManager();
                if (!annotationManager) {
                    const envelope = createErrorEnvelope(
                        TOOLS.GRAPH_ANNOTATIONS,
                        'NOT_AVAILABLE',
                        'Annotation manager not available',
                        workspace
                    );
                    return envelopeToResult(envelope);
                }

                switch (input.action) {
                    case 'list': {
                        const all = await annotationManager.getAll();
                        const result: AnnotationsResult = {
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
                                filePath: annotationManager.getFilePath(),
                            },
                        };
                        const envelope = createSuccessEnvelope(
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
                        return envelopeToResult(envelope);
                    }

                    case 'addEdge':
                        if (!input.from || !input.to) {
                            const envelope = createErrorEnvelope(
                                TOOLS.GRAPH_ANNOTATIONS,
                                'MISSING_PARAMS',
                                'from and to are required for addEdge',
                                workspace,
                                { required: ['from', 'to'] }
                            );
                            return envelopeToResult(envelope);
                        }
                        await annotationManager.addEdge({
                            from: input.from,
                            to: input.to,
                            kind: input.edgeKind ?? 'imports',
                            confidence: 'high' as Confidence,
                            reason: input.reason ?? 'manual annotation',
                        });
                        return envelopeToResult(createSuccessEnvelope(
                            TOOLS.GRAPH_ANNOTATIONS,
                            { success: true, message: `Added edge: ${input.from} → ${input.to}` },
                            workspace,
                            { truncated: false, limits: {} }
                        ));

                    case 'addEntrypoint':
                        if (!input.path || !input.entrypointType || !input.name) {
                            const envelope = createErrorEnvelope(
                                TOOLS.GRAPH_ANNOTATIONS,
                                'MISSING_PARAMS',
                                'path, entrypointType, and name are required for addEntrypoint',
                                workspace,
                                { required: ['path', 'entrypointType', 'name'] }
                            );
                            return envelopeToResult(envelope);
                        }
                        await annotationManager.addEntrypoint({
                            path: input.path,
                            type: input.entrypointType as EntrypointType,
                            name: input.name,
                        });
                        return envelopeToResult(createSuccessEnvelope(
                            TOOLS.GRAPH_ANNOTATIONS,
                            { success: true, message: `Added entrypoint: ${input.name} (${input.path})` },
                            workspace,
                            { truncated: false, limits: {} }
                        ));

                    case 'addIgnore':
                        if (!input.issueKind || !input.ignorePath) {
                            const envelope = createErrorEnvelope(
                                TOOLS.GRAPH_ANNOTATIONS,
                                'MISSING_PARAMS',
                                'issueKind and ignorePath are required for addIgnore',
                                workspace,
                                { required: ['issueKind', 'ignorePath'] }
                            );
                            return envelopeToResult(envelope);
                        }
                        await annotationManager.addIgnore({
                            issueKind: input.issueKind as IssueKind,
                            path: input.ignorePath,
                            reason: input.ignoreReason ?? 'manual ignore',
                        });
                        return envelopeToResult(createSuccessEnvelope(
                            TOOLS.GRAPH_ANNOTATIONS,
                            { success: true, message: `Added ignore rule: ${input.issueKind} for ${input.ignorePath}` },
                            workspace,
                            { truncated: false, limits: {} }
                        ));

                    case 'remove':
                        if (input.removeType === 'edge' && input.from && input.to) {
                            const removed = await annotationManager.removeEdge(input.from, input.to);
                            return envelopeToResult(createSuccessEnvelope(
                                TOOLS.GRAPH_ANNOTATIONS,
                                { success: removed, message: removed ? 'Edge removed' : 'Edge not found' },
                                workspace,
                                { truncated: false, limits: {} }
                            ));
                        }
                        if (input.removeType === 'entrypoint' && input.path) {
                            const removed = await annotationManager.removeEntrypoint(input.path);
                            return envelopeToResult(createSuccessEnvelope(
                                TOOLS.GRAPH_ANNOTATIONS,
                                { success: removed, message: removed ? 'Entrypoint removed' : 'Entrypoint not found' },
                                workspace,
                                { truncated: false, limits: {} }
                            ));
                        }
                        if (input.removeType === 'ignore' && input.issueKind && input.ignorePath) {
                            const removed = await annotationManager.removeIgnore(input.issueKind as IssueKind, input.ignorePath);
                            return envelopeToResult(createSuccessEnvelope(
                                TOOLS.GRAPH_ANNOTATIONS,
                                { success: removed, message: removed ? 'Ignore rule removed' : 'Ignore rule not found' },
                                workspace,
                                { truncated: false, limits: {} }
                            ));
                        }
                        return envelopeToResult(createErrorEnvelope(
                            TOOLS.GRAPH_ANNOTATIONS,
                            'INVALID_PARAMS',
                            'Invalid remove parameters',
                            workspace,
                            { removeType: input.removeType }
                        ));

                    default:
                        return envelopeToResult(createErrorEnvelope(
                            TOOLS.GRAPH_ANNOTATIONS,
                            'UNKNOWN_ACTION',
                            `Unknown action: ${input.action}`,
                            workspace,
                            { action: input.action }
                        ));
                }
            } catch (error) {
                logger.error('Graph annotations error:', error);
                const envelope = createErrorEnvelope(
                    TOOLS.GRAPH_ANNOTATIONS,
                    'INTERNAL_ERROR',
                    error instanceof Error ? error.message : 'Unknown error',
                    workspace
                );
                return envelopeToResult(envelope);
            }
        },
    };
}
