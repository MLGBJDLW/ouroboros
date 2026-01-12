/**
 * Graph Tree Tool
 * LM Tool for browsing directory structure and file organization
 */

import * as vscode from 'vscode';
import { z } from 'zod';
import type { CodeGraphManager } from '../CodeGraphManager';
import { createLogger } from '../../utils/logger';
import {
    createSuccessEnvelope,
    createErrorEnvelope,
    envelopeToResult,
    getWorkspaceContext,
} from './envelope';
import { TOOLS } from '../../constants';

const logger = createLogger('GraphTreeTool');

export const GraphTreeInputSchema = z.object({
    path: z
        .string()
        .optional()
        .describe('Directory path to browse (e.g., "src/features"). Default: root'),
    depth: z
        .number()
        .min(1)
        .max(5)
        .optional()
        .describe('Max depth to traverse (1-5, default: 2)'),
    includeFiles: z
        .boolean()
        .optional()
        .describe('Include files in output (default: true)'),
    includeStats: z
        .boolean()
        .optional()
        .describe('Include file counts and import stats (default: true)'),
    pattern: z
        .string()
        .optional()
        .describe('Filter pattern for file names (e.g., "*.test.ts", "index.*")'),
});

export type GraphTreeInput = z.infer<typeof GraphTreeInputSchema>;

interface TreeNode {
    name: string;
    path: string;
    type: 'directory' | 'file';
    children?: TreeNode[];
    stats?: {
        files?: number;
        imports?: number;
        exports?: number;
        isEntrypoint?: boolean;
        isBarrel?: boolean;
    };
}

export function createGraphTreeTool(
    manager: CodeGraphManager
): vscode.LanguageModelTool<GraphTreeInput> {
    return {
        async invoke(
            options: vscode.LanguageModelToolInvocationOptions<GraphTreeInput>,
            _token: vscode.CancellationToken
        ): Promise<vscode.LanguageModelToolResult> {
            const input = options.input;
            const workspace = getWorkspaceContext();

            logger.info('Graph tree requested', input);

            try {
                // Validate input
                const parsed = GraphTreeInputSchema.safeParse(input);
                if (!parsed.success) {
                    const envelope = createErrorEnvelope(
                        TOOLS.GRAPH_TREE,
                        'INVALID_INPUT',
                        'Invalid input: ' + parsed.error.message,
                        workspace,
                        { errors: parsed.error.errors }
                    );
                    return envelopeToResult(envelope);
                }

                const { path: rootPath, depth, includeFiles, includeStats, pattern } = parsed.data;
                const maxDepth = depth ?? 2;
                const withFiles = includeFiles ?? true;
                const withStats = includeStats ?? true;

                const store = manager.getStore();
                if (!store) {
                    const envelope = createSuccessEnvelope(
                        TOOLS.GRAPH_TREE,
                        { tree: null, path: rootPath ?? '', stats: { directories: 0, files: 0 } },
                        workspace,
                        { truncated: false, limits: { depth: maxDepth } }
                    );
                    return envelopeToResult(envelope);
                }

                // Get all file nodes
                const allNodes = store.getAllNodes().filter(n => n.kind === 'file' && n.path);
                const edges = store.getAllEdges();

                // Build import/export counts
                const importCountMap = new Map<string, number>();
                const exportCountMap = new Map<string, number>();
                
                if (withStats) {
                    for (const edge of edges) {
                        if (edge.kind === 'imports' || edge.kind === 'reexports') {
                            importCountMap.set(edge.to, (importCountMap.get(edge.to) ?? 0) + 1);
                        }
                        if (edge.kind === 'exports' || edge.kind === 'reexports') {
                            exportCountMap.set(edge.from, (exportCountMap.get(edge.from) ?? 0) + 1);
                        }
                    }
                }

                // Filter by root path
                const prefix = rootPath ? (rootPath.endsWith('/') ? rootPath : rootPath + '/') : '';
                const filteredNodes = rootPath
                    ? allNodes.filter(n => (n.path ?? '').startsWith(prefix) || n.path === rootPath)
                    : allNodes;

                // Filter by pattern
                const patternRegex = pattern
                    ? new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i')
                    : null;

                // Build tree structure
                const tree: TreeNode = {
                    name: rootPath ? rootPath.split('/').pop() ?? rootPath : '.',
                    path: rootPath ?? '.',
                    type: 'directory',
                    children: [],
                    stats: withStats ? { files: 0, imports: 0, exports: 0 } : undefined,
                };

                const dirMap = new Map<string, TreeNode>();
                dirMap.set(rootPath ?? '.', tree);

                // Helper to get or create directory node
                const getOrCreateDir = (dirPath: string, currentDepth: number): TreeNode | null => {
                    if (currentDepth > maxDepth) return null;
                    
                    if (dirMap.has(dirPath)) {
                        return dirMap.get(dirPath) ?? null;
                    }

                    const parts = dirPath.split('/');
                    const name = parts.pop() ?? '';
                    const parentPath = parts.join('/') || (rootPath ?? '.');
                    
                    const parent = getOrCreateDir(parentPath, currentDepth);
                    if (!parent) return null;

                    const node: TreeNode = {
                        name,
                        path: dirPath,
                        type: 'directory',
                        children: [],
                        stats: withStats ? { files: 0, imports: 0, exports: 0 } : undefined,
                    };

                    parent.children = parent.children ?? [];
                    parent.children.push(node);
                    dirMap.set(dirPath, node);
                    return node;
                };

                // Process all files
                let totalFiles = 0;
                let totalDirs = 0;

                for (const node of filteredNodes) {
                    const filePath = node.path ?? '';
                    const relativePath = rootPath ? filePath.slice(prefix.length) : filePath;
                    const parts = relativePath.split('/');
                    const fileName = parts.pop() ?? '';
                    const dirPath = rootPath 
                        ? (parts.length > 0 ? prefix + parts.join('/') : rootPath)
                        : (parts.join('/') || '.');

                    // Calculate depth
                    const fileDepth = parts.length + 1;
                    if (fileDepth > maxDepth) continue;

                    // Apply pattern filter
                    if (patternRegex && !patternRegex.test(fileName)) continue;

                    // Get or create parent directory
                    const parentDir = getOrCreateDir(dirPath, parts.length);
                    if (!parentDir) continue;

                    // Update directory stats
                    if (withStats && parentDir.stats) {
                        parentDir.stats.files = (parentDir.stats.files ?? 0) + 1;
                        parentDir.stats.imports = (parentDir.stats.imports ?? 0) + (importCountMap.get(node.id) ?? 0);
                        parentDir.stats.exports = (parentDir.stats.exports ?? 0) + (exportCountMap.get(node.id) ?? 0);
                    }

                    // Add file node if requested
                    if (withFiles) {
                        const isBarrel = fileName === 'index.ts' || fileName === 'index.js' || 
                                        fileName === 'index.tsx' || fileName === 'index.jsx' ||
                                        fileName === '__init__.py' || fileName === 'mod.rs';
                        
                        const fileNode: TreeNode = {
                            name: fileName,
                            path: filePath,
                            type: 'file',
                            stats: withStats ? {
                                imports: importCountMap.get(node.id) ?? 0,
                                exports: exportCountMap.get(node.id) ?? 0,
                                isEntrypoint: node.kind === 'entrypoint' || node.meta?.isEntrypoint === true,
                                isBarrel,
                            } : undefined,
                        };

                        parentDir.children = parentDir.children ?? [];
                        parentDir.children.push(fileNode);
                        totalFiles++;
                    }
                }

                // Sort children: directories first, then files, alphabetically
                const sortChildren = (node: TreeNode) => {
                    if (node.children) {
                        node.children.sort((a, b) => {
                            if (a.type !== b.type) {
                                return a.type === 'directory' ? -1 : 1;
                            }
                            return a.name.localeCompare(b.name);
                        });
                        node.children.forEach(sortChildren);
                    }
                };
                sortChildren(tree);

                // Count directories
                totalDirs = dirMap.size - 1; // Exclude root

                // Aggregate stats up the tree
                if (withStats) {
                    const aggregateStats = (node: TreeNode): { files: number; imports: number; exports: number } => {
                        if (node.type === 'file') {
                            return {
                                files: 1,
                                imports: node.stats?.imports ?? 0,
                                exports: node.stats?.exports ?? 0,
                            };
                        }

                        const totals = { files: 0, imports: 0, exports: 0 };
                        for (const child of node.children ?? []) {
                            const childStats = aggregateStats(child);
                            totals.files += childStats.files;
                            totals.imports += childStats.imports;
                            totals.exports += childStats.exports;
                        }

                        if (node.stats) {
                            node.stats.files = totals.files;
                            node.stats.imports = totals.imports;
                            node.stats.exports = totals.exports;
                        }

                        return totals;
                    };
                    aggregateStats(tree);
                }

                const response = {
                    tree,
                    path: rootPath ?? '.',
                    stats: {
                        directories: totalDirs,
                        files: totalFiles,
                    },
                    meta: {
                        tokensEstimate: Math.ceil(JSON.stringify(tree).length / 4),
                        depth: maxDepth,
                        patternApplied: pattern ?? null,
                    },
                };

                logger.debug('Tree result', {
                    path: rootPath,
                    directories: totalDirs,
                    files: totalFiles,
                });

                // Find interesting directories for suggestions
                const interestingDirs = Array.from(dirMap.values())
                    .filter(d => d.type === 'directory' && d.stats && (d.stats.files ?? 0) > 3)
                    .sort((a, b) => (b.stats?.files ?? 0) - (a.stats?.files ?? 0))
                    .slice(0, 3);

                const envelope = createSuccessEnvelope(
                    TOOLS.GRAPH_TREE,
                    response,
                    workspace,
                    {
                        truncated: false,
                        limits: { depth: maxDepth },
                        nextQuerySuggestion: interestingDirs.length > 0
                            ? interestingDirs.map(d => ({
                                tool: TOOLS.GRAPH_TREE,
                                args: { path: d.path, depth: 2 },
                                reason: `Explore ${d.name} (${d.stats?.files} files)`,
                            }))
                            : undefined,
                    }
                );
                return envelopeToResult(envelope);
            } catch (error) {
                logger.error('Graph tree error:', error);
                const envelope = createErrorEnvelope(
                    TOOLS.GRAPH_TREE,
                    'INTERNAL_ERROR',
                    error instanceof Error ? error.message : 'Unknown error',
                    workspace
                );
                return envelopeToResult(envelope);
            }
        },
    };
}
