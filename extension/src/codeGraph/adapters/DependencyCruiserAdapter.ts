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
    private isAvailable: boolean | null = null;
    private dcPath: string | null = null;

    constructor(workspaceRoot: string, config?: Partial<DependencyCruiserConfig>) {
        this.workspaceRoot = workspaceRoot;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Check if dependency-cruiser is available
     * Checks workspace local installation (supports npm, yarn, pnpm)
     */
    async checkAvailability(): Promise<boolean> {
        if (this.isAvailable !== null) {
            return this.isAvailable;
        }

        const isWindows = process.platform === 'win32';
        const binName = isWindows ? 'depcruise.cmd' : 'depcruise';

        // Check multiple possible locations for different package managers
        const possiblePaths = [
            // npm/yarn: node_modules/.bin/
            path.join(this.workspaceRoot, 'node_modules', '.bin', binName),
            // pnpm: may also be in node_modules/.bin/ as symlink
            // Check if the binary exists and is executable
        ];

        logger.debug('Checking dependency-cruiser at:', { localPath: possiblePaths[0] });

        for (const localPath of possiblePaths) {
            if (fs.existsSync(localPath)) {
                this.dcPath = localPath;
                this.isAvailable = true;
                logger.info('Found local dependency-cruiser installation', { path: localPath });
                return true;
            }
        }

        // For pnpm workspaces, also check if we can resolve via pnpm
        // Try to find depcruise by checking if the package is installed
        const pnpmBinPath = await this.findPnpmBinary(binName);
        if (pnpmBinPath) {
            this.dcPath = pnpmBinPath;
            this.isAvailable = true;
            logger.info('Found dependency-cruiser via pnpm', { path: pnpmBinPath });
            return true;
        }

        // For yarn berry (v2+) with PnP
        const yarnBerryPath = await this.findYarnBerryBinary(binName);
        if (yarnBerryPath) {
            this.dcPath = yarnBerryPath;
            this.isAvailable = true;
            logger.info('Found dependency-cruiser via yarn berry', { path: yarnBerryPath });
            return true;
        }

        this.isAvailable = false;
        logger.debug('dependency-cruiser not installed in workspace');
        return false;
    }

    /**
     * Find binary in pnpm workspace structure
     * pnpm may install binaries in workspace root or use different symlink structure
     */
    private async findPnpmBinary(binName: string): Promise<string | null> {
        // Check workspace root's node_modules/.bin (for pnpm -w installs)
        let currentDir = this.workspaceRoot;

        // Walk up to find workspace root (look for pnpm-workspace.yaml)
        for (let i = 0; i < 5; i++) {
            const workspaceYaml = path.join(currentDir, 'pnpm-workspace.yaml');
            const binPath = path.join(currentDir, 'node_modules', '.bin', binName);

            if (fs.existsSync(workspaceYaml) && fs.existsSync(binPath)) {
                logger.debug('Found pnpm workspace root with binary', { root: currentDir, binPath });
                return binPath;
            }

            const parent = path.dirname(currentDir);
            if (parent === currentDir) break;
            currentDir = parent;
        }

        return null;
    }

    /**
     * Find binary in yarn berry (v2+) PnP structure
     * Yarn berry uses Plug'n'Play without node_modules
     */
    private async findYarnBerryBinary(binName: string): Promise<string | null> {
        let currentDir = this.workspaceRoot;

        // Walk up to find yarn berry workspace (look for .yarnrc.yml)
        for (let i = 0; i < 5; i++) {
            const yarnrcPath = path.join(currentDir, '.yarnrc.yml');

            if (fs.existsSync(yarnrcPath)) {
                // Check .yarn/unplugged for the binary
                const unpluggedDir = path.join(currentDir, '.yarn', 'unplugged');
                if (fs.existsSync(unpluggedDir)) {
                    try {
                        const entries = fs.readdirSync(unpluggedDir);
                        for (const entry of entries) {
                            if (entry.startsWith('dependency-cruiser-')) {
                                const dcBinPath = path.join(
                                    unpluggedDir, entry, 'node_modules', 'dependency-cruiser', 'bin', 'dependency-cruise.mjs'
                                );
                                if (fs.existsSync(dcBinPath)) {
                                    logger.debug('Found yarn berry unplugged binary', { path: dcBinPath });
                                    return dcBinPath;
                                }
                            }
                        }
                    } catch {
                        // Ignore errors
                    }
                }

                // Also check node_modules/.bin in case yarn is in node-modules linker mode
                const binPath = path.join(currentDir, 'node_modules', '.bin', binName);
                if (fs.existsSync(binPath)) {
                    logger.debug('Found yarn berry binary in node_modules mode', { path: binPath });
                    return binPath;
                }
            }

            const parent = path.dirname(currentDir);
            if (parent === currentDir) break;
            currentDir = parent;
        }

        return null;
    }

    /**
     * Find the extension root directory by searching up from __dirname
     */
    private findExtensionRoot(): string | null {
        try {
            let currentDir = __dirname;
            for (let i = 0; i < 10; i++) {
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
                const parent = path.dirname(currentDir);
                if (parent === currentDir) break;
                currentDir = parent;
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

            logger.debug(`Auto-detected source directories: ${includePaths.join(', ')}`);
            logger.debug(`Analyzing directories: ${includePaths.join(', ')}`);

            // Build exclude pattern - escape regex special chars
            const excludeDirs = this.config.exclude ?? [];
            const excludePattern = excludeDirs
                .map(d => d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                .join('|');

            const isWindows = process.platform === 'win32';

            // Build args
            const args = [
                '--output-type', 'json',
                '--no-config',
            ];

            // Add exclude pattern
            if (excludePattern) {
                args.push('--exclude', isWindows ? `"${excludePattern}"` : excludePattern);
            }

            args.push('--do-not-follow', 'node_modules');
            args.push(...includePaths);

            logger.debug(`Running: ${this.dcPath} ${args.join(' ')}`);

            const dcPath = this.dcPath;
            if (!dcPath) {
                resolve(null);
                return;
            }

            const proc = spawn(dcPath, args, {
                cwd: this.workspaceRoot,
                timeout: this.config.timeout,
                shell: isWindows,
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
                if (code !== 0 && code !== 1) {
                    logger.warn(`dependency-cruiser exited with code ${code}: ${stderr}`);
                    resolve(null);
                    return;
                }

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

                    if (!output.modules || !Array.isArray(output.modules)) {
                        logger.warn('dependency-cruiser output missing modules array');
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

                // Only report orphans that are not expected to be orphans
                if (module.orphan && this.config.detectOrphans && !this.shouldSkipOrphan(filePath)) {
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

            for (const dep of module.dependencies) {
                if (dep.coreModule || dep.couldNotResolve) continue;
                if (dep.dependencyTypes.some(t =>
                    t === 'npm' || t === 'npm-dev' || t === 'npm-peer' || t === 'npm-optional'
                )) continue;

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

                if (dep.circular && dep.cycle && this.config.detectCircular) {
                    issues.push({
                        id: `issue:circular:${edgeId}`,
                        kind: 'CIRCULAR_DEPENDENCY',
                        severity: 'warning',
                        nodeId,
                        title: `Circular dependency detected`,
                        evidence: [`Cycle: ${dep.cycle.join(' → ')}`],
                        suggestedFix: ['Break the cycle by extracting shared code'],
                        meta: { filePath, cycle: dep.cycle, source: 'dependency-cruiser' },
                    });
                }
            }
        }

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

    private mapViolationType(type: string): IssueKind {
        switch (type) {
            case 'cycle': return 'CIRCULAR_DEPENDENCY';
            case 'orphan': return 'HANDLER_UNREACHABLE';
            case 'not-reachable': return 'HANDLER_UNREACHABLE';
            default: return 'BROKEN_EXPORT_CHAIN';
        }
    }

    private detectLanguage(filePath: string): string {
        if (filePath.endsWith('.tsx')) return 'tsx';
        if (filePath.endsWith('.ts') || filePath.endsWith('.mts') || filePath.endsWith('.cts')) return 'typescript';
        if (filePath.endsWith('.jsx')) return 'jsx';
        if (filePath.endsWith('.mjs')) return 'esm';
        if (filePath.endsWith('.cjs')) return 'commonjs';
        return 'javascript';
    }

    /**
     * Check if an orphan file should be skipped from reporting
     * These are files that are expected to be "orphans" (not imported by other files):
     * - Test files (.test.ts, .spec.ts, __tests__)
     * - Config files (vitest.config.ts, vite.config.ts, etc.)
     * - Type definition files (.d.ts)
     * - Entry point type files (types.ts in directories)
     */
    private shouldSkipOrphan(filePath: string): boolean {
        const skipPatterns = [
            /\.test\./,           // test.ts, test.tsx
            /\.spec\./,           // spec.ts, spec.tsx
            /__tests__/,          // __tests__ directories
            /\.config\./,         // vitest.config.ts, vite.config.ts, etc.
            /\.d\.ts$/,           // type definition files
            /node_modules/,       // node_modules
            /\/e2e\//,            // e2e test directories
            /\.setup\./,          // setup files (vitest.setup.ts)
            /\.stories\./,        // Storybook stories
        ];

        return skipPatterns.some((pattern) => pattern.test(filePath));
    }

    supportsFile(filePath: string): boolean {
        const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts'];
        return extensions.some(ext => filePath.endsWith(ext));
    }

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
                if (this.containsJsTsFiles(dirPath)) {
                    detected.push(entry.name);
                }
            }

            const rootFiles = entries.filter(e => e.isFile() && this.supportsFile(e.name));
            if (rootFiles.length > 0 && detected.length === 0) {
                detected.push('.');
            }
        } catch (error) {
            logger.debug('Failed to auto-detect source directories:', error);
        }

        return detected;
    }

    private containsJsTsFiles(dirPath: string): boolean {
        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                if (entry.isFile() && this.supportsFile(entry.name)) return true;
                if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                    const subPath = path.join(dirPath, entry.name);
                    try {
                        const subEntries = fs.readdirSync(subPath);
                        if (subEntries.some(f => this.supportsFile(f))) return true;
                    } catch { /* ignore */ }
                }
            }
        } catch { /* ignore */ }
        return false;
    }

    static getInstallInstructions(): string {
        return `
To enable enhanced JS/TS dependency analysis, install dependency-cruiser in your project:

  npm install --save-dev dependency-cruiser

Then refresh the Code Graph.
`.trim();
    }
}

export function shouldRecommendDependencyCruiser(workspaceRoot: string): boolean {
    const packageJsonPath = path.join(workspaceRoot, 'package.json');
    return fs.existsSync(packageJsonPath);
}
