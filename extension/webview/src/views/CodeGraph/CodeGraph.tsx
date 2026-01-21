/**
 * Code Graph View
 * Displays codebase structure, issues, and impact analysis
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useVSCode } from '../../context/VSCodeContext';
import { useAppContext } from '../../context/AppContext';
import { Card, CardHeader, CardBody } from '../../components/Card';
import { Icon } from '../../components/Icon';
import { EmptyState } from '../../components/EmptyState';
import { Spinner } from '../../components/Spinner';
import { ForceGraph } from './components/ForceGraph';
import { FileTree } from './components/FileTree';
import { NodeDetail } from './components/NodeDetail';
import type { GraphNode, GraphEdge, GraphData, ImpactResult, ModuleInfo, GraphIssue } from './types';
import styles from './CodeGraph.module.css';

interface GraphDigest {
    summary: {
        files: number;
        modules: number;
        entrypoints: number;
        edges: number;
    };
    entrypoints: {
        routes: string[];
        commands: string[];
        pages: string[];
        jobs: string[];
    };
    hotspots: Array<{
        path: string;
        importers: number;
        exports: number;
    }>;
    issues: Record<string, number>;
    meta: {
        lastIndexed: string;
        tokensEstimate: number;
    };
}

type TabType = 'overview' | 'graph' | 'tree' | 'issues' | 'hotspots';

interface GraphFileIndex {
    files: Array<{
        path: string;
        name: string;
        importers: number;
        exports: number;
        isEntrypoint: boolean;
        isHotspot: boolean;
        language?: string;
    }>;
    meta: {
        total: number;
        hotspotLimit: number;
    };
}

export function CodeGraph() {
    const vscode = useVSCode();
    const { state } = useAppContext();
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [digest, setDigest] = useState<GraphDigest | null>(null);
    const [issues, setIssues] = useState<GraphIssue[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // Persistent tracking of items added to context (synced with backend)
    const [addedToContext, setAddedToContext] = useState<Set<string>>(new Set());
    // Temporary flash feedback for newly added items
    const [recentlyAdded, setRecentlyAdded] = useState<Set<string>>(new Set());

    // Graph view state
    const [graphData, setGraphData] = useState<GraphData | null>(null);
    const [fileNodes, setFileNodes] = useState<GraphNode[]>([]);
    const [fileIndex, setFileIndex] = useState<GraphFileIndex | null>(null);
    const [realEdges, setRealEdges] = useState<Array<{ source: string; target: string; type: string }>>([]);
    const [lspDiagnostics, setLspDiagnostics] = useState<Record<string, { errors: number; warnings: number }>>({});
    const [selectedNode, setSelectedNode] = useState<string | null>(null);
    const [hoveredNode, setHoveredNode] = useState<string | null>(null);
    const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());
    const [showDetail, setShowDetail] = useState(false);
    const [graphSize, setGraphSize] = useState({ width: 600, height: 400 });
    const [isFileIndexLoading, setIsFileIndexLoading] = useState(true);
    const [fitVersion, setFitVersion] = useState(0);
    const [isFrozen, setIsFrozen] = useState(false);
    const [graphSettings, setGraphSettings] = useState({
        showLabels: true,
        showEdges: true,
        highlightEntrypoints: true,
        highlightHotspots: true,
    });
    const graphContainerRef = useRef<HTMLDivElement>(null);

    // Build graph data from digest and real edges
    const buildGraphData = useCallback((
        digest: GraphDigest,
        issues: GraphIssue[],
        edges: Array<{ source: string; target: string; type: string }>,
        lspDiags: Record<string, { errors: number; warnings: number }>
    ): GraphData => {
        const nodes: GraphNode[] = [];
        const links: GraphEdge[] = [];
        const nodeMap = new Map<string, GraphNode>();

        const entrypointPaths = new Set([
            ...digest.entrypoints.routes,
            ...digest.entrypoints.commands,
            ...digest.entrypoints.pages,
            ...digest.entrypoints.jobs,
        ]);

        const issueCountMap = new Map<string, number>();
        issues.forEach(issue => {
            const count = issueCountMap.get(issue.file) || 0;
            issueCountMap.set(issue.file, count + 1);
        });

        // Count importers from real edges
        const importerCounts = new Map<string, number>();
        edges.forEach(edge => {
            const count = importerCounts.get(edge.target) || 0;
            importerCounts.set(edge.target, count + 1);
        });

        // Add hotspot nodes
        digest.hotspots.forEach((hotspot, index) => {
            const lspDiag = lspDiags[hotspot.path];
            const node: GraphNode = {
                id: hotspot.path,
                path: hotspot.path,
                name: hotspot.path.split('/').pop() || hotspot.path,
                type: entrypointPaths.has(hotspot.path) ? 'entrypoint' : 'hotspot',
                issueCount: issueCountMap.get(hotspot.path) || 0,
                importers: importerCounts.get(hotspot.path) || hotspot.importers,
                exports: hotspot.exports,
                isEntrypoint: entrypointPaths.has(hotspot.path),
                isHotspot: true,
                depth: index,
                val: Math.max(5, Math.min(20, hotspot.importers)),
                lspErrorCount: lspDiag?.errors || 0,
                lspWarningCount: lspDiag?.warnings || 0,
                hasLspDiagnostics: !!(lspDiag && (lspDiag.errors > 0 || lspDiag.warnings > 0)),
            };
            nodes.push(node);
            nodeMap.set(hotspot.path, node);
        });

        // Add entrypoint nodes not in hotspots
        [...entrypointPaths].forEach(path => {
            if (!nodeMap.has(path)) {
                const lspDiag = lspDiags[path];
                const node: GraphNode = {
                    id: path,
                    path: path,
                    name: path.split('/').pop() || path,
                    type: 'entrypoint',
                    issueCount: issueCountMap.get(path) || 0,
                    importers: importerCounts.get(path) || 0,
                    exports: 0,
                    isEntrypoint: true,
                    isHotspot: false,
                    depth: 0,
                    val: 8,
                    lspErrorCount: lspDiag?.errors || 0,
                    lspWarningCount: lspDiag?.warnings || 0,
                    hasLspDiagnostics: !!(lspDiag && (lspDiag.errors > 0 || lspDiag.warnings > 0)),
                };
                nodes.push(node);
                nodeMap.set(path, node);
            }
        });

        // Create links from real edges (only between nodes that exist in our graph)
        const nodeIds = new Set(nodes.map(n => n.id));
        edges.forEach(edge => {
            if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
                links.push({
                    source: edge.source,
                    target: edge.target,
                    type: edge.type as 'import' | 'export' | 'reexport' | 'dynamic',
                    weight: 1,
                });
            }
        });

        // Always expand the graph to include nodes connected to hotspots/entrypoints
        // This ensures we show a meaningful dependency structure, not just isolated nodes
        {
            // Find edges where at least one end is in our node set
            const relevantEdges = edges.filter(edge =>
                nodeIds.has(edge.source) || nodeIds.has(edge.target)
            );

            // Add missing nodes that are connected to our hotspots/entrypoints
            const nodesToAdd = new Set<string>();
            relevantEdges.forEach(edge => {
                if (nodeIds.has(edge.source) && !nodeIds.has(edge.target)) {
                    nodesToAdd.add(edge.target);
                }
                if (nodeIds.has(edge.target) && !nodeIds.has(edge.source)) {
                    nodesToAdd.add(edge.source);
                }
            });

            // Add up to 50 connected nodes for a richer graph
            let addedCount = 0;
            nodesToAdd.forEach(path => {
                if (addedCount >= 50) return;
                const lspDiag = lspDiags[path];
                const node: GraphNode = {
                    id: path,
                    path: path,
                    name: path.split('/').pop() || path,
                    type: 'file',
                    issueCount: issueCountMap.get(path) || 0,
                    importers: importerCounts.get(path) || 0,
                    exports: 0,
                    isEntrypoint: entrypointPaths.has(path),
                    isHotspot: false,
                    depth: nodes.length,
                    val: 5,
                    lspErrorCount: lspDiag?.errors || 0,
                    lspWarningCount: lspDiag?.warnings || 0,
                    hasLspDiagnostics: !!(lspDiag && (lspDiag.errors > 0 || lspDiag.warnings > 0)),
                };
                nodes.push(node);
                nodeMap.set(path, node);
                nodeIds.add(path); // Update nodeIds for link creation
                addedCount++;
            });

            // Now add links with the expanded node set
            edges.forEach(edge => {
                if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
                    // Avoid duplicate links (all links at this point have string source/target)
                    const exists = links.some(l =>
                        l.source === edge.source && l.target === edge.target
                    );
                    if (!exists) {
                        links.push({
                            source: edge.source,
                            target: edge.target,
                            type: edge.type as 'import' | 'export' | 'reexport' | 'dynamic',
                            weight: 1,
                        });
                    }
                }
            });
        }

        return { nodes, links };
    }, []);

    const buildFileNodes = useCallback((
        fileIndex: GraphFileIndex,
        issues: GraphIssue[],
        lspDiags: Record<string, { errors: number; warnings: number }>
    ): GraphNode[] => {
        const issueCountMap = new Map<string, number>();
        issues.forEach(issue => {
            const count = issueCountMap.get(issue.file) || 0;
            issueCountMap.set(issue.file, count + 1);
        });

        return fileIndex.files.map((file, index) => {
            const lspDiag = lspDiags[file.path];
            return {
                id: file.path,
                path: file.path,
                name: file.name || file.path.split('/').pop() || file.path,
                type: 'file',
                language: file.language,
                issueCount: issueCountMap.get(file.path) || 0,
                importers: file.importers,
                exports: file.exports,
                isEntrypoint: file.isEntrypoint,
                isHotspot: file.isHotspot,
                depth: index,
                val: Math.max(4, Math.min(18, file.importers || 4)),
                lspErrorCount: lspDiag?.errors || 0,
                lspWarningCount: lspDiag?.warnings || 0,
                hasLspDiagnostics: !!(lspDiag && (lspDiag.errors > 0 || lspDiag.warnings > 0)),
            };
        });
    }, []);

    // Request graph data from extension (fetch cached data)
    const fetchData = useCallback(() => {
        setIsLoading(true);
        setIsFileIndexLoading(true);
        setError(null);
        vscode.postMessage({ type: 'getGraphDigest' });
        vscode.postMessage({ type: 'getGraphIssues' });
        vscode.postMessage({ type: 'getGraphFiles' });
        vscode.postMessage({ type: 'getGraphEdges' });
        vscode.postMessage({ type: 'getLspDiagnostics' });
    }, [vscode]);

    // Force refresh - triggers full re-index
    const [isRefreshing, setIsRefreshing] = useState(false);
    const refreshData = useCallback(() => {
        setIsRefreshing(true);
        setError(null);
        vscode.postMessage({ type: 'refreshGraph' });
    }, [vscode]);

    // Add item to pending request context
    const addToContext = useCallback((type: string, data: unknown) => {
        const contextItem = {
            type: `graph_${type}`,
            data,
            timestamp: Date.now(),
        };
        vscode.postMessage({
            type: 'addGraphContext',
            payload: contextItem
        });

        // Track what's been added - persistent until context is consumed
        const id = type === 'issue' ? (data as GraphIssue).id :
            type === 'hotspot' ? (data as { path: string }).path : 'digest';
        setAddedToContext(prev => new Set(prev).add(id));

        // Show brief flash feedback for newly added item
        setRecentlyAdded(prev => new Set(prev).add(id));
        setTimeout(() => {
            setRecentlyAdded(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }, 1500);
    }, [vscode]);

    // Open file in editor
    const openFile = useCallback((filePath: string) => {
        vscode.postMessage({
            type: 'command',
            payload: {
                command: 'vscode.open',
                args: [{ path: filePath }]
            }
        });
    }, [vscode]);

    // Graph node selection
    const handleNodeClick = useCallback((node: GraphNode) => {
        setSelectedNode(node.id);
        setShowDetail(true);
        // Highlight connected nodes
        const connected = new Set<string>([node.id]);
        graphData?.links.forEach(link => {
            const sourceId = typeof link.source === 'string' ? link.source : (link.source as GraphNode).id;
            const targetId = typeof link.target === 'string' ? link.target : (link.target as GraphNode).id;
            if (sourceId === node.id) connected.add(targetId);
            if (targetId === node.id) connected.add(sourceId);
        });
        setHighlightedNodes(connected);
    }, [graphData]);

    const handleNodeHover = useCallback((node: GraphNode | null) => {
        setHoveredNode(node?.id || null);
    }, []);

    const handleTreeSelect = useCallback((path: string) => {
        setSelectedNode(path);
        setShowDetail(true);
    }, []);

    const clearSelection = useCallback(() => {
        setSelectedNode(null);
        setShowDetail(false);
        setHighlightedNodes(new Set());
    }, []);

    // Get impact analysis
    const getImpact = useCallback(async (target: string): Promise<ImpactResult | null> => {
        return new Promise((resolve) => {
            const handler = (event: MessageEvent) => {
                if (event.data.type === 'graphImpact' && event.data.payload?.target === target) {
                    window.removeEventListener('message', handler);
                    resolve(event.data.payload);
                }
            };
            window.addEventListener('message', handler);
            vscode.postMessage({ type: 'getGraphImpact', payload: { target } });
            setTimeout(() => { window.removeEventListener('message', handler); resolve(null); }, 5000);
        });
    }, [vscode]);

    // Get module info
    const getModule = useCallback(async (target: string): Promise<ModuleInfo | null> => {
        return new Promise((resolve) => {
            const handler = (event: MessageEvent) => {
                if (event.data.type === 'graphModule' && event.data.payload?.path === target) {
                    window.removeEventListener('message', handler);
                    resolve(event.data.payload);
                }
            };
            window.addEventListener('message', handler);
            vscode.postMessage({ type: 'getGraphModule', payload: { target } });
            setTimeout(() => { window.removeEventListener('message', handler); resolve(null); }, 5000);
        });
    }, [vscode]);

    // Fix with Copilot
    const handleFixWithCopilot = useCallback((issue: GraphIssue) => {
        const prompt = `Fix this code issue:\n\nFile: ${issue.file}\nIssue: ${issue.kind}\nSummary: ${issue.summary}\n\nEvidence:\n${issue.evidence.join('\n')}\n\nSuggested fix:\n${issue.suggestedFix.join('\n')}`;
        vscode.postMessage({ type: 'sendToCopilot', payload: { prompt } });
    }, [vscode]);

    const handleTreeAction = useCallback((path: string, action: 'open' | 'impact' | 'fix') => {
        if (action === 'open') {
            openFile(path);
            return;
        }
        if (action === 'impact') {
            setSelectedNode(path);
            setShowDetail(true);
            return;
        }
        if (action === 'fix') {
            const issue = issues.find((i) => i.file === path);
            if (issue) {
                handleFixWithCopilot(issue);
            }
        }
    }, [openFile, issues, handleFixWithCopilot]);

    // Resize observer for graph container
    useEffect(() => {
        if (!graphContainerRef.current) return;
        const resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                setGraphSize({ width: Math.max(300, width), height: Math.max(200, height) });
            }
        });
        resizeObserver.observe(graphContainerRef.current);
        return () => resizeObserver.disconnect();
    }, [activeTab]);

    useEffect(() => {
        fetchData();

        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            if (message.type === 'graphDigest') {
                setDigest(message.payload);
                setIsLoading(false);
            } else if (message.type === 'graphIssues') {
                setIssues(message.payload?.issues || []);
            } else if (message.type === 'graphFiles') {
                const indexPayload = message.payload as GraphFileIndex;
                setFileIndex(indexPayload);
                setIsFileIndexLoading(false);
            } else if (message.type === 'graphEdges') {
                setRealEdges(message.payload?.edges || []);
            } else if (message.type === 'lspDiagnostics') {
                setLspDiagnostics(message.payload || {});
            } else if (message.type === 'graphError') {
                setError(message.payload);
                setIsLoading(false);
                setIsRefreshing(false);
            } else if (message.type === 'graphRefreshStarted') {
                setIsRefreshing(true);
            } else if (message.type === 'graphRefreshCompleted') {
                setIsRefreshing(false);
                setIsLoading(false);
                setIsFileIndexLoading(false);
                // Trigger graph to re-fit after data updates
                setTimeout(() => {
                    setFitVersion(v => v + 1);
                }, 100);
            } else if (message.type === 'graphContextUpdate') {
                // Sync addedToContext with backend state
                const contextItems = message.payload as Array<{ type: string; data: unknown }> || [];
                const ids = new Set<string>();
                contextItems.forEach(item => {
                    if (item.type === 'graph_issue') {
                        ids.add((item.data as GraphIssue).id);
                    } else if (item.type === 'graph_hotspot') {
                        ids.add((item.data as { path: string }).path);
                    } else if (item.type === 'graph_digest') {
                        ids.add('digest');
                    }
                });
                setAddedToContext(ids);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [fetchData, vscode]);

    // Auto-refresh interval (every 2 minutes when tab is visible)
    // Use refs to avoid stale closures and prevent interval reset on state changes
    const isRefreshingRef = useRef(isRefreshing);
    const isLoadingRef = useRef(isLoading);

    // Keep refs in sync with state
    useEffect(() => {
        isRefreshingRef.current = isRefreshing;
        isLoadingRef.current = isLoading;
    }, [isRefreshing, isLoading]);

    const AUTO_REFRESH_INTERVAL = 2 * 60 * 1000; // 2 minutes
    useEffect(() => {
        let intervalId: ReturnType<typeof setInterval> | null = null;

        const startAutoRefresh = () => {
            if (intervalId) return;
            intervalId = setInterval(() => {
                // Use refs to get current values (avoids stale closure)
                if (!isRefreshingRef.current && !isLoadingRef.current) {
                    fetchData();
                }
            }, AUTO_REFRESH_INTERVAL);
        };

        const stopAutoRefresh = () => {
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
        };

        // Start auto-refresh
        startAutoRefresh();

        // Handle visibility change - pause when hidden, resume when visible
        const handleVisibilityChange = () => {
            if (document.hidden) {
                stopAutoRefresh();
            } else {
                startAutoRefresh();
                // Fetch immediately when becoming visible
                if (!isRefreshingRef.current && !isLoadingRef.current) {
                    fetchData();
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            stopAutoRefresh();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [fetchData]); // Only depend on fetchData, not on loading states


    // Build graph data when digest/issues/edges/lspDiagnostics change
    useEffect(() => {
        if (digest) {
            const data = buildGraphData(digest, issues, realEdges, lspDiagnostics);
            setGraphData(data);
        }
    }, [digest, issues, realEdges, lspDiagnostics, buildGraphData]);

    useEffect(() => {
        if (fileIndex) {
            const nodes = buildFileNodes(fileIndex, issues, lspDiagnostics);
            setFileNodes(nodes);
        }
    }, [fileIndex, issues, lspDiagnostics, buildFileNodes]);

    // Get selected node object
    const selectedGraphNode = graphData?.nodes.find(n => n.id === selectedNode) || null;
    const selectedFileNode = fileNodes.find(n => n.id === selectedNode) || null;
    const selectedNodeObj = selectedGraphNode || selectedFileNode || null;

    if (isLoading) {
        return (
            <div className={styles.loading}>
                <Spinner size="large" />
                <span>Analyzing codebase structure...</span>
            </div>
        );
    }

    if (error) {
        return (
            <EmptyState
                icon="error"
                title="Failed to load graph"
                description={error}
            />
        );
    }

    if (!digest) {
        return (
            <EmptyState
                icon="graph"
                title="No graph data"
                description="Initialize the project to build the code graph"
            />
        );
    }

    const totalIssues = Object.values(digest.issues).reduce((a, b) => a + b, 0);

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerTitle}>
                    <Icon name="graph" />
                    <span>Code Graph</span>
                </div>
                <button
                    className={`${styles.contextBtn} ${addedToContext.has('digest') ? styles.added : ''}`}
                    onClick={() => addToContext('digest', digest)}
                    title="Add full digest to context for Copilot"
                    disabled={addedToContext.has('digest')}
                >
                    <Icon name={addedToContext.has('digest') ? 'check' : 'add'} />
                    <span>{addedToContext.has('digest') ? 'Added' : 'Add to Context'}</span>
                </button>
            </div>

            {/* Dependency Cruiser Hint */}
            {!state.dependencyCruiserAvailable && (
                <div className={styles.hintBanner}>
                    <Icon name="lightbulb" />
                    <span>
                        Install <code>dependency-cruiser</code> for enhanced JS/TS analysis:
                    </span>
                    <code className={styles.hintCommand}>npm i -D dependency-cruiser</code>
                </div>
            )}

            {/* Tab Navigation */}
            <div className={styles.tabs}>
                <button
                    className={`${styles.tab} ${activeTab === 'overview' ? styles.active : ''}`}
                    onClick={() => setActiveTab('overview')}
                    title="Codebase overview and statistics"
                >
                    <Icon name="pulse" />
                    <span>Overview</span>
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'graph' ? styles.active : ''}`}
                    onClick={() => setActiveTab('graph')}
                    title="Interactive dependency graph"
                >
                    <Icon name="type-hierarchy" />
                    <span>Graph</span>
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'tree' ? styles.active : ''}`}
                    onClick={() => setActiveTab('tree')}
                    title="File tree with hotspots and issues"
                >
                    <Icon name="list-tree" />
                    <span>Tree</span>
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'issues' ? styles.active : ''}`}
                    onClick={() => setActiveTab('issues')}
                    title="Code quality issues detected"
                >
                    <Icon name="warning" />
                    <span>Issues</span>
                    {totalIssues > 0 && (
                        <span className={styles.badge}>{totalIssues}</span>
                    )}
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'hotspots' ? styles.active : ''}`}
                    onClick={() => setActiveTab('hotspots')}
                    title="High-impact files with many dependents"
                >
                    <Icon name="flame" />
                    <span>Hotspots</span>
                </button>
            </div>

            {/* Content */}
            <div className={styles.content}>
                {activeTab === 'overview' && <OverviewTab digest={digest} />}
                {activeTab === 'graph' && graphData && (
                    <div className={styles.graphTab}>
                        {graphData.nodes.length === 0 ? (
                            <div className={styles.graphEmpty}>
                                <Icon name="info" />
                                <span>No hotspots or entrypoints detected</span>
                                <p>The graph shows files with high import counts. This project may not have clear dependency hotspots yet, or the language parser needs improvement.</p>
                                <p>Try the <strong>Hotspots</strong> tab to see if any files are detected.</p>
                            </div>
                        ) : (
                            <>
                                {/* Graph Stats Bar */}
                                <div className={styles.graphStatsBar}>
                                    <span className={styles.graphStat}>
                                        <Icon name="circle-filled" />
                                        {graphData.nodes.length} nodes
                                    </span>
                                    <span className={styles.graphStat}>
                                        <Icon name="git-merge" />
                                        {graphData.links.length} edges
                                    </span>
                                    {graphData.links.length === 0 && (
                                        <span className={styles.graphStatWarning}>
                                            <Icon name="warning" />
                                            No connections between displayed nodes
                                        </span>
                                    )}
                                </div>
                                {/* Graph Settings */}
                                <div className={styles.graphSettings}>
                                    <button
                                        className={`${styles.settingBtn} ${graphSettings.showLabels ? styles.active : ''}`}
                                        onClick={() => setGraphSettings(s => ({ ...s, showLabels: !s.showLabels }))}
                                        title="Show labels"
                                    >
                                        <Icon name="symbol-text" />
                                    </button>
                                    <button
                                        className={`${styles.settingBtn} ${graphSettings.showEdges ? styles.active : ''}`}
                                        onClick={() => setGraphSettings(s => ({ ...s, showEdges: !s.showEdges }))}
                                        title="Show edges"
                                    >
                                        <Icon name="git-merge" />
                                    </button>
                                    <button
                                        className={`${styles.settingBtn} ${graphSettings.highlightEntrypoints ? styles.active : ''}`}
                                        onClick={() => setGraphSettings(s => ({ ...s, highlightEntrypoints: !s.highlightEntrypoints }))}
                                        title="Highlight entrypoints"
                                    >
                                        <Icon name="rocket" />
                                    </button>
                                    <button
                                        className={`${styles.settingBtn} ${graphSettings.highlightHotspots ? styles.active : ''}`}
                                        onClick={() => setGraphSettings(s => ({ ...s, highlightHotspots: !s.highlightHotspots }))}
                                        title="Highlight hotspots"
                                    >
                                        <Icon name="flame" />
                                    </button>
                                    <div className={styles.settingDivider} />
                                    <button
                                        className={styles.settingBtn}
                                        onClick={() => setFitVersion((v) => v + 1)}
                                        title="Fit to view"
                                    >
                                        <Icon name="target" />
                                    </button>
                                    <button
                                        className={`${styles.settingBtn} ${isFrozen ? styles.active : ''}`}
                                        onClick={() => setIsFrozen((prev) => !prev)}
                                        title={isFrozen ? 'Resume layout' : 'Freeze layout'}
                                    >
                                        <Icon name={isFrozen ? 'debug-start' : 'debug-pause'} />
                                    </button>
                                    <button
                                        className={styles.settingBtn}
                                        onClick={clearSelection}
                                        title="Clear selection"
                                    >
                                        <Icon name="clear-all" />
                                    </button>
                                </div>

                                {/* Graph + Detail Layout */}
                                <div className={styles.graphLayout}>
                                    <div className={styles.graphContainer} ref={graphContainerRef}>
                                        <ForceGraph
                                            data={graphData}
                                            width={graphSize.width}
                                            height={graphSize.height}
                                            selectedNode={selectedNode}
                                            hoveredNode={hoveredNode}
                                            highlightedNodes={highlightedNodes}
                                            onNodeClick={handleNodeClick}
                                            onNodeHover={handleNodeHover}
                                            onNodeRightClick={handleNodeClick}
                                            showLabels={graphSettings.showLabels}
                                            showEdges={graphSettings.showEdges}
                                            highlightEntrypoints={graphSettings.highlightEntrypoints}
                                            highlightHotspots={graphSettings.highlightHotspots}
                                            isFrozen={isFrozen}
                                            fitVersion={fitVersion}
                                        />
                                    </div>
                                    {showDetail && (
                                        <div className={styles.detailPanel}>
                                            <NodeDetail
                                                node={selectedNodeObj}
                                                issues={issues}
                                                onClose={clearSelection}
                                                onOpenFile={openFile}
                                                onAnalyzeImpact={getImpact}
                                                onGetModule={getModule}
                                                onFixWithCopilot={handleFixWithCopilot}
                                                onAddToContext={addToContext}
                                            />
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}
                {activeTab === 'tree' && (
                    <div className={styles.treeTab}>
                        {isFileIndexLoading ? (
                            <div className={styles.loading}>
                                <Spinner size="large" />
                                <span>Building file index...</span>
                            </div>
                        ) : fileNodes.length === 0 ? (
                            <EmptyState
                                icon="list-tree"
                                title="No files indexed"
                                description="Adjust graph include patterns or ensure the repo has supported files."
                            />
                        ) : (
                            <div className={styles.treeLayout}>
                                <div className={styles.treeContainer}>
                                    <FileTree
                                        nodes={fileNodes}
                                        issues={issues}
                                        selectedNode={selectedNode}
                                        onNodeSelect={handleTreeSelect}
                                        onNodeAction={handleTreeAction}
                                    />
                                </div>
                                {showDetail && selectedNodeObj && (
                                    <div className={styles.detailPanel}>
                                        <NodeDetail
                                            node={selectedNodeObj}
                                            issues={issues}
                                            onClose={clearSelection}
                                            onOpenFile={openFile}
                                            onAnalyzeImpact={getImpact}
                                            onGetModule={getModule}
                                            onFixWithCopilot={handleFixWithCopilot}
                                            onAddToContext={addToContext}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
                {activeTab === 'issues' && (
                    <IssuesTab
                        issues={issues}
                        addToContext={addToContext}
                        addedToContext={addedToContext}
                        recentlyAdded={recentlyAdded}
                        openFile={openFile}
                    />
                )}
                {activeTab === 'hotspots' && (
                    <HotspotsTab
                        hotspots={digest.hotspots}
                        addToContext={addToContext}
                        addedToContext={addedToContext}
                        recentlyAdded={recentlyAdded}
                        openFile={openFile}
                    />
                )}
            </div>

            {/* Footer */}
            <div className={styles.footer}>
                <span className={styles.meta} title="Last indexed time">
                    <Icon name="clock" />
                    {new Date(digest.meta.lastIndexed).toLocaleTimeString()}
                </span>
                <span className={styles.meta} title="Estimated tokens for Copilot">
                    <Icon name="symbol-numeric" />
                    ~{digest.meta.tokensEstimate} tokens
                </span>
                <button
                    className={`${styles.refreshBtn} ${isRefreshing ? styles.refreshing : ''}`}
                    onClick={refreshData}
                    title="Re-index the codebase"
                    disabled={isRefreshing}
                >
                    <Icon name={isRefreshing ? 'sync' : 'refresh'} className={isRefreshing ? styles.spinning : ''} />
                    {isRefreshing ? 'Indexing...' : 'Refresh'}
                </button>
            </div>
        </div>
    );
}


// Overview Tab Component
function OverviewTab({ digest }: { digest: GraphDigest }) {
    return (
        <div className={styles.overview}>
            {/* Info Banner */}
            <div className={styles.infoBanner}>
                <Icon name="lightbulb" />
                <span>Click "Add to Context" to include graph data in your next Copilot message.</span>
            </div>

            {/* Stats Grid */}
            <div className={styles.statsGrid}>
                <StatCard
                    icon="file-code"
                    label="Files"
                    value={digest.summary.files}
                    color="info"
                    tooltip="Total TypeScript/JavaScript files indexed"
                />
                <StatCard
                    icon="package"
                    label="Modules"
                    value={digest.summary.modules}
                    color="success"
                    tooltip="Logical modules (directories with index files)"
                />
                <StatCard
                    icon="rocket"
                    label="Entrypoints"
                    value={digest.summary.entrypoints}
                    color="warning"
                    tooltip="Routes, pages, commands, and jobs"
                />
                <StatCard
                    icon="git-merge"
                    label="Edges"
                    value={digest.summary.edges}
                    color="secondary"
                    tooltip="Import/export relationships between files"
                />
            </div>

            {/* Entrypoints */}
            <Card className={styles.card}>
                <CardHeader>
                    <div className={styles.cardTitle}>
                        <Icon name="rocket" />
                        <span>Entrypoints</span>
                        <span className={styles.cardHint}>Where code execution begins</span>
                    </div>
                </CardHeader>
                <CardBody>
                    <div className={styles.entrypointGrid}>
                        <EntrypointGroup
                            icon="globe"
                            label="Routes"
                            items={digest.entrypoints.routes}
                            tooltip="API endpoints and HTTP routes"
                        />
                        <EntrypointGroup
                            icon="browser"
                            label="Pages"
                            items={digest.entrypoints.pages}
                            tooltip="UI pages and views"
                        />
                        <EntrypointGroup
                            icon="terminal"
                            label="Commands"
                            items={digest.entrypoints.commands}
                            tooltip="CLI commands and scripts"
                        />
                        <EntrypointGroup
                            icon="server"
                            label="Jobs"
                            items={digest.entrypoints.jobs}
                            tooltip="Background jobs and scheduled tasks"
                        />
                    </div>
                </CardBody>
            </Card>

            {/* Issue Summary */}
            <Card className={styles.card}>
                <CardHeader>
                    <div className={styles.cardTitle}>
                        <Icon name="checklist" />
                        <span>Issue Summary</span>
                    </div>
                </CardHeader>
                <CardBody>
                    <div className={styles.issueSummary}>
                        <IssueStat
                            count={digest.issues.HANDLER_UNREACHABLE || 0}
                            label="Unreachable"
                            severity="warning"
                            tooltip="Code not reachable from any entrypoint (potential dead code)"
                        />
                        <IssueStat
                            count={digest.issues.DYNAMIC_EDGE_UNKNOWN || 0}
                            label="Dynamic"
                            severity="info"
                            tooltip="Dynamic imports that cannot be statically analyzed"
                        />
                        <IssueStat
                            count={digest.issues.BROKEN_EXPORT_CHAIN || 0}
                            label="Broken"
                            severity="error"
                            tooltip="Exports pointing to non-existent files or symbols"
                        />
                    </div>
                </CardBody>
            </Card>
        </div>
    );
}

// Issues Tab Component
function IssuesTab({ issues, addToContext, addedToContext, recentlyAdded, openFile }: {
    issues: GraphIssue[];
    addToContext: (type: string, data: unknown) => void;
    addedToContext: Set<string>;
    recentlyAdded: Set<string>;
    openFile: (path: string) => void;
}) {
    const [filter, setFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [displayLimit, setDisplayLimit] = useState<number>(50);
    const [showLimitSelector, setShowLimitSelector] = useState(false);

    // Build dynamic issue categories from actual issues
    const issueCategories = useMemo(() => {
        const categories = new Map<string, number>();
        issues.forEach(issue => {
            const count = categories.get(issue.kind) || 0;
            categories.set(issue.kind, count + 1);
        });
        return categories;
    }, [issues]);

    // Human-readable labels for issue kinds
    const kindLabelMap: Record<string, { label: string; icon: string; severity: 'info' | 'warning' | 'error' }> = {
        HANDLER_UNREACHABLE: { label: 'Unreachable', icon: '🔸', severity: 'warning' },
        DYNAMIC_EDGE_UNKNOWN: { label: 'Dynamic', icon: '🔹', severity: 'info' },
        BROKEN_EXPORT_CHAIN: { label: 'Broken Export', icon: '🔴', severity: 'error' },
        CIRCULAR_REEXPORT: { label: 'Circular Re-export', icon: '🔄', severity: 'warning' },
        ORPHAN_EXPORT: { label: 'Orphan Export', icon: '📦', severity: 'info' },
        ENTRY_MISSING_HANDLER: { label: 'Missing Handler', icon: '⚠️', severity: 'warning' },
        NOT_REGISTERED: { label: 'Not Registered', icon: '📝', severity: 'info' },
        CYCLE_RISK: { label: 'Cycle Risk', icon: '🔁', severity: 'warning' },
        LAYER_VIOLATION: { label: 'Layer Violation', icon: '🏗️', severity: 'error' },
    };

    // Filter issues by type and search query
    const filteredIssues = useMemo(() => {
        let result = issues;

        // Apply type filter
        if (filter !== 'all') {
            result = result.filter((i) => i.kind === filter);
        }

        // Apply search filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter((i) =>
                i.file.toLowerCase().includes(query) ||
                i.summary.toLowerCase().includes(query) ||
                i.kind.toLowerCase().includes(query)
            );
        }

        return result;
    }, [issues, filter, searchQuery]);

    // Paginated issues for display
    const displayedIssues = useMemo(() => {
        return displayLimit === -1 ? filteredIssues : filteredIssues.slice(0, displayLimit);
    }, [filteredIssues, displayLimit]);

    const hasMoreIssues = displayLimit !== -1 && filteredIssues.length > displayLimit;

    if (issues.length === 0) {
        return (
            <EmptyState
                icon="check-all"
                title="No issues found"
                description="Your codebase looks clean! All code is reachable and exports are valid."
            />
        );
    }

    return (
        <div className={styles.issuesTab}>
            {/* Filter Bar */}
            <div className={styles.filterBar}>
                <div className={styles.searchBox}>
                    <Icon name="search" />
                    <input
                        type="text"
                        className={styles.searchInput}
                        placeholder="Search issues..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button
                            className={styles.clearSearch}
                            onClick={() => setSearchQuery('')}
                            title="Clear search"
                        >
                            <Icon name="close" />
                        </button>
                    )}
                </div>
                <select
                    className={styles.filterSelect}
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    title="Filter issues by type"
                >
                    <option value="all">All Issues ({issues.length})</option>
                    {Array.from(issueCategories.entries())
                        .sort((a, b) => b[1] - a[1]) // Sort by count descending
                        .map(([kind, count]) => {
                            const info = kindLabelMap[kind] || { label: kind, icon: '•', severity: 'info' };
                            return (
                                <option key={kind} value={kind}>
                                    {info.icon} {info.label} ({count})
                                </option>
                            );
                        })}
                </select>
                <div className={styles.limitSelector}>
                    <button
                        className={styles.limitBtn}
                        onClick={() => setShowLimitSelector(!showLimitSelector)}
                        title="Change display limit"
                    >
                        <Icon name="list-ordered" />
                        <span>{displayLimit === -1 ? 'All' : displayLimit}</span>
                    </button>
                    {showLimitSelector && (
                        <div className={styles.limitDropdown}>
                            {[20, 50, 100, 200, -1].map((limit) => (
                                <button
                                    key={limit}
                                    className={`${styles.limitOption} ${displayLimit === limit ? styles.active : ''}`}
                                    onClick={() => {
                                        setDisplayLimit(limit);
                                        setShowLimitSelector(false);
                                    }}
                                >
                                    {limit === -1 ? 'Show All' : `Show ${limit}`}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Results Summary */}
            <div className={styles.resultsSummary}>
                <span>
                    Showing {displayedIssues.length} of {filteredIssues.length} issues
                    {filter !== 'all' && ` (filtered from ${issues.length} total)`}
                </span>
                {addedToContext.size > 0 && (
                    <span className={styles.addedCount}>
                        <Icon name="check" />
                        {addedToContext.size} added to context
                    </span>
                )}
            </div>

            {/* Dynamic Legend based on actual issue types */}
            <div className={styles.legend}>
                {Array.from(issueCategories.keys()).slice(0, 4).map(kind => {
                    const info = kindLabelMap[kind] || { label: kind, icon: '•', severity: 'info' };
                    return (
                        <button
                            key={kind}
                            className={`${styles.legendItem} ${styles.clickable} ${filter === kind ? styles.active : ''}`}
                            onClick={() => setFilter(filter === kind ? 'all' : kind)}
                            title={`Filter by ${info.label}`}
                        >
                            <span className={`${styles.legendDot} ${styles[info.severity]}`} />
                            {info.label}
                        </button>
                    );
                })}
            </div>

            {/* Issue List with scroll */}
            <div className={styles.issueListContainer}>
                {filteredIssues.length === 0 ? (
                    <div className={styles.noResults}>
                        <Icon name="search" />
                        <span>No issues match your search</span>
                        <button onClick={() => { setSearchQuery(''); setFilter('all'); }}>
                            Clear filters
                        </button>
                    </div>
                ) : (
                    <div className={styles.issueList}>
                        {displayedIssues.map((issue) => (
                            <IssueCard
                                key={issue.id}
                                issue={issue}
                                addToContext={addToContext}
                                isAdded={addedToContext.has(issue.id)}
                                isRecentlyAdded={recentlyAdded.has(issue.id)}
                                openFile={openFile}
                            />
                        ))}
                        {hasMoreIssues && (
                            <button
                                className={styles.loadMoreBtn}
                                onClick={() => setDisplayLimit(prev => prev === -1 ? -1 : prev + 50)}
                            >
                                <Icon name="more" />
                                Load more ({filteredIssues.length - displayLimit} remaining)
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// Hotspots Tab Component
function HotspotsTab({ hotspots, addToContext, addedToContext, recentlyAdded, openFile }: {
    hotspots: GraphDigest['hotspots'];
    addToContext: (type: string, data: unknown) => void;
    addedToContext: Set<string>;
    recentlyAdded: Set<string>;
    openFile: (path: string) => void;
}) {
    if (hotspots.length === 0) {
        return (
            <EmptyState
                icon="flame"
                title="No hotspots"
                description="No highly imported files detected yet"
            />
        );
    }

    const maxImporters = Math.max(...hotspots.map((h) => h.importers));

    return (
        <div className={styles.hotspotsTab}>
            {/* Description */}
            <div className={styles.infoBanner}>
                <Icon name="flame" />
                <span>
                    <strong>Hotspots</strong> are files with many dependents.
                    Changes here have wide impact — add to context before asking Copilot about changes.
                </span>
            </div>

            {/* Legend */}
            <div className={styles.legend}>
                <span className={styles.legendItem}>
                    <Icon name="arrow-left" className={styles.legendIconWarning} />
                    Importers (files that depend on this)
                </span>
                <span className={styles.legendItem}>
                    <Icon name="arrow-right" className={styles.legendIconInfo} />
                    Exports (symbols exposed)
                </span>
            </div>

            {/* Hotspot List */}
            <div className={styles.hotspotList}>
                {hotspots.map((hotspot, index) => {
                    const isAdded = addedToContext.has(hotspot.path);
                    const isRecent = recentlyAdded.has(hotspot.path);
                    return (
                        <div key={hotspot.path} className={`${styles.hotspotItem} ${isRecent ? styles.recentlyAdded : ''}`}>
                            <div className={styles.hotspotRank}>#{index + 1}</div>
                            <div className={styles.hotspotInfo}>
                                <span
                                    className={styles.hotspotPath}
                                    onClick={() => openFile(hotspot.path)}
                                    title={`Open ${hotspot.path}`}
                                >
                                    {hotspot.path}
                                </span>
                                <div className={styles.hotspotBar}>
                                    <div
                                        className={styles.hotspotFill}
                                        style={{ width: `${(hotspot.importers / maxImporters) * 100}%` }}
                                    />
                                </div>
                            </div>
                            <div className={styles.hotspotStats}>
                                <span className={styles.hotspotImporters} title="Files that import this">
                                    <Icon name="arrow-left" />
                                    {hotspot.importers}
                                </span>
                                <span className={styles.hotspotExports} title="Exported symbols">
                                    <Icon name="arrow-right" />
                                    {hotspot.exports}
                                </span>
                            </div>
                            <button
                                className={`${styles.hotspotAction} ${isAdded ? styles.added : ''}`}
                                onClick={() => addToContext('hotspot', hotspot)}
                                title={isAdded ? 'Added to context' : 'Add to context for impact analysis'}
                                disabled={isAdded}
                            >
                                <Icon name={isAdded ? 'check' : 'add'} />
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// Helper Components
function StatCard({ icon, label, value, color, tooltip }: {
    icon: string;
    label: string;
    value: number;
    color: string;
    tooltip?: string;
}) {
    return (
        <div className={`${styles.statCard} ${styles[color]}`} title={tooltip}>
            <Icon name={icon} className={styles.statIcon} />
            <div className={styles.statValue}>{value.toLocaleString()}</div>
            <div className={styles.statLabel}>{label}</div>
        </div>
    );
}

function EntrypointGroup({ icon, label, items, tooltip }: {
    icon: string;
    label: string;
    items: string[];
    tooltip?: string;
}) {
    return (
        <div className={styles.entrypointGroup} title={tooltip}>
            <div className={styles.entrypointHeader}>
                <Icon name={icon} />
                <span>{label}</span>
                <span className={styles.entrypointCount}>{items.length}</span>
            </div>
            {items.length > 0 ? (
                <ul className={styles.entrypointList}>
                    {items.slice(0, 3).map((item) => (
                        <li key={item} title={item}>{item}</li>
                    ))}
                    {items.length > 3 && (
                        <li className={styles.moreItems}>+{items.length - 3} more</li>
                    )}
                </ul>
            ) : (
                <span className={styles.noItems}>None detected</span>
            )}
        </div>
    );
}

function IssueStat({ count, label, severity, tooltip }: {
    count: number;
    label: string;
    severity: 'info' | 'warning' | 'error';
    tooltip?: string;
}) {
    return (
        <div className={`${styles.issueStat} ${styles[severity]}`} title={tooltip}>
            <div className={styles.issueStatCount}>{count}</div>
            <div className={styles.issueStatLabel}>{label}</div>
        </div>
    );
}

function IssueCard({ issue, addToContext, isAdded, isRecentlyAdded, openFile }: {
    issue: GraphIssue;
    addToContext: (type: string, data: unknown) => void;
    isAdded: boolean;
    isRecentlyAdded: boolean;
    openFile: (path: string) => void;
}) {
    const [expanded, setExpanded] = useState(false);

    const severityIcon = issue.severity === 'error' ? 'error' : issue.severity === 'warning' ? 'warning' : 'info';
    const kindLabelMap: Record<string, string> = {
        HANDLER_UNREACHABLE: 'Unreachable Code',
        DYNAMIC_EDGE_UNKNOWN: 'Dynamic Import',
        BROKEN_EXPORT_CHAIN: 'Broken Export',
        CIRCULAR_REEXPORT: 'Circular Re-export',
        ORPHAN_EXPORT: 'Orphan Export',
        ENTRY_MISSING_HANDLER: 'Missing Handler',
        NOT_REGISTERED: 'Not Registered',
        CYCLE_RISK: 'Cycle Risk',
        LAYER_VIOLATION: 'Layer Violation',
    };
    const kindLabel = kindLabelMap[issue.kind] || issue.kind;

    return (
        <div className={`${styles.issueCard} ${styles[issue.severity]} ${isRecentlyAdded ? styles.recentlyAdded : ''}`}>
            <div className={styles.issueHeader} onClick={() => setExpanded(!expanded)}>
                <Icon name={severityIcon} />
                <div className={styles.issueHeaderContent}>
                    <span className={styles.issueKind}>{kindLabel}</span>
                    <span className={styles.issueFile}>{issue.file}</span>
                </div>
                <Icon name={expanded ? 'chevron-up' : 'chevron-down'} className={styles.expandIcon} />
            </div>
            {expanded && (
                <div className={styles.issueBody}>
                    <p className={styles.issueSummaryText}>{issue.summary}</p>

                    {issue.evidence.length > 0 && (
                        <div className={styles.issueSection}>
                            <div className={styles.issueSectionHeader}>
                                <Icon name="search" />
                                <span>Evidence</span>
                            </div>
                            <ul className={styles.issueDetailList}>
                                {issue.evidence.map((e, i) => <li key={i}>{e}</li>)}
                            </ul>
                        </div>
                    )}

                    {issue.suggestedFix.length > 0 && (
                        <div className={styles.issueSection}>
                            <div className={styles.issueSectionHeader}>
                                <Icon name="lightbulb" />
                                <span>Suggested Fix</span>
                            </div>
                            <ul className={`${styles.issueDetailList} ${styles.fixList}`}>
                                {issue.suggestedFix.map((f, i) => <li key={i}>{f}</li>)}
                            </ul>
                        </div>
                    )}

                    <div className={styles.issueActions}>
                        <button
                            className={styles.issueActionBtn}
                            onClick={() => openFile(issue.file)}
                            title="Open file in editor"
                        >
                            <Icon name="go-to-file" />
                            Open File
                        </button>
                        <button
                            className={`${styles.issueActionBtn} ${styles.primary} ${isAdded ? styles.added : ''}`}
                            onClick={() => addToContext('issue', issue)}
                            title={isAdded ? 'Added to context' : 'Add this issue to context for Copilot'}
                            disabled={isAdded}
                        >
                            <Icon name={isAdded ? 'check' : 'add'} />
                            {isAdded ? 'Added' : 'Add to Context'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
