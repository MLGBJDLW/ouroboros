/**
 * Annotation Manager
 * Manages manual annotations for the code graph (edges, entrypoints, ignores)
 */

import * as fs from 'fs';
import * as path from 'path';
import type { GraphEdge, GraphNode, Confidence, EntrypointType, IssueKind } from '../core/types';

// ============================================
// Annotation Types
// ============================================

export interface ManualEdge {
    from: string;
    to: string;
    kind: 'imports' | 'calls' | 'registers';
    confidence: Confidence;
    reason: string;
}

export interface ManualEntrypoint {
    path: string;
    type: EntrypointType;
    name: string;
    meta?: Record<string, unknown>;
}

export interface IgnoreRule {
    issueKind: IssueKind;
    path: string;
    reason: string;
}

export interface AnnotationFile {
    version: string;
    edges: ManualEdge[];
    entrypoints: ManualEntrypoint[];
    ignores: IgnoreRule[];
}

const DEFAULT_ANNOTATIONS: AnnotationFile = {
    version: '1.0.0',
    edges: [],
    entrypoints: [],
    ignores: [],
};

export class AnnotationManager {
    private annotations: AnnotationFile = { ...DEFAULT_ANNOTATIONS };
    private filePath: string;
    private loaded = false;

    constructor(workspaceRoot: string) {
        this.filePath = path.join(workspaceRoot, '.ouroboros', 'graph', 'annotations.json');
    }

    // ============================================
    // File Operations
    // ============================================

    /**
     * Load annotations from file
     */
    async load(): Promise<void> {
        try {
            const content = await fs.promises.readFile(this.filePath, 'utf-8');
            const parsed = JSON.parse(content) as Partial<AnnotationFile>;
            
            this.annotations = {
                version: parsed.version ?? '1.0.0',
                edges: parsed.edges ?? [],
                entrypoints: parsed.entrypoints ?? [],
                ignores: parsed.ignores ?? [],
            };
            this.loaded = true;
        } catch (error) {
            // File doesn't exist or is invalid, use defaults
            this.annotations = { ...DEFAULT_ANNOTATIONS };
            this.loaded = true;
        }
    }

    /**
     * Save annotations to file
     */
    async save(): Promise<void> {
        const dir = path.dirname(this.filePath);
        
        // Ensure directory exists
        await fs.promises.mkdir(dir, { recursive: true });
        
        const content = JSON.stringify(this.annotations, null, 2);
        await fs.promises.writeFile(this.filePath, content, 'utf-8');
    }

    /**
     * Ensure annotations are loaded
     */
    private async ensureLoaded(): Promise<void> {
        if (!this.loaded) {
            await this.load();
        }
    }

    // ============================================
    // Edge Operations
    // ============================================

    /**
     * Add a manual edge annotation
     */
    async addEdge(edge: ManualEdge): Promise<void> {
        await this.ensureLoaded();
        
        // Check for duplicates
        const exists = this.annotations.edges.some(
            (e) => e.from === edge.from && e.to === edge.to && e.kind === edge.kind
        );
        
        if (!exists) {
            this.annotations.edges.push(edge);
            await this.save();
        }
    }

    /**
     * Remove a manual edge annotation
     */
    async removeEdge(from: string, to: string): Promise<boolean> {
        await this.ensureLoaded();
        
        const initialLength = this.annotations.edges.length;
        this.annotations.edges = this.annotations.edges.filter(
            (e) => !(e.from === from && e.to === to)
        );
        
        if (this.annotations.edges.length !== initialLength) {
            await this.save();
            return true;
        }
        return false;
    }

    /**
     * Get all manual edges
     */
    async getEdges(): Promise<ManualEdge[]> {
        await this.ensureLoaded();
        return [...this.annotations.edges];
    }

    /**
     * Convert manual edges to GraphEdges
     */
    async getGraphEdges(): Promise<GraphEdge[]> {
        await this.ensureLoaded();
        
        return this.annotations.edges.map((e) => ({
            id: `edge:annotation:${e.from}:${e.to}`,
            from: `file:${e.from}`,
            to: `file:${e.to}`,
            kind: e.kind,
            confidence: e.confidence,
            reason: `manual annotation: ${e.reason}`,
            meta: {
                isAnnotation: true,
            },
        }));
    }

    // ============================================
    // Entrypoint Operations
    // ============================================

    /**
     * Add a manual entrypoint annotation
     */
    async addEntrypoint(entrypoint: ManualEntrypoint): Promise<void> {
        await this.ensureLoaded();
        
        // Check for duplicates
        const exists = this.annotations.entrypoints.some(
            (e) => e.path === entrypoint.path
        );
        
        if (!exists) {
            this.annotations.entrypoints.push(entrypoint);
            await this.save();
        }
    }

    /**
     * Remove a manual entrypoint annotation
     */
    async removeEntrypoint(entrypointPath: string): Promise<boolean> {
        await this.ensureLoaded();
        
        const initialLength = this.annotations.entrypoints.length;
        this.annotations.entrypoints = this.annotations.entrypoints.filter(
            (e) => e.path !== entrypointPath
        );
        
        if (this.annotations.entrypoints.length !== initialLength) {
            await this.save();
            return true;
        }
        return false;
    }

    /**
     * Get all manual entrypoints
     */
    async getEntrypoints(): Promise<ManualEntrypoint[]> {
        await this.ensureLoaded();
        return [...this.annotations.entrypoints];
    }

    /**
     * Convert manual entrypoints to GraphNodes
     */
    async getGraphEntrypoints(): Promise<GraphNode[]> {
        await this.ensureLoaded();
        
        return this.annotations.entrypoints.map((e) => ({
            id: `entrypoint:annotation:${e.path}`,
            kind: 'entrypoint' as const,
            name: e.name,
            path: e.path,
            meta: {
                entrypointType: e.type,
                isAnnotation: true,
                ...e.meta,
            },
        }));
    }

    // ============================================
    // Ignore Operations
    // ============================================

    /**
     * Add an ignore rule
     */
    async addIgnore(ignore: IgnoreRule): Promise<void> {
        await this.ensureLoaded();
        
        // Check for duplicates
        const exists = this.annotations.ignores.some(
            (i) => i.issueKind === ignore.issueKind && i.path === ignore.path
        );
        
        if (!exists) {
            this.annotations.ignores.push(ignore);
            await this.save();
        }
    }

    /**
     * Remove an ignore rule
     */
    async removeIgnore(issueKind: IssueKind, ignorePath: string): Promise<boolean> {
        await this.ensureLoaded();
        
        const initialLength = this.annotations.ignores.length;
        this.annotations.ignores = this.annotations.ignores.filter(
            (i) => !(i.issueKind === issueKind && i.path === ignorePath)
        );
        
        if (this.annotations.ignores.length !== initialLength) {
            await this.save();
            return true;
        }
        return false;
    }

    /**
     * Get all ignore rules
     */
    async getIgnores(): Promise<IgnoreRule[]> {
        await this.ensureLoaded();
        return [...this.annotations.ignores];
    }

    /**
     * Check if an issue should be ignored
     */
    async shouldIgnore(issueKind: IssueKind, filePath: string): Promise<boolean> {
        await this.ensureLoaded();
        
        return this.annotations.ignores.some((ignore) => {
            if (ignore.issueKind !== issueKind) return false;
            
            // Support glob-like patterns with *
            if (ignore.path.endsWith('*')) {
                const prefix = ignore.path.slice(0, -1);
                return filePath.startsWith(prefix);
            }
            
            return filePath === ignore.path || filePath.startsWith(ignore.path + '/');
        });
    }

    // ============================================
    // Utility
    // ============================================

    /**
     * Get all annotations
     */
    async getAll(): Promise<AnnotationFile> {
        await this.ensureLoaded();
        return { ...this.annotations };
    }

    /**
     * Clear all annotations
     */
    async clear(): Promise<void> {
        this.annotations = { ...DEFAULT_ANNOTATIONS };
        await this.save();
    }

    /**
     * Check if annotations file exists
     */
    async exists(): Promise<boolean> {
        try {
            await fs.promises.access(this.filePath);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get the annotations file path
     */
    getFilePath(): string {
        return this.filePath;
    }
}
