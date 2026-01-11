/**
 * Framework Adapter Types
 * Interfaces for framework-specific entrypoint detection
 */

import type { GraphStore } from '../core/GraphStore';
import type { GraphNode, GraphEdge, GraphIssue } from '../core/types';

/**
 * Framework adapter interface
 * Each adapter detects entrypoints for a specific framework
 */
export interface FrameworkAdapter {
    /** Unique adapter name */
    name: string;
    
    /** Human-readable display name */
    displayName: string;
    
    /** Framework category */
    category: 'web' | 'api' | 'cli' | 'fullstack';
    
    /** File patterns this adapter cares about */
    filePatterns: string[];
    
    /**
     * Detect if this framework is used in the project
     * @param projectRoot - Workspace root path
     * @param packageJson - Parsed package.json (if exists)
     */
    detect(projectRoot: string, packageJson?: PackageJson): Promise<boolean>;
    
    /**
     * Extract entrypoints from the codebase
     * @param store - Graph store with indexed files
     * @param projectRoot - Workspace root path
     */
    extractEntrypoints(store: GraphStore, projectRoot: string): Promise<GraphNode[]>;
    
    /**
     * Extract registration edges (route -> handler, etc.)
     * @param store - Graph store with indexed files
     * @param projectRoot - Workspace root path
     */
    extractRegistrations(store: GraphStore, projectRoot: string): Promise<GraphEdge[]>;
    
    /**
     * Detect framework-specific issues (optional)
     * @param store - Graph store with indexed files
     */
    detectIssues?(store: GraphStore): Promise<GraphIssue[]>;
}

/**
 * Simplified package.json structure
 */
export interface PackageJson {
    name?: string;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
}

/**
 * Framework detection result
 */
export interface FrameworkDetection {
    name: string;
    displayName: string;
    confidence: 'high' | 'medium' | 'low';
    version?: string;
}

/**
 * Route registration info
 */
export interface RouteInfo {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'ALL' | '*';
    path: string;
    handlerFile: string;
    handlerName?: string;
    line?: number;
    middleware?: string[];
}

/**
 * CLI command info
 */
export interface CommandInfo {
    name: string;
    description?: string;
    handlerFile: string;
    handlerName?: string;
    line?: number;
    aliases?: string[];
    subcommands?: CommandInfo[];
}
