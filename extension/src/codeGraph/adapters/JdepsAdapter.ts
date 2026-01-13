/**
 * Jdeps Adapter
 * 
 * Integrates JDK's built-in `jdeps` command for Java dependency analysis.
 * 
 * Why use jdeps?
 * - Built into JDK (8+), no extra installation needed
 * - Accurate class-level and package-level dependency information
 * - Supports Java 9+ module system
 * - Can analyze JAR files and class files
 * 
 * This adapter:
 * 1. Checks if JDK is available
 * 2. Runs `jdeps` with JSON output (JDK 9+) or parses text output
 * 3. Converts output to our GraphNode/GraphEdge format
 * 4. Falls back to JavaIndexer if not available
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync, spawn } from 'child_process';
import type { GraphNode, GraphEdge, GraphIssue } from '../core/types';
import { createLogger } from '../../utils/logger';

const logger = createLogger('JdepsAdapter');

/**
 * Adapter configuration
 */
export interface JdepsConfig {
    /** Whether to use jdeps when available */
    enabled: boolean;
    /** Paths to analyze (default: target/classes, build/classes) */
    classPaths?: string[];
    /** Whether to include JDK internal dependencies */
    includeJdkInternals?: boolean;
    /** Timeout for CLI execution (ms) */
    timeout?: number;
}

const DEFAULT_CONFIG: JdepsConfig = {
    enabled: true,
    classPaths: ['target/classes', 'build/classes/java/main', 'out/production'],
    includeJdkInternals: false,
    timeout: 60000,
};

export class JdepsAdapter {
    private config: JdepsConfig;
    private workspaceRoot: string;
    private isAvailable: boolean | null = null;
    private jdkVersion: number = 0;
    private jdepsPath: string | null = null;

    constructor(workspaceRoot: string, config?: Partial<JdepsConfig>) {
        this.workspaceRoot = workspaceRoot;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Check if jdeps is available
     */
    async checkAvailability(): Promise<boolean> {
        if (this.isAvailable !== null) {
            return this.isAvailable;
        }

        // Check if this is a Java project
        const hasJavaProject = this.detectJavaProject();
        if (!hasJavaProject) {
            this.isAvailable = false;
            logger.debug('No Java project detected');
            return false;
        }

        // Check if jdeps is installed
        try {
            const versionOutput = execSync('jdeps --version', { 
                encoding: 'utf8',
                timeout: 5000,
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            
            // Parse version (e.g., "jdeps 17.0.1" or "17.0.1")
            const versionMatch = versionOutput.match(/(\d+)\.(\d+)/);
            if (versionMatch) {
                this.jdkVersion = parseInt(versionMatch[1], 10);
            }
            
            this.jdepsPath = 'jdeps';
            this.isAvailable = true;
            logger.info(`jdeps available (JDK ${this.jdkVersion})`);
            return true;
        } catch {
            this.isAvailable = false;
            logger.debug('jdeps not available');
            return false;
        }
    }

    /**
     * Detect if this is a Java project
     */
    private detectJavaProject(): boolean {
        const indicators = [
            'pom.xml',
            'build.gradle',
            'build.gradle.kts',
            'settings.gradle',
            'settings.gradle.kts',
            '.classpath',
        ];

        for (const indicator of indicators) {
            if (fs.existsSync(path.join(this.workspaceRoot, indicator))) {
                return true;
            }
        }

        // Check for src/main/java directory
        if (fs.existsSync(path.join(this.workspaceRoot, 'src', 'main', 'java'))) {
            return true;
        }

        return false;
    }

    /**
     * Find compiled class directories
     */
    private findClassPaths(): string[] {
        const found: string[] = [];
        
        // First try configured paths
        for (const classPath of this.config.classPaths ?? []) {
            const fullPath = path.join(this.workspaceRoot, classPath);
            if (fs.existsSync(fullPath)) {
                found.push(fullPath);
            }
        }

        // If no configured paths found, try auto-detection
        if (found.length === 0) {
            const autoDetected = this.autoDetectClassPaths();
            found.push(...autoDetected);
        }

        return found;
    }

    /**
     * Auto-detect compiled class directories
     */
    private autoDetectClassPaths(): string[] {
        const detected: string[] = [];
        const commonPaths = [
            // Maven
            'target/classes',
            'target/test-classes',
            // Gradle
            'build/classes/java/main',
            'build/classes/java/test',
            'build/classes/kotlin/main',
            // IntelliJ
            'out/production',
            'out/test',
            // Eclipse
            'bin',
            // Generic
            'classes',
        ];

        for (const classPath of commonPaths) {
            const fullPath = path.join(this.workspaceRoot, classPath);
            if (fs.existsSync(fullPath) && this.containsClassFiles(fullPath)) {
                detected.push(fullPath);
            }
        }

        if (detected.length > 0) {
            logger.debug(`Auto-detected class paths: ${detected.join(', ')}`);
        }

        return detected;
    }

    /**
     * Check if directory contains .class files
     */
    private containsClassFiles(dirPath: string): boolean {
        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isFile() && entry.name.endsWith('.class')) {
                    return true;
                }
                if (entry.isDirectory()) {
                    const subPath = path.join(dirPath, entry.name);
                    if (this.containsClassFiles(subPath)) {
                        return true;
                    }
                }
            }
        } catch {
            // Ignore errors
        }
        return false;
    }

    /**
     * Run jdeps and get results
     */
    async analyze(): Promise<{ nodes: GraphNode[]; edges: GraphEdge[]; issues: GraphIssue[] } | null> {
        if (!this.config.enabled) {
            return null;
        }

        const available = await this.checkAvailability();
        if (!available) {
            return null;
        }

        const classPaths = this.findClassPaths();
        if (classPaths.length === 0) {
            logger.info('No compiled classes found, skipping jdeps analysis');
            return null;
        }

        try {
            const output = await this.runJdeps(classPaths);
            if (!output) {
                return null;
            }

            return this.convertOutput(output);
        } catch (error) {
            logger.error('Failed to run jdeps:', error);
            return null;
        }
    }

    /**
     * Run jdeps and parse output
     */
    private async runJdeps(classPaths: string[]): Promise<string | null> {
        return new Promise((resolve) => {
            const args = [
                '-verbose:class',
                '-R', // Recursive
            ];

            // JDK 9+ supports --multi-release
            if (this.jdkVersion >= 9) {
                args.push('--multi-release', 'base');
            }

            // Filter JDK internals
            if (!this.config.includeJdkInternals) {
                args.push('--ignore-missing-deps');
            }

            // Add class paths
            args.push(...classPaths);

            logger.debug(`Running: jdeps ${args.join(' ')}`);

            const proc = spawn('jdeps', args, {
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
                // jdeps may return non-zero for warnings
                if (code !== 0 && !stdout) {
                    logger.warn(`jdeps exited with code ${code}: ${stderr}`);
                    resolve(null);
                    return;
                }
                resolve(stdout);
            });

            proc.on('error', (error) => {
                logger.error('Failed to spawn jdeps:', error);
                resolve(null);
            });
        });
    }

    /**
     * Convert jdeps output to our graph format
     * 
     * Output format (verbose:class):
     *   com.example.Main (target/classes)
     *      -> java.lang.Object
     *      -> com.example.util.Helper
     */
    private convertOutput(output: string): { nodes: GraphNode[]; edges: GraphEdge[]; issues: GraphIssue[] } {
        const nodes: GraphNode[] = [];
        const edges: GraphEdge[] = [];
        const issues: GraphIssue[] = [];
        const seenNodes = new Set<string>();

        const lines = output.split('\n');
        let currentClass: string | null = null;
        let currentLocation: string | null = null;

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            // Check if this is a class definition line
            // Format: "com.example.Main (target/classes)"
            const classMatch = trimmed.match(/^([a-zA-Z_][\w.]*)\s+\(([^)]+)\)$/);
            if (classMatch) {
                currentClass = classMatch[1];
                currentLocation = classMatch[2];

                if (!seenNodes.has(currentClass)) {
                    seenNodes.add(currentClass);
                    nodes.push({
                        id: `class:${currentClass}`,
                        kind: 'module',
                        name: currentClass.split('.').pop() ?? currentClass,
                        path: this.classToPath(currentClass),
                        meta: {
                            language: 'java',
                            fullClassName: currentClass,
                            location: currentLocation,
                            source: 'jdeps',
                        },
                    });
                }
                continue;
            }

            // Check if this is a dependency line
            // Format: "   -> java.lang.Object" or "   -> com.example.Helper  target/classes"
            const depMatch = trimmed.match(/^->\s+([a-zA-Z_][\w.]*)/);
            if (depMatch && currentClass) {
                const depClass = depMatch[1];

                // Skip JDK classes unless configured
                if (!this.config.includeJdkInternals && this.isJdkClass(depClass)) {
                    continue;
                }

                // Create dependency node if not seen
                if (!seenNodes.has(depClass)) {
                    seenNodes.add(depClass);
                    nodes.push({
                        id: `class:${depClass}`,
                        kind: 'module',
                        name: depClass.split('.').pop() ?? depClass,
                        path: this.classToPath(depClass),
                        meta: {
                            language: 'java',
                            fullClassName: depClass,
                            source: 'jdeps',
                        },
                    });
                }

                // Create edge
                edges.push({
                    id: `edge:${currentClass}:imports:${depClass}`,
                    from: `class:${currentClass}`,
                    to: `class:${depClass}`,
                    kind: 'imports',
                    confidence: 'high',
                    reason: 'jdeps class dependency',
                    meta: {
                        source: 'jdeps',
                    },
                });
            }
        }

        logger.info(`Converted ${nodes.length} classes, ${edges.length} dependencies from jdeps`);
        return { nodes, edges, issues };
    }

    /**
     * Convert class name to file path
     */
    private classToPath(className: string): string {
        // com.example.Main -> src/main/java/com/example/Main.java
        const parts = className.split('.');
        return `src/main/java/${parts.join('/')}.java`;
    }

    /**
     * Check if class is from JDK
     */
    private isJdkClass(className: string): boolean {
        const jdkPrefixes = [
            'java.',
            'javax.',
            'jdk.',
            'sun.',
            'com.sun.',
            'org.w3c.',
            'org.xml.',
            'org.ietf.',
        ];
        return jdkPrefixes.some(prefix => className.startsWith(prefix));
    }

    /**
     * Check if this adapter should be used for a file
     */
    supportsFile(filePath: string): boolean {
        return filePath.endsWith('.java');
    }

    /**
     * Get installation instructions
     */
    static getInstallInstructions(): string {
        return `
jdeps is built into the JDK (Java 8+).

Requirements:
1. JDK installed (not just JRE)
2. Project compiled (classes in target/classes or build/classes)

To compile a Maven project:
  mvn compile

To compile a Gradle project:
  gradle compileJava

Benefits:
- Accurate class-level dependency analysis
- Supports Java 9+ module system
- Can detect JDK internal API usage
`.trim();
    }
}

/**
 * Check if jdeps should be recommended for a project
 */
export function shouldRecommendJdeps(workspaceRoot: string): boolean {
    const indicators = ['pom.xml', 'build.gradle', 'build.gradle.kts'];
    return indicators.some(f => fs.existsSync(path.join(workspaceRoot, f)));
}
