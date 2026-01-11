/**
 * Code Graph View
 * Displays codebase structure, issues, and impact analysis
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useVSCode } from '../../context/VSCodeContext';
import { Card, CardHeader, CardBody } from '../../components/Card';
import { Icon } from '../../components/Icon';
import { EmptyState } from '../../components/EmptyState';
import { Spinner } from '../../components/Spinner';
import { ForceGraph } from './components/ForceGraph';
import { NodeDetail } from './components/NodeDetail';
import type { GraphNode, GraphEdge, GraphData, ImpactResult, ModuleInfo } from './types';
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

interface GraphIssue {
    id: string;
    kind: string;
    severity: 'info' | 'warning' | 'error';
    file: string;
    summary: string;
    evidence: string[];
    suggestedFix: string[];
}

type TabType = 'overview' | 'graph' | 'issues' | 'hotspots';

export function CodeGraph() {
    const vscode = useVSCode();
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [digest, setDigest] = useState<GraphDigest | null>(null);
    const [issues, setIssues] = useState<GraphIssue[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [addedToContext, setAddedToContext] = useState<Set<string>>(new Set());
    
    // Graph view state
    const [graphData, setGraphData] = useState<GraphData | null>(null);
    const [selectedNode, setSelectedNode] = useState<string | null>(null);
    const [hoveredNode, setHoveredNode] = useState<string | null>(null);
    const [highlightedNodes, setHighlightedNodes] = useState<Set<string>>(new Set());
    const [showDetail, setShowDetail] = useState(false);
    const [graphSize, setGraphSize] = useState({ width: 600, height: 400 });
    const [graphSettings, setGraphSettings] = useState({
        showLabels: true,
        highlightEntrypoints: true,
        highlightHotspots: true,
    });
    const graphContainerRef = useRef<HTMLDivElement>(null);

    // Build graph data from digest
    const buildGraphData = useCallback((digest: GraphDigest, issues: GraphIssue[]): GraphData => {
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

        // Add hotspot nodes
        digest.hotspots.forEach((hotspot, index) => {
            const node: GraphNode = {
                id: hotspot.path,
                path: hotspot.path,
                name: hotspot.path.split('/').pop() || hotspot.path,
                type: entrypointPaths.has(hotspot.path) ? 'entrypoint' : 'hotspot',
                issueCount: issueCountMap.get(hotspot.path) || 0,
                importers: hotspot.importers,
                exports: hotspot.exports,
                isEntrypoint: entrypointPaths.has(hotspot.path),
                isHotspot: true,
                depth: index,
                val: Math.max(5, Math.min(20, hotspot.importers)),
            };
            nodes.push(node);
            nodeMap.set(hotspot.path, node);
        });

        // Add entrypoint nodes not in hotspots
        [...entrypointPaths].forEach(path => {
            if (!nodeMap.has(path)) {
                const node: GraphNode = {
                    id: path,
                    path: path,
                    name: path.split('/').pop() || path,
                    type: 'entrypoint',
                    issueCount: issueCountMap.get(path) || 0,
                    importers: 0,
                    exports: 0,
                    isEntrypoint: true,
                    isHotspot: false,
                    depth: 0,
                    val: 8,
                };
                nodes.push(node);
                nodeMap.set(path, node);
            }
        });

        // If no nodes yet (no hotspots/entrypoints), show a placeholder message
        // The graph will be empty but that's expected for projects without clear structure
        
        // Create links based on directory proximity
        const sortedHotspots = [...digest.hotspots].sort((a, b) => b.importers - a.importers);
        for (let i = 0; i < Math.min(sortedHotspots.length, 10); i++) {
            for (let j = i + 1; j < Math.min(sortedHotspots.length, 10); j++) {
                const source = sortedHotspots[i].path;
                const target = sortedHotspots[j].path;
                const sourceDir = source.split('/').slice(0, -1).join('/');
                const targetDir = target.split('/').slice(0, -1).join('/');
                if (sourceDir === targetDir || sourceDir.startsWith(targetDir) || targetDir.startsWith(sourceDir)) {
                    links.push({ source, target, type: 'import', weight: 1 });
                }
            }
        }

        return { nodes, links };
    }, []);

    // Request graph data from extension
    const refreshData = useCallback(() => {
        setIsLoading(true);
        setError(null);
        vscode.postMessage({ type: 'getGraphDigest' });
        vscode.postMessage({ type: 'getGraphIssues' });
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
        
        // Track what's been added
        const id = type === 'issue' ? (data as GraphIssue).id : 
                   type === 'hotspot' ? (data as { path: string }).path : 'digest';
        setAddedToContext(prev => new Set(prev).add(id));
        
        // Show feedback briefly
        setTimeout(() => {
            setAddedToContext(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }, 2000);
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
        refreshData();

        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            if (message.type === 'graphDigest') {
                setDigest(message.payload);
                setIsLoading(false);
            } else if (message.type === 'graphIssues') {
                setIssues(message.payload?.issues || []);
            } else if (message.type === 'graphError') {
                setError(message.payload);
                setIsLoading(false);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [refreshData]);

    // Build graph data when digest/issues change
    useEffect(() => {
        if (digest) {
            const data = buildGraphData(digest, issues);
            setGraphData(data);
        }
    }, [digest, issues, buildGraphData]);

    // Get selected node object
    const selectedNodeObj = graphData?.nodes.find(n => n.id === selectedNode) || null;

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
                                        className={`${styles.settingBtn} ${graphSettings.highlightEntrypoints ? styles.active : ''}`}
                                        onClick={() => setGraphSettings(s => ({ ...s, highlightEntrypoints: !s.highlightEntrypoints }))}
                                        title="Highlight entrypoints"
                                    >
                                        🚀
                                    </button>
                                    <button
                                        className={`${styles.settingBtn} ${graphSettings.highlightHotspots ? styles.active : ''}`}
                                        onClick={() => setGraphSettings(s => ({ ...s, highlightHotspots: !s.highlightHotspots }))}
                                        title="Highlight hotspots"
                                    >
                                        🔥
                                    </button>
                                    <div className={styles.settingDivider} />
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
                                            highlightEntrypoints={graphSettings.highlightEntrypoints}
                                            highlightHotspots={graphSettings.highlightHotspots}
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
                {activeTab === 'issues' && (
                    <IssuesTab 
                        issues={issues} 
                        digest={digest} 
                        addToContext={addToContext}
                        addedToContext={addedToContext}
                        openFile={openFile} 
                    />
                )}
                {activeTab === 'hotspots' && (
                    <HotspotsTab 
                        hotspots={digest.hotspots} 
                        addToContext={addToContext}
                        addedToContext={addedToContext}
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
                <button className={styles.refreshBtn} onClick={refreshData} title="Re-index the codebase">
                    <Icon name="refresh" />
                    Refresh
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
function IssuesTab({ issues, digest, addToContext, addedToContext, openFile }: { 
    issues: GraphIssue[]; 
    digest: GraphDigest;
    addToContext: (type: string, data: unknown) => void;
    addedToContext: Set<string>;
    openFile: (path: string) => void;
}) {
    const [filter, setFilter] = useState<string>('all');

    const filteredIssues = filter === 'all'
        ? issues
        : issues.filter((i) => i.kind === filter);

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
                <select
                    className={styles.filterSelect}
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    title="Filter issues by type"
                >
                    <option value="all">All Issues ({issues.length})</option>
                    <option value="HANDLER_UNREACHABLE">
                        🔸 Unreachable ({digest.issues.HANDLER_UNREACHABLE || 0})
                    </option>
                    <option value="DYNAMIC_EDGE_UNKNOWN">
                        🔹 Dynamic ({digest.issues.DYNAMIC_EDGE_UNKNOWN || 0})
                    </option>
                    <option value="BROKEN_EXPORT_CHAIN">
                        🔴 Broken ({digest.issues.BROKEN_EXPORT_CHAIN || 0})
                    </option>
                </select>
            </div>

            {/* Legend */}
            <div className={styles.legend}>
                <span className={styles.legendItem}>
                    <span className={`${styles.legendDot} ${styles.warning}`} />
                    Unreachable = Dead code
                </span>
                <span className={styles.legendItem}>
                    <span className={`${styles.legendDot} ${styles.info}`} />
                    Dynamic = Needs annotation
                </span>
                <span className={styles.legendItem}>
                    <span className={`${styles.legendDot} ${styles.error}`} />
                    Broken = Fix required
                </span>
            </div>

            {/* Issue List */}
            <div className={styles.issueList}>
                {filteredIssues.map((issue) => (
                    <IssueCard 
                        key={issue.id} 
                        issue={issue} 
                        addToContext={addToContext}
                        isAdded={addedToContext.has(issue.id)}
                        openFile={openFile}
                    />
                ))}
            </div>
        </div>
    );
}

// Hotspots Tab Component
function HotspotsTab({ hotspots, addToContext, addedToContext, openFile }: { 
    hotspots: GraphDigest['hotspots'];
    addToContext: (type: string, data: unknown) => void;
    addedToContext: Set<string>;
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
                    return (
                        <div key={hotspot.path} className={styles.hotspotItem}>
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

function IssueCard({ issue, addToContext, isAdded, openFile }: { 
    issue: GraphIssue;
    addToContext: (type: string, data: unknown) => void;
    isAdded: boolean;
    openFile: (path: string) => void;
}) {
    const [expanded, setExpanded] = useState(false);

    const severityIcon = issue.severity === 'error' ? 'error' : issue.severity === 'warning' ? 'warning' : 'info';
    const kindLabel = {
        'HANDLER_UNREACHABLE': 'Unreachable Code',
        'DYNAMIC_EDGE_UNKNOWN': 'Dynamic Import',
        'BROKEN_EXPORT_CHAIN': 'Broken Export'
    }[issue.kind] || issue.kind;

    return (
        <div className={`${styles.issueCard} ${styles[issue.severity]}`}>
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
