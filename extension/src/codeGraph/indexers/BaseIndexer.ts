/**
 * Base Indexer
 * Abstract base class for language-specific indexers
 * 
 * Supports multi-language workspace package detection for monorepos:
 * - JavaScript/TypeScript: package.json workspaces, pnpm-workspace.yaml
 * - Python: pyproject.toml, setup.py, pip editable installs
 * - Go: go.work, go.mod replace directives
 * - Rust: Cargo.toml workspace members
 * - Java: Maven pom.xml modules, Gradle settings.gradle includes
 */

import * as fs from 'fs';
import * as path from 'path';
import type { IndexResult, GraphNode, GraphEdge, IndexError, Confidence } from '../core/types';

export interface IndexerOptions {
    workspaceRoot: string;
    include?: string[];
    exclude?: string[];
    maxFileSize?: number;
}

/**
 * Multi-language workspace cache structure
 */
export interface WorkspaceCache {
    // JavaScript/TypeScript packages (from package.json workspaces)
    jsPackages: Set<string>;
    // Python packages (from pyproject.toml, setup.py)
    pythonPackages: Set<string>;
    // Go modules (from go.work, go.mod replace)
    goModules: Set<string>;
    // Rust crates (from Cargo.toml workspace)
    rustCrates: Set<string>;
    // Java packages (from Maven/Gradle)
    javaPackages: Set<string>;
}

// Global cache for workspace packages
let workspaceCache: WorkspaceCache | null = null;
let workspaceCacheRoot: string | null = null;

// Legacy cache for backward compatibility
let workspacePackagesCache: Set<string> | null = null;
let workspacePackagesCacheRoot: string | null = null;

export abstract class BaseIndexer {
    protected workspaceRoot: string;
    protected include: string[];
    protected exclude: string[];
    protected maxFileSize: number;
    protected workspacePackages: Set<string>;
    protected workspaceData: WorkspaceCache;

    constructor(options: IndexerOptions) {
        this.workspaceRoot = options.workspaceRoot;
        this.include = options.include ?? ['**/*'];
        this.exclude = options.exclude ?? ['**/node_modules/**', '**/dist/**', '**/.git/**'];
        this.maxFileSize = options.maxFileSize ?? 1024 * 1024; // 1MB default
        this.workspaceData = this.loadAllWorkspacePackages();
        this.workspacePackages = this.workspaceData.jsPackages; // Legacy compatibility
    }

    /**
     * Load all workspace packages for all supported languages
     */
    private loadAllWorkspacePackages(): WorkspaceCache {
        // Use cache if available and for the same workspace
        if (workspaceCache && workspaceCacheRoot === this.workspaceRoot) {
            return workspaceCache;
        }

        const cache: WorkspaceCache = {
            jsPackages: new Set<string>(),
            pythonPackages: new Set<string>(),
            goModules: new Set<string>(),
            rustCrates: new Set<string>(),
            javaPackages: new Set<string>(),
        };

        // Load all language-specific workspace packages
        this.loadJsWorkspacePackages(cache.jsPackages);
        this.loadPythonWorkspacePackages(cache.pythonPackages);
        this.loadGoWorkspaceModules(cache.goModules);
        this.loadRustWorkspaceCrates(cache.rustCrates);
        this.loadJavaWorkspacePackages(cache.javaPackages);

        // Cache the result
        workspaceCache = cache;
        workspaceCacheRoot = this.workspaceRoot;

        // Also update legacy cache for backward compatibility
        workspacePackagesCache = cache.jsPackages;
        workspacePackagesCacheRoot = this.workspaceRoot;

        return cache;
    }

    /**
     * Load JavaScript/TypeScript workspace package names from package.json files in the monorepo
     */
    private loadJsWorkspacePackages(packages: Set<string>): void {
        try {
            // Read root package.json
            const rootPkgPath = path.join(this.workspaceRoot, 'package.json');
            if (fs.existsSync(rootPkgPath)) {
                const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf-8'));
                
                // Get workspace patterns from package.json
                const workspacePatterns: string[] = [];
                if (rootPkg.workspaces) {
                    if (Array.isArray(rootPkg.workspaces)) {
                        workspacePatterns.push(...rootPkg.workspaces);
                    } else if (rootPkg.workspaces.packages) {
                        workspacePatterns.push(...rootPkg.workspaces.packages);
                    }
                }
                
                // Also check pnpm-workspace.yaml
                const pnpmWorkspacePath = path.join(this.workspaceRoot, 'pnpm-workspace.yaml');
                if (fs.existsSync(pnpmWorkspacePath)) {
                    const content = fs.readFileSync(pnpmWorkspacePath, 'utf-8');
                    // Simple YAML parsing for packages array
                    const packagesMatch = content.match(/packages:\s*\n((?:\s+-\s+['"]?[^\n]+['"]?\n?)+)/);
                    if (packagesMatch) {
                        const lines = packagesMatch[1].split('\n');
                        for (const line of lines) {
                            const match = line.match(/^\s+-\s+['"]?([^'"]+)['"]?/);
                            if (match) {
                                workspacePatterns.push(match[1]);
                            }
                        }
                    }
                }
                
                // Scan workspace directories for package.json files
                for (const pattern of workspacePatterns) {
                    // Convert glob pattern to directory (remove trailing /*)
                    const baseDir = pattern.replace(/\/\*$/, '').replace(/\*$/, '');
                    const fullDir = path.join(this.workspaceRoot, baseDir);
                    
                    if (fs.existsSync(fullDir) && fs.statSync(fullDir).isDirectory()) {
                        // Check if it's a direct package or contains packages
                        const directPkgPath = path.join(fullDir, 'package.json');
                        if (fs.existsSync(directPkgPath)) {
                            try {
                                const pkg = JSON.parse(fs.readFileSync(directPkgPath, 'utf-8'));
                                if (pkg.name) {
                                    packages.add(pkg.name);
                                }
                            } catch {
                                // Ignore parse errors
                            }
                        }
                        
                        // Scan subdirectories
                        try {
                            const entries = fs.readdirSync(fullDir, { withFileTypes: true });
                            for (const entry of entries) {
                                if (entry.isDirectory() && !entry.name.startsWith('.')) {
                                    const subPkgPath = path.join(fullDir, entry.name, 'package.json');
                                    if (fs.existsSync(subPkgPath)) {
                                        try {
                                            const pkg = JSON.parse(fs.readFileSync(subPkgPath, 'utf-8'));
                                            if (pkg.name) {
                                                packages.add(pkg.name);
                                            }
                                        } catch {
                                            // Ignore parse errors
                                        }
                                    }
                                }
                            }
                        } catch {
                            // Ignore read errors
                        }
                    }
                }
            }
        } catch {
            // Ignore errors
        }
    }

    /**
     * Load Python workspace packages from pyproject.toml, setup.py, and pip editable installs
     */
    private loadPythonWorkspacePackages(packages: Set<string>): void {
        try {
            // Check pyproject.toml for project name and workspace packages
            const pyprojectPath = path.join(this.workspaceRoot, 'pyproject.toml');
            if (fs.existsSync(pyprojectPath)) {
                const content = fs.readFileSync(pyprojectPath, 'utf-8');
                
                // Extract project name: [project] name = "package-name"
                const projectNameMatch = content.match(/\[project\][\s\S]*?name\s*=\s*["']([^"']+)["']/);
                if (projectNameMatch) {
                    packages.add(projectNameMatch[1]);
                    // Also add underscore version (Python imports use underscores)
                    packages.add(projectNameMatch[1].replace(/-/g, '_'));
                }
                
                // Check for Poetry workspace packages
                const poetryPackagesMatch = content.match(/\[tool\.poetry\.packages\][\s\S]*?include\s*=\s*["']([^"']+)["']/g);
                if (poetryPackagesMatch) {
                    for (const match of poetryPackagesMatch) {
                        const includeMatch = match.match(/include\s*=\s*["']([^"']+)["']/);
                        if (includeMatch) {
                            packages.add(includeMatch[1]);
                        }
                    }
                }
                
                // Check for PDM workspace packages
                const pdmPackagesMatch = content.match(/\[tool\.pdm\.dev-dependencies\][\s\S]*?/);
                if (pdmPackagesMatch) {
                    // PDM uses path dependencies for workspace packages
                    const pathDepsMatch = content.match(/\{.*?path\s*=\s*["']([^"']+)["'].*?\}/g);
                    if (pathDepsMatch) {
                        for (const match of pathDepsMatch) {
                            const pathMatch = match.match(/path\s*=\s*["']([^"']+)["']/);
                            if (pathMatch) {
                                // Try to read the package name from the path
                                const pkgPath = path.join(this.workspaceRoot, pathMatch[1], 'pyproject.toml');
                                if (fs.existsSync(pkgPath)) {
                                    const pkgContent = fs.readFileSync(pkgPath, 'utf-8');
                                    const nameMatch = pkgContent.match(/name\s*=\s*["']([^"']+)["']/);
                                    if (nameMatch) {
                                        packages.add(nameMatch[1]);
                                        packages.add(nameMatch[1].replace(/-/g, '_'));
                                    }
                                }
                            }
                        }
                    }
                }
            }
            
            // Check setup.py for package name
            const setupPyPath = path.join(this.workspaceRoot, 'setup.py');
            if (fs.existsSync(setupPyPath)) {
                const content = fs.readFileSync(setupPyPath, 'utf-8');
                const nameMatch = content.match(/name\s*=\s*["']([^"']+)["']/);
                if (nameMatch) {
                    packages.add(nameMatch[1]);
                    packages.add(nameMatch[1].replace(/-/g, '_'));
                }
            }
            
            // Scan for subdirectories with pyproject.toml or setup.py (monorepo packages)
            const commonDirs = ['packages', 'libs', 'services', 'apps', 'src'];
            for (const dir of commonDirs) {
                const fullDir = path.join(this.workspaceRoot, dir);
                if (fs.existsSync(fullDir) && fs.statSync(fullDir).isDirectory()) {
                    try {
                        const entries = fs.readdirSync(fullDir, { withFileTypes: true });
                        for (const entry of entries) {
                            if (entry.isDirectory() && !entry.name.startsWith('.') && !entry.name.startsWith('_')) {
                                const subPyprojectPath = path.join(fullDir, entry.name, 'pyproject.toml');
                                const subSetupPyPath = path.join(fullDir, entry.name, 'setup.py');
                                
                                if (fs.existsSync(subPyprojectPath)) {
                                    try {
                                        const content = fs.readFileSync(subPyprojectPath, 'utf-8');
                                        const nameMatch = content.match(/name\s*=\s*["']([^"']+)["']/);
                                        if (nameMatch) {
                                            packages.add(nameMatch[1]);
                                            packages.add(nameMatch[1].replace(/-/g, '_'));
                                        }
                                    } catch {
                                        // Ignore parse errors
                                    }
                                } else if (fs.existsSync(subSetupPyPath)) {
                                    try {
                                        const content = fs.readFileSync(subSetupPyPath, 'utf-8');
                                        const nameMatch = content.match(/name\s*=\s*["']([^"']+)["']/);
                                        if (nameMatch) {
                                            packages.add(nameMatch[1]);
                                            packages.add(nameMatch[1].replace(/-/g, '_'));
                                        }
                                    } catch {
                                        // Ignore parse errors
                                    }
                                }
                            }
                        }
                    } catch {
                        // Ignore read errors
                    }
                }
            }
        } catch {
            // Ignore errors
        }
    }

    /**
     * Load Go workspace modules from go.work and go.mod replace directives
     */
    private loadGoWorkspaceModules(modules: Set<string>): void {
        try {
            // Check go.work for workspace modules (Go 1.18+)
            const goWorkPath = path.join(this.workspaceRoot, 'go.work');
            if (fs.existsSync(goWorkPath)) {
                const content = fs.readFileSync(goWorkPath, 'utf-8');
                // Parse use directives: use ./path/to/module
                const useMatches = content.matchAll(/use\s+\.\/([^\s\n]+)/g);
                for (const match of useMatches) {
                    const modulePath = match[1];
                    // Read go.mod from the module directory to get module name
                    const modPath = path.join(this.workspaceRoot, modulePath, 'go.mod');
                    if (fs.existsSync(modPath)) {
                        const modContent = fs.readFileSync(modPath, 'utf-8');
                        const moduleMatch = modContent.match(/module\s+([^\s\n]+)/);
                        if (moduleMatch) {
                            modules.add(moduleMatch[1]);
                        }
                    }
                }
                
                // Also parse use block: use ( ./path1 ./path2 )
                const useBlockMatch = content.match(/use\s*\(\s*([\s\S]*?)\s*\)/);
                if (useBlockMatch) {
                    const paths = useBlockMatch[1].match(/\.\/[^\s\n]+/g);
                    if (paths) {
                        for (const p of paths) {
                            const modulePath = p.slice(2); // Remove ./
                            const modPath = path.join(this.workspaceRoot, modulePath, 'go.mod');
                            if (fs.existsSync(modPath)) {
                                const modContent = fs.readFileSync(modPath, 'utf-8');
                                const moduleMatch = modContent.match(/module\s+([^\s\n]+)/);
                                if (moduleMatch) {
                                    modules.add(moduleMatch[1]);
                                }
                            }
                        }
                    }
                }
            }
            
            // Check go.mod for replace directives
            const goModPath = path.join(this.workspaceRoot, 'go.mod');
            if (fs.existsSync(goModPath)) {
                const content = fs.readFileSync(goModPath, 'utf-8');
                
                // Get the main module name
                const moduleMatch = content.match(/module\s+([^\s\n]+)/);
                if (moduleMatch) {
                    modules.add(moduleMatch[1]);
                }
                
                // Parse replace directives: replace module => ./local/path
                const replaceMatches = content.matchAll(/replace\s+([^\s]+)\s+=>\s+\.\/([^\s\n]+)/g);
                for (const match of replaceMatches) {
                    modules.add(match[1]); // The module being replaced is local
                }
                
                // Also parse replace block
                const replaceBlockMatch = content.match(/replace\s*\(\s*([\s\S]*?)\s*\)/);
                if (replaceBlockMatch) {
                    const lines = replaceBlockMatch[1].split('\n');
                    for (const line of lines) {
                        const replaceMatch = line.match(/([^\s]+)\s+=>\s+\.\//);
                        if (replaceMatch) {
                            modules.add(replaceMatch[1]);
                        }
                    }
                }
            }
        } catch {
            // Ignore errors
        }
    }

    /**
     * Load Rust workspace crates from Cargo.toml
     */
    private loadRustWorkspaceCrates(crates: Set<string>): void {
        try {
            const cargoPath = path.join(this.workspaceRoot, 'Cargo.toml');
            if (fs.existsSync(cargoPath)) {
                const content = fs.readFileSync(cargoPath, 'utf-8');
                
                // Get the main package name
                const packageMatch = content.match(/\[package\][\s\S]*?name\s*=\s*["']([^"']+)["']/);
                if (packageMatch) {
                    crates.add(packageMatch[1]);
                    // Also add underscore version (Rust crate names use underscores in code)
                    crates.add(packageMatch[1].replace(/-/g, '_'));
                }
                
                // Parse workspace members: [workspace] members = ["crate1", "crate2"]
                const workspaceMatch = content.match(/\[workspace\][\s\S]*?members\s*=\s*\[([\s\S]*?)\]/);
                if (workspaceMatch) {
                    const membersStr = workspaceMatch[1];
                    // Extract quoted strings
                    const memberMatches = membersStr.matchAll(/["']([^"']+)["']/g);
                    for (const match of memberMatches) {
                        const memberPath = match[1];
                        // Handle glob patterns like "crates/*"
                        if (memberPath.includes('*')) {
                            const baseDir = memberPath.replace(/\/?\*.*$/, '');
                            const fullDir = path.join(this.workspaceRoot, baseDir);
                            if (fs.existsSync(fullDir) && fs.statSync(fullDir).isDirectory()) {
                                try {
                                    const entries = fs.readdirSync(fullDir, { withFileTypes: true });
                                    for (const entry of entries) {
                                        if (entry.isDirectory() && !entry.name.startsWith('.')) {
                                            const cratePath = path.join(fullDir, entry.name, 'Cargo.toml');
                                            if (fs.existsSync(cratePath)) {
                                                const crateContent = fs.readFileSync(cratePath, 'utf-8');
                                                const nameMatch = crateContent.match(/\[package\][\s\S]*?name\s*=\s*["']([^"']+)["']/);
                                                if (nameMatch) {
                                                    crates.add(nameMatch[1]);
                                                    crates.add(nameMatch[1].replace(/-/g, '_'));
                                                }
                                            }
                                        }
                                    }
                                } catch {
                                    // Ignore read errors
                                }
                            }
                        } else {
                            // Direct path to crate
                            const cratePath = path.join(this.workspaceRoot, memberPath, 'Cargo.toml');
                            if (fs.existsSync(cratePath)) {
                                try {
                                    const crateContent = fs.readFileSync(cratePath, 'utf-8');
                                    const nameMatch = crateContent.match(/\[package\][\s\S]*?name\s*=\s*["']([^"']+)["']/);
                                    if (nameMatch) {
                                        crates.add(nameMatch[1]);
                                        crates.add(nameMatch[1].replace(/-/g, '_'));
                                    }
                                } catch {
                                    // Ignore parse errors
                                }
                            }
                        }
                    }
                }
                
                // Also check for path dependencies in [dependencies]
                const depsMatch = content.match(/\[dependencies\]([\s\S]*?)(?=\[|$)/);
                if (depsMatch) {
                    const pathDepsMatches = depsMatch[1].matchAll(/(\w+)\s*=\s*\{[^}]*path\s*=\s*["']([^"']+)["'][^}]*\}/g);
                    for (const match of pathDepsMatches) {
                        crates.add(match[1]);
                        crates.add(match[1].replace(/-/g, '_'));
                    }
                }
            }
        } catch {
            // Ignore errors
        }
    }

    /**
     * Load Java workspace packages from Maven pom.xml and Gradle settings.gradle
     */
    private loadJavaWorkspacePackages(packages: Set<string>): void {
        try {
            // Check Maven pom.xml for modules
            const pomPath = path.join(this.workspaceRoot, 'pom.xml');
            if (fs.existsSync(pomPath)) {
                const content = fs.readFileSync(pomPath, 'utf-8');
                
                // Get the main project groupId and artifactId
                const groupIdMatch = content.match(/<groupId>([^<]+)<\/groupId>/);
                const artifactIdMatch = content.match(/<artifactId>([^<]+)<\/artifactId>/);
                if (groupIdMatch && artifactIdMatch) {
                    packages.add(`${groupIdMatch[1]}.${artifactIdMatch[1]}`);
                    packages.add(groupIdMatch[1]);
                }
                
                // Parse modules: <modules><module>subproject</module></modules>
                const modulesMatch = content.match(/<modules>([\s\S]*?)<\/modules>/);
                if (modulesMatch) {
                    const moduleMatches = modulesMatch[1].matchAll(/<module>([^<]+)<\/module>/g);
                    for (const match of moduleMatches) {
                        const modulePath = match[1];
                        const modulePomPath = path.join(this.workspaceRoot, modulePath, 'pom.xml');
                        if (fs.existsSync(modulePomPath)) {
                            try {
                                const moduleContent = fs.readFileSync(modulePomPath, 'utf-8');
                                const moduleGroupId = moduleContent.match(/<groupId>([^<]+)<\/groupId>/);
                                const moduleArtifactId = moduleContent.match(/<artifactId>([^<]+)<\/artifactId>/);
                                if (moduleGroupId && moduleArtifactId) {
                                    packages.add(`${moduleGroupId[1]}.${moduleArtifactId[1]}`);
                                }
                                // Also add just the groupId as it's commonly used in imports
                                if (moduleGroupId) {
                                    packages.add(moduleGroupId[1]);
                                }
                            } catch {
                                // Ignore parse errors
                            }
                        }
                    }
                }
            }
            
            // Check Gradle settings.gradle for includes
            const settingsGradlePath = path.join(this.workspaceRoot, 'settings.gradle');
            const settingsGradleKtsPath = path.join(this.workspaceRoot, 'settings.gradle.kts');
            const settingsPath = fs.existsSync(settingsGradleKtsPath) ? settingsGradleKtsPath : settingsGradlePath;
            
            if (fs.existsSync(settingsPath)) {
                const content = fs.readFileSync(settingsPath, 'utf-8');
                
                // Parse include statements: include ':subproject', include(":subproject")
                const includeMatches = content.matchAll(/include\s*\(?['":]+([^'":\)]+)['"]?\)?/g);
                for (const match of includeMatches) {
                    const projectName = match[1];
                    // Try to read build.gradle to get group
                    const buildGradlePath = path.join(this.workspaceRoot, projectName.replace(/:/g, '/'), 'build.gradle');
                    const buildGradleKtsPath = path.join(this.workspaceRoot, projectName.replace(/:/g, '/'), 'build.gradle.kts');
                    const buildPath = fs.existsSync(buildGradleKtsPath) ? buildGradleKtsPath : buildGradlePath;
                    
                    if (fs.existsSync(buildPath)) {
                        try {
                            const buildContent = fs.readFileSync(buildPath, 'utf-8');
                            const groupMatch = buildContent.match(/group\s*=\s*['"]([^'"]+)['"]/);
                            if (groupMatch) {
                                packages.add(groupMatch[1]);
                                packages.add(`${groupMatch[1]}.${projectName.replace(/:/g, '.')}`);
                            }
                        } catch {
                            // Ignore parse errors
                        }
                    }
                    
                    // Also add the project name itself as a potential package prefix
                    packages.add(projectName.replace(/:/g, '.'));
                }
            }
            
            // Check root build.gradle for group
            const buildGradlePath = path.join(this.workspaceRoot, 'build.gradle');
            const buildGradleKtsPath = path.join(this.workspaceRoot, 'build.gradle.kts');
            const buildPath = fs.existsSync(buildGradleKtsPath) ? buildGradleKtsPath : buildGradlePath;
            
            if (fs.existsSync(buildPath)) {
                const content = fs.readFileSync(buildPath, 'utf-8');
                const groupMatch = content.match(/group\s*=\s*['"]([^'"]+)['"]/);
                if (groupMatch) {
                    packages.add(groupMatch[1]);
                }
            }
        } catch {
            // Ignore errors
        }
    }

    /**
     * Check if a package is a workspace package for a specific language
     */
    protected isWorkspacePackage(packageName: string, language: 'js' | 'python' | 'go' | 'rust' | 'java'): boolean {
        switch (language) {
            case 'js':
                return this.workspaceData.jsPackages.has(packageName);
            case 'python':
                return this.workspaceData.pythonPackages.has(packageName) ||
                       this.workspaceData.pythonPackages.has(packageName.replace(/-/g, '_'));
            case 'go':
                return this.workspaceData.goModules.has(packageName);
            case 'rust':
                return this.workspaceData.rustCrates.has(packageName) ||
                       this.workspaceData.rustCrates.has(packageName.replace(/-/g, '_'));
            case 'java':
                // For Java, check if any workspace package is a prefix of the import
                for (const pkg of this.workspaceData.javaPackages) {
                    if (packageName.startsWith(pkg)) {
                        return true;
                    }
                }
                return false;
            default:
                return false;
        }
    }

    /**
     * Load workspace package names from package.json files in the monorepo
     * @deprecated Use loadAllWorkspacePackages() instead
     */
    private loadWorkspacePackages(): Set<string> {
        return this.workspaceData.jsPackages;
    }

    /**
     * Index a single file
     */
    abstract indexFile(filePath: string, content: string): Promise<IndexResult>;

    /**
     * Check if this indexer supports the given file
     */
    abstract supports(filePath: string): boolean;

    /**
     * Get supported file extensions
     */
    abstract get extensions(): string[];

    /**
     * Create a file node
     */
    protected createFileNode(filePath: string, name: string): GraphNode {
        return {
            id: `file:${filePath}`,
            kind: 'file',
            name,
            path: filePath,
        };
    }

    /**
     * Create a symbol node
     */
    protected createSymbolNode(
        filePath: string,
        name: string,
        line?: number
    ): GraphNode {
        const id = line ? `symbol:${filePath}:${name}:${line}` : `symbol:${filePath}:${name}`;
        return {
            id,
            kind: 'symbol',
            name,
            path: filePath,
            meta: line ? { loc: { line, column: 0 } } : undefined,
        };
    }

    /**
     * Create an import edge
     */
    protected createImportEdge(
        fromFile: string,
        toFile: string,
        confidence: Confidence,
        reason: string,
        isDynamic = false,
        line?: number
    ): GraphEdge {
        return {
            id: `edge:${fromFile}:imports:${toFile}`,
            from: `file:${fromFile}`,
            to: `file:${toFile}`,
            kind: 'imports',
            confidence,
            reason,
            meta: {
                isDynamic,
                loc: line ? { line, column: 0 } : undefined,
            },
        };
    }

    /**
     * Create an export edge
     */
    protected createExportEdge(
        filePath: string,
        symbolName: string,
        confidence: Confidence = 'high'
    ): GraphEdge {
        return {
            id: `edge:${filePath}:exports:${symbolName}`,
            from: `file:${filePath}`,
            to: `symbol:${filePath}:${symbolName}`,
            kind: 'exports',
            confidence,
            reason: 'static export',
        };
    }

    /**
     * Create an index error
     */
    protected createError(
        file: string,
        message: string,
        line?: number,
        recoverable = true
    ): IndexError {
        return { file, message, line, recoverable };
    }

    /**
     * Normalize import path to absolute path
     * Handles relative imports, tsconfig aliases, workspace packages, and filters external packages
     */
    protected normalizeImportPath(
        importPath: string,
        fromFile: string
    ): string | null {
        // Handle relative imports
        if (importPath.startsWith('.')) {
            const fromDir = fromFile.substring(0, fromFile.lastIndexOf('/'));
            const resolved = this.resolvePath(fromDir, importPath);
            // Add extension if missing (common in TS/JS imports)
            return this.addExtensionIfNeeded(resolved);
        }

        // Handle common path aliases that should be treated as internal
        // These are typically configured in tsconfig.json paths
        const aliasPatterns = [
            /^@\//, // @/components -> src/components
            /^@[a-z]/i, // @components, @utils (but not @org/package)
            /^~\//, // ~/utils
            /^src\//, // src/utils
            /^lib\//, // lib/utils
            /^app\//, // app/utils (Next.js app router)
            /^components\//, // components/Button
            /^utils\//, // utils/helpers
            /^hooks\//, // hooks/useAuth
            /^services\//, // services/api
            /^types\//, // types/index
            /^constants\//, // constants/config
            /^config\//, // config/settings
            /^styles\//, // styles/global
            /^assets\//, // assets/images
            /^pages\//, // pages/index (Next.js)
            /^api\//, // api/routes
        ];

        // Check if it matches any alias pattern
        for (const pattern of aliasPatterns) {
            if (pattern.test(importPath)) {
                // This looks like an internal alias, but we can't resolve it without tsconfig
                // Return the path as-is and let the graph handle it
                // The PathResolver in CodeGraphManager will handle proper resolution
                return this.addExtensionIfNeeded(importPath);
            }
        }

        // Check if it's a workspace package (monorepo internal dependency)
        // Extract package name: @scope/pkg or @scope/pkg/subpath -> @scope/pkg
        let packageName = importPath;
        if (importPath.startsWith('@')) {
            const parts = importPath.split('/');
            if (parts.length >= 2) {
                packageName = `${parts[0]}/${parts[1]}`;
            }
        } else {
            packageName = importPath.split('/')[0];
        }
        
        if (this.workspacePackages.has(packageName)) {
            // This is a workspace package - return a special marker
            // The graph will track this as an internal dependency
            // Format: workspace:@scope/pkg or workspace:@scope/pkg/subpath
            return `workspace:${importPath}`;
        }

        // Check if it's clearly an external package
        // External packages: lodash, react, @org/package, node:fs
        if (this.isExternalPackage(importPath)) {
            return null;
        }

        // For anything else, assume it might be an internal path
        // This is a conservative approach - better to include than exclude
        return this.addExtensionIfNeeded(importPath);
    }

    /**
     * Check if import path is an external package
     */
    private isExternalPackage(importPath: string): boolean {
        // Node built-in modules
        if (importPath.startsWith('node:')) {
            return true;
        }

        // Common Node.js built-ins
        const builtins = new Set([
            'fs', 'path', 'os', 'util', 'events', 'stream', 'http', 'https',
            'crypto', 'buffer', 'url', 'querystring', 'child_process', 'cluster',
            'dgram', 'dns', 'net', 'readline', 'repl', 'tls', 'tty', 'v8', 'vm',
            'zlib', 'assert', 'async_hooks', 'console', 'constants', 'domain',
            'inspector', 'module', 'perf_hooks', 'process', 'punycode',
            'string_decoder', 'timers', 'trace_events', 'worker_threads',
        ]);
        
        const firstPart = importPath.split('/')[0];
        if (builtins.has(firstPart)) {
            return true;
        }

        // Check if it's a workspace package (monorepo internal dependency)
        // Extract package name: @scope/pkg or @scope/pkg/subpath -> @scope/pkg
        let packageName = importPath;
        if (importPath.startsWith('@')) {
            const parts = importPath.split('/');
            if (parts.length >= 2) {
                packageName = `${parts[0]}/${parts[1]}`;
            }
        } else {
            packageName = importPath.split('/')[0];
        }
        
        // If it's a workspace package, it's NOT external
        if (this.workspacePackages.has(packageName)) {
            return false;
        }

        // Scoped packages like @org/package (but not @/alias or @alias)
        if (importPath.startsWith('@') && importPath.includes('/')) {
            const scopePart = importPath.split('/')[0];
            // @org/package pattern (org is lowercase, typically npm scope)
            if (/^@[a-z0-9][\w.-]*$/i.test(scopePart) && scopePart !== '@') {
                // Check if it looks like a real npm scope vs an alias
                // Real scopes: @types, @babel, @testing-library
                // Aliases: @components, @utils (single word after @)
                const afterScope = importPath.split('/')[1];
                if (afterScope && !afterScope.includes('.')) {
                    // Likely a real scoped package
                    return true;
                }
            }
        }

        // Bare specifiers without path separators are likely external
        // e.g., 'lodash', 'react', 'express'
        if (!importPath.includes('/') && !importPath.startsWith('.') && !importPath.startsWith('@')) {
            return true;
        }

        return false;
    }

    /**
     * Add file extension if the path doesn't have one
     * Also handles ESM-style .js imports that should map to .ts source files
     */
    private addExtensionIfNeeded(filePath: string): string {
        const lastPart = filePath.split('/').pop() || '';
        
        // Handle ESM-style .js/.jsx/.mjs/.cjs imports that should resolve to .ts/.tsx files
        // In TypeScript projects with moduleResolution: NodeNext, imports use .js extension
        // but the actual source files are .ts
        if (lastPart.endsWith('.js')) {
            return filePath.slice(0, -3); // Remove .js, let graph try .ts
        }
        if (lastPart.endsWith('.jsx')) {
            return filePath.slice(0, -4); // Remove .jsx, let graph try .tsx
        }
        if (lastPart.endsWith('.mjs')) {
            return filePath.slice(0, -4); // Remove .mjs, let graph try .mts or .ts
        }
        if (lastPart.endsWith('.cjs')) {
            return filePath.slice(0, -4); // Remove .cjs, let graph try .cts or .ts
        }
        
        // If already has a source extension (.ts, .tsx, etc.), return as-is
        if (lastPart.includes('.') && !lastPart.startsWith('.')) {
            return filePath;
        }
        
        // Return without extension - the graph will try to match with various extensions
        return filePath;
    }

    /**
     * Simple path resolution
     */
    private resolvePath(base: string, relative: string): string {
        const parts = base.split('/').filter(Boolean);
        const relativeParts = relative.split('/');

        for (const part of relativeParts) {
            if (part === '..') {
                parts.pop();
            } else if (part !== '.') {
                parts.push(part);
            }
        }

        return parts.join('/');
    }
}
