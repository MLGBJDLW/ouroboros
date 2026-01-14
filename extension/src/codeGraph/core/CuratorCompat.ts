/**
 * Curator Compatibility Layer
 * 
 * Provides a unified interface that works with both:
 * 1. Full Graph (when dependency-cruiser or external tools available)
 * 2. Built-in Indexers (TypeScriptIndexer, PythonIndexer, etc.)
 * 3. Curator-style Index (symbol + file index only, no edges)
 * 4. Regex Fallback (basic text search)
 * 
 * This enables graceful degradation while maintaining a consistent API.
 */

import type { GraphStore } from './GraphStore';
import type { GraphQuery } from './GraphQuery';
import type {
    GraphNode,
    Confidence,
} from './types';

// ============================================
// Curator Index Types
// ============================================

export interface SymbolLocation {
    name: string;
    kind: 'function' | 'class' | 'variable' | 'type' | 'interface' | 'method' | 'property';
    filePath: string;
    line: number;
    column?: number;
    exported: boolean;
}

export interface FileMetadata {
    path: string;
    language: string;
    size: number;
    lastModified: number;
    symbols: string[];
    imports: string[];
    exports: string[];
}

export interface Reference {
    symbolName: string;
    fromFile: string;
    toFile: string;
    line: number;
    kind: 'import' | 'call' | 'type' | 'extends' | 'implements';
}

export interface FileContext {
    file: FileMetadata;
    symbols: SymbolLocation[];
    incomingRefs: Reference[];
    outgoingRefs: Reference[];
}

// ============================================
// Curator Search Results
// ============================================

export interface CuratorSearchResult {
    type: 'symbol' | 'file' | 'reference';
    name: string;
    path: string;
    line?: number;
    confidence: Confidence;
    source: 'graph' | 'index' | 'regex';
}

export interface CuratorQueryResult {
    results: CuratorSearchResult[];
    source: 'full-graph' | 'builtin-indexer' | 'curator-index' | 'regex-fallback';
    confidence: Confidence;
    meta: {
        totalFound: number;
        returned: number;
        truncated: boolean;
        queryTime: number;
    };
}

// ============================================
// Index Level Detection
// ============================================

export type IndexLevel = 
    | 'full-graph'      // External tools (dependency-cruiser) available
    | 'builtin-indexer' // Built-in language indexers
    | 'curator-index'   // Symbol + file index only
    | 'regex-fallback'; // Basic text search

export interface IndexCapabilities {
    level: IndexLevel;
    hasEdges: boolean;
    hasSymbols: boolean;
    hasEntrypoints: boolean;
    languages: string[];
    frameworks: string[];
}

// ============================================
// Curator Compatibility Class
// ============================================

export class CuratorCompat {
    private symbolIndex: Map<string, SymbolLocation[]> = new Map();
    private fileIndex: Map<string, FileMetadata> = new Map();
    private referenceIndex: Map<string, Reference[]> = new Map();
    
    constructor(
        private store: GraphStore,
        private query: GraphQuery
    ) {}

    // ============================================
    // Index Level Detection
    // ============================================

    /**
     * Detect current index capabilities
     */
    getCapabilities(): IndexCapabilities {
        const meta = this.store.getMeta();
        const hasEdges = meta.edgeCount > 0;
        const hasNodes = meta.nodeCount > 0;
        
        // Check for entrypoints (indicates framework detection)
        const entrypoints = this.store.getNodesByKind('entrypoint');
        const hasEntrypoints = entrypoints.length > 0;
        
        // Detect languages from file extensions
        const files = this.store.getNodesByKind('file');
        const languages = this.detectLanguages(files);
        
        // Detect frameworks from entrypoint metadata
        const frameworks = this.detectFrameworks(entrypoints);
        
        // Determine index level
        let level: IndexLevel;
        if (hasEdges && hasEntrypoints) {
            level = 'full-graph';
        } else if (hasEdges) {
            level = 'builtin-indexer';
        } else if (hasNodes) {
            level = 'curator-index';
        } else {
            level = 'regex-fallback';
        }
        
        return {
            level,
            hasEdges,
            hasSymbols: this.symbolIndex.size > 0 || hasNodes,
            hasEntrypoints,
            languages,
            frameworks,
        };
    }

    private detectLanguages(files: GraphNode[]): string[] {
        const extensions = new Set<string>();
        for (const file of files) {
            if (file.path) {
                const ext = file.path.split('.').pop()?.toLowerCase();
                if (ext) extensions.add(ext);
            }
        }
        
        const langMap: Record<string, string> = {
            'ts': 'typescript', 'tsx': 'typescript',
            'js': 'javascript', 'jsx': 'javascript', 'mjs': 'javascript',
            'py': 'python', 'pyi': 'python',
            'rs': 'rust',
            'go': 'go',
            'java': 'java',
            'cs': 'csharp',
            'rb': 'ruby',
            'php': 'php',
        };
        
        const languages: string[] = [];
        for (const ext of extensions) {
            const lang = langMap[ext];
            if (lang && !languages.includes(lang)) {
                languages.push(lang);
            }
        }
        
        return languages;
    }

    private detectFrameworks(entrypoints: GraphNode[]): string[] {
        const frameworks = new Set<string>();
        for (const ep of entrypoints) {
            const framework = ep.meta?.framework as string | undefined;
            if (framework) frameworks.add(framework);
        }
        return Array.from(frameworks);
    }

    // ============================================
    // Unified Search API
    // ============================================

    /**
     * Search with automatic fallback based on index level
     */
    search(query: string, options?: {
        type?: 'symbol' | 'file' | 'all';
        limit?: number;
        scope?: string;
    }): CuratorQueryResult {
        const startTime = Date.now();
        const capabilities = this.getCapabilities();
        const limit = options?.limit ?? 20;
        const type = options?.type ?? 'all';
        
        let results: CuratorSearchResult[] = [];
        let source: CuratorQueryResult['source'] = capabilities.level;
        
        // Try each level in order of preference
        if (capabilities.level === 'full-graph' || capabilities.level === 'builtin-indexer') {
            results = this.searchInGraph(query, type, options?.scope);
            if (results.length > 0) {
                source = capabilities.hasEdges ? 'full-graph' : 'builtin-indexer';
            }
        }
        
        // Fallback to symbol index if graph search yields nothing
        if (results.length === 0 && this.symbolIndex.size > 0) {
            results = this.searchInSymbolIndex(query, type);
            source = 'curator-index';
        }
        
        // Final fallback to file index
        if (results.length === 0 && this.fileIndex.size > 0) {
            results = this.searchInFileIndex(query);
            source = 'curator-index';
        }
        
        // Regex fallback would require file system access
        // (handled externally if needed)
        
        const truncated = results.length > limit;
        const returned = results.slice(0, limit);
        
        return {
            results: returned,
            source,
            confidence: this.calculateConfidence(source, returned.length),
            meta: {
                totalFound: results.length,
                returned: returned.length,
                truncated,
                queryTime: Date.now() - startTime,
            },
        };
    }

    private searchInGraph(
        query: string, 
        type: 'symbol' | 'file' | 'all',
        scope?: string
    ): CuratorSearchResult[] {
        const results: CuratorSearchResult[] = [];
        const queryLower = query.toLowerCase();
        
        // Search files
        if (type === 'file' || type === 'all') {
            const files = this.store.getNodesByKind('file');
            for (const file of files) {
                if (!file.path) continue;
                if (scope && !file.path.startsWith(scope)) continue;
                
                const fileName = file.path.split('/').pop() ?? '';
                if (fileName.toLowerCase().includes(queryLower) ||
                    file.path.toLowerCase().includes(queryLower)) {
                    results.push({
                        type: 'file',
                        name: fileName,
                        path: file.path,
                        confidence: fileName.toLowerCase() === queryLower ? 'high' : 'medium',
                        source: 'graph',
                    });
                }
            }
        }
        
        // Search symbols (from node exports)
        if (type === 'symbol' || type === 'all') {
            const files = this.store.getNodesByKind('file');
            for (const file of files) {
                if (!file.path) continue;
                if (scope && !file.path.startsWith(scope)) continue;
                
                const exports = file.meta?.exports as string[] | undefined;
                if (exports) {
                    for (const exp of exports) {
                        if (exp.toLowerCase().includes(queryLower)) {
                            results.push({
                                type: 'symbol',
                                name: exp,
                                path: file.path,
                                confidence: exp.toLowerCase() === queryLower ? 'high' : 'medium',
                                source: 'graph',
                            });
                        }
                    }
                }
            }
        }
        
        // Sort by confidence
        results.sort((a, b) => {
            const confOrder = { high: 0, medium: 1, low: 2, unknown: 3 };
            return confOrder[a.confidence] - confOrder[b.confidence];
        });
        
        return results;
    }

    private searchInSymbolIndex(
        query: string,
        type: 'symbol' | 'file' | 'all'
    ): CuratorSearchResult[] {
        if (type === 'file') return [];
        
        const results: CuratorSearchResult[] = [];
        const queryLower = query.toLowerCase();
        
        for (const [name, locations] of this.symbolIndex) {
            if (name.toLowerCase().includes(queryLower)) {
                for (const loc of locations) {
                    results.push({
                        type: 'symbol',
                        name: loc.name,
                        path: loc.filePath,
                        line: loc.line,
                        confidence: name.toLowerCase() === queryLower ? 'high' : 'medium',
                        source: 'index',
                    });
                }
            }
        }
        
        return results;
    }

    private searchInFileIndex(query: string): CuratorSearchResult[] {
        const results: CuratorSearchResult[] = [];
        const queryLower = query.toLowerCase();
        
        for (const [path, _meta] of this.fileIndex) {
            const fileName = path.split('/').pop() ?? '';
            if (fileName.toLowerCase().includes(queryLower) ||
                path.toLowerCase().includes(queryLower)) {
                results.push({
                    type: 'file',
                    name: fileName,
                    path,
                    confidence: fileName.toLowerCase() === queryLower ? 'high' : 'medium',
                    source: 'index',
                });
            }
        }
        
        return results;
    }

    private calculateConfidence(
        source: CuratorQueryResult['source'],
        resultCount: number
    ): Confidence {
        if (resultCount === 0) return 'unknown';
        if (source === 'full-graph') return 'high';
        if (source === 'builtin-indexer') return 'high';
        if (source === 'curator-index') return 'medium';
        return 'low';
    }

    // ============================================
    // Symbol Index Management
    // ============================================

    /**
     * Add symbol to index
     */
    addSymbol(symbol: SymbolLocation): void {
        const existing = this.symbolIndex.get(symbol.name) ?? [];
        existing.push(symbol);
        this.symbolIndex.set(symbol.name, existing);
    }

    /**
     * Find symbol by name
     */
    findSymbol(name: string): SymbolLocation[] {
        return this.symbolIndex.get(name) ?? [];
    }

    /**
     * Find all symbols in a file
     */
    getFileSymbols(filePath: string): SymbolLocation[] {
        const results: SymbolLocation[] = [];
        for (const locations of this.symbolIndex.values()) {
            for (const loc of locations) {
                if (loc.filePath === filePath) {
                    results.push(loc);
                }
            }
        }
        return results;
    }

    // ============================================
    // File Index Management
    // ============================================

    /**
     * Add file to index
     */
    addFile(meta: FileMetadata): void {
        this.fileIndex.set(meta.path, meta);
    }

    /**
     * Get file metadata
     */
    getFile(path: string): FileMetadata | undefined {
        return this.fileIndex.get(path);
    }

    /**
     * Get file context (symbols + references)
     */
    getFileContext(path: string): FileContext | null {
        const file = this.fileIndex.get(path);
        if (!file) return null;
        
        const symbols = this.getFileSymbols(path);
        const incomingRefs = this.referenceIndex.get(`to:${path}`) ?? [];
        const outgoingRefs = this.referenceIndex.get(`from:${path}`) ?? [];
        
        return {
            file,
            symbols,
            incomingRefs,
            outgoingRefs,
        };
    }

    // ============================================
    // Reference Index Management
    // ============================================

    /**
     * Add reference to index
     */
    addReference(ref: Reference): void {
        // Index by source file
        const fromKey = `from:${ref.fromFile}`;
        const fromRefs = this.referenceIndex.get(fromKey) ?? [];
        fromRefs.push(ref);
        this.referenceIndex.set(fromKey, fromRefs);
        
        // Index by target file
        const toKey = `to:${ref.toFile}`;
        const toRefs = this.referenceIndex.get(toKey) ?? [];
        toRefs.push(ref);
        this.referenceIndex.set(toKey, toRefs);
    }

    /**
     * Find references to a symbol
     */
    findReferences(symbolName: string): Reference[] {
        const results: Reference[] = [];
        for (const refs of this.referenceIndex.values()) {
            for (const ref of refs) {
                if (ref.symbolName === symbolName) {
                    results.push(ref);
                }
            }
        }
        return results;
    }

    // ============================================
    // Sync with GraphStore
    // ============================================

    /**
     * Build curator index from GraphStore
     * Call this after graph indexing to populate curator-style indexes
     */
    syncFromGraph(): void {
        this.symbolIndex.clear();
        this.fileIndex.clear();
        this.referenceIndex.clear();
        
        const files = this.store.getNodesByKind('file');
        
        for (const file of files) {
            if (!file.path) continue;
            
            // Build file metadata
            const exports = (file.meta?.exports as string[]) ?? [];
            const edges = this.store.getEdgesFrom(file.id);
            const imports = edges
                .filter(e => e.kind === 'imports')
                .map(e => {
                    const target = this.store.getNode(e.to);
                    return target?.path ?? e.to;
                });
            
            const fileMeta: FileMetadata = {
                path: file.path,
                language: this.detectLanguageFromPath(file.path),
                size: 0, // Would need file system access
                lastModified: 0,
                symbols: exports,
                imports,
                exports,
            };
            this.addFile(fileMeta);
            
            // Build symbol index from exports
            for (const exp of exports) {
                this.addSymbol({
                    name: exp,
                    kind: 'function', // Default, would need AST for accurate kind
                    filePath: file.path,
                    line: 1, // Would need AST for accurate line
                    exported: true,
                });
            }
            
            // Build reference index from edges
            for (const edge of edges) {
                if (edge.kind === 'imports' && edge.to !== 'unknown') {
                    const targetNode = this.store.getNode(edge.to);
                    if (targetNode?.path) {
                        this.addReference({
                            symbolName: edge.meta?.importPath ?? '',
                            fromFile: file.path,
                            toFile: targetNode.path,
                            line: edge.meta?.loc?.line ?? 1,
                            kind: 'import',
                        });
                    }
                }
            }
        }
    }

    private detectLanguageFromPath(path: string): string {
        const ext = path.split('.').pop()?.toLowerCase() ?? '';
        const langMap: Record<string, string> = {
            'ts': 'typescript', 'tsx': 'typescript',
            'js': 'javascript', 'jsx': 'javascript', 'mjs': 'javascript',
            'py': 'python', 'pyi': 'python',
            'rs': 'rust',
            'go': 'go',
            'java': 'java',
            'cs': 'csharp',
            'rb': 'ruby',
            'php': 'php',
        };
        return langMap[ext] ?? 'unknown';
    }

    // ============================================
    // Clear Index
    // ============================================

    clear(): void {
        this.symbolIndex.clear();
        this.fileIndex.clear();
        this.referenceIndex.clear();
    }

    // ============================================
    // Stats
    // ============================================

    getStats(): {
        symbolCount: number;
        fileCount: number;
        referenceCount: number;
    } {
        let refCount = 0;
        for (const refs of this.referenceIndex.values()) {
            refCount += refs.length;
        }
        // Divide by 2 because we index both from and to
        refCount = Math.floor(refCount / 2);
        
        return {
            symbolCount: this.symbolIndex.size,
            fileCount: this.fileIndex.size,
            referenceCount: refCount,
        };
    }
}
