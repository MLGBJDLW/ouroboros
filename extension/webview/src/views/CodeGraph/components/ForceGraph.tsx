/**
 * ForceGraph Component
 * Interactive force-directed graph visualization
 */

import { useRef, useCallback, useEffect, useMemo, useState } from 'react';
import ForceGraph2D, { ForceGraphMethods, NodeObject, LinkObject } from 'react-force-graph-2d';
import type { GraphData, GraphNode, GraphEdge } from '../types';
import styles from './ForceGraph.module.css';

// Extended types for force graph
type ForceNode = GraphNode & NodeObject;
type ForceLink = GraphEdge & LinkObject;

interface ForceGraphProps {
    data: GraphData;
    width: number;
    height: number;
    selectedNode: string | null;
    hoveredNode: string | null;
    highlightedNodes: Set<string>;
    onNodeClick: (node: GraphNode) => void;
    onNodeHover: (node: GraphNode | null) => void;
    onNodeRightClick: (node: GraphNode) => void;
    showLabels: boolean;
    showEdges: boolean;
    highlightEntrypoints: boolean;
    highlightHotspots: boolean;
    isFrozen: boolean;
    fitVersion: number;
}

// Color palette - using CSS custom properties where possible
const COLORS = {
    entrypoint: '#4CAF50',      // Green
    hotspot: '#FF5722',         // Orange-red
    file: '#2196F3',            // Blue
    fileWithIssue: '#FFC107',   // Amber
    selected: '#E91E63',        // Pink
    hovered: '#9C27B0',         // Purple
    // These will be computed from CSS variables
    edge: '',
    edgeHighlight: '',
    label: '',
    border: '',
};

// Get computed CSS variable value
function getCSSVar(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// Check if dark theme
function isDarkTheme(): boolean {
    const bg = getCSSVar('--background');
    if (!bg) return true;
    // Simple heuristic: check if background is dark
    const rgb = bg.match(/\d+/g);
    if (rgb && rgb.length >= 3) {
        const brightness = (parseInt(rgb[0]) + parseInt(rgb[1]) + parseInt(rgb[2])) / 3;
        return brightness < 128;
    }
    return true;
}

// Update colors based on theme
function getThemeColors() {
    const dark = isDarkTheme();
    return {
        ...COLORS,
        edge: dark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
        edgeHighlight: dark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)',
        label: dark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
        border: dark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
    };
}

export function ForceGraph({
    data,
    width,
    height,
    selectedNode,
    hoveredNode,
    highlightedNodes,
    onNodeClick,
    onNodeHover,
    onNodeRightClick,
    showLabels,
    showEdges,
    highlightEntrypoints,
    highlightHotspots,
    isFrozen,
    fitVersion,
}: ForceGraphProps) {
    const graphRef = useRef<ForceGraphMethods | null>(null);
    const [isStabilized, setIsStabilized] = useState(false);
    const [themeColors, setThemeColors] = useState(getThemeColors());
    const pendingZoomRef = useRef(true);
    const lastZoomSizeRef = useRef<{ width: number; height: number } | null>(null);

    // Update colors when theme changes
    useEffect(() => {
        const updateColors = () => setThemeColors(getThemeColors());
        updateColors();
        // Listen for theme changes via MutationObserver on body class
        const observer = new MutationObserver(updateColors);
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    // Convert data to force graph format
    const forceData = useMemo(() => ({
        nodes: data.nodes as ForceNode[],
        links: data.links as ForceLink[],
    }), [data]);

    // Get node color
    const getNodeColor = useCallback((node: GraphNode): string => {
        if (node.id === selectedNode) return COLORS.selected;
        if (node.id === hoveredNode) return COLORS.hovered;
        if (highlightEntrypoints && node.isEntrypoint) return COLORS.entrypoint;
        if (highlightHotspots && node.isHotspot) return COLORS.hotspot;
        if (node.issueCount > 0) return COLORS.fileWithIssue;
        return COLORS.file;
    }, [selectedNode, hoveredNode, highlightEntrypoints, highlightHotspots]);

    // Get node opacity
    const getNodeOpacity = useCallback((node: GraphNode): number => {
        if (highlightedNodes.size === 0) return 1;
        return highlightedNodes.has(node.id) ? 1 : 0.15;
    }, [highlightedNodes]);

    // Get node size
    const getNodeSize = useCallback((node: GraphNode): number => {
        const baseSize = node.val || 5;
        if (node.id === selectedNode) return baseSize * 1.5;
        if (node.id === hoveredNode) return baseSize * 1.3;
        return baseSize;
    }, [selectedNode, hoveredNode]);

    // Draw node
    const drawNode = useCallback((node: ForceNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const size = getNodeSize(node);
        const color = getNodeColor(node);
        const opacity = getNodeOpacity(node);
        const x = node.x || 0;
        const y = node.y || 0;

        ctx.globalAlpha = opacity;

        // Draw glow for selected/hovered
        if (node.id === selectedNode || node.id === hoveredNode) {
            ctx.beginPath();
            ctx.arc(x, y, size + 4, 0, 2 * Math.PI);
            ctx.fillStyle = `${color}40`;
            ctx.fill();
        }

        // Draw node circle
        ctx.beginPath();
        ctx.arc(x, y, size, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();

        // Draw border
        ctx.strokeStyle = themeColors.border;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Draw icon for special nodes
        if (node.isEntrypoint || node.isHotspot) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.font = `${Math.max(8, size * 0.8)}px codicon`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const icon = node.isEntrypoint ? '🚀' : '🔥';
            ctx.fillText(icon, x, y);
        }

        // Draw issue badge
        if (node.issueCount > 0) {
            const badgeX = x + size * 0.7;
            const badgeY = y - size * 0.7;
            const badgeSize = Math.max(6, size * 0.5);
            
            ctx.beginPath();
            ctx.arc(badgeX, badgeY, badgeSize, 0, 2 * Math.PI);
            ctx.fillStyle = '#f44336';
            ctx.fill();
            
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${badgeSize}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(node.issueCount), badgeX, badgeY);
        }

        // Draw label (only when zoomed or focused to reduce clutter)
        const shouldShowLabel =
            showLabels && (node.id === selectedNode || node.id === hoveredNode || globalScale > 1.2);
        if (shouldShowLabel) {
            const label = node.name;
            const fontSize = Math.max(10, 12 / globalScale);
            ctx.font = `${fontSize}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillStyle = themeColors.label;
            ctx.fillText(label, x, y + size + 4);
        }

        ctx.globalAlpha = 1;
    }, [getNodeSize, getNodeColor, getNodeOpacity, selectedNode, hoveredNode, showLabels, themeColors]);

    // Draw link
    const drawLink = useCallback((link: ForceLink, ctx: CanvasRenderingContext2D) => {
        if (!showEdges) return;
        const source = link.source as unknown as ForceNode;
        const target = link.target as unknown as ForceNode;
        
        if (!source.x || !source.y || !target.x || !target.y) return;

        const isHighlighted = highlightedNodes.size === 0 || 
            (highlightedNodes.has(source.id) && highlightedNodes.has(target.id));

        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.strokeStyle = isHighlighted ? themeColors.edgeHighlight : themeColors.edge;
        ctx.lineWidth = isHighlighted ? 1.5 : 0.5;
        ctx.stroke();

        // Draw arrow for direction
        if (isHighlighted) {
            const angle = Math.atan2(target.y - source.y, target.x - source.x);
            const arrowLen = 6;
            const midX = (source.x + target.x) / 2;
            const midY = (source.y + target.y) / 2;

            ctx.beginPath();
            ctx.moveTo(midX, midY);
            ctx.lineTo(
                midX - arrowLen * Math.cos(angle - Math.PI / 6),
                midY - arrowLen * Math.sin(angle - Math.PI / 6)
            );
            ctx.lineTo(
                midX - arrowLen * Math.cos(angle + Math.PI / 6),
                midY - arrowLen * Math.sin(angle + Math.PI / 6)
            );
            ctx.closePath();
            ctx.fillStyle = themeColors.edgeHighlight;
            ctx.fill();
        }
    }, [highlightedNodes, themeColors, showEdges]);

    // Handle node click
    const handleNodeClick = useCallback((node: ForceNode) => {
        onNodeClick(node);
        // Center on node
        graphRef.current?.centerAt(node.x, node.y, 500);
        graphRef.current?.zoom(2, 500);
    }, [onNodeClick]);

    // Handle right click
    const handleNodeRightClick = useCallback((node: ForceNode, event: MouseEvent) => {
        event.preventDefault();
        onNodeRightClick(node);
    }, [onNodeRightClick]);

    const zoomToFit = useCallback(() => {
        if (!graphRef.current || data.nodes.length === 0) return;
        graphRef.current.zoomToFit(400, 50);
        lastZoomSizeRef.current = { width, height };
        pendingZoomRef.current = false;
    }, [data.nodes.length, width, height]);

    const handleEngineStop = useCallback(() => {
        if (pendingZoomRef.current) {
            zoomToFit();
        }
        setIsStabilized(true);
    }, [zoomToFit]);

    // Reset stabilization when data changes
    useEffect(() => {
        pendingZoomRef.current = true;
        setIsStabilized(false);
    }, [data]);

    useEffect(() => {
        const lastSize = lastZoomSizeRef.current;
        const sizeChanged = !lastSize || lastSize.width !== width || lastSize.height !== height;
        if (sizeChanged) {
            if (isStabilized) {
                zoomToFit();
            } else {
                pendingZoomRef.current = true;
            }
        }
    }, [width, height, isStabilized, zoomToFit]);

    useEffect(() => {
        if (!graphRef.current) return;
        const nodeCount = data.nodes.length;
        const charge = graphRef.current.d3Force('charge') as { strength?: (value: number) => void } | undefined;
        const link = graphRef.current.d3Force('link') as { distance?: (value: number) => void; strength?: (value: number) => void } | undefined;

        const chargeStrength = -Math.min(420, 60 + nodeCount * 8);
        const linkDistance = Math.min(160, 40 + nodeCount * 3);

        charge?.strength?.(chargeStrength);
        link?.distance?.(linkDistance);
        link?.strength?.(showEdges ? 0.8 : 0.2);
        graphRef.current.d3ReheatSimulation();
    }, [data.nodes.length, showEdges]);

    useEffect(() => {
        if (!graphRef.current) return;
        if (isFrozen) {
            graphRef.current.pauseAnimation();
        } else {
            graphRef.current.resumeAnimation();
            graphRef.current.d3ReheatSimulation();
        }
    }, [isFrozen]);

    useEffect(() => {
        if (fitVersion <= 0) return;
        zoomToFit();
    }, [fitVersion, zoomToFit]);

    return (
        <div className={styles.container}>
            <ForceGraph2D
                ref={graphRef}
                graphData={forceData}
                width={width}
                height={height}
                nodeId="id"
                nodeLabel={(node: NodeObject) => {
                    const n = node as ForceNode;
                    return `${n.path}\n${n.importers} importers, ${n.exports} exports`;
                }}
                nodeCanvasObject={(node: NodeObject, ctx, globalScale) => drawNode(node as ForceNode, ctx, globalScale)}
                nodePointerAreaPaint={(node: NodeObject, color, ctx) => {
                    const n = node as ForceNode;
                    const size = getNodeSize(n);
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.arc(n.x || 0, n.y || 0, size + 2, 0, 2 * Math.PI);
                    ctx.fill();
                }}
                linkCanvasObject={(link: LinkObject, ctx) => drawLink(link as ForceLink, ctx)}
                onNodeClick={(node) => handleNodeClick(node as ForceNode)}
                onNodeHover={(node) => onNodeHover(node as ForceNode | null)}
                onNodeRightClick={(node, event) => handleNodeRightClick(node as ForceNode, event)}
                cooldownTicks={100}
                onEngineStop={handleEngineStop}
                enableNodeDrag={true}
                enableZoomInteraction={true}
                enablePanInteraction={true}
                minZoom={0.2}
                maxZoom={8}
                backgroundColor="transparent"
                d3AlphaDecay={0.02}
                d3VelocityDecay={0.3}
            />
            
            {/* Legend */}
            <div className={styles.legend}>
                <div className={styles.legendItem}>
                    <span className={styles.legendDot} style={{ background: COLORS.entrypoint }} />
                    <span>Entrypoint</span>
                </div>
                <div className={styles.legendItem}>
                    <span className={styles.legendDot} style={{ background: COLORS.hotspot }} />
                    <span>Hotspot</span>
                </div>
                <div className={styles.legendItem}>
                    <span className={styles.legendDot} style={{ background: COLORS.file }} />
                    <span>File</span>
                </div>
                <div className={styles.legendItem}>
                    <span className={styles.legendDot} style={{ background: COLORS.fileWithIssue }} />
                    <span>Has Issues</span>
                </div>
            </div>

            {/* Controls hint */}
            <div className={styles.controls}>
                <span>🖱️ Drag to pan • Scroll to zoom • Click node to select</span>
            </div>
        </div>
    );
}
