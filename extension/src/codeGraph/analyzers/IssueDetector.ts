/**
 * Issue Detector
 * Detects code graph issues (missing links, unreachable code, broken exports)
 */

import type { GraphStore } from '../core/GraphStore';
import type { GraphIssue, IssueSeverity } from '../core/types';
import { ReachabilityAnalyzer } from './ReachabilityAnalyzer';

export class IssueDetector {
    private reachabilityAnalyzer: ReachabilityAnalyzer;

    constructor(private store: GraphStore) {
        this.reachabilityAnalyzer = new ReachabilityAnalyzer(store);
    }

    /**
     * Detect all issues in the graph
     */
    detectAll(): GraphIssue[] {
        const issues: GraphIssue[] = [];

        issues.push(...this.detectUnreachableHandlers());
        issues.push(...this.detectDynamicEdges());
        issues.push(...this.detectBrokenExports());

        return issues;
    }

    /**
     * Detect unreachable handlers (HANDLER_UNREACHABLE)
     * Files that exist but are not reachable from any entrypoint
     */
    detectUnreachableHandlers(): GraphIssue[] {
        const issues: GraphIssue[] = [];
        const result = this.reachabilityAnalyzer.analyze();

        for (const nodeId of result.unreachable) {
            const node = this.store.getNode(nodeId);
            if (!node || node.kind !== 'file') continue;

            // Skip test files, config files, etc.
            if (this.shouldSkipFile(node.path ?? '')) continue;

            // Check if file has exports (potential handler)
            const exports = node.meta?.exports as string[] | undefined;
            if (!exports || exports.length === 0) continue;

            issues.push({
                id: `issue:unreachable:${nodeId}`,
                kind: 'HANDLER_UNREACHABLE',
                severity: this.calculateSeverity(exports.length),
                nodeId,
                title: `Unreachable file: ${node.name}`,
                evidence: [
                    `File exports ${exports.length} symbol(s): ${exports.slice(0, 3).join(', ')}${exports.length > 3 ? '...' : ''}`,
                    'Not imported by any file reachable from entrypoints',
                ],
                suggestedFix: [
                    'Import this file from a reachable module',
                    'Add as an entrypoint if it should be directly accessible',
                    'Remove if no longer needed',
                ],
                meta: {
                    filePath: node.path,
                    affectedCount: exports.length,
                },
            });
        }

        return issues;
    }

    /**
     * Detect dynamic edges (DYNAMIC_EDGE_UNKNOWN)
     * Imports that cannot be statically resolved
     */
    detectDynamicEdges(): GraphIssue[] {
        const issues: GraphIssue[] = [];
        const edges = this.store.getAllEdges();

        for (const edge of edges) {
            if (edge.confidence === 'unknown' || edge.meta?.isDynamic) {
                const fromNode = this.store.getNode(edge.from);
                
                issues.push({
                    id: `issue:dynamic:${edge.id}`,
                    kind: 'DYNAMIC_EDGE_UNKNOWN',
                    severity: 'warning',
                    nodeId: edge.from,
                    title: `Dynamic import in ${fromNode?.name ?? edge.from}`,
                    evidence: [
                        `Dynamic import detected: ${edge.reason ?? 'unknown reason'}`,
                        `Target: ${edge.to}`,
                        'Cannot statically verify this connection',
                    ],
                    suggestedFix: [
                        'Consider using static imports if possible',
                        'Add annotation to declare this connection',
                    ],
                    meta: {
                        filePath: fromNode?.path,
                        line: edge.meta?.loc?.line,
                    },
                });
            }
        }

        return issues;
    }

    /**
     * Detect broken export chains (BROKEN_EXPORT_CHAIN)
     * Re-exports that point to non-existent files or symbols
     */
    detectBrokenExports(): GraphIssue[] {
        const issues: GraphIssue[] = [];
        const edges = this.store.getAllEdges();

        for (const edge of edges) {
            if (edge.kind === 'reexports' || edge.kind === 'exports') {
                const toNode = this.store.getNode(edge.to);
                
                // Check if target exists
                if (!toNode) {
                    const fromNode = this.store.getNode(edge.from);
                    
                    issues.push({
                        id: `issue:broken:${edge.id}`,
                        kind: 'BROKEN_EXPORT_CHAIN',
                        severity: 'error',
                        nodeId: edge.from,
                        title: `Broken export in ${fromNode?.name ?? edge.from}`,
                        evidence: [
                            `Export target not found: ${edge.to}`,
                            'This may cause runtime errors',
                        ],
                        suggestedFix: [
                            'Verify the export path is correct',
                            'Ensure the target file exists',
                            'Check for typos in the import path',
                        ],
                        meta: {
                            filePath: fromNode?.path,
                            symbol: edge.to,
                        },
                    });
                }
            }
        }

        return issues;
    }

    /**
     * Calculate severity based on impact
     */
    private calculateSeverity(exportCount: number): IssueSeverity {
        if (exportCount > 5) return 'error';
        if (exportCount > 2) return 'warning';
        return 'info';
    }

    /**
     * Check if file should be skipped for unreachable detection
     */
    private shouldSkipFile(filePath: string): boolean {
        const skipPatterns = [
            /\.test\./,
            /\.spec\./,
            /__tests__/,
            /\.config\./,
            /\.d\.ts$/,
            /node_modules/,
        ];

        return skipPatterns.some((pattern) => pattern.test(filePath));
    }
}
