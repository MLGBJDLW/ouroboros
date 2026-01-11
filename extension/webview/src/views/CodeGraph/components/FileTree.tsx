/**
 * FileTree Component
 * Hierarchical file tree view with issue indicators
 */

import { useState, useCallback, useMemo } from 'react';
import { Icon } from '../../../components/Icon';
import type { GraphNode, GraphIssue, FileTreeNode } from '../types';
import styles from './FileTree.module.css';

interface FileTreeProps {
    nodes: GraphNode[];
    issues: GraphIssue[];
    selectedNode: string | null;
    onNodeSelect: (path: string) => void;
    onNodeAction: (path: string, action: 'open' | 'impact' | 'fix') => void;
}

export function FileTree({
    nodes,
    issues,
    selectedNode,
    onNodeSelect,
    onNodeAction,
}: FileTreeProps) {
    const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(['src']));
    const [searchQuery, setSearchQuery] = useState('');

    // Build tree structure from flat nodes
    const treeData = useMemo(() => {
        const issueMap = new Map<string, number>();
        issues.forEach(issue => {
            const count = issueMap.get(issue.file) || 0;
            issueMap.set(issue.file, count + 1);
        });

        const nodeMap = new Map<string, GraphNode>();
        nodes.forEach(node => nodeMap.set(node.path, node));

        const root: FileTreeNode = {
            id: 'root',
            name: 'Project',
            path: '',
            type: 'directory',
            children: [],
            issueCount: 0,
            isEntrypoint: false,
            isHotspot: false,
        };

        // Build tree
        const pathMap = new Map<string, FileTreeNode>();
        pathMap.set('', root);

        // Sort paths to ensure parents are created before children
        const sortedPaths = [...nodes].map(n => n.path).sort();

        sortedPaths.forEach(path => {
            const parts = path.split('/');
            let currentPath = '';
            let parent = root;

            parts.forEach((part, index) => {
                const isLast = index === parts.length - 1;
                const newPath = currentPath ? `${currentPath}/${part}` : part;

                if (!pathMap.has(newPath)) {
                    const node = nodeMap.get(newPath);
                    const treeNode: FileTreeNode = {
                        id: newPath,
                        name: part,
                        path: newPath,
                        type: isLast ? 'file' : 'directory',
                        children: isLast ? undefined : [],
                        issueCount: issueMap.get(newPath) || 0,
                        isEntrypoint: node?.isEntrypoint || false,
                        isHotspot: node?.isHotspot || false,
                    };
                    pathMap.set(newPath, treeNode);
                    parent.children?.push(treeNode);
                }

                parent = pathMap.get(newPath)!;
                currentPath = newPath;
            });
        });

        // Calculate directory issue counts
        const calculateDirIssues = (node: FileTreeNode): number => {
            if (node.type === 'file') return node.issueCount;
            let total = 0;
            node.children?.forEach(child => {
                total += calculateDirIssues(child);
            });
            node.issueCount = total;
            return total;
        };
        calculateDirIssues(root);

        // Sort children: directories first, then files, alphabetically
        const sortChildren = (node: FileTreeNode) => {
            if (node.children) {
                node.children.sort((a, b) => {
                    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
                    return a.name.localeCompare(b.name);
                });
                node.children.forEach(sortChildren);
            }
        };
        sortChildren(root);

        return root;
    }, [nodes, issues]);

    // Filter tree by search
    const filteredTree = useMemo(() => {
        if (!searchQuery.trim()) return treeData;

        const query = searchQuery.toLowerCase();
        const filterNode = (node: FileTreeNode): FileTreeNode | null => {
            if (node.type === 'file') {
                return node.name.toLowerCase().includes(query) ? node : null;
            }

            const filteredChildren = node.children
                ?.map(filterNode)
                .filter((n): n is FileTreeNode => n !== null);

            if (filteredChildren && filteredChildren.length > 0) {
                return { ...node, children: filteredChildren };
            }

            return node.name.toLowerCase().includes(query) ? node : null;
        };

        return filterNode(treeData) || treeData;
    }, [treeData, searchQuery]);

    // Toggle directory expansion
    const toggleDir = useCallback((path: string) => {
        setExpandedDirs(prev => {
            const next = new Set(prev);
            if (next.has(path)) {
                next.delete(path);
            } else {
                next.add(path);
            }
            return next;
        });
    }, []);

    // Expand all directories containing issues
    const expandIssues = useCallback(() => {
        const dirsWithIssues = new Set<string>();
        issues.forEach(issue => {
            const parts = issue.file.split('/');
            let path = '';
            parts.slice(0, -1).forEach(part => {
                path = path ? `${path}/${part}` : part;
                dirsWithIssues.add(path);
            });
        });
        setExpandedDirs(dirsWithIssues);
    }, [issues]);

    // Collapse all
    const collapseAll = useCallback(() => {
        setExpandedDirs(new Set());
    }, []);

    // Render tree node
    const renderNode = (node: FileTreeNode, depth: number = 0): JSX.Element => {
        const isExpanded = expandedDirs.has(node.path);
        const isSelected = selectedNode === node.path;
        const hasIssues = node.issueCount > 0;

        return (
            <div key={node.id} className={styles.nodeWrapper}>
                <div
                    className={`${styles.node} ${isSelected ? styles.selected : ''} ${hasIssues ? styles.hasIssues : ''}`}
                    style={{ paddingLeft: `${depth * 16 + 8}px` }}
                    onClick={() => {
                        if (node.type === 'directory') {
                            toggleDir(node.path);
                        } else {
                            onNodeSelect(node.path);
                        }
                    }}
                    onDoubleClick={() => {
                        if (node.type === 'file') {
                            onNodeAction(node.path, 'open');
                        }
                    }}
                >
                    {/* Expand/collapse icon for directories */}
                    {node.type === 'directory' ? (
                        <Icon
                            name={isExpanded ? 'chevron-down' : 'chevron-right'}
                            className={styles.expandIcon}
                        />
                    ) : (
                        <span className={styles.expandPlaceholder} />
                    )}

                    {/* File/folder icon */}
                    <Icon
                        name={node.type === 'directory' 
                            ? (isExpanded ? 'folder-opened' : 'folder')
                            : getFileIcon(node.name)}
                        className={`${styles.fileIcon} ${node.isEntrypoint ? styles.entrypoint : ''} ${node.isHotspot ? styles.hotspot : ''}`}
                    />

                    {/* Name */}
                    <span className={styles.name}>{node.name}</span>

                    {/* Badges */}
                    <div className={styles.badges}>
                        {node.isEntrypoint && (
                            <span className={styles.badge} title="Entrypoint">🚀</span>
                        )}
                        {node.isHotspot && (
                            <span className={styles.badge} title="Hotspot">🔥</span>
                        )}
                        {hasIssues && (
                            <span className={`${styles.issueBadge} ${getIssueSeverityClass(node.issueCount)}`}>
                                {node.issueCount}
                            </span>
                        )}
                    </div>

                    {/* Actions (visible on hover) */}
                    {node.type === 'file' && (
                        <div className={styles.actions}>
                            <button
                                className={styles.actionBtn}
                                onClick={(e) => { e.stopPropagation(); onNodeAction(node.path, 'open'); }}
                                title="Open file"
                            >
                                <Icon name="go-to-file" />
                            </button>
                            <button
                                className={styles.actionBtn}
                                onClick={(e) => { e.stopPropagation(); onNodeAction(node.path, 'impact'); }}
                                title="Analyze impact"
                            >
                                <Icon name="pulse" />
                            </button>
                            {hasIssues && (
                                <button
                                    className={`${styles.actionBtn} ${styles.fixBtn}`}
                                    onClick={(e) => { e.stopPropagation(); onNodeAction(node.path, 'fix'); }}
                                    title="Fix with Copilot"
                                >
                                    <Icon name="sparkle" />
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Children */}
                {node.type === 'directory' && isExpanded && node.children && (
                    <div className={styles.children}>
                        {node.children.map(child => renderNode(child, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className={styles.container}>
            {/* Toolbar */}
            <div className={styles.toolbar}>
                <div className={styles.searchWrapper}>
                    <Icon name="search" className={styles.searchIcon} />
                    <input
                        type="text"
                        className={styles.searchInput}
                        placeholder="Search files..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button
                            className={styles.clearBtn}
                            onClick={() => setSearchQuery('')}
                        >
                            <Icon name="close" />
                        </button>
                    )}
                </div>
                <div className={styles.toolbarActions}>
                    <button
                        className={styles.toolbarBtn}
                        onClick={expandIssues}
                        title="Expand directories with issues"
                    >
                        <Icon name="warning" />
                    </button>
                    <button
                        className={styles.toolbarBtn}
                        onClick={collapseAll}
                        title="Collapse all"
                    >
                        <Icon name="collapse-all" />
                    </button>
                </div>
            </div>

            {/* Tree */}
            <div className={styles.tree}>
                {filteredTree.children?.map(child => renderNode(child, 0))}
            </div>

            {/* Summary */}
            <div className={styles.summary}>
                <span>{nodes.length} files</span>
                <span>•</span>
                <span>{issues.length} issues</span>
            </div>
        </div>
    );
}

// Helper: Get file icon based on extension
function getFileIcon(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'ts':
        case 'tsx':
            return 'file-code';
        case 'js':
        case 'jsx':
            return 'file-code';
        case 'json':
            return 'json';
        case 'css':
        case 'scss':
        case 'less':
            return 'symbol-color';
        case 'md':
            return 'markdown';
        case 'py':
            return 'file-code';
        case 'rs':
            return 'file-code';
        case 'go':
            return 'file-code';
        case 'java':
            return 'file-code';
        default:
            return 'file';
    }
}

// Helper: Get issue severity class
function getIssueSeverityClass(count: number): string {
    if (count >= 5) return styles.critical;
    if (count >= 3) return styles.high;
    if (count >= 1) return styles.medium;
    return '';
}
