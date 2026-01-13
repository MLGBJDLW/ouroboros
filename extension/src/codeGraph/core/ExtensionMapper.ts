/**
 * Extension Mapper
 * Handles language-specific extension mapping for static analysis
 * 
 * Problem: Some languages have source/compiled extension mismatches:
 * - TypeScript ESM: imports use .js but source files are .ts
 * - Kotlin/Java: .kt files can import .java and vice versa
 * - C/C++: .h headers vs .c/.cpp implementations
 * 
 * Solution: This mapper normalizes file paths to handle both the import path
 * and the actual source path, ensuring consistent node IDs in the graph.
 */

/**
 * Language-specific extension mapping rules
 * Maps compiled/import extensions to source extensions
 */
export const LANGUAGE_EXTENSION_MAPPINGS: Record<string, ReadonlyArray<[string, string[]]>> = {
    // TypeScript/JavaScript ESM
    typescript: [
        ['.js', ['.ts', '.tsx', '.mts']],
        ['.jsx', ['.tsx', '.ts']],
        ['.mjs', ['.mts', '.ts']],
        ['.cjs', ['.cts', '.ts']],
    ],
    // Kotlin/Java interop
    java: [
        ['.java', ['.kt', '.kts']], // Kotlin can replace Java
        ['.kt', ['.java']], // Java can be called from Kotlin
    ],
    // C/C++ header/implementation
    cpp: [
        ['.h', ['.c', '.cpp', '.cc', '.cxx']],
        ['.hpp', ['.cpp', '.cc', '.cxx']],
        ['.hxx', ['.cxx', '.cpp']],
    ],
    // Swift/Objective-C interop
    swift: [
        ['.h', ['.m', '.mm', '.swift']],
    ],
};

/**
 * Extension mapping rules for TypeScript ESM projects
 * Maps compiled extensions to source extensions
 */
export const EXTENSION_MAPPINGS: ReadonlyArray<[string, string[]]> = LANGUAGE_EXTENSION_MAPPINGS.typescript;

/**
 * Source file extensions (in priority order)
 */
export const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];

/**
 * Index file names (in priority order)
 */
export const INDEX_FILES = ['index.ts', 'index.tsx', 'index.js', 'index.jsx', 'index.mts', 'index.mjs'];

/**
 * Normalize a file path by removing compiled extensions
 * This ensures consistent node IDs regardless of import style
 * 
 * @param filePath - The file path to normalize
 * @returns The normalized path without compiled extension
 * 
 * @example
 * normalizeExtension('./utils/helper.js') // './utils/helper'
 * normalizeExtension('./utils/helper.ts') // './utils/helper.ts' (unchanged)
 */
export function normalizeExtension(filePath: string): string {
    for (const [compiledExt] of EXTENSION_MAPPINGS) {
        if (filePath.endsWith(compiledExt)) {
            return filePath.slice(0, -compiledExt.length);
        }
    }
    return filePath;
}

/**
 * Get all possible source file paths for a given import path
 * Handles ESM-style .js imports that should resolve to .ts files
 * 
 * @param importPath - The import path (may have .js extension)
 * @returns Array of possible source file paths
 * 
 * @example
 * getPossibleSourcePaths('./utils/helper.js')
 * // ['./utils/helper.ts', './utils/helper.tsx', './utils/helper.mts', './utils/helper.js']
 */
export function getPossibleSourcePaths(importPath: string): string[] {
    const paths: string[] = [];
    
    // Check if path has a compiled extension
    for (const [compiledExt, sourceExts] of EXTENSION_MAPPINGS) {
        if (importPath.endsWith(compiledExt)) {
            const basePath = importPath.slice(0, -compiledExt.length);
            // Add source extensions first (higher priority)
            for (const sourceExt of sourceExts) {
                paths.push(basePath + sourceExt);
            }
            // Also add the original path (in case it's actually a .js file)
            paths.push(importPath);
            return paths;
        }
    }
    
    // Check if path already has a source extension
    const hasSourceExtension = SOURCE_EXTENSIONS.some(ext => importPath.endsWith(ext));
    if (hasSourceExtension) {
        paths.push(importPath);
        return paths;
    }
    
    // Check if path has any extension (but not a source extension)
    const lastPart = importPath.split('/').pop() || '';
    const hasOtherExtension = lastPart.includes('.') && !lastPart.startsWith('.');
    
    if (hasOtherExtension) {
        // Has some other extension, just return as-is
        paths.push(importPath);
        return paths;
    }
    
    // No extension - try all source extensions
    for (const ext of SOURCE_EXTENSIONS) {
        paths.push(importPath + ext);
    }
    
    // Also try as directory with index file
    for (const indexFile of INDEX_FILES) {
        paths.push(`${importPath}/${indexFile}`);
    }
    
    // Always include the original path
    paths.push(importPath);
    
    return paths;
}

/**
 * Create a canonical node ID for a file path
 * Ensures consistent IDs regardless of import style (.js vs .ts)
 * 
 * @param filePath - The file path
 * @returns Canonical node ID in format "file:path/to/file"
 */
export function createCanonicalNodeId(filePath: string): string {
    // Normalize the path first
    const normalized = normalizeExtension(filePath);
    return `file:${normalized}`;
}

/**
 * Get all possible node IDs for a given import path
 * Used for edge resolution when the exact source file is unknown
 * 
 * @param importPath - The import path
 * @returns Array of possible node IDs
 */
export function getPossibleNodeIds(importPath: string): string[] {
    const sourcePaths = getPossibleSourcePaths(importPath);
    return sourcePaths.map(p => `file:${p}`);
}

/**
 * Check if two paths refer to the same file (considering extension mapping)
 * 
 * @param path1 - First path
 * @param path2 - Second path
 * @returns True if paths refer to the same file
 */
export function isSameFile(path1: string, path2: string): boolean {
    // Direct match
    if (path1 === path2) return true;
    
    // Normalize both and compare
    const normalized1 = normalizeExtension(path1);
    const normalized2 = normalizeExtension(path2);
    
    if (normalized1 === normalized2) return true;
    
    // Check if one is a source version of the other
    const possiblePaths1 = getPossibleSourcePaths(path1);
    const possiblePaths2 = getPossibleSourcePaths(path2);
    
    for (const p1 of possiblePaths1) {
        if (possiblePaths2.includes(p1)) return true;
    }
    
    return false;
}

/**
 * Configuration for extension mapping behavior
 */
export interface ExtensionMapperConfig {
    /** Whether to enable ESM extension mapping (.js → .ts) */
    enableEsmMapping: boolean;
    /** Additional extension mappings */
    customMappings?: Array<[string, string[]]>;
    /** Whether to prefer TypeScript extensions over JavaScript */
    preferTypeScript: boolean;
    /** Language-specific mappings to enable */
    languages?: Array<'typescript' | 'java' | 'cpp' | 'swift'>;
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: ExtensionMapperConfig = {
    enableEsmMapping: true,
    preferTypeScript: true,
    languages: ['typescript'],
};

/**
 * Extension Mapper class for stateful operations
 */
export class ExtensionMapper {
    private config: ExtensionMapperConfig;
    private mappings: Map<string, string[]>;
    
    constructor(config: Partial<ExtensionMapperConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.mappings = new Map();
        
        // Load language-specific mappings
        const languages = this.config.languages ?? ['typescript'];
        for (const lang of languages) {
            const langMappings = LANGUAGE_EXTENSION_MAPPINGS[lang];
            if (langMappings) {
                for (const [from, to] of langMappings) {
                    const existing = this.mappings.get(from) ?? [];
                    this.mappings.set(from, [...existing, ...to]);
                }
            }
        }
        
        // Add custom mappings
        if (config.customMappings) {
            for (const [from, to] of config.customMappings) {
                const existing = this.mappings.get(from) ?? [];
                this.mappings.set(from, [...existing, ...to]);
            }
        }
    }
    
    /**
     * Normalize a path using this mapper's configuration
     */
    normalize(filePath: string): string {
        if (!this.config.enableEsmMapping) {
            return filePath;
        }
        return normalizeExtension(filePath);
    }
    
    /**
     * Get possible source paths using this mapper's configuration
     */
    getPossiblePaths(importPath: string): string[] {
        if (!this.config.enableEsmMapping) {
            return [importPath];
        }
        return getPossibleSourcePaths(importPath);
    }
    
    /**
     * Check if a path has a compiled extension
     */
    hasCompiledExtension(filePath: string): boolean {
        for (const [ext] of this.mappings) {
            if (filePath.endsWith(ext)) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * Get the source extension for a compiled extension
     */
    getSourceExtensions(compiledExt: string): string[] {
        return this.mappings.get(compiledExt) ?? [];
    }
    
    /**
     * Get all configured mappings
     */
    getAllMappings(): Map<string, string[]> {
        return new Map(this.mappings);
    }
}
