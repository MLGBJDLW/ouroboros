/**
 * Entrypoint Detector
 * Detects and classifies entrypoints across different frameworks
 */

import type { GraphNode, EntrypointType, Confidence } from '../core/types';

export interface EntrypointPattern {
    glob: string;
    type: EntrypointType;
    framework: string;
    confidence: Confidence;
}

// Default entrypoint patterns for common frameworks
const DEFAULT_PATTERNS: EntrypointPattern[] = [
    // Next.js App Router
    { glob: '**/app/**/page.{ts,tsx,js,jsx}', type: 'page', framework: 'nextjs', confidence: 'high' },
    { glob: '**/app/**/route.{ts,tsx,js,jsx}', type: 'api', framework: 'nextjs', confidence: 'high' },
    { glob: '**/app/**/layout.{ts,tsx,js,jsx}', type: 'page', framework: 'nextjs', confidence: 'high' },
    // Next.js Pages Router
    { glob: '**/pages/**/*.{ts,tsx,js,jsx}', type: 'page', framework: 'nextjs', confidence: 'high' },
    { glob: '**/pages/api/**/*.{ts,tsx,js,jsx}', type: 'api', framework: 'nextjs', confidence: 'high' },
    // Express/Koa routes
    { glob: '**/routes/**/*.{ts,js}', type: 'route', framework: 'express', confidence: 'medium' },
    { glob: '**/controllers/**/*.{ts,js}', type: 'route', framework: 'express', confidence: 'medium' },
    // NestJS
    { glob: '**/*.controller.{ts,js}', type: 'route', framework: 'nestjs', confidence: 'high' },
    { glob: '**/*.module.{ts,js}', type: 'main', framework: 'nestjs', confidence: 'medium' },
    // CLI
    { glob: '**/commands/**/*.{ts,js}', type: 'command', framework: 'cli', confidence: 'medium' },
    { glob: '**/bin/**/*.{ts,js}', type: 'command', framework: 'cli', confidence: 'medium' },
    // Jobs/Workers
    { glob: '**/jobs/**/*.{ts,js}', type: 'job', framework: 'worker', confidence: 'medium' },
    { glob: '**/workers/**/*.{ts,js}', type: 'job', framework: 'worker', confidence: 'medium' },
    { glob: '**/queues/**/*.{ts,js}', type: 'job', framework: 'worker', confidence: 'medium' },
    // Main entry
    { glob: '**/main.{ts,js}', type: 'main', framework: 'generic', confidence: 'medium' },
    { glob: '**/index.{ts,js}', type: 'main', framework: 'generic', confidence: 'low' },
    { glob: '**/server.{ts,js}', type: 'main', framework: 'generic', confidence: 'medium' },
    { glob: '**/app.{ts,js}', type: 'main', framework: 'generic', confidence: 'medium' },
];

export class EntrypointDetector {
    private patterns: EntrypointPattern[];

    constructor(customPatterns?: EntrypointPattern[]) {
        this.patterns = customPatterns ?? DEFAULT_PATTERNS;
    }

    /**
     * Detect if a file path matches any entrypoint pattern
     */
    detect(filePath: string): {
        type: EntrypointType;
        framework: string;
        confidence: Confidence;
    } | null {
        for (const pattern of this.patterns) {
            if (this.matchGlob(filePath, pattern.glob)) {
                return {
                    type: pattern.type,
                    framework: pattern.framework,
                    confidence: pattern.confidence,
                };
            }
        }
        return null;
    }

    /**
     * Create an entrypoint node from detection result
     */
    createEntrypointNode(
        filePath: string,
        detection: { type: EntrypointType; framework: string; confidence: Confidence }
    ): GraphNode {
        const name = filePath.split('/').pop() ?? filePath;
        return {
            id: `entrypoint:${filePath}`,
            kind: 'entrypoint',
            name,
            path: filePath,
            meta: {
                entrypointType: detection.type,
                framework: detection.framework,
                confidence: detection.confidence,
            },
        };
    }

    /**
     * Simple glob matching (supports * and **)
     */
    private matchGlob(filePath: string, glob: string): boolean {
        // Normalize paths
        const normalizedPath = filePath.replace(/\\/g, '/');
        const normalizedGlob = glob.replace(/\\/g, '/');

        // Convert glob to regex
        const regexStr = normalizedGlob
            .replace(/\./g, '\\.')
            .replace(/\*\*/g, '{{DOUBLESTAR}}')
            .replace(/\*/g, '[^/]*')
            .replace(/{{DOUBLESTAR}}/g, '.*')
            .replace(/\{([^}]+)\}/g, (_, group) => `(${group.split(',').join('|')})`);

        const regex = new RegExp(`^${regexStr}$`);
        return regex.test(normalizedPath);
    }

    /**
     * Add custom patterns
     */
    addPatterns(patterns: EntrypointPattern[]): void {
        this.patterns = [...patterns, ...this.patterns];
    }

    /**
     * Get all patterns
     */
    getPatterns(): EntrypointPattern[] {
        return [...this.patterns];
    }
}
