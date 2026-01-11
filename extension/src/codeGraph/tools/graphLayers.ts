/**
 * Graph Layers Tool
 * LM Tool for checking architectural layer violations
 */

import type * as vscode from 'vscode';
import type { LayerAnalyzer, LayerRule } from '../analyzers/LayerAnalyzer';

export interface GraphLayersInput {
    action: 'check' | 'list' | 'suggest';
    scope?: string;
    rules?: LayerRule[];
}

export interface GraphLayersResult {
    violations?: Array<{
        rule: string;
        sourceFile: string;
        targetFile: string;
        severity: 'warning' | 'error';
        description: string;
        line?: number;
    }>;
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

export interface GraphLayersTool {
    name: string;
    description: string;
    inputSchema: object;
    execute: (input: GraphLayersInput) => Promise<GraphLayersResult>;
}

export function createGraphLayersTool(
    getLayerAnalyzer: () => LayerAnalyzer | null
): GraphLayersTool {
    return {
        name: 'ouroborosai_graph_layers',
        description: `Check architectural layer rules and detect violations.
Use this to enforce clean architecture boundaries (e.g., UI cannot import DB).

Actions:
- check: Find violations of configured rules
- list: Show current layer rules
- suggest: Get suggested rules based on project structure

Examples:
- Check violations: action="check"
- Check specific scope: action="check", scope="src/features"
- List rules: action="list"
- Get suggestions: action="suggest"`,

        inputSchema: {
            type: 'object',
            required: ['action'],
            properties: {
                action: {
                    type: 'string',
                    enum: ['check', 'list', 'suggest'],
                    description: 'Action to perform',
                },
                scope: {
                    type: 'string',
                    description: 'Directory scope for checking (e.g., "src/features")',
                },
                rules: {
                    type: 'array',
                    description: 'Custom rules to check (for action="check")',
                    items: {
                        type: 'object',
                        properties: {
                            name: { type: 'string' },
                            from: { type: 'string' },
                            cannotImport: { type: 'string' },
                            severity: { type: 'string', enum: ['warning', 'error'] },
                        },
                    },
                },
            },
        },

        async execute(input: GraphLayersInput): Promise<GraphLayersResult> {
            const analyzer = getLayerAnalyzer();

            if (!analyzer) {
                return {
                    stats: {},
                    meta: { tokensEstimate: 50, action: input.action, scope: null },
                };
            }

            switch (input.action) {
                case 'check': {
                    const rules = input.rules ?? analyzer.getRules();
                    const violations = analyzer.checkViolations({ rules, scope: input.scope });
                    
                    const errorCount = violations.filter(v => v.rule.severity === 'error').length;
                    const warningCount = violations.filter(v => v.rule.severity === 'warning').length;

                    return {
                        violations: violations.map(v => ({
                            rule: v.rule.name,
                            sourceFile: v.sourceFile,
                            targetFile: v.targetFile,
                            severity: v.rule.severity,
                            description: v.rule.description ?? `${v.sourceFile} should not import ${v.targetFile}`,
                            line: v.line,
                        })),
                        stats: {
                            totalViolations: violations.length,
                            errorCount,
                            warningCount,
                        },
                        meta: {
                            tokensEstimate: Math.ceil(JSON.stringify(violations).length / 4),
                            action: 'check',
                            scope: input.scope ?? null,
                        },
                    };
                }

                case 'list': {
                    const rules = analyzer.getRules();
                    return {
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
                }

                case 'suggest': {
                    const suggestions = analyzer.suggestRules();
                    return {
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
                }

                default:
                    return {
                        stats: {},
                        meta: { tokensEstimate: 50, action: input.action, scope: null },
                    };
            }
        },
    };
}

/**
 * Register the graph layers tool with VS Code
 */
export function registerGraphLayersTool(
    _context: vscode.ExtensionContext,
    getLayerAnalyzer: () => LayerAnalyzer | null
): vscode.Disposable | undefined {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const vscodeAny = require('vscode') as typeof vscode & {
        lm?: {
            registerTool?: (
                name: string,
                tool: {
                    invoke: (
                        options: { input: GraphLayersInput },
                        token: vscode.CancellationToken
                    ) => Promise<vscode.LanguageModelToolResult>;
                }
            ) => vscode.Disposable;
        };
    };

    if (!vscodeAny.lm?.registerTool) {
        return undefined;
    }

    const tool = createGraphLayersTool(getLayerAnalyzer);

    return vscodeAny.lm.registerTool(tool.name, {
        async invoke(
            options: { input: GraphLayersInput },
            _token: vscode.CancellationToken
        ): Promise<vscode.LanguageModelToolResult> {
            const result = await tool.execute(options.input);
            return new vscodeAny.LanguageModelToolResult([
                new vscodeAny.LanguageModelTextPart(JSON.stringify(result, null, 2)),
            ]);
        },
    });
}
