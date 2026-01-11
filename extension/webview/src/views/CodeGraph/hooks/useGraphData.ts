/**
 * useGraphData Hook
 * Manages graph data fetching and state
 */

import { useState, useEffect, useCallback } from 'react';
import { useVSCode } from '../../../context/VSCodeContext';
import type { GraphDigest, GraphIssue, ImpactResult, ModuleInfo, GraphData, GraphNode, GraphEdge } from '../types';

interface UseGraphDataReturn {
    digest: GraphDigest | null;
    issues: GraphIssue[];
    graphData: GraphData | null;
    isLoading: boolean;
    error: string | null;
    refresh: () => void;
    getImpact: (target: string) => Promise<ImpactResult | null>;
    getModule: (target: string) => Promise<ModuleInfo | null>;
}

export function useGraphData(): UseGraphDataReturn {
    const vscode = useVSCode();
    const [digest, setDigest] = useState<GraphDigest | null>(null);
    const [issues, setIssues] = useState<GraphIssue[]>([]);
    const [graphData, setGraphData] = useState<GraphData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Build graph data from digest
    const buildGraphData = useCallback((digest: GraphDigest, issues: GraphIssue[]): GraphData => {
        const nodes: GraphNode[] = [];
        const links: GraphEdge[] = [];
        const nodeMap = new Map<string, GraphNode>();

        // Create entrypoint paths set
        const entrypointPaths = new Set([
            ...digest.entrypoints.routes,
            ...digest.entrypoints.commands,
            ...digest.entrypoints.pages,
            ...digest.entrypoints.jobs,
        ]);

        // Count issues per file
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

        // Add issue file nodes not already present
        issues.forEach(issue => {
            if (!nodeMap.has(issue.file)) {
                const node: GraphNode = {
                    id: issue.file,
                    path: issue.file,
                    name: issue.file.split('/').pop() || issue.file,
                    type: 'file',
                    issueCount: issueCountMap.get(issue.file) || 0,
                    importers: 0,
                    exports: 0,
                    isEntrypoint: false,
                    isHotspot: false,
                    depth: 2,
                    val: 5,
                };
                nodes.push(node);
                nodeMap.set(issue.file, node);
            }
        });

        // Create links between hotspots (simplified - in real impl would come from backend)
        // For now, create links based on directory proximity
        const sortedHotspots = [...digest.hotspots].sort((a, b) => b.importers - a.importers);
        for (let i = 0; i < Math.min(sortedHotspots.length, 10); i++) {
            for (let j = i + 1; j < Math.min(sortedHotspots.length, 10); j++) {
                const source = sortedHotspots[i].path;
                const target = sortedHotspots[j].path;
                // Check if in same directory
                const sourceDir = source.split('/').slice(0, -1).join('/');
                const targetDir = target.split('/').slice(0, -1).join('/');
                if (sourceDir === targetDir || sourceDir.startsWith(targetDir) || targetDir.startsWith(sourceDir)) {
                    links.push({
                        source,
                        target,
                        type: 'import',
                        weight: 1,
                    });
                }
            }
        }

        return { nodes, links };
    }, []);

    // Refresh data
    const refresh = useCallback(() => {
        setIsLoading(true);
        setError(null);
        vscode.postMessage({ type: 'getGraphDigest' });
        vscode.postMessage({ type: 'getGraphIssues' });
        vscode.postMessage({ type: 'getGraphData' });
    }, [vscode]);

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
            // Timeout after 5s
            setTimeout(() => {
                window.removeEventListener('message', handler);
                resolve(null);
            }, 5000);
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
            setTimeout(() => {
                window.removeEventListener('message', handler);
                resolve(null);
            }, 5000);
        });
    }, [vscode]);

    // Listen for messages
    useEffect(() => {
        refresh();

        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            switch (message.type) {
                case 'graphDigest':
                    setDigest(message.payload);
                    setIsLoading(false);
                    break;
                case 'graphIssues':
                    setIssues(message.payload?.issues || []);
                    break;
                case 'graphData':
                    if (message.payload) {
                        setGraphData(message.payload);
                    }
                    break;
                case 'graphError':
                    setError(message.payload);
                    setIsLoading(false);
                    break;
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [refresh]);

    // Build graph data when digest/issues change
    useEffect(() => {
        if (digest && !graphData) {
            const data = buildGraphData(digest, issues);
            setGraphData(data);
        }
    }, [digest, issues, graphData, buildGraphData]);

    return {
        digest,
        issues,
        graphData,
        isLoading,
        error,
        refresh,
        getImpact,
        getModule,
    };
}
