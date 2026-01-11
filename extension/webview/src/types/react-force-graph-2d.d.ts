declare module 'react-force-graph-2d' {
    import { Component, RefObject } from 'react';

    export interface ForceGraphMethods {
        centerAt: (x?: number, y?: number, ms?: number) => void;
        zoom: (k?: number, ms?: number) => void;
        zoomToFit: (ms?: number, padding?: number) => void;
        pauseAnimation: () => void;
        resumeAnimation: () => void;
        d3Force: (forceName: string, force?: unknown) => unknown;
        d3ReheatSimulation: () => void;
        emitParticle: (link: object) => void;
        refresh: () => void;
    }

    export interface NodeObject {
        id?: string | number;
        x?: number;
        y?: number;
        vx?: number;
        vy?: number;
        fx?: number | null;
        fy?: number | null;
        [key: string]: unknown;
    }

    export interface LinkObject {
        source?: string | number | NodeObject;
        target?: string | number | NodeObject;
        [key: string]: unknown;
    }

    export interface GraphData {
        nodes: NodeObject[];
        links: LinkObject[];
    }

    export interface ForceGraphProps {
        graphData: GraphData;
        width?: number;
        height?: number;
        backgroundColor?: string;
        nodeId?: string;
        nodeLabel?: string | ((node: NodeObject) => string);
        nodeVal?: number | string | ((node: NodeObject) => number);
        nodeColor?: string | ((node: NodeObject) => string);
        nodeAutoColorBy?: string | ((node: NodeObject) => string | null);
        nodeCanvasObject?: (node: NodeObject, ctx: CanvasRenderingContext2D, globalScale: number) => void;
        nodeCanvasObjectMode?: string | ((node: NodeObject) => string);
        nodePointerAreaPaint?: (node: NodeObject, color: string, ctx: CanvasRenderingContext2D) => void;
        linkSource?: string;
        linkTarget?: string;
        linkLabel?: string | ((link: LinkObject) => string);
        linkColor?: string | ((link: LinkObject) => string);
        linkAutoColorBy?: string | ((link: LinkObject) => string | null);
        linkWidth?: number | string | ((link: LinkObject) => number);
        linkCurvature?: number | string | ((link: LinkObject) => number);
        linkCanvasObject?: (link: LinkObject, ctx: CanvasRenderingContext2D, globalScale: number) => void;
        linkCanvasObjectMode?: string | ((link: LinkObject) => string);
        linkDirectionalArrowLength?: number | string | ((link: LinkObject) => number);
        linkDirectionalArrowColor?: string | ((link: LinkObject) => string);
        linkDirectionalArrowRelPos?: number | string | ((link: LinkObject) => number);
        linkDirectionalParticles?: number | string | ((link: LinkObject) => number);
        linkDirectionalParticleSpeed?: number | string | ((link: LinkObject) => number);
        linkDirectionalParticleWidth?: number | string | ((link: LinkObject) => number);
        linkDirectionalParticleColor?: string | ((link: LinkObject) => string);
        linkPointerAreaPaint?: (link: LinkObject, color: string, ctx: CanvasRenderingContext2D) => void;
        dagMode?: string;
        dagLevelDistance?: number;
        dagNodeFilter?: (node: NodeObject) => boolean;
        onDagError?: (loopNodeIds: (string | number)[]) => void;
        d3AlphaMin?: number;
        d3AlphaDecay?: number;
        d3VelocityDecay?: number;
        warmupTicks?: number;
        cooldownTicks?: number;
        cooldownTime?: number;
        onEngineTick?: () => void;
        onEngineStop?: () => void;
        onNodeClick?: (node: NodeObject, event: MouseEvent) => void;
        onNodeRightClick?: (node: NodeObject, event: MouseEvent) => void;
        onNodeHover?: (node: NodeObject | null, previousNode: NodeObject | null) => void;
        onNodeDrag?: (node: NodeObject, translate: { x: number; y: number }) => void;
        onNodeDragEnd?: (node: NodeObject, translate: { x: number; y: number }) => void;
        onLinkClick?: (link: LinkObject, event: MouseEvent) => void;
        onLinkRightClick?: (link: LinkObject, event: MouseEvent) => void;
        onLinkHover?: (link: LinkObject | null, previousLink: LinkObject | null) => void;
        onBackgroundClick?: (event: MouseEvent) => void;
        onBackgroundRightClick?: (event: MouseEvent) => void;
        onZoom?: (transform: { k: number; x: number; y: number }) => void;
        onZoomEnd?: (transform: { k: number; x: number; y: number }) => void;
        enableNodeDrag?: boolean;
        enableZoomInteraction?: boolean;
        enablePanInteraction?: boolean;
        enablePointerInteraction?: boolean;
        minZoom?: number;
        maxZoom?: number;
    }

    const ForceGraph2D: React.ForwardRefExoticComponent<
        ForceGraphProps & React.RefAttributes<ForceGraphMethods>
    >;

    export default ForceGraph2D;
    export { ForceGraph2D };
}
