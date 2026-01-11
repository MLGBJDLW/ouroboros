/**
 * Layer Analyzer
 * Enforces architectural layer rules and detects violations
 */

import type { GraphStore } from '../core/GraphStore';
import type { GraphIssue, IssueSeverity } from '../core/types';
import { createLogger } from '../../utils/logger';

const logger = createLogger('LayerAnalyzer');

export interface LayerRule {
    /** Rule name for identification */
    name: string;
    /** Source layer pattern (glob) */
    from: string;
    /** Forbidden target pattern (glob) */
    cannotImport: string;
    /** Optional: must go through this layer */
    mustGoThrough?: string;
    /** Severity of violation */
    severity: 'warning' | 'error';
    /** Optional description */
    description?: string;
}

export interface LayerViolation {
    /** The rule that was violated */
    rule: LayerRule;
    /** Source file that violated the rule */
    sourceFile: string;
    /** Target file that was imported */
    targetFile: string;
    /** Line number of the import */
    line?: number;
}

export interface LayerAnalyzerOptions {
    /** Layer rules to enforce */
    rules: LayerRule[];
    /** Scope to limit analysis */
    scope?: string;
}

// Common architectural layer rules
export const COMMON_LAYER_RULES: LayerRule[] = [
    {
        name: 'UI cannot import DB',
        from: 'src/ui/**',
        cannotImport: 'src/db/**',
        severity: 'error',
        description: 'UI layer should not directly access database layer',
    },
    {
        name: 'UI cannot import API internals',
        from: 'src/ui/**',
        cannotImport: 'src/api/internal/**',
        severity: 'error',
        description: 'UI should use public API interfaces only',
    },
    {
        name: 'Controllers cannot import Views',
        from: 'src/controllers/**',
        cannotImport: 'src/views/**',
        severity: 'warning',
        description: 'Controllers should not depend on views',
    },
    {
        name: 'Domain cannot import Infrastructure',
        from: 'src/domain/**',
        cannotImport: 'src/infrastructure/**',
        severity: 'error',
        description: 'Domain layer should be independent of infrastructure',
    },
    {
        name: 'Utils cannot import Features',
        from: 'src/utils/**',
        cannotImport: 'src/features/**',
        severity: 'error',
        description: 'Utilities should not depend on feature modules',
    },
];

export class LayerAnalyzer {
    private store: GraphStore;
    private rules: LayerRule[] = [];

    constructor(store: GraphStore) {
        this.store = store;
    }

    /**
     * Set layer rules
     */
    setRules(rules: LayerRule[]): void {
        this.rules = rules;
        logger.info(`Configured ${rules.length} layer rules`);
    }

    /**
     * Add a single rule
     */
    addRule(rule: LayerRule): void {
        this.rules.push(rule);
    }

    /**
     * Get current rules
     */
    getRules(): LayerRule[] {
        return [...this.rules];
    }

    /**
     * Check all edges against layer rules
     */
    checkViolations(options: LayerAnalyzerOptions = { rules: this.rules }): LayerViolation[] {
        const { rules, scope } = options;
        const violations: LayerViolation[] = [];
        const edges = this.store.getAllEdges();

        for (const edge of edges) {
            // Only check import edges
            if (edge.kind !== 'imports') continue;

            const sourceFile = edge.from.replace(/^file:/, '');
            const targetFile = edge.to.replace(/^(file|module):/, '');

            // Apply scope filter
            if (scope && !this.matchesPattern(sourceFile, scope)) continue;

            // Check against each rule
            for (const rule of rules) {
                if (this.violatesRule(sourceFile, targetFile, rule)) {
                    violations.push({
                        rule,
                        sourceFile,
                        targetFile,
                        line: edge.meta?.loc?.line,
                    });
                }
            }
        }

        logger.info(`Found ${violations.length} layer violations`);
        return violations;
    }

    /**
     * Convert violations to GraphIssues
     */
    detectLayerIssues(options: LayerAnalyzerOptions = { rules: this.rules }): GraphIssue[] {
        const violations = this.checkViolations(options);

        return violations.map((v, index) => ({
            id: `issue:layer:${index}`,
            kind: 'LAYER_VIOLATION' as const,
            severity: v.rule.severity as IssueSeverity,
            title: `Layer violation: ${v.rule.name}`,
            message: v.rule.description || `${v.sourceFile} should not import ${v.targetFile}`,
            evidence: [
                `Source: ${v.sourceFile}${v.line ? `:${v.line}` : ''}`,
                `Target: ${v.targetFile}`,
                `Rule: ${v.rule.from} cannot import ${v.rule.cannotImport}`,
            ],
            suggestedFix: this.getSuggestedFix(v),
            meta: {
                filePath: v.sourceFile,
                line: v.line,
                ruleName: v.rule.name,
                targetFile: v.targetFile,
            },
        }));
    }

    /**
     * Check if an import violates a rule
     */
    private violatesRule(sourceFile: string, targetFile: string, rule: LayerRule): boolean {
        // Check if source matches the 'from' pattern
        if (!this.matchesPattern(sourceFile, rule.from)) {
            return false;
        }

        // Check if target matches the 'cannotImport' pattern
        if (!this.matchesPattern(targetFile, rule.cannotImport)) {
            return false;
        }

        // If mustGoThrough is specified, check if it's in the path
        if (rule.mustGoThrough) {
            // This would require path analysis - for now, just flag the violation
            // A more sophisticated implementation would check if there's an allowed path
        }

        return true;
    }

    /**
     * Match a path against a glob pattern
     */
    private matchesPattern(path: string, pattern: string): boolean {
        // Normalize path separators
        const normalizedPath = path.replace(/\\/g, '/');
        const normalizedPattern = pattern.replace(/\\/g, '/');

        // Convert glob to regex
        const regexPattern = normalizedPattern
            .replace(/\*\*/g, '{{GLOBSTAR}}')
            .replace(/\*/g, '[^/]*')
            .replace(/{{GLOBSTAR}}/g, '.*')
            .replace(/\?/g, '.');

        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(normalizedPath);
    }

    /**
     * Get suggested fix for a violation
     */
    private getSuggestedFix(violation: LayerViolation): string[] {
        const fixes: string[] = [];

        if (violation.rule.mustGoThrough) {
            fixes.push(`Import through ${violation.rule.mustGoThrough} instead`);
        }

        fixes.push(
            `Move the shared code to a common module`,
            `Create an interface/abstraction in an allowed layer`,
            `Use dependency injection to invert the dependency`,
        );

        return fixes;
    }

    /**
     * Analyze layer structure and suggest rules
     */
    suggestRules(): LayerRule[] {
        const suggestions: LayerRule[] = [];
        const nodes = this.store.getAllNodes();

        // Detect common directory patterns
        const directories = new Set<string>();
        for (const node of nodes) {
            if (node.kind === 'file' && node.path) {
                const parts = node.path.split('/');
                if (parts.length > 1) {
                    directories.add(parts.slice(0, -1).join('/'));
                }
            }
        }

        // Check for common layer patterns
        const hasUI = [...directories].some(d => d.includes('ui') || d.includes('views') || d.includes('components'));
        const hasDB = [...directories].some(d => d.includes('db') || d.includes('database') || d.includes('models'));
        const _hasAPI = [...directories].some(d => d.includes('api') || d.includes('routes') || d.includes('controllers'));
        const hasUtils = [...directories].some(d => d.includes('utils') || d.includes('helpers') || d.includes('lib'));

        if (hasUI && hasDB) {
            suggestions.push({
                name: 'UI cannot import DB',
                from: '**/ui/**',
                cannotImport: '**/db/**',
                severity: 'error',
                description: 'UI layer should not directly access database',
            });
        }

        if (hasUtils) {
            suggestions.push({
                name: 'Utils should be independent',
                from: '**/utils/**',
                cannotImport: '**/features/**',
                severity: 'warning',
                description: 'Utilities should not depend on feature modules',
            });
        }

        return suggestions;
    }
}
