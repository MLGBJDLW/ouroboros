/**
 * Generic Indexer
 * Regex-based fallback indexer for unsupported languages
 * Always returns confidence: 'low'
 */

import { BaseIndexer, type IndexerOptions } from './BaseIndexer';
import type { GraphNode, GraphEdge, IndexResult, Confidence } from '../core/types';
import { createLogger } from '../../utils/logger';

const logger = createLogger('GenericIndexer');

// Common import patterns across languages
const IMPORT_PATTERNS: Array<{
    pattern: RegExp;
    language?: string;
    extractModule: (match: RegExpMatchArray) => string;
}> = [
    // Python: import x, from x import y
    { pattern: /^import\s+([a-zA-Z_][a-zA-Z0-9_\.]*)/m, language: 'python', extractModule: m => m[1] },
    { pattern: /^from\s+([a-zA-Z_\.][a-zA-Z0-9_\.]*)\s+import/m, language: 'python', extractModule: m => m[1] },
    
    // Rust: use crate::x, mod x
    { pattern: /^use\s+([a-zA-Z_][a-zA-Z0-9_:]*)/m, language: 'rust', extractModule: m => m[1] },
    { pattern: /^mod\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*;/m, language: 'rust', extractModule: m => m[1] },
    
    // Go: import "x"
    { pattern: /import\s+"([^"]+)"/g, language: 'go', extractModule: m => m[1] },
    
    // Java/Kotlin: import x.y.z
    { pattern: /^import\s+([a-zA-Z_][a-zA-Z0-9_\.]*);?/m, language: 'java', extractModule: m => m[1] },
    
    // C#: using X.Y.Z
    { pattern: /^using\s+([a-zA-Z_][a-zA-Z0-9_\.]*);/m, language: 'csharp', extractModule: m => m[1] },
    
    // Ruby: require 'x', require_relative 'x'
    { pattern: /require(?:_relative)?\s+['"]([^'"]+)['"]/g, language: 'ruby', extractModule: m => m[1] },
    
    // PHP: use X\Y\Z, require 'x'
    { pattern: /^use\s+([a-zA-Z_\\][a-zA-Z0-9_\\]*)/m, language: 'php', extractModule: m => m[1] },
    { pattern: /(?:require|include)(?:_once)?\s+['"]([^'"]+)['"]/g, language: 'php', extractModule: m => m[1] },
    
    // C/C++: #include <x> or #include "x"
    { pattern: /#include\s*[<"]([^>"]+)[>"]/g, language: 'c', extractModule: m => m[1] },
    
    // Swift: import X
    { pattern: /^import\s+([a-zA-Z_][a-zA-Z0-9_]*)/m, language: 'swift', extractModule: m => m[1] },
    
    // Kotlin: import x.y.z
    { pattern: /^import\s+([a-zA-Z_][a-zA-Z0-9_\.]*)/m, language: 'kotlin', extractModule: m => m[1] },
];

// Common entrypoint patterns
const ENTRYPOINT_PATTERNS: Array<{
    pattern: RegExp;
    type: 'main' | 'api' | 'command';
    language?: string;
}> = [
    // Main functions
    { pattern: /if\s+__name__\s*==\s*['"]__main__['"]/m, type: 'main', language: 'python' },
    { pattern: /fn\s+main\s*\(/m, type: 'main', language: 'rust' },
    { pattern: /func\s+main\s*\(/m, type: 'main', language: 'go' },
    { pattern: /public\s+static\s+void\s+main/m, type: 'main', language: 'java' },
    { pattern: /static\s+void\s+Main\s*\(/m, type: 'main', language: 'csharp' },
    { pattern: /int\s+main\s*\(/m, type: 'main', language: 'c' },
    
    // Web frameworks
    { pattern: /@(app|router)\.(get|post|put|delete|patch)\s*\(/m, type: 'api' },
    { pattern: /@(Get|Post|Put|Delete|Patch)Mapping/m, type: 'api', language: 'java' },
    { pattern: /@RestController/m, type: 'api', language: 'java' },
    { pattern: /#\[(get|post|put|delete)\s*\(/m, type: 'api', language: 'rust' },
    
    // CLI
    { pattern: /@click\.(command|group)/m, type: 'command', language: 'python' },
    { pattern: /\.command\s*\(/m, type: 'command' },
];

export class GenericIndexer extends BaseIndexer {
    readonly supportedExtensions: string[] = [];  // Accepts all files
    
    constructor(options: IndexerOptions) {
        super(options);
    }

    supports(filePath: string): boolean {
        // Generic indexer is a fallback, supports any file
        // But skip binary and known non-code files
        const skipExtensions = [
            '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
            '.woff', '.woff2', '.ttf', '.eot',
            '.zip', '.tar', '.gz', '.rar',
            '.pdf', '.doc', '.docx',
            '.exe', '.dll', '.so', '.dylib',
            '.lock', '.sum',
        ];
        return !skipExtensions.some(ext => filePath.endsWith(ext));
    }

    async indexFile(filePath: string, content: string): Promise<IndexResult> {
        const nodes: GraphNode[] = [];
        const edges: GraphEdge[] = [];
        const exports: string[] = [];

        const lines = content.split('\n');
        const detectedLanguage = this.detectLanguage(filePath);

        // Extract imports
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            for (const { pattern, extractModule } of IMPORT_PATTERNS) {
                // Reset regex lastIndex for global patterns
                pattern.lastIndex = 0;
                
                let match;
                while ((match = pattern.exec(line)) !== null) {
                    const modulePath = extractModule(match);
                    edges.push(this.createImportEdge(filePath, modulePath, i + 1));
                    
                    // Break if not global pattern
                    if (!pattern.global) break;
                }
            }
        }

        // Create file node
        nodes.push({
            id: `file:${filePath}`,
            kind: 'file',
            name: this.getFileName(filePath),
            path: filePath,
            meta: {
                language: detectedLanguage,
                exports,
                confidence: 'low',
            },
        });

        // Detect entrypoints
        for (const { pattern, type, language } of ENTRYPOINT_PATTERNS) {
            if (pattern.test(content)) {
                nodes.push({
                    id: `entrypoint:${type}:${filePath}`,
                    kind: 'entrypoint',
                    name: `${type === 'main' ? 'Main' : type === 'api' ? 'API' : 'CLI'}: ${this.getFileName(filePath)}`,
                    path: filePath,
                    meta: {
                        entrypointType: type,
                        language: language || detectedLanguage,
                        confidence: 'low',
                    },
                });
                break;  // Only one entrypoint per file
            }
        }

        return { nodes, edges };
    }

    /**
     * Create import edge with low confidence
     */
    private createImportEdge(fromFile: string, toModule: string, line: number): GraphEdge {
        return {
            id: `edge:${fromFile}:${toModule}:${line}`,
            from: `file:${fromFile}`,
            to: `module:${toModule}`,
            kind: 'imports',
            confidence: 'low',
            meta: {
                importPath: toModule,
                loc: { line, column: 0 },
            },
        };
    }

    /**
     * Detect language from file extension
     */
    private detectLanguage(filePath: string): string {
        const ext = filePath.substring(filePath.lastIndexOf('.'));
        const extMap: Record<string, string> = {
            '.py': 'python',
            '.pyi': 'python',
            '.rs': 'rust',
            '.go': 'go',
            '.java': 'java',
            '.kt': 'kotlin',
            '.kts': 'kotlin',
            '.cs': 'csharp',
            '.rb': 'ruby',
            '.php': 'php',
            '.c': 'c',
            '.h': 'c',
            '.cpp': 'cpp',
            '.hpp': 'cpp',
            '.cc': 'cpp',
            '.swift': 'swift',
            '.scala': 'scala',
            '.groovy': 'groovy',
            '.lua': 'lua',
            '.r': 'r',
            '.R': 'r',
            '.pl': 'perl',
            '.pm': 'perl',
            '.sh': 'shell',
            '.bash': 'shell',
            '.zsh': 'shell',
        };
        return extMap[ext] ?? 'unknown';
    }

    /**
     * Get file name from path
     */
    private getFileName(filePath: string): string {
        return filePath.split('/').pop() ?? filePath;
    }
}
