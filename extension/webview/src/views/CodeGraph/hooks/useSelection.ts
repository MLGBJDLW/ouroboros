/**
 * useSelection Hook
 * Manages selection and highlight state for the graph
 */

import { useState, useCallback, useMemo } from 'react';
import type { SelectionState, GraphNode, GraphEdge } from '../types';

interface UseSelectionReturn {
    selection: SelectionState;
    selectNode: (nodeId: string | null) => void;
    hoverNode: (nodeId: string | null) => void;
    setImpactTarget: (nodeId: string | null) => void;
    highlightNodes: (nodeIds: string[]) => void;
    clearHighlight: () => void;
    isNodeHighlighted: (nodeId: string) => boolean;
    isNodeSelected: (nodeId: string) => boolean;
    getNodeOpacity: (nodeId: string) => number;
    getEdgeOpacity: (source: string, target: string) => number;
}

export function useSelection(
    _nodes: GraphNode[],
    edges: GraphEdge[]
): UseSelectionReturn {
    void _nodes; // Reserved for future node-based operations
    const [selection, setSelection] = useState<SelectionState>({
        selectedNode: null,
        hoveredNode: null,
        impactTarget: null,
        highlightedNodes: new Set(),
    });

    // Build adjacency map for quick lookups
    const adjacencyMap = useMemo(() => {
        const map = new Map<string, Set<string>>();
        edges.forEach(edge => {
            const sourceId = typeof edge.source === 'string' ? edge.source : (edge.source as GraphNode).id;
            const targetId = typeof edge.target === 'string' ? edge.target : (edge.target as GraphNode).id;
            
            if (!map.has(sourceId)) map.set(sourceId, new Set());
            if (!map.has(targetId)) map.set(targetId, new Set());
            map.get(sourceId)!.add(targetId);
            map.get(targetId)!.add(sourceId);
        });
        return map;
    }, [edges]);

    // Select a node
    const selectNode = useCallback((nodeId: string | null) => {
        setSelection(prev => ({
            ...prev,
            selectedNode: nodeId,
            highlightedNodes: nodeId ? new Set([nodeId, ...(adjacencyMap.get(nodeId) || [])]) : new Set(),
        }));
    }, [adjacencyMap]);

    // Hover a node
    const hoverNode = useCallback((nodeId: string | null) => {
        setSelection(prev => ({
            ...prev,
            hoveredNode: nodeId,
        }));
    }, []);

    // Set impact target
    const setImpactTarget = useCallback((nodeId: string | null) => {
        setSelection(prev => ({
            ...prev,
            impactTarget: nodeId,
        }));
    }, []);

    // Highlight specific nodes
    const highlightNodes = useCallback((nodeIds: string[]) => {
        setSelection(prev => ({
            ...prev,
            highlightedNodes: new Set(nodeIds),
        }));
    }, []);

    // Clear all highlights
    const clearHighlight = useCallback(() => {
        setSelection(prev => ({
            ...prev,
            selectedNode: null,
            hoveredNode: null,
            impactTarget: null,
            highlightedNodes: new Set(),
        }));
    }, []);

    // Check if node is highlighted
    const isNodeHighlighted = useCallback((nodeId: string): boolean => {
        if (selection.highlightedNodes.size === 0) return true;
        return selection.highlightedNodes.has(nodeId);
    }, [selection.highlightedNodes]);

    // Check if node is selected
    const isNodeSelected = useCallback((nodeId: string): boolean => {
        return selection.selectedNode === nodeId;
    }, [selection.selectedNode]);

    // Get node opacity based on selection state
    const getNodeOpacity = useCallback((nodeId: string): number => {
        if (selection.highlightedNodes.size === 0) return 1;
        if (selection.highlightedNodes.has(nodeId)) return 1;
        return 0.2;
    }, [selection.highlightedNodes]);

    // Get edge opacity based on selection state
    const getEdgeOpacity = useCallback((source: string, target: string): number => {
        if (selection.highlightedNodes.size === 0) return 0.3;
        if (selection.highlightedNodes.has(source) && selection.highlightedNodes.has(target)) {
            return 0.6;
        }
        return 0.05;
    }, [selection.highlightedNodes]);

    return {
        selection,
        selectNode,
        hoverNode,
        setImpactTarget,
        highlightNodes,
        clearHighlight,
        isNodeHighlighted,
        isNodeSelected,
        getNodeOpacity,
        getEdgeOpacity,
    };
}
