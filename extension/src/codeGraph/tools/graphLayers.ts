/**
 * Graph Layers Tool
 * LM Tool for checking architectural layer violations
 */

import * as vscode from 'vscode';
import { z } from 'zod';
import type { CodeGraphManager } from '../CodeGraphManager';
import type { LayerRule } from '../analyzers/LayerAnalyzer';
import { createLogger } from '../../utils/logger';
import {
    createSuccessEnvelope,
    createErrorEnvelope,
    envelopeToResult,
    getWorkspaceContext,
} from './envelope';
import { TOOLS } from '../../constants';

const logger = createLogger('GraphLayersTool');

const LayerRuleSchema = z.object({
    name: z.string(),
    from: z.string(),
    cannotImport: z.string(),
    severity: z.enum(['warning', 'error']).optional(),
    description: z.string().optional(),
});

export const GraphLayersInputSchema = z.object({
    action: z
        .enum(['check', 'list', 'suggest'])
        .describe('Action to perform'),
    scope: z
        .string()
        .optional()
        .describe('Directory scope for checking (e.g., "src/features")'),
    rules: z
        .array(LayerRuleSchema)
        .optional()
        .describe('Custom rules to check (for action="check")'),
    severityFilter: z
        .enum(['all', 'warning', 'error'])
        .optional()
        .describe('Filter violations by severity (default: all)'),
    limit: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe('Max violations to return (1-100, default: 50)'),
    groupByRule: z
        .boolean()
        .optional()
        .describe('Group violations by rule name (default: false)'),
});

export type GraphLayersInput = z.infer<typeof GraphLayersInputSchema>;

export interface GraphLayersResult {
    violations?: Array<{
        rule: string;
        sourceFile: string;
        targetFile: string;
        severity: 'warning' | 'error';
        description: string;
        line?: number;
    }>;
    groupedViolations?: Record<string, Array<{
        rule: string;
        sourceFile: string;
        targetFile: string;
        severity: 'warning' | 'error';
        description: string;
        line?: number;
    }>>;
    rules?: Array<{
        name: string;
        from: string;
        cannotImport: string;
        severity: 'warning' | 'error';
        description?: string;
    }>;
    suggestions?: Array<{
        name: string;
        from: string;
        cannotImport: string;
        severity: 'warning' | 'error';
        description?: string;
    }>;
    stats: {
        totalViolations?: number;
        returnedViolations?: number;
        errorCount?: number;
        warningCount?: number;
        rulesCount?: number;
    };
    meta: {
        tokensEstimate: number;
        action: string;
        scope: string | null;
    };
}

export function createGraphLayersTool(
    manager: CodeGraphManager
): vscode.LanguageModelTool<GraphLayersInput> {
    return {
        async invoke(
            options: vscode.LanguageModelToolInvocationOptions<GraphLayersInput>,
            _token: vscode.CancellationToken
        ): Promise<vscode.LanguageModelToolResult> {
            const input = options.input;
            const workspace = getWorkspaceContext();

            logger.info('Graph layers requested', { action: input.action });

            try {
                // Validate input
                const parsed = GraphLayersInputSchema.safeParse(input);
                if (!parsed.success) {
                    const envelope = createErrorEnvelope(
                        TOOLS.GRAPH_LAYERS,
                        'INVALID_INPUT',
                        'Invalid input: ' + parsed.error.message,
                        workspace,
                        { errors: parsed.error.errors }
                    );
                    return envelopeToResult(envelope);
                }

                const { action, scope, rules: inputRules, severityFilter, limit, groupByRule } = parsed.data;
                const analyzer = manager.getLayerAnalyzer();

                if (!analyzer) {
                    const emptyResult: GraphLayersResult = {
                        stats: {},
                        meta: { tokensEstimate: 50, action, scope: null },
                    };
                    const envelope = createSuccessEnvelope(
                        TOOLS.GRAPH_LAYERS,
                        emptyResult,
                        workspace,
                        { truncated: false, limits: {} }
                    );
                    return envelopeToResult(envelope);
                }

                switch (action) {
                    case 'check': {
                        const rules = (inputRules as LayerRule[] | undefined) ?? analyzer.getRules();
                        let violations = analyzer.checkViolations({ rules, scope });

                        // Apply severity filter
                        if (severityFilter && severityFilter !== 'all') {
                            violations = violations.filter(v => v.rule.severity === severityFilter);
                        }

                        // Apply limit
                        const maxLimit = Math.min(limit ?? 50, 100);
                        const truncated = violations.length > maxLimit;
                        const limitedViolations = violations.slice(0, maxLimit);

                        const errorCount = limitedViolations.filter(v => v.rule.severity === 'error').length;
                        const warningCount = limitedViolations.filter(v => v.rule.severity === 'warning').length;

                        // Build result with optional grouping
                        let violationsData: GraphLayersResult['violations'] | Record<string, GraphLayersResult['violations']>;

                        if (groupByRule) {
                            const grouped: Record<string, GraphLayersResult['violations']> = {};
                            for (const v of limitedViolations) {
                                const ruleName = v.rule.name;
                                if (!grouped[ruleName]) {
                                    grouped[ruleName] = [];
                                }
                                const group = grouped[ruleName];
                                if (group) {
                                    group.push({
                                        rule: v.rule.name,
                                        sourceFile: v.sourceFile,
                                        targetFile: v.targetFile,
                                        severity: v.rule.severity,
                                        description: v.rule.description ?? `${v.sourceFile} should not import ${v.targetFile}`,
                                        line: v.line,
                                    });
                                }
                            }
                            violationsData = grouped;
                        } else {
                            violationsData = limitedViolations.map(v => ({
                                rule: v.rule.name,
                                sourceFile: v.sourceFile,
                                targetFile: v.targetFile,
                                severity: v.rule.severity,
                                description: v.rule.description ?? `${v.sourceFile} should not import ${v.targetFile}`,
                                line: v.line,
                            }));
                        }

                        const result: GraphLayersResult = {
                            violations: groupByRule ? undefined : violationsData as GraphLayersResult['violations'],
                            stats: {
                                totalViolations: violations.length,
                                returnedViolations: limitedViolations.length,
                                errorCount,
                                warningCount,
                            },
                            meta: {
                                tokensEstimate: Math.ceil(JSON.stringify(violationsData).length / 4),
                                action: 'check',
                                scope: scope ?? null,
                            },
                        };

                        if (groupByRule) {
                            (result as unknown as Record<string, unknown>).groupedViolations = violationsData;
                        }

                        logger.debug('Layers check result', {
                            totalViolations: violations.length,
                            errorCount,
                            warningCount,
                        });

                        const envelope = createSuccessEnvelope(
                            TOOLS.GRAPH_LAYERS,
                            result,
                            workspace,
                            {
                                truncated,
                                limits: { maxItems: maxLimit },
                                nextQuerySuggestion: errorCount > 0
                                    ? [{
                                        tool: TOOLS.GRAPH_PATH,
                                        args: { from: limitedViolations[0]?.sourceFile, to: limitedViolations[0]?.targetFile },
                                        reason: 'Trace violation path for first error',
                                    }]
                                    : rules.length === 0
                                        ? [{
                                            tool: TOOLS.GRAPH_LAYERS,
                                            args: { action: 'suggest' },
                                            reason: 'No rules configured - get suggestions',
                                        }]
                                        : truncated
                                            ? [{
                                                tool: TOOLS.GRAPH_LAYERS,
                                                args: { ...input, limit: Math.min(maxLimit + 20, 100) },
                                                reason: `${violations.length - maxLimit} more violations available`,
                                            }]
                                            : undefined,
                            }
                        );
                        return envelopeToResult(envelope);
                    }

                    case 'list': {
                        const rules = analyzer.getRules();
                        const result: GraphLayersResult = {
                            rules: rules.map(r => ({
                                name: r.name,
                                from: r.from,
                                cannotImport: r.cannotImport,
                                severity: r.severity,
                                description: r.description,
                            })),
                            stats: { rulesCount: rules.length },
                            meta: {
                                tokensEstimate: Math.ceil(JSON.stringify(rules).length / 4),
                                action: 'list',
                                scope: null,
                            },
                        };

                        const envelope = createSuccessEnvelope(
                            TOOLS.GRAPH_LAYERS,
                            result,
                            workspace,
                            {
                                truncated: false,
                                limits: {},
                                nextQuerySuggestion: rules.length === 0
                                    ? [{
                                        tool: TOOLS.GRAPH_LAYERS,
                                        args: { action: 'suggest' },
                                        reason: 'No rules configured - get suggestions',
                                    }]
                                    : [{
                                        tool: TOOLS.GRAPH_LAYERS,
                                        args: { action: 'check' },
                                        reason: 'Check for violations with current rules',
                                    }],
                            }
                        );
                        return envelopeToResult(envelope);
                    }

                    case 'suggest': {
                        const suggestions = analyzer.suggestRules();
                        const result: GraphLayersResult = {
                            suggestions: suggestions.map(r => ({
                                name: r.name,
                                from: r.from,
                                cannotImport: r.cannotImport,
                                severity: r.severity,
                                description: r.description,
                            })),
                            stats: { rulesCount: suggestions.length },
                            meta: {
                                tokensEstimate: Math.ceil(JSON.stringify(suggestions).length / 4),
                                action: 'suggest',
                                scope: null,
                            },
                        };

                        const envelope = createSuccessEnvelope(
                            TOOLS.GRAPH_LAYERS,
                            result,
                            workspace,
                            {
                                truncated: false,
                                limits: {},
                                nextQuerySuggestion: suggestions.length > 0
                                    ? [{
                                        tool: TOOLS.GRAPH_LAYERS,
                                        args: { action: 'check', rules: suggestions.slice(0, 3) },
                                        reason: 'Test suggested rules for violations',
                                    }]
                                    : undefined,
                            }
                        );
                        return envelopeToResult(envelope);
                    }

                    default: {
                        const emptyResult: GraphLayersResult = {
                            stats: {},
                            meta: { tokensEstimate: 50, action, scope: null },
                        };
                        const envelope = createSuccessEnvelope(
                            TOOLS.GRAPH_LAYERS,
                            emptyResult,
                            workspace,
                            { truncated: false, limits: {} }
                        );
                        return envelopeToResult(envelope);
                    }
                }
            } catch (error) {
                logger.error('Graph layers error:', error);
                const envelope = createErrorEnvelope(
                    TOOLS.GRAPH_LAYERS,
                    'INTERNAL_ERROR',
                    error instanceof Error ? error.message : 'Unknown error',
                    workspace
                );
                return envelopeToResult(envelope);
            }
        },
    };
}
