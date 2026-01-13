/**
 * Dependency Cruiser Adapter
 * 
 * Integrates dependency-cruiser for JS/TS projects.
 * dependency-cruiser is bundled with the extension as a dependency,
 * and we use its CLI via the bundled binary.
 * 
 * Why use dependency-cruiser?
 * - 10+ years of development, handles countless edge cases
 * - Native support for tsconfig paths, ESM, CommonJS, AMD
 * - Handles dynamic imports, re-exports, barrel files correctly
 * - Actively maintained with excellent TypeScript support
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import type { GraphNode, GraphEdge, GraphIssue, IssueKind } from '../core/types';
import { createLogger } from '../../utils/logger';

const logger = createLogger('DependencyCruiserAdapter');

/**
 * Dependency cruiser module info (from its JSON output)
 */
interface DCModule {
    source: string;
    dependencies: Array<{
        module: string;
        resolved: string;
        coreModule: boolean;
        dependencyTypes: string[];
        dynamic: boolean;
        exoticallyRequired: boolean;
        matchesDoNotFollow: boolean;
        couldNotResolve: boolean;
        circular?: boolean;
        cycle?: string[];
    }>;
    orphan?: boolean;
    valid: boolean;
}

/**
 * Dependency cruiser output format
 */
interface DCOutput {
    modules: DCModule[];
    summary: {
        violations: Array<{
            type: string;
            from: string;
            to: string;
            rule: { severity: string; name: string };
            cycle?: string[];
        }>;
        error: number;
        warn: number;
        info: number;
        totalCruised: number;
        totalDependenciesCruised: number;
    };
}

/**
 * Adapter configuration
 */
export interface DependencyCruiserConfig {
    /** Whether to use dependency-cruiser when available */
    enabled: boolean;
    /** Directories to analyze */
    include?: string[];
    /** Directories to exclude */
    exclude?: string[];
    /** Whether to detect circular dependencies */
    detectCircular?: boolean;
    /** Whether to detect orphans */
    detectOrphans?: boolean;
    /** Timeout for CLI execution (ms) */
    timeout?: number;
}

const DEFAULT_CONFIG: DependencyCruiserConfig = {
    enabled: true,
    include: ['src', 'app', 'lib', 'client', 'server', 'pages', 'components', 'utils', 'hooks', 'services', 'api'],
    exclude: ['node_modules', 'dist', 'coverage', '.git', '.wasp', 'build', 'out'],
    detectCircular: true,
    detectOrphans: true,
    timeout: 60000,
};

export class DependencyCruiserAdapter {
    private config: DependencyCruiserConfig;
    private workspaceRoot: string;
    private extensionPath: string | null;
    private isAvailable: boolean | null = null;
    private dcPath: string | null = null;

    constructor(workspaceRoot: string, config?: Partial<DependencyCruiserConfig>, extensionPath?: string) {
        this.workspaceRoot = workspaceRoot;
        this.extensionPath = extensionPath ?? null;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Check if dependency-cruiser is available
     * First checks bundled version (in dist/node_modules for production),
     * then extension's node_modules (for development), then local/global installations
     */
    async checkAvailability(): Promise<boolean> {
        if (this.isAvailable !== null) {
            return this.isAvailable;
        }

        const isWindows = process.platform === 'win32';
        const extensionRoot = this.extensionPath ?? this.findExtensionRoot();

        if (extensionRoot) {
            // Check dist/node_modules first (production - copied by copy-dependency-cruiser.js)
            const distBundledPath = path.join(extensionRoot, 'dist', 'node_modules', '.bin', 'depcruise');
            const distBundledPathWin = path.join(extensionRoot, 'dist', 'node_modules', '.bin', 'depcruise.cmd');
            
            if (isWindows) {
                if (fs.existsSync(distBundledPathWin)) {
                    this.dcPath = distBundledPathWin;
                    this.isAvailable = true;
                    logger.info('Found bundled dependency-cruiser in dist (Windows)', { path: distBundledPathWin });
                    return true;
                }
            } else {
                if (fs.existsSync(distBundledPath)) {
                    this.dcPath = distBundledPath;
                    this.isAvailable = true;
                    logger.info('Found bundled dependency-cruiser in dist', { path: distBundledPath });
                    return true;
                }
            }

            // Check extension's node_modules (development)
            const bundledPath = path.join(extensionRoot, 'node_modules', '.bin', 'depcruise');
            const bundledPathWin = path.join(extensionRoot, 'node_modules', '.bin', 'depcruise.cmd');
            
            if (isWindows) {
                if (fs.existsSync(bundledPathWin)) {
                    this.dcPath = bundledPathWin;
                    this.isAvailable = true;
                    logger.info('Found bundled dependency-cruiser (Windows)', { path: bundledPathWin });
                    return true;
                }
            } else {
                if (fs.existsSync(bundledPath)) {
                    this.dcPath = bundledPath;
                    this.isAvailable = true;
                    logger.info('Found bundled dependency-cruiser', { path: bundledPath });
                    return true;
                }
            }
        }

        // Fallback: Check for local installation in workspace
        const localPath = path.join(this.workspaceRoot, 'node_modules', '.bin', 'depcruise');
        const localPathWin = path.join(this.workspaceRoot, 'node_modules', '.bin', 'depcruise.cmd');
        
        if (isWindows) {
            if (fs.existsSync(localPathWin)) {
                this.dcPath = localPathWin;
                this.isAvailable = true;
                logger.info('Found local dependency-cruiser installation (Windows)');
                return true;
            }
        } else {
            if (fs.existsSync(localPath)) {
                this.dcPath = localPath;
                this.isAvailable = true;
                logger.info('Found local dependency-cruiser installation');
                return true;
            }
        }

        this.isAvailable = false;
        logger.warn('dependency-cruiser not available');
        return false;
    }

    /**
     * Find the extension root directory
     */
    private findExtensionRoot(): string | null {
        // In development, __dirname points to dist/
        // In production, it's inside the extension folder
        try {
            // Try to find package.json with our extension name
            let currentDir = __dirname;
            for (let i = 0; i < 5; i++) {
                const pkgPath = path.join(currentDir, 'package.json');
                if (fs.existsSync(pkgPath)) {
                    try {
                        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                        if (pkg.name === 'ouroboros-ai') {
                            return currentDir;
                        }
                    } catch {
                        // Continue searching
                    }
                }
                currentDir = path.dirname(currentDir);
            }
        } catch {
            // Ignore errors
        }
        return null;
    }

    /**
     * Run dependency-cruiser and get results
     */
    async analyze(): Promise<{ nodes: GraphNode[]; edges: GraphEdge[]; issues: GraphIssue[] } | null> {
        if (!this.config.enabled) {
            return null;
        }

        const available = await this.checkAvailability();
        if (!available || !this.dcPath) {
            return null;
        }

        try {
            const output = await this.runDependencyCruiser();
            if (!output) {
                return null;
            }

            return this.convertOutput(output);
        } catch (error) {
            logger.error('Failed to run dependency-cruiser:', error);
            return null;
        }
    }

    /**
     * Run dependency-cruiser CLI and parse output
     */
    private async runDependencyCruiser(): Promise<DCOutput | null> {
        return new Promise((resolve) => {
            // Find directories to analyze
            let includePaths = (this.config.include ?? ['src'])
                .filter(p => fs.existsSync(path.join(this.workspaceRoot, p)));

            // If no configured directories exist, try to auto-detect source directories
            if (includePaths.length === 0) {
                includePaths = this.autoDetectSourceDirs();
            }

            if (includePaths.length === 0) {
                logger.debug('No source directories found');
                resolve(null);
                return;
            }

            logger.debug(`Analyzing directories: ${includePaths.join(', ')}`);

            // Build exclude pattern for dependency-cruiser
            // Use simple directory names - dependency-cruiser handles the matching
            const excludeDirs = this.config.exclude ?? [];
            // dependency-cruiser expects a regex pattern, not glob
            // Escape special regex characters (especially . for directories like .wasp, .git)
            const excludePattern = excludeDirs
                .map(d => d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                .join('|');
            
            const isWindows = process.platform === 'win32';
            
            // Build args
            const args = [
                '--output-type', 'json',
                '--no-config',
            ];
            
            // Add exclude pattern if we have exclusions
            // On Windows, wrap pattern in quotes to prevent | being interpreted as pipe
            if (excludePattern) {
                if (isWindows) {
                    args.push('--exclude', `"${excludePattern}"`);
                } else {
                    args.push('--exclude', excludePattern);
                }
            }
            
            // Add do-not-follow for node_modules
            args.push('--do-not-follow', 'node_modules');
            
            // Add source directories
            args.push(...includePaths);

            logger.debug(`Running: ${this.dcPath} ${args.join(' ')}`);

            const dcPath = this.dcPath;
            if (!dcPath) {
                resolve(null);
                return;
            }

            // Cross-platform spawn configuration
            const isWindowsPlatform = process.platform === 'win32';
            
            const proc = spawn(dcPath, args, {
                cwd: this.workspaceRoot,
                timeout: this.config.timeout,
                // On Windows, use shell to handle .cmd files
                // The special characters in args are already quoted
                shell: isWindowsPlatform,
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
                // code 0 = success, code 1 = violations found (still valid output)
                if (code !== 0 && code !== 1) {
                    logger.warn(`dependency-cruiser exited with code ${code}: ${stderr}`);
                    resolve(null);
                    return;
                }

                // Check for empty output
                if (!stdout.trim()) {
                    logger.debug('dependency-cruiser returned empty output');
                    if (stderr) {
                        logger.debug(`stderr: ${stderr}`);
                    }
                    resolve(null);
                    return;
                }

                try {
                    const output = JSON.parse(stdout) as DCOutput;
                    
                    // Validate output structure
                    if (!output.modules || !Array.isArray(output.modules)) {
                        logger.warn('dependency-cruiser output missing modules array');
                        logger.debug(`Output keys: ${Object.keys(output).join(', ')}`);
                        resolve(null);
                        return;
                    }
                    
                    logger.debug(`dependency-cruiser found ${output.modules.length} modules`);
                    resolve(output);
                } catch {
                    logger.error('Failed to parse dependency-cruiser output:', stdout.substring(0, 200));
                    resolve(null);
                }
            });

            proc.on('error', (error) => {
                logger.error('Failed to spawn dependency-cruiser:', error);
                resolve(null);
            });
        });
    }

    /**
     * Convert dependency-cruiser output to our graph format
     */
    private convertOutput(output: DCOutput): { nodes: GraphNode[]; edges: GraphEdge[]; issues: GraphIssue[] } {
        const nodes: GraphNode[] = [];
        const edges: GraphEdge[] = [];
        const issues: GraphIssue[] = [];
        const seenNodes = new Set<string>();

        for (const module of output.modules) {
            const filePath = module.source;
            const nodeId = `file:${filePath}`;

            // Create file node
            if (!seenNodes.has(nodeId)) {
                seenNodes.add(nodeId);
                const fileName = filePath.split('/').pop() ?? filePath;
                
                nodes.push({
                    id: nodeId,
                    kind: 'file',
                    name: fileName,
                    path: filePath,
                    meta: {
                        language: this.detectLanguage(filePath),
                        orphan: module.orphan,
                        valid: module.valid,
                        source: 'dependency-cruiser',
                    },
                });

                // Create orphan issue
                if (module.orphan && this.config.detectOrphans) {
                    issues.push({
                        id: `issue:orphan:${nodeId}`,
                        kind: 'HANDLER_UNREACHABLE',
                        severity: 'warning',
                        nodeId,
                        title: `Orphan file: ${fileName}`,
                        evidence: ['File is not imported by any other file'],
                        suggestedFix: ['Import this file from another module', 'Remove if unused'],
                        meta: { filePath, source: 'dependency-cruiser' },
                    });
                }
            }

            // Create edges for dependencies
            for (const dep of module.dependencies) {
                // Skip core modules and unresolved
                if (dep.coreModule || dep.couldNotResolve) {
                    continue;
                }

                // Skip external dependencies
                if (dep.dependencyTypes.some(t => 
                    t === 'npm' || t === 'npm-dev' || t === 'npm-peer' || t === 'npm-optional'
                )) {
                    continue;
                }

                const targetPath = dep.resolved;
                const targetNodeId = `file:${targetPath}`;
                const edgeId = `edge:${filePath}:imports:${targetPath}`;

                edges.push({
                    id: edgeId,
                    from: nodeId,
                    to: targetNodeId,
                    kind: 'imports',
                    confidence: 'high',
                    reason: dep.dynamic ? 'dynamic import (dc)' : 'static import (dc)',
                    meta: {
                        importPath: dep.module,
                        isDynamic: dep.dynamic,
                        dependencyTypes: dep.dependencyTypes,
                        source: 'dependency-cruiser',
                    },
                });

                // Create circular dependency issue
                if (dep.circular && dep.cycle && this.config.detectCircular) {
                    issues.push({
                        id: `issue:circular:${edgeId}`,
                        kind: 'CIRCULAR_DEPENDENCY',
                        severity: 'warning',
                        nodeId,
                        title: `Circular dependency detected`,
                        evidence: [`Cycle: ${dep.cycle.join(' → ')}`],
                        suggestedFix: ['Break the cycle by extracting shared code'],
                        meta: { 
                            filePath, 
                            cycle: dep.cycle,
                            source: 'dependency-cruiser',
                        },
                    });
                }
            }
        }

        // Add violations as issues
        for (const violation of output.summary.violations) {
            const severity = violation.rule.severity === 'error' ? 'error' : 
                            violation.rule.severity === 'warn' ? 'warning' : 'info';
            
            issues.push({
                id: `issue:dc:${violation.rule.name}:${violation.from}:${violation.to}`,
                kind: this.mapViolationType(violation.type),
                severity,
                nodeId: `file:${violation.from}`,
                title: `${violation.rule.name}: ${violation.from} → ${violation.to}`,
                evidence: [
                    `Rule: ${violation.rule.name}`,
                    `Type: ${violation.type}`,
                    violation.cycle ? `Cycle: ${violation.cycle.join(' → ')}` : '',
                ].filter(Boolean),
                suggestedFix: ['Review the dependency and fix according to rule'],
                meta: {
                    from: violation.from,
                    to: violation.to,
                    rule: violation.rule.name,
                    cycle: violation.cycle,
                    source: 'dependency-cruiser',
                },
            });
        }

        logger.info(`Converted ${nodes.length} nodes, ${edges.length} edges, ${issues.length} issues from dependency-cruiser`);
        return { nodes, edges, issues };
    }

    /**
     * Map dependency-cruiser violation type to our issue kind
     */
    private mapViolationType(type: string): IssueKind {
        switch (type) {
            case 'cycle':
                return 'CIRCULAR_DEPENDENCY';
            case 'orphan':
                return 'HANDLER_UNREACHABLE';
            case 'not-reachable':
                return 'HANDLER_UNREACHABLE';
            default:
                return 'BROKEN_EXPORT_CHAIN';
        }
    }

    /**
     * Detect language from file extension
     */
    private detectLanguage(filePath: string): string {
        if (filePath.endsWith('.tsx')) return 'tsx';
        if (filePath.endsWith('.ts') || filePath.endsWith('.mts') || filePath.endsWith('.cts')) return 'typescript';
        if (filePath.endsWith('.jsx')) return 'jsx';
        if (filePath.endsWith('.mjs')) return 'esm';
        if (filePath.endsWith('.cjs')) return 'commonjs';
        return 'javascript';
    }

    /**
     * Check if this adapter should be used for a file
     */
    supportsFile(filePath: string): boolean {
        const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts'];
        return extensions.some(ext => filePath.endsWith(ext));
    }

    /**
     * Auto-detect source directories by looking for directories containing JS/TS files
     */
    private autoDetectSourceDirs(): string[] {
        const detected: string[] = [];
        const excludeDirs = new Set(this.config.exclude ?? []);
        
        try {
            const entries = fs.readdirSync(this.workspaceRoot, { withFileTypes: true });
            
            for (const entry of entries) {
                if (!entry.isDirectory()) continue;
                if (excludeDirs.has(entry.name)) continue;
                if (entry.name.startsWith('.')) continue;
                
                const dirPath = path.join(this.workspaceRoot, entry.name);
                
                // Check if directory contains any JS/TS files (recursively, but shallow check first)
                if (this.containsJsTsFiles(dirPath)) {
                    detected.push(entry.name);
                }
            }
            
            // Also check for JS/TS files in root (for projects without src folder)
            const rootFiles = entries.filter(e => 
                e.isFile() && this.supportsFile(e.name)
            );
            if (rootFiles.length > 0 && detected.length === 0) {
                // If there are JS/TS files in root but no source dirs, analyze root
                detected.push('.');
            }
            
            logger.debug(`Auto-detected source directories: ${detected.join(', ') || 'none'}`);
        } catch (error) {
            logger.debug('Failed to auto-detect source directories:', error);
        }
        
        return detected;
    }

    /**
     * Check if a directory contains JS/TS files (shallow check)
     */
    private containsJsTsFiles(dirPath: string): boolean {
        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                if (entry.isFile() && this.supportsFile(entry.name)) {
                    return true;
                }
                // Check one level deep for common patterns
                if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                    const subPath = path.join(dirPath, entry.name);
                    try {
                        const subEntries = fs.readdirSync(subPath);
                        if (subEntries.some(f => this.supportsFile(f))) {
                            return true;
                        }
                    } catch {
                        // Ignore permission errors
                    }
                }
            }
        } catch {
            // Ignore errors
        }
        return false;
    }

    /**
     * Get installation instructions
     */
    static getInstallInstructions(): string {
        return `
dependency-cruiser is bundled with the Ouroboros extension.
No additional installation required!

To enable enhanced JS/TS dependency analysis, set in .ouroboros/graph/config.json:
{
  "externalTools": {
    "preferExternal": true,
    "javascript": { "tool": "auto" }
  }
}
`.trim();
    }
}

/**
 * Check if dependency-cruiser should be recommended for a project
 */
export function shouldRecommendDependencyCruiser(workspaceRoot: string): boolean {
    // Check if it's a JS/TS project
    const packageJsonPath = path.join(workspaceRoot, 'package.json');
    return fs.existsSync(packageJsonPath);
}
