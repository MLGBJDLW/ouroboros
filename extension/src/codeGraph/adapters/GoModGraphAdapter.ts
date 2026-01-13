/**
 * Go Mod Graph Adapter
 * 
 * Integrates Go's built-in `go mod graph` command for dependency analysis.
 * 
 * Why use go mod graph?
 * - Built into Go toolchain, no extra installation needed
 * - Accurate module-level dependency information
 * - Handles replace directives and workspace modules
 * 
 * This adapter:
 * 1. Checks if Go is available and project has go.mod
 * 2. Runs `go mod graph` to get module dependencies
 * 3. Converts output to our GraphNode/GraphEdge format
 * 4. Falls back to GoIndexer if not available
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync, spawn } from 'child_process';
import type { GraphNode, GraphEdge, GraphIssue } from '../core/types';
import { createLogger } from '../../utils/logger';

const logger = createLogger('GoModGraphAdapter');

/**
 * Adapter configuration
 */
export interface GoModGraphConfig {
    /** Whether to use go mod graph when available */
    enabled: boolean;
    /** Timeout for CLI execution (ms) */
    timeout?: number;
}

const DEFAULT_CONFIG: GoModGraphConfig = {
    enabled: true,
    timeout: 30000,
};

export class GoModGraphAdapter {
    private config: GoModGraphConfig;
    private workspaceRoot: string;
    private isAvailable: boolean | null = null;
    private goPath: string | null = null;

    constructor(workspaceRoot: string, config?: Partial<GoModGraphConfig>) {
        this.workspaceRoot = workspaceRoot;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Check if go mod graph is available
     */
    async checkAvailability(): Promise<boolean> {
        if (this.isAvailable !== null) {
            return this.isAvailable;
        }

        // Check if go.mod exists
        const goModPath = path.join(this.workspaceRoot, 'go.mod');
        if (!fs.existsSync(goModPath)) {
            this.isAvailable = false;
            logger.debug('No go.mod found, go mod graph not applicable');
            return false;
        }

        // Check if Go is installed
        try {
            execSync('go version', { stdio: 'ignore', timeout: 5000 });
            this.goPath = 'go';
            this.isAvailable = true;
            logger.info('Go toolchain available for dependency analysis');
            return true;
        } catch {
            this.isAvailable = false;
            logger.debug('Go not available');
            return false;
        }
    }

    /**
     * Run go mod graph and get results
     */
    async analyze(): Promise<{ nodes: GraphNode[]; edges: GraphEdge[]; issues: GraphIssue[] } | null> {
        if (!this.config.enabled) {
            return null;
        }

        const available = await this.checkAvailability();
        if (!available) {
            return null;
        }

        try {
            const output = await this.runGoModGraph();
            if (!output) {
                return null;
            }

            return this.convertOutput(output);
        } catch (error) {
            logger.error('Failed to run go mod graph:', error);
            return null;
        }
    }

    /**
     * Run go mod graph and parse output
     */
    private async runGoModGraph(): Promise<string | null> {
        return new Promise((resolve) => {
            const proc = spawn('go', ['mod', 'graph'], {
                cwd: this.workspaceRoot,
                timeout: this.config.timeout,
            });

            let stdout = '';
            let stderr = '';

            proc.stdout?.on('data', (data) => {
                stdout += data.toString();
            });

            proc.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            proc.on('close', (code) => {
                if (code !== 0) {
                    logger.warn(`go mod graph exited with code ${code}: ${stderr}`);
                    resolve(null);
                    return;
                }
                resolve(stdout);
            });

            proc.on('error', (error) => {
                logger.error('Failed to spawn go mod graph:', error);
                resolve(null);
            });
        });
    }

    /**
     * Convert go mod graph output to our graph format
     * 
     * Output format: "module@version dependency@version\n"
     */
    private convertOutput(output: string): { nodes: GraphNode[]; edges: GraphEdge[]; issues: GraphIssue[] } {
        const nodes: GraphNode[] = [];
        const edges: GraphEdge[] = [];
        const issues: GraphIssue[] = [];
        const seenNodes = new Set<string>();

        const lines = output.trim().split('\n').filter(line => line.trim());

        for (const line of lines) {
            const parts = line.split(' ');
            if (parts.length !== 2) continue;

            const [fromModule, toModule] = parts;
            const fromName = this.extractModuleName(fromModule);
            const toName = this.extractModuleName(toModule);

            // Create nodes
            if (!seenNodes.has(fromName)) {
                seenNodes.add(fromName);
                nodes.push({
                    id: `module:${fromName}`,
                    kind: 'module',
                    name: fromName,
                    path: fromName,
                    meta: {
                        language: 'go',
                        version: this.extractVersion(fromModule),
                        source: 'go-mod-graph',
                    },
                });
            }

            if (!seenNodes.has(toName)) {
                seenNodes.add(toName);
                nodes.push({
                    id: `module:${toName}`,
                    kind: 'module',
                    name: toName,
                    path: toName,
                    meta: {
                        language: 'go',
                        version: this.extractVersion(toModule),
                        source: 'go-mod-graph',
                    },
                });
            }

            // Create edge
            edges.push({
                id: `edge:${fromName}:imports:${toName}`,
                from: `module:${fromName}`,
                to: `module:${toName}`,
                kind: 'imports',
                confidence: 'high',
                reason: 'go mod graph',
                meta: {
                    fromVersion: this.extractVersion(fromModule),
                    toVersion: this.extractVersion(toModule),
                    source: 'go-mod-graph',
                },
            });
        }

        logger.info(`Converted ${nodes.length} modules, ${edges.length} dependencies from go mod graph`);
        return { nodes, edges, issues };
    }

    /**
     * Extract module name without version
     */
    private extractModuleName(moduleWithVersion: string): string {
        const atIndex = moduleWithVersion.lastIndexOf('@');
        if (atIndex > 0) {
            return moduleWithVersion.substring(0, atIndex);
        }
        return moduleWithVersion;
    }

    /**
     * Extract version from module string
     */
    private extractVersion(moduleWithVersion: string): string | undefined {
        const atIndex = moduleWithVersion.lastIndexOf('@');
        if (atIndex > 0) {
            return moduleWithVersion.substring(atIndex + 1);
        }
        return undefined;
    }

    /**
     * Check if this adapter should be used for a file
     */
    supportsFile(filePath: string): boolean {
        return filePath.endsWith('.go');
    }

    /**
     * Get installation instructions
     */
    static getInstallInstructions(): string {
        return `
Go mod graph is built into the Go toolchain.

Requirements:
1. Go installed (https://go.dev/dl/)
2. Project has go.mod file

To initialize a Go module:
  go mod init your-module-name

Benefits:
- Accurate module-level dependency analysis
- Handles replace directives
- Works with Go workspaces
`.trim();
    }
}

/**
 * Check if go mod graph should be recommended for a project
 */
export function shouldRecommendGoModGraph(workspaceRoot: string): boolean {
    const goModPath = path.join(workspaceRoot, 'go.mod');
    return fs.existsSync(goModPath);
}
