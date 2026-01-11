/**
 * Tree-Sitter Manager
 * Manages tree-sitter parser instances and language loading
 */

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
let TreeSitter: any = null;
let treeSitterInitialized = false;
let treeSitterInitFailed = false; // Track if init already failed
let initErrorLogged = false; // Only log error once

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

        try {
            // Dynamic import for web-tree-sitter
            const module = await import('web-tree-sitter');
            TreeSitter = module.default || module;
            
            // Initialize with WASM path
            await TreeSitter.init({
                locateFile: (scriptName: string) => {
                    // Try to locate tree-sitter.wasm
                    if (scriptName.includes('tree-sitter.wasm')) {
                        // Check node_modules path
                        return path.join(
                            this.extensionPath,
                            'node_modules',
                            'web-tree-sitter',
                            'tree-sitter.wasm'
                        );
                    }
                    return scriptName;
                },
            });
            
            treeSitterInitialized = true;
            logger.info('Tree-sitter initialized');
        } catch (error) {
            treeSitterInitFailed = true;
            if (!initErrorLogged) {
                logger.debug('Tree-sitter not available in this environment');
                initErrorLogged = true;
            }
            throw error;
        }
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

        let parser = this.parsers.get(language);
        if (!parser) {
            parser = new TreeSitter() as TreeSitterParser;
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
}
