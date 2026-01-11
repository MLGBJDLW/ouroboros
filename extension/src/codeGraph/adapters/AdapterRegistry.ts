/**
 * Adapter Registry
 * Manages framework adapters and coordinates detection
 */

import * as fs from 'fs';
import * as path from 'path';
import type { GraphStore } from '../core/GraphStore';
import type { GraphNode, GraphEdge, GraphIssue } from '../core/types';
import type { FrameworkAdapter, FrameworkDetection, PackageJson } from './types';
import { createLogger } from '../../utils/logger';

const logger = createLogger('AdapterRegistry');

export class AdapterRegistry {
    private adapters: FrameworkAdapter[] = [];
    private detectedFrameworks: FrameworkDetection[] = [];

    /**
     * Register a framework adapter
     */
    register(adapter: FrameworkAdapter): void {
        // Avoid duplicates
        if (!this.adapters.some(a => a.name === adapter.name)) {
            this.adapters.push(adapter);
            logger.debug(`Registered adapter: ${adapter.name}`);
        }
    }

    /**
     * Get all registered adapters
     */
    getAdapters(): FrameworkAdapter[] {
        return [...this.adapters];
    }

    /**
     * Get adapter by name
     */
    getAdapter(name: string): FrameworkAdapter | undefined {
        return this.adapters.find(a => a.name === name);
    }

    /**
     * Detect which frameworks are used in the project
     */
    async detectFrameworks(projectRoot: string): Promise<FrameworkDetection[]> {
        const packageJson = await this.loadPackageJson(projectRoot);
        const detected: FrameworkDetection[] = [];

        for (const adapter of this.adapters) {
            try {
                const isDetected = await adapter.detect(projectRoot, packageJson);
                if (isDetected) {
                    const version = this.getFrameworkVersion(adapter.name, packageJson);
                    detected.push({
                        name: adapter.name,
                        displayName: adapter.displayName,
                        confidence: version ? 'high' : 'medium',
                        version,
                    });
                    logger.info(`Detected framework: ${adapter.displayName}`);
                }
            } catch (error) {
                logger.error(`Error detecting ${adapter.name}:`, error);
            }
        }

        this.detectedFrameworks = detected;
        return detected;
    }

    /**
     * Get detected frameworks
     */
    getDetectedFrameworks(): FrameworkDetection[] {
        return [...this.detectedFrameworks];
    }

    /**
     * Run all detected adapters to extract entrypoints
     */
    async extractAllEntrypoints(
        store: GraphStore,
        projectRoot: string
    ): Promise<GraphNode[]> {
        const allEntrypoints: GraphNode[] = [];

        for (const detection of this.detectedFrameworks) {
            const adapter = this.getAdapter(detection.name);
            if (!adapter) continue;

            try {
                const entrypoints = await adapter.extractEntrypoints(store, projectRoot);
                allEntrypoints.push(...entrypoints);
                logger.debug(`${adapter.displayName}: found ${entrypoints.length} entrypoints`);
            } catch (error) {
                logger.error(`Error extracting entrypoints for ${adapter.name}:`, error);
            }
        }

        return allEntrypoints;
    }

    /**
     * Run all detected adapters to extract registrations
     */
    async extractAllRegistrations(
        store: GraphStore,
        projectRoot: string
    ): Promise<GraphEdge[]> {
        const allEdges: GraphEdge[] = [];

        for (const detection of this.detectedFrameworks) {
            const adapter = this.getAdapter(detection.name);
            if (!adapter) continue;

            try {
                const edges = await adapter.extractRegistrations(store, projectRoot);
                allEdges.push(...edges);
                logger.debug(`${adapter.displayName}: found ${edges.length} registrations`);
            } catch (error) {
                logger.error(`Error extracting registrations for ${adapter.name}:`, error);
            }
        }

        return allEdges;
    }

    /**
     * Run all detected adapters to detect issues
     */
    async detectAllIssues(store: GraphStore): Promise<GraphIssue[]> {
        const allIssues: GraphIssue[] = [];

        for (const detection of this.detectedFrameworks) {
            const adapter = this.getAdapter(detection.name);
            if (!adapter?.detectIssues) continue;

            try {
                const issues = await adapter.detectIssues(store);
                allIssues.push(...issues);
            } catch (error) {
                logger.error(`Error detecting issues for ${adapter.name}:`, error);
            }
        }

        return allIssues;
    }

    /**
     * Load package.json from project root
     */
    private async loadPackageJson(projectRoot: string): Promise<PackageJson | undefined> {
        const pkgPath = path.join(projectRoot, 'package.json');
        
        try {
            const content = await fs.promises.readFile(pkgPath, 'utf-8');
            return JSON.parse(content) as PackageJson;
        } catch {
            return undefined;
        }
    }

    /**
     * Get framework version from package.json
     */
    private getFrameworkVersion(
        adapterName: string,
        packageJson?: PackageJson
    ): string | undefined {
        if (!packageJson) return undefined;

        const deps = {
            ...packageJson.dependencies,
            ...packageJson.devDependencies,
        };

        // Map adapter names to package names
        const packageMap: Record<string, string[]> = {
            express: ['express'],
            nextjs: ['next'],
            nestjs: ['@nestjs/core'],
            'commander-cli': ['commander'],
            'yargs-cli': ['yargs'],
            fastify: ['fastify'],
            koa: ['koa'],
            hono: ['hono'],
        };

        const packages = packageMap[adapterName] ?? [];
        for (const pkg of packages) {
            if (deps[pkg]) {
                return deps[pkg].replace(/[\^~]/, '');
            }
        }

        return undefined;
    }

    /**
     * Clear all adapters and detections
     */
    clear(): void {
        this.adapters = [];
        this.detectedFrameworks = [];
    }
}

// Singleton instance
let registryInstance: AdapterRegistry | null = null;

export function getAdapterRegistry(): AdapterRegistry {
    if (!registryInstance) {
        registryInstance = new AdapterRegistry();
    }
    return registryInstance;
}

export function resetAdapterRegistry(): void {
    registryInstance = null;
}
