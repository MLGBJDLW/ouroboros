/**
 * Generic Indexer
 * Regex-based fallback indexer for unsupported languages
 * Always returns confidence: 'low'
 * 
 * Supports:
 * - Python, Rust, Go, Java, Kotlin, C#, Ruby, PHP, C/C++, Swift, Scala
 * - Common import patterns for each language
 * - Entrypoint detection (main functions, web frameworks, CLI)
 */

import { BaseIndexer, type IndexerOptions } from './BaseIndexer';
import type { GraphNode, GraphEdge, IndexResult } from '../core/types';

// Common import patterns across languages
const IMPORT_PATTERNS: Array<{
    pattern: RegExp;
    language?: string;
    extractModule: (match: RegExpMatchArray) => string;
}> = [
    // Python: import x, from x import y
    { pattern: /^import\s+([a-zA-Z_][a-zA-Z0-9_.]*)/m, language: 'python', extractModule: m => m[1] },
    { pattern: /^from\s+([a-zA-Z_.][a-zA-Z0-9_.]*)\s+import/m, language: 'python', extractModule: m => m[1] },
    
    // Rust: use crate::x, mod x
    { pattern: /^use\s+([a-zA-Z_][a-zA-Z0-9_:]*)/m, language: 'rust', extractModule: m => m[1] },
    { pattern: /^mod\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*;/m, language: 'rust', extractModule: m => m[1] },
    { pattern: /^pub\s+use\s+([a-zA-Z_][a-zA-Z0-9_:]*)/m, language: 'rust', extractModule: m => m[1] },
    
    // Go: import "x"
    { pattern: /import\s+"([^"]+)"/g, language: 'go', extractModule: m => m[1] },
    { pattern: /import\s+\w+\s+"([^"]+)"/g, language: 'go', extractModule: m => m[1] },
    
    // Java/Kotlin: import x.y.z
    { pattern: /^import\s+(?:static\s+)?([a-zA-Z_][a-zA-Z0-9_.]*);?/m, language: 'java', extractModule: m => m[1] },
    
    // C#: using X.Y.Z
    { pattern: /^using\s+(?:static\s+)?([a-zA-Z_][a-zA-Z0-9_.]*);/m, language: 'csharp', extractModule: m => m[1] },
    { pattern: /^using\s+\w+\s*=\s*([a-zA-Z_][a-zA-Z0-9_.]*);/m, language: 'csharp', extractModule: m => m[1] },
    
    // Ruby: require 'x', require_relative 'x'
    { pattern: /require(?:_relative)?\s+['"]([^'"]+)['"]/g, language: 'ruby', extractModule: m => m[1] },
    { pattern: /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g, language: 'ruby', extractModule: m => m[1] },
    
    // PHP: use X\Y\Z, require 'x'
    { pattern: /^use\s+([a-zA-Z_\\][a-zA-Z0-9_\\]*)/m, language: 'php', extractModule: m => m[1] },
    { pattern: /(?:require|include)(?:_once)?\s+['"]([^'"]+)['"]/g, language: 'php', extractModule: m => m[1] },
    { pattern: /(?:require|include)(?:_once)?\s*\(\s*['"]([^'"]+)['"]\s*\)/g, language: 'php', extractModule: m => m[1] },
    
    // C/C++: #include <x> or #include "x"
    { pattern: /#include\s*[<"]([^>"]+)[>"]/g, language: 'c', extractModule: m => m[1] },
    
    // Swift: import X
    { pattern: /^import\s+([a-zA-Z_][a-zA-Z0-9_]*)/m, language: 'swift', extractModule: m => m[1] },
    { pattern: /^@testable\s+import\s+([a-zA-Z_][a-zA-Z0-9_]*)/m, language: 'swift', extractModule: m => m[1] },
    
    // Scala: import x.y.z
    { pattern: /^import\s+([a-zA-Z_][a-zA-Z0-9_.{}]*)/m, language: 'scala', extractModule: m => m[1] },
    
    // Dart: import 'package:x/y.dart'
    { pattern: /import\s+['"]([^'"]+)['"]/g, language: 'dart', extractModule: m => m[1] },
    
    // Elixir: import/use/alias
    { pattern: /^(?:import|use|alias)\s+([A-Z][a-zA-Z0-9_.]*)/m, language: 'elixir', extractModule: m => m[1] },
];

// Common entrypoint patterns
const ENTRYPOINT_PATTERNS: Array<{
    pattern: RegExp;
    type: 'main' | 'api' | 'command' | 'test';
    language?: string;
    framework?: string;
}> = [
    // Main functions
    { pattern: /if\s+__name__\s*==\s*['"]__main__['"]/m, type: 'main', language: 'python' },
    { pattern: /fn\s+main\s*\(/m, type: 'main', language: 'rust' },
    { pattern: /func\s+main\s*\(/m, type: 'main', language: 'go' },
    { pattern: /public\s+static\s+void\s+main/m, type: 'main', language: 'java' },
    { pattern: /static\s+void\s+Main\s*\(/m, type: 'main', language: 'csharp' },
    { pattern: /int\s+main\s*\(/m, type: 'main', language: 'c' },
    { pattern: /func\s+main\s*\(\s*\)/m, type: 'main', language: 'swift' },
    { pattern: /def\s+main\s*\(/m, type: 'main', language: 'scala' },
    
    // Web frameworks - Python
    { pattern: /@(app|router)\.(get|post|put|delete|patch)\s*\(/m, type: 'api', framework: 'fastapi' },
    { pattern: /@app\.route\s*\(/m, type: 'api', framework: 'flask' },
    { pattern: /class\s+\w+\(APIView\)/m, type: 'api', framework: 'django-rest' },
    
    // Web frameworks - Java
    { pattern: /@(Get|Post|Put|Delete|Patch)Mapping/m, type: 'api', language: 'java', framework: 'spring' },
    { pattern: /@RestController/m, type: 'api', language: 'java', framework: 'spring' },
    { pattern: /@Path\s*\(/m, type: 'api', language: 'java', framework: 'jakarta' },
    
    // Web frameworks - Rust
    { pattern: /#\[(get|post|put|delete)\s*\(/m, type: 'api', language: 'rust', framework: 'web' },
    { pattern: /#\[actix_web::main\]/m, type: 'api', language: 'rust', framework: 'actix' },
    
    // Web frameworks - Go
    { pattern: /gin\.Default\(\)/m, type: 'api', language: 'go', framework: 'gin' },
    { pattern: /echo\.New\(\)/m, type: 'api', language: 'go', framework: 'echo' },
    { pattern: /fiber\.New\(\)/m, type: 'api', language: 'go', framework: 'fiber' },
    
    // CLI frameworks
    { pattern: /@click\.(command|group)/m, type: 'command', language: 'python', framework: 'click' },
    { pattern: /typer\.Typer\(\)/m, type: 'command', language: 'python', framework: 'typer' },
    { pattern: /#\[derive\(.*Clap.*\)\]/m, type: 'command', language: 'rust', framework: 'clap' },
    { pattern: /cobra\.Command/m, type: 'command', language: 'go', framework: 'cobra' },
    
    // Test patterns
    { pattern: /def\s+test_\w+\s*\(/m, type: 'test', language: 'python', framework: 'pytest' },
    { pattern: /@Test\s*\n/m, type: 'test', language: 'java', framework: 'junit' },
    { pattern: /func\s+Test[A-Z]\w*\s*\(/m, type: 'test', language: 'go', framework: 'go-test' },
    { pattern: /#\[test\]/m, type: 'test', language: 'rust', framework: 'rust-test' },
    { pattern: /describe\s*\(\s*['"`]/m, type: 'test', framework: 'jest' },
    { pattern: /it\s*\(\s*['"`]/m, type: 'test', framework: 'mocha' },
];

export class GenericIndexer extends BaseIndexer {
    readonly supportedExtensions: string[] = [];  // Accepts all files
    
    constructor(options: IndexerOptions) {
        super(options);
    }

    get extensions(): string[] {
        return this.supportedExtensions;
    }

    supports(filePath: string): boolean {
        // Generic indexer is a fallback, supports any file
        // But skip binary and known non-code files
        const skipExtensions = [
            '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.bmp',
            '.woff', '.woff2', '.ttf', '.eot', '.otf',
            '.zip', '.tar', '.gz', '.rar', '.7z', '.bz2',
            '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
            '.exe', '.dll', '.so', '.dylib', '.a', '.o', '.obj',
            '.lock', '.sum', '.mod',
            '.map', '.min.js', '.min.css',
            '.wasm', '.pyc', '.pyo', '.class',
        ];
        return !skipExtensions.some(ext => filePath.toLowerCase().endsWith(ext));
    }

    async indexFile(filePath: string, content: string): Promise<IndexResult> {
        const nodes: GraphNode[] = [];
        const edges: GraphEdge[] = [];
        const exports: string[] = [];

        const lines = content.split('\n');
        const detectedLanguage = this.detectLanguage(filePath);
        const isTestFile = this.isTestFile(filePath, detectedLanguage);

        // Extract imports
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            for (const { pattern, extractModule } of IMPORT_PATTERNS) {
                // Reset regex lastIndex for global patterns
                pattern.lastIndex = 0;
                
                let match;
                while ((match = pattern.exec(line)) !== null) {
                    const modulePath = extractModule(match);
                    edges.push(this.createGenericImportEdge(filePath, modulePath, i + 1));
                    
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
        for (const { pattern, type, framework } of ENTRYPOINT_PATTERNS) {
            if (pattern.test(content)) {
                // Test files get test entrypoint
                if (isTestFile && type !== 'test') {
                    continue;
                }
                
                const entrypointName = type === 'main' ? 'Main' : 
                                       type === 'api' ? 'API' : 
                                       type === 'command' ? 'CLI' : 'Test';
                
                nodes.push({
                    id: `entrypoint:${type}:${filePath}`,
                    kind: 'entrypoint',
                    name: `${entrypointName}: ${this.getFileName(filePath)}`,
                    path: filePath,
                    meta: {
                        entrypointType: type,
                        language: detectedLanguage,
                        framework: framework,
                        confidence: 'low',
                    },
                });
                break;  // Only one entrypoint per file
            }
        }

        // If test file but no test entrypoint detected, add one
        if (isTestFile && !nodes.some(n => n.kind === 'entrypoint')) {
            nodes.push({
                id: `entrypoint:test:${filePath}`,
                kind: 'entrypoint',
                name: `Test: ${this.getFileName(filePath)}`,
                path: filePath,
                meta: {
                    entrypointType: 'test',
                    language: detectedLanguage,
                    confidence: 'low',
                },
            });
        }

        return { nodes, edges };
    }

    /**
     * Check if file is a test file
     */
    private isTestFile(filePath: string, language: string): boolean {
        const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();
        const fileName = this.getFileName(filePath).toLowerCase();
        
        // Common test directory patterns
        if (normalizedPath.includes('/test/') || 
            normalizedPath.includes('/tests/') ||
            normalizedPath.includes('/__tests__/') ||
            normalizedPath.includes('/spec/') ||
            normalizedPath.includes('/specs/')) {
            return true;
        }
        
        // Language-specific test file patterns
        switch (language) {
            case 'python':
                return fileName.startsWith('test_') || fileName.endsWith('_test.py');
            case 'go':
                return fileName.endsWith('_test.go');
            case 'rust':
                return fileName.endsWith('_test.rs') || normalizedPath.includes('/tests/');
            case 'java':
            case 'kotlin':
                return fileName.endsWith('test.java') || fileName.endsWith('test.kt') ||
                       fileName.endsWith('tests.java') || fileName.endsWith('tests.kt') ||
                       fileName.endsWith('spec.java') || fileName.endsWith('spec.kt');
            case 'ruby':
                return fileName.endsWith('_spec.rb') || fileName.endsWith('_test.rb');
            case 'csharp':
                return fileName.endsWith('tests.cs') || fileName.endsWith('test.cs');
            default:
                return fileName.includes('.test.') || fileName.includes('.spec.') ||
                       fileName.includes('_test.') || fileName.includes('_spec.');
        }
    }

    /**
     * Create import edge with low confidence
     */
    private createGenericImportEdge(fromFile: string, toModule: string, line: number): GraphEdge {
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
        const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
        const extMap: Record<string, string> = {
            // Python
            '.py': 'python',
            '.pyi': 'python',
            '.pyx': 'python',
            '.pxd': 'python',
            // Rust
            '.rs': 'rust',
            // Go
            '.go': 'go',
            // Java
            '.java': 'java',
            // Kotlin
            '.kt': 'kotlin',
            '.kts': 'kotlin',
            // C#
            '.cs': 'csharp',
            '.csx': 'csharp',
            // Ruby
            '.rb': 'ruby',
            '.rake': 'ruby',
            '.gemspec': 'ruby',
            // PHP
            '.php': 'php',
            '.phtml': 'php',
            // C/C++
            '.c': 'c',
            '.h': 'c',
            '.cpp': 'cpp',
            '.hpp': 'cpp',
            '.cc': 'cpp',
            '.cxx': 'cpp',
            '.hxx': 'cpp',
            '.hh': 'cpp',
            // Swift
            '.swift': 'swift',
            // Scala
            '.scala': 'scala',
            '.sc': 'scala',
            // Groovy
            '.groovy': 'groovy',
            '.gradle': 'groovy',
            // Lua
            '.lua': 'lua',
            // R
            '.r': 'r',
            '.R': 'r',
            '.rmd': 'r',
            // Perl
            '.pl': 'perl',
            '.pm': 'perl',
            // Shell
            '.sh': 'shell',
            '.bash': 'shell',
            '.zsh': 'shell',
            '.fish': 'shell',
            // Dart
            '.dart': 'dart',
            // Elixir
            '.ex': 'elixir',
            '.exs': 'elixir',
            // Erlang
            '.erl': 'erlang',
            '.hrl': 'erlang',
            // Haskell
            '.hs': 'haskell',
            '.lhs': 'haskell',
            // F#
            '.fs': 'fsharp',
            '.fsx': 'fsharp',
            // OCaml
            '.ml': 'ocaml',
            '.mli': 'ocaml',
            // Clojure
            '.clj': 'clojure',
            '.cljs': 'clojure',
            '.cljc': 'clojure',
            // Julia
            '.jl': 'julia',
            // Nim
            '.nim': 'nim',
            // Zig
            '.zig': 'zig',
            // V
            '.v': 'vlang',
            // Crystal
            '.cr': 'crystal',
        };
        return extMap[ext] ?? 'unknown';
    }

    /**
     * Get file name from path
     */
    private getFileName(filePath: string): string {
        const normalized = filePath.replace(/\\/g, '/');
        return normalized.split('/').pop() ?? filePath;
    }
}
