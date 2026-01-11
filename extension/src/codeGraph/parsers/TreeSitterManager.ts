/**
 * Tree-Sitter Manager
 * Manages tree-sitter parser instances and language loading
 */

import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../../utils/logger';

const logger = createLogger('TreeSitterManager');

// Language WASM file URLs (from CDN or bundled)
const LANGUAGE_WASM_URLS: Record<string, string> = {
    python: 'https://unpkg.com/tree-sitter-python@0.21.0/tree-sitter-python.wasm',
    rust: 'https://unpkg.com/tree-sitter-rust@0.21.2/tree-sitter-rust.wasm',
    go: 'https://unpkg.com/tree-sitter-go@0.21.0/tree-sitter-go.wasm',
    java: 'https://unpkg.com/tree-sitter-java@0.21.0/tree-sitter-java.wasm',
    c_sharp: 'https://unpkg.com/tree-sitter-c-sharp@0.21.3/tree-sitter-c_sharp.wasm',
    ruby: 'https://unpkg.com/tree-sitter-ruby@0.21.0/tree-sitter-ruby.wasm',
    php: 'https://unpkg.com/tree-sitter-php@0.22.8/tree-sitter-php.wasm',
};

export type SupportedLanguage = keyof typeof LANGUAGE_WASM_URLS;

export interface ParsedNode {
    type: string;
    text: string;
    startPosition: { row: number; column: number };
    endPosition: { row: number; column: number };
    children: ParsedNode[];
    namedChildren: ParsedNode[];
    childForFieldName(name: string): ParsedNode | null;
}

export interface ParseTree {
    rootNode: ParsedNode;
}

export interface TreeSitterParser {
    parse(content: string): ParseTree;
    setLanguage(language: unknown): void;
}

// Lazy-loaded tree-sitter module
type TreeSitterApi = {
    Parser: new () => TreeSitterParser;
    Language: { load: (input: Uint8Array) => Promise<unknown> };
    init: (options: { locateFile: (scriptName: string) => string }) => Promise<void>;
};

let TreeSitter: TreeSitterApi | null = null;
let treeSitterInitialized = false;
let treeSitterInitFailed = false; // Track if init already failed
let initErrorLogged = false; // Only log error once
let treeSitterInitPromise: Promise<void> | null = null;

export class TreeSitterManager {
    private parsers: Map<SupportedLanguage, TreeSitterParser> = new Map();
    private languages: Map<SupportedLanguage, unknown> = new Map();
    private loadingPromises: Map<SupportedLanguage, Promise<void>> = new Map();
    private extensionPath: string;

    constructor(extensionPath: string) {
        this.extensionPath = extensionPath;
    }

    /**
     * Initialize tree-sitter WASM
     */
    async initialize(): Promise<void> {
        if (treeSitterInitialized) return;
        if (treeSitterInitFailed) throw new Error('Tree-sitter init previously failed');

        if (treeSitterInitPromise) return treeSitterInitPromise;

        let wasmInfo: { wasmPath: string; candidates: string[] } | null = null;
        treeSitterInitPromise = (async () => {
            try {
                // Dynamic import for web-tree-sitter
                const module = await import('web-tree-sitter');
                TreeSitter = this.normalizeTreeSitterModule(module);

                wasmInfo = this.resolveTreeSitterWasmPath();

                // Convert file path to file URL for Node.js compatibility
                // web-tree-sitter requires a file URL, not a plain path
                const wasmFileUrl = this.pathToFileUrl(wasmInfo.wasmPath);

                // Initialize with WASM path
                await TreeSitter.init({
                    locateFile: (scriptName: string) => {
                        // Try to locate tree-sitter.wasm
                        if (scriptName.includes('tree-sitter.wasm')) {
                            return wasmFileUrl;
                        }
                        return scriptName;
                    },
                });

                treeSitterInitialized = true;
                logger.info('Tree-sitter initialized', { wasmPath: wasmInfo.wasmPath });
            } catch (error) {
                treeSitterInitFailed = true;
                const errorMessage = error instanceof Error ? error.message : String(error);
                if (!initErrorLogged) {
                    const fallbackInfo = wasmInfo ?? this.resolveTreeSitterWasmPath();
                    logger.error('Failed to initialize tree-sitter', {
                        error: errorMessage,
                        wasmPath: fallbackInfo.wasmPath,
                        candidates: fallbackInfo.candidates,
                        extensionPath: this.extensionPath,
                    });
                    initErrorLogged = true;
                }
                throw error;
            } finally {
                if (treeSitterInitFailed) {
                    treeSitterInitPromise = null;
                }
            }
        })();

        return treeSitterInitPromise;
    }

    /**
     * Convert a file path to a file URL
     * Required for web-tree-sitter in Node.js environment
     */
    private pathToFileUrl(filePath: string): string {
        // Normalize path separators
        const normalizedPath = filePath.replace(/\\/g, '/');
        
        // Handle Windows absolute paths (e.g., C:/path/to/file)
        if (/^[a-zA-Z]:/.test(normalizedPath)) {
            return `file:///${normalizedPath}`;
        }
        
        // Handle Unix absolute paths
        if (normalizedPath.startsWith('/')) {
            return `file://${normalizedPath}`;
        }
        
        // Relative path - convert to absolute first
        const absolutePath = path.resolve(filePath).replace(/\\/g, '/');
        if (/^[a-zA-Z]:/.test(absolutePath)) {
            return `file:///${absolutePath}`;
        }
        return `file://${absolutePath}`;
    }

    /**
     * Load a language grammar
     */
    async loadLanguage(language: SupportedLanguage): Promise<void> {
        if (this.languages.has(language)) return;

        // Check if already loading
        const existingPromise = this.loadingPromises.get(language);
        if (existingPromise) {
            await existingPromise;
            return;
        }

        const loadPromise = this.doLoadLanguage(language);
        this.loadingPromises.set(language, loadPromise);

        try {
            await loadPromise;
        } finally {
            this.loadingPromises.delete(language);
        }
    }

    private async doLoadLanguage(language: SupportedLanguage): Promise<void> {
        await this.initialize();
        if (!TreeSitter) {
            throw new Error('Tree-sitter not initialized');
        }

        const wasmUrl = LANGUAGE_WASM_URLS[language];
        if (!wasmUrl) {
            throw new Error(`Unsupported language: ${language}`);
        }

        try {
            logger.debug(`Loading language: ${language}`);
            
            // Fetch WASM from CDN
            const response = await fetch(wasmUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch ${language} WASM: ${response.status}`);
            }
            
            const wasmBuffer = await response.arrayBuffer();
            const lang = await TreeSitter.Language.load(new Uint8Array(wasmBuffer));
            
            this.languages.set(language, lang);
            logger.info(`Loaded language: ${language}`);
        } catch (error) {
            logger.error(`Failed to load language ${language}:`, error);
            throw error;
        }
    }

    /**
     * Get or create a parser for a language
     */
    async getParser(language: SupportedLanguage): Promise<TreeSitterParser> {
        await this.loadLanguage(language);
        if (!TreeSitter) {
            throw new Error('Tree-sitter not initialized');
        }

        let parser = this.parsers.get(language);
        if (!parser) {
            parser = new TreeSitter.Parser() as TreeSitterParser;
            parser.setLanguage(this.languages.get(language));
            this.parsers.set(language, parser);
        }

        return parser;
    }

    /**
     * Parse content with a specific language
     */
    async parse(content: string, language: SupportedLanguage): Promise<ParseTree> {
        const parser = await this.getParser(language);
        return parser.parse(content);
    }

    /**
     * Check if a language is supported
     */
    isSupported(language: string): language is SupportedLanguage {
        return language in LANGUAGE_WASM_URLS;
    }

    /**
     * Get supported languages
     */
    getSupportedLanguages(): SupportedLanguage[] {
        return Object.keys(LANGUAGE_WASM_URLS) as SupportedLanguage[];
    }

    /**
     * Map file extension to language
     */
    getLanguageForExtension(ext: string): SupportedLanguage | null {
        const extMap: Record<string, SupportedLanguage> = {
            '.py': 'python',
            '.pyi': 'python',
            '.rs': 'rust',
            '.go': 'go',
            '.java': 'java',
            '.cs': 'c_sharp',
            '.rb': 'ruby',
            '.php': 'php',
        };
        return extMap[ext] ?? null;
    }

    private resolveTreeSitterWasmPath(): { wasmPath: string; candidates: string[] } {
        const candidates = [
            path.join(this.extensionPath, 'dist', 'tree-sitter.wasm'),
            path.join(this.extensionPath, 'resources', 'tree-sitter', 'tree-sitter.wasm'),
            path.join(this.extensionPath, 'node_modules', 'web-tree-sitter', 'tree-sitter.wasm'),
            path.join(this.extensionPath, 'node_modules', 'web-tree-sitter', 'web-tree-sitter.wasm'),
            path.join(this.extensionPath, 'node_modules', 'web-tree-sitter', 'debug', 'web-tree-sitter.wasm'),
        ];

        for (const candidate of candidates) {
            if (fs.existsSync(candidate)) {
                return { wasmPath: candidate, candidates };
            }
        }

        return { wasmPath: candidates[candidates.length - 1], candidates };
    }

    private normalizeTreeSitterModule(module: unknown): TreeSitterApi {
        const mod = module as Record<string, unknown> | undefined;
        const parserCandidate = (mod?.Parser as TreeSitterApi['Parser'] | undefined) ??
            (mod?.default as TreeSitterApi['Parser'] | undefined) ??
            (mod as TreeSitterApi['Parser'] | undefined);
        const languageCandidate = (mod?.Language as TreeSitterApi['Language'] | undefined) ??
            (parserCandidate as unknown as { Language?: TreeSitterApi['Language'] })?.Language;
        const initCandidate = (parserCandidate as unknown as { init?: TreeSitterApi['init'] })?.init ??
            (mod?.init as TreeSitterApi['init'] | undefined);

        if (!parserCandidate || !languageCandidate || typeof initCandidate !== 'function') {
            const keys = mod ? Object.keys(mod) : [];
            throw new Error(`Unsupported web-tree-sitter module shape (exports: ${keys.join(', ')})`);
        }

        return {
            Parser: parserCandidate,
            Language: languageCandidate,
            init: initCandidate,
        };
    }

    /**
     * Dispose all parsers
     */
    dispose(): void {
        this.parsers.clear();
        this.languages.clear();
        this.loadingPromises.clear();
    }
}

// Singleton instance
let managerInstance: TreeSitterManager | null = null;

export function getTreeSitterManager(extensionPath: string): TreeSitterManager {
    if (!managerInstance) {
        managerInstance = new TreeSitterManager(extensionPath);
    }
    return managerInstance;
}

export function resetTreeSitterManager(): void {
    if (managerInstance) {
        managerInstance.dispose();
        managerInstance = null;
    }
    TreeSitter = null;
    treeSitterInitialized = false;
    treeSitterInitFailed = false;
    initErrorLogged = false;
    treeSitterInitPromise = null;
}
