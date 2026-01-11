# Code Graph Upgrade Path

> Roadmap from MVP to full-featured system

## Version Overview

| Version | Focus | Timeline | Key Features |
|---------|-------|----------|--------------|
| MVP (v0.1) | Core Value | 2-3 weeks | TS indexing, 3 issues, 3 tools |
| v0.2 | Accuracy | 2 weeks | tsconfig paths, barrel handling |
| v0.3 | Frameworks | 3 weeks | Express, Next.js, NestJS adapters |
| v0.4 | Multi-lang | 3 weeks | Python, generic fallback |
| v0.5 | Architecture | 2 weeks | Cycles, layer rules |
| v1.0 | Production | 2 weeks | Polish, performance, docs |

---

## MVP (v0.1) - Core Value Proof

**Goal**: Prove the concept works and provides value

### Deliverables

```
✅ TypeScript/JavaScript static import parsing
✅ Basic entrypoint detection (pattern-based)
✅ 3 Issue types:
   - HANDLER_UNREACHABLE
   - DYNAMIC_EDGE_UNKNOWN  
   - BROKEN_EXPORT_CHAIN
✅ 3 LM Tools:
   - graph.digest
   - graph.issues
   - graph.impact
✅ In-memory graph store with JSON persistence
✅ File watcher for incremental updates
✅ Basic sidebar integration (stats display)
```

### Architecture

```
src/codeGraph/
├── core/
│   ├── types.ts
│   ├── GraphStore.ts
│   └── GraphQuery.ts
├── indexers/
│   ├── BaseIndexer.ts
│   ├── TypeScriptIndexer.ts
│   └── EntrypointDetector.ts
├── analyzers/
│   ├── ReachabilityAnalyzer.ts
│   └── IssueDetector.ts
├── tools/
│   ├── graphDigest.ts
│   ├── graphIssues.ts
│   └── graphImpact.ts
└── watcher/
    └── IncrementalWatcher.ts
```

### Limitations (Accepted)

- No tsconfig paths resolution
- No framework-specific detection
- No cycle detection
- No layer rules
- Basic visualization only
- Single-package repos only

---

## v0.2 - Accuracy Improvements

**Goal**: Handle real-world TypeScript projects accurately

### New Features

```
🆕 tsconfig.json paths alias resolution
🆕 Barrel file (index.ts) proper handling
🆕 Re-export chain tracking
🆕 CIRCULAR_REEXPORT issue type
🆕 Improved confidence scoring
🆕 Annotations system (manual edge hints)
```

### Technical Changes

```typescript
// Enhanced path resolution
class PathResolver {
  private tsconfig: TSConfig;
  
  resolve(importPath: string, fromFile: string): ResolvedPath {
    // 1. Check tsconfig paths
    // 2. Check baseUrl
    // 3. Resolve relative
    // 4. Handle index.ts barrels
  }
}

// Barrel tracking
interface BarrelInfo {
  path: string;
  reexports: Array<{
    source: string;
    symbols: string[] | "*";
    resolved: boolean;
  }>;
}
```

### New Tool

```json
{
  "name": "ouroborosai_graph_annotations",
  "description": "Manage manual graph annotations"
}
```

### File Changes

```
src/codeGraph/
├── core/
│   └── PathResolver.ts        # NEW
├── indexers/
│   └── BarrelAnalyzer.ts      # NEW
└── annotations/
    └── AnnotationManager.ts   # NEW
```

---

## v0.3 - Framework Adapters

**Goal**: Accurate entrypoint detection for popular frameworks

### Supported Frameworks

**JavaScript/TypeScript:**
| Framework | Entrypoint Type | Detection Method |
|-----------|-----------------|------------------|
| Express/Koa/Fastify/Hono | Routes | `app.get()`, `router.use()` |
| Next.js | Pages, API | File-based (`pages/`, `app/`) |
| Nuxt | Pages, API | File-based (`pages/`, `server/`) |
| SvelteKit | Routes | File-based (`routes/`) |
| Remix | Routes | File-based (`routes/`) |
| Astro | Pages | File-based (`pages/`) |
| NestJS | Controllers | `@Controller`, `@Module` |
| CLI (commander/yargs) | Commands | `.command()` |

**Python:**
| Framework | Entrypoint Type | Detection Method |
|-----------|-----------------|------------------|
| FastAPI | Routes | `@app.get()`, `APIRouter` |
| Flask | Routes | `@app.route()`, blueprints |
| Django | Views | `urls.py`, `views.py` |
| Click | Commands | `@click.command()` |

**Rust:**
| Framework | Entrypoint Type | Detection Method |
|-----------|-----------------|------------------|
| Actix-web | Routes | `#[get]`, `web::resource` |
| Axum | Routes | `Router::new()` |
| Rocket | Routes | `#[get]`, `#[post]` |
| Clap | Commands | `#[command]` |

**Go:**
| Framework | Entrypoint Type | Detection Method |
|-----------|-----------------|------------------|
| Gin | Routes | `r.GET()` |
| Echo | Routes | `e.GET()` |
| Cobra | Commands | `&cobra.Command{}` |

**Java:**
| Framework | Entrypoint Type | Detection Method |
|-----------|-----------------|------------------|
| Spring Boot | Controllers | `@RestController` |

**Ruby:**
| Framework | Entrypoint Type | Detection Method |
|-----------|-----------------|------------------|
| Rails | Controllers | `routes.rb` |

**PHP:**
| Framework | Entrypoint Type | Detection Method |
|-----------|-----------------|------------------|
| Laravel | Controllers | `routes/web.php` |

### Architecture

```typescript
// Adapter interface
interface FrameworkAdapter {
  name: string;
  detect(projectRoot: string): Promise<boolean>;
  extractEntrypoints(store: GraphStore): Promise<GraphNode[]>;
  extractRegistrations(store: GraphStore): Promise<GraphEdge[]>;
  detectIssues?(store: GraphStore): Promise<GraphIssue[]>;
}

// Registry
class AdapterRegistry {
  private adapters: FrameworkAdapter[] = [];
  
  async detectFrameworks(root: string): Promise<string[]>;
  async runAdapters(store: GraphStore): Promise<void>;
}
```

### New Issue Types

```
🆕 ENTRY_MISSING_HANDLER - Route defined, handler not found
🆕 NOT_REGISTERED - Implementation exists, not registered
```

### File Changes

```
src/codeGraph/
├── adapters/
│   ├── AdapterRegistry.ts     # NEW - Manages all adapters
│   ├── js/
│   │   ├── ExpressAdapter.ts  # Express/Koa/Fastify/Hono
│   │   ├── NextjsAdapter.ts   # Next.js
│   │   ├── NuxtAdapter.ts     # Nuxt
│   │   ├── SvelteKitAdapter.ts # SvelteKit
│   │   ├── RemixAdapter.ts    # Remix
│   │   ├── AstroAdapter.ts    # Astro
│   │   ├── NestjsAdapter.ts   # NestJS
│   │   └── JsCliAdapter.ts    # commander/yargs
│   ├── python/
│   │   ├── FastAPIAdapter.ts  # FastAPI
│   │   ├── FlaskAdapter.ts    # Flask
│   │   ├── DjangoAdapter.ts   # Django
│   │   └── ClickAdapter.ts    # Click CLI
│   ├── rust/
│   │   ├── ActixAdapter.ts    # Actix-web
│   │   ├── AxumAdapter.ts     # Axum
│   │   ├── RocketAdapter.ts   # Rocket
│   │   └── ClapAdapter.ts     # Clap CLI
│   ├── go/
│   │   ├── GinAdapter.ts      # Gin
│   │   ├── EchoAdapter.ts     # Echo
│   │   └── CobraAdapter.ts    # Cobra CLI
│   ├── java/
│   │   └── SpringAdapter.ts   # Spring Boot
│   ├── ruby/
│   │   └── RailsAdapter.ts    # Rails
│   └── php/
│       └── LaravelAdapter.ts  # Laravel
```

---

## v0.4 - Multi-Language Support

**Goal**: Support all major programming languages

### Language Support

| Language | Parser | Extensions | Confidence |
|----------|--------|------------|------------|
| TypeScript | TS Compiler API | `.ts`, `.tsx` | High |
| JavaScript | TS Compiler API | `.js`, `.jsx` | High |
| Python | tree-sitter | `.py`, `.pyi` | High |
| Rust | tree-sitter | `.rs` | High |
| Go | tree-sitter | `.go` | Medium |
| Java | tree-sitter | `.java` | Medium |
| C# | tree-sitter | `.cs` | Medium |
| Ruby | tree-sitter | `.rb` | Medium |
| PHP | tree-sitter | `.php` | Medium |
| Other | Regex fallback | `*` | Low |

### Language Indexers

```typescript
// Python Indexer
class PythonIndexer extends BaseIndexer {
  readonly supportedExtensions = [".py", ".pyi"];
  
  // Detect:
  // - import x / from x import y
  // - __all__ exports
  // - if __name__ == "__main__" entrypoints
  // - @decorator patterns (FastAPI, Flask, Click)
}

// Rust Indexer
class RustIndexer extends BaseIndexer {
  readonly supportedExtensions = [".rs"];
  
  // Detect:
  // - use x::y / mod x
  // - pub fn/struct/enum exports
  // - #[tokio::main] / fn main() entrypoints
  // - #[get], #[post] route attributes
}

// Go Indexer
class GoIndexer extends BaseIndexer {
  readonly supportedExtensions = [".go"];
  
  // Detect:
  // - import "x" / import (...)
  // - Exported symbols (capitalized)
  // - func main() entrypoints
}

// Java Indexer
class JavaIndexer extends BaseIndexer {
  readonly supportedExtensions = [".java"];
  
  // Detect:
  // - import x.y.z
  // - public class/interface exports
  // - public static void main() entrypoints
  // - @RestController, @RequestMapping annotations
}
```

### Generic Fallback

```typescript
class GenericIndexer extends BaseIndexer {
  // Regex-based detection for:
  // - Common import patterns across languages
  // - Export/public patterns
  // - Main/entrypoint patterns
  
  // Always returns confidence: "low"
  // Used for unsupported languages
}
```

### File Changes

```
src/codeGraph/
├── indexers/
│   ├── PythonIndexer.ts       # NEW
│   ├── RustIndexer.ts         # NEW
│   ├── GoIndexer.ts           # NEW
│   ├── JavaIndexer.ts         # NEW
│   ├── CSharpIndexer.ts       # NEW
│   ├── RubyIndexer.ts         # NEW
│   ├── PhpIndexer.ts          # NEW
│   └── GenericIndexer.ts      # NEW
├── parsers/
│   └── TreeSitterManager.ts   # NEW (manages tree-sitter instances)
```

### Dependencies

```json
{
  "dependencies": {
    "web-tree-sitter": "^0.22.0"
  }
}
```

Note: Using `web-tree-sitter` (WASM-based) for cross-platform compatibility. Language grammars loaded on-demand.

---

## v0.5 - Architecture Analysis

**Goal**: Detect structural problems and enforce rules

### New Features

```
🆕 Cycle detection (Tarjan's algorithm)
🆕 Layer violation rules (configurable)
🆕 Dependency depth analysis
🆕 Module coupling metrics
```

### Cycle Detection

```typescript
class CycleDetector {
  // Tarjan's strongly connected components
  findCycles(store: GraphStore): Cycle[] {
    // Returns all cycles with:
    // - Nodes involved
    // - Cycle length
    // - Severity (based on length and node types)
  }
}

interface Cycle {
  nodes: string[];
  length: number;
  severity: "warning" | "error";
  breakPoints: string[];  // Suggested places to break cycle
}
```

### Layer Rules

```typescript
interface LayerRule {
  name: string;
  from: string;        // Glob pattern
  cannotImport: string;  // Glob pattern
  mustGoThrough?: string;  // Optional intermediate layer
  severity: "warning" | "error";
}

// Configuration
{
  "layerRules": [
    {
      "name": "UI cannot import DB",
      "from": "src/ui/**",
      "cannotImport": "src/db/**",
      "severity": "error"
    }
  ]
}
```

### New Issue Types

```
🆕 CYCLE_RISK - Circular dependency detected
🆕 LAYER_VIOLATION - Architectural rule violated
```

### New Tools

```json
{
  "name": "ouroborosai_graph_cycles",
  "description": "List circular dependencies"
},
{
  "name": "ouroborosai_graph_layers",
  "description": "Check layer rule violations"
}
```

---

## v1.0 - Production Ready

**Goal**: Polish, performance, documentation

### Performance Optimizations

```typescript
// Parallel indexing
class ParallelIndexer {
  async indexAll(files: string[]): Promise<void> {
    const BATCH_SIZE = 50;
    const batches = chunk(files, BATCH_SIZE);
    
    for (const batch of batches) {
      await Promise.all(batch.map(f => this.indexFile(f)));
    }
  }
}

// Incremental persistence
class IncrementalPersistence {
  // Only write changed portions
  // Use append-only log for changes
  // Periodic compaction
}

// Query caching
class QueryCache {
  private cache: LRUCache<string, unknown>;
  
  // Cache digest, impact results
  // Invalidate on graph changes
}
```

### Visualization (Sidebar)

```
🆕 Interactive dependency graph (vis-network)
🆕 Issue list with filters
🆕 Impact visualization
🆕 One-click "Fix with Copilot"
```

### Documentation

```
🆕 User guide
🆕 Configuration reference
🆕 Framework adapter guide
🆕 Troubleshooting guide
```

### Quality

```
🆕 90%+ test coverage
🆕 Performance benchmarks
🆕 Error recovery improvements
🆕 Telemetry (opt-in)
```


---

## Feature Comparison Matrix

| Feature | MVP | v0.2 | v0.3 | v0.4 | v0.5 | v1.0 |
|---------|-----|------|------|------|------|------|
| **Indexing** |
| TS/JS static imports | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| tsconfig paths | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Barrel files | ⚠️ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Python | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Rust | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Go | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Java | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| C#/Ruby/PHP | ❌ | ❌ | ❌ | ⚠️ | ✅ | ✅ |
| Generic fallback | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Frameworks** |
| Pattern-based | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Express/Koa/Hono | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Fastify | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Next.js | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Nuxt/SvelteKit/Remix | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| NestJS | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| FastAPI/Flask/Django | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Actix/Axum/Rocket | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Gin/Echo | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Spring Boot | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Rails/Laravel | ❌ | ❌ | ❌ | ⚠️ | ✅ | ✅ |
| CLI tools | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Issues** |
| HANDLER_UNREACHABLE | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DYNAMIC_EDGE_UNKNOWN | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| BROKEN_EXPORT_CHAIN | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ENTRY_MISSING_HANDLER | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| NOT_REGISTERED | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| CYCLE_RISK | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| LAYER_VIOLATION | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| **Tools** |
| graph.digest | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| graph.issues | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| graph.impact | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| graph.path | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| graph.module | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| graph.annotations | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| graph.issue.explain | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| graph.issue.fixplan | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| **UI** |
| Stats display | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Issue list | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Interactive graph | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Fix with Copilot | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Infrastructure** |
| Incremental updates | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Annotations | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Monorepo support | ❌ | ⚠️ | ✅ | ✅ | ✅ | ✅ |
| Query caching | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

Legend: ✅ Full support | ⚠️ Partial | ❌ Not supported

---

## Migration Notes

### MVP → v0.2

**Breaking Changes**: None

**New Configuration**:
```json
// .ouroboros/graph/config.json
{
  "indexing": {
    "respectTsconfig": true  // NEW: default true
  }
}
```

**New Files**:
```
.ouroboros/graph/annotations.json  // User-provided hints
```

---

### v0.2 → v0.3

**Breaking Changes**: None

**New Configuration**:
```json
{
  "entrypoints": {
    "frameworks": ["auto"]  // NEW: auto-detect frameworks
    // Or specify: ["express", "nextjs"]
  }
}
```

**Behavior Change**:
- Entrypoint detection now uses framework adapters when available
- Pattern-based detection still works as fallback

---

### v0.3 → v0.4

**Breaking Changes**: None

**New Dependencies**:
```json
{
  "dependencies": {
    "tree-sitter": "^0.20.0",
    "tree-sitter-python": "^0.20.0"
  }
}
```

**New Configuration**:
```json
{
  "indexing": {
    "languages": ["typescript", "python"]  // NEW
  }
}
```

---

### v0.4 → v0.5

**Breaking Changes**: None

**New Configuration**:
```json
{
  "analysis": {
    "detectCycles": true,  // NEW: default false
    "layerRules": []       // NEW: user-defined rules
  }
}
```

---

### v0.5 → v1.0

**Breaking Changes**: None

**Performance Improvements**:
- Parallel indexing enabled by default
- Query caching enabled by default

**New Configuration**:
```json
{
  "performance": {
    "parallelIndexing": true,
    "cacheQueries": true,
    "maxCacheSize": 100
  }
}
```

---

## Deprecation Policy

1. Features deprecated in version N are removed in version N+2
2. Deprecated features log warnings
3. Migration guides provided for all breaking changes
4. Configuration schema versioned

---

## Contribution Guidelines

### Adding a New Indexer

1. Extend `BaseIndexer`
2. Implement `index(filePath, content): IndexResult`
3. Register in `IndexerRegistry`
4. Add tests with fixtures
5. Document supported patterns

### Adding a New Framework Adapter

1. Implement `FrameworkAdapter` interface
2. Add detection logic in `detect()`
3. Implement entrypoint extraction
4. Add to `AdapterRegistry`
5. Add integration tests
6. Document in framework guide

### Adding a New Issue Type

1. Add to `IssueKind` enum
2. Implement detection in appropriate analyzer
3. Define evidence format
4. Define suggested fixes
5. Add to ISSUES.md documentation
6. Add tests

---

## Performance Targets

| Metric | MVP | v1.0 |
|--------|-----|------|
| Full index (1000 files) | < 10s | < 3s |
| Incremental update | < 500ms | < 100ms |
| graph.digest | < 100ms | < 20ms |
| graph.impact (depth 2) | < 200ms | < 50ms |
| Memory (1000 files) | < 100MB | < 50MB |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Large repos slow | Scoping, incremental indexing, caching |
| False positives | Confidence levels, annotations, ignores |
| Framework changes | Adapter versioning, fallback to patterns |
| Token budget exceeded | Hard limits, truncation, pagination |
| Complex monorepos | Package-aware scoping, workspace support |
