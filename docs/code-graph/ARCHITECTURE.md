# Code Graph Architecture

> System design, data structures, and component interactions

## Design Principles

1. **Graph as Truth Layer** - Single source of structural knowledge
2. **Query, Don't Dump** - Never expose full graph; always filtered views
3. **Confidence Over Certainty** - Mark uncertainty explicitly
4. **Incremental by Default** - Minimize re-indexing cost
5. **Adapter Pattern** - Pluggable language/framework support

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         VS Code Extension                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
│  │   LM Tools   │  │   Sidebar    │  │    Commands/Actions      │   │
│  │  (Copilot)   │  │  (Webview)   │  │  (User interactions)     │   │
│  └──────┬───────┘  └──────┬───────┘  └────────────┬─────────────┘   │
│         │                 │                        │                 │
│         └─────────────────┼────────────────────────┘                 │
│                           ▼                                          │
│              ┌────────────────────────┐                              │
│              │      GraphQuery API    │  ← Public interface          │
│              │  digest() impact()     │                              │
│              │  issues() path()       │                              │
│              └───────────┬────────────┘                              │
│                          │                                           │
│         ┌────────────────┼────────────────┐                          │
│         ▼                ▼                ▼                          │
│  ┌────────────┐  ┌────────────────┐  ┌────────────────┐             │
│  │ GraphStore │  │   Analyzers    │  │   Formatters   │             │
│  │  (State)   │  │ (Reachability, │  │ (Token-aware   │             │
│  │            │  │  Issues, etc.) │  │  output)       │             │
│  └─────┬──────┘  └────────────────┘  └────────────────┘             │
│        │                                                             │
│        ▼                                                             │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                      Indexer Layer                           │    │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────────┐ │    │
│  │  │ TS/JS  │ │ Python │ │  Rust  │ │ Go/Java│ │  Generic   │ │    │
│  │  │Indexer │ │Indexer │ │Indexer │ │Indexer │ │  Fallback  │ │    │
│  │  └────────┘ └────────┘ └────────┘ └────────┘ └────────────┘ │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                          │                                           │
│                          ▼                                           │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                   Framework Adapters                         │    │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────────┐ │    │
│  │  │Next.js │ │Express │ │FastAPI │ │ Actix  │ │  Spring    │ │    │
│  │  │Nuxt    │ │Koa     │ │Flask   │ │ Axum   │ │  Rails     │ │    │
│  │  │Svelte  │ │Fastify │ │Django  │ │ Rocket │ │  Laravel   │ │    │
│  │  │Remix   │ │Hono    │ │Click   │ │ Gin    │ │  NestJS    │ │    │
│  │  │Astro   │ │NestJS  │ │        │ │ Cobra  │ │  CLI tools │ │    │
│  │  └────────┘ └────────┘ └────────┘ └────────┘ └────────────┘ │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                          │                                           │
│                          ▼                                           │
│              ┌────────────────────────┐                              │
│              │    File System         │                              │
│              │  (Watcher + Reader)    │                              │
│              └────────────────────────┘                              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Core Data Structures

### Node Types

```typescript
/**
 * Base node in the code graph
 */
interface GraphNode {
  id: string;           // Unique, stable identifier
  kind: NodeKind;       // file | module | symbol | entrypoint
  name: string;         // Human-readable name
  path?: string;        // File system path (if applicable)
  meta?: NodeMeta;      // Additional metadata
}

type NodeKind = "file" | "module" | "symbol" | "entrypoint";

interface NodeMeta {
  // Location info
  loc?: { line: number; column: number; endLine?: number; endColumn?: number };
  
  // For entrypoints
  entrypointType?: "route" | "page" | "command" | "job" | "event" | "export";
  httpMethod?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  routePath?: string;
  
  // For symbols
  symbolKind?: "function" | "class" | "variable" | "type" | "interface";
  exported?: boolean;
  
  // Framework detection
  framework?: string;
  
  // Metrics
  complexity?: number;
  lineCount?: number;
  
  [key: string]: unknown;
}
```

### Edge Types

```typescript
/**
 * Directed edge representing a relationship
 */
interface GraphEdge {
  id: string;
  from: string;           // Source node ID
  to: string;             // Target node ID (or "unknown")
  kind: EdgeKind;
  confidence: Confidence;
  reason?: string;        // Why this confidence level
  meta?: EdgeMeta;
}

type EdgeKind =
  | "imports"      // import/require statement
  | "exports"      // export statement
  | "reexports"    // export * from / export { x } from
  | "calls"        // Function invocation
  | "extends"      // Class inheritance
  | "implements"   // Interface implementation
  | "registers"    // Route/command/job registration
  | "injects"      // Dependency injection
  | "unknown";     // Cannot determine statically

type Confidence = "high" | "medium" | "low" | "unknown";

interface EdgeMeta {
  importPath?: string;      // Original import specifier
  isTypeOnly?: boolean;     // import type { X }
  isDynamic?: boolean;      // Dynamic import
  isConditional?: boolean;  // Inside if/switch
  registrationMethod?: string; // e.g., "app.get", "router.use"
  [key: string]: unknown;
}
```

### Issue Types

```typescript
/**
 * A detected problem in the code graph
 */
interface GraphIssue {
  id: string;
  kind: IssueKind;
  severity: IssueSeverity;
  
  // Related entities
  nodeId?: string;
  entrypointId?: string;
  edgeId?: string;
  
  // Human-readable info
  title: string;
  evidence: string[];       // Bullet points explaining detection
  suggestedFix?: string[];  // Actionable suggestions
  
  // For tooling
  meta?: {
    filePath?: string;
    line?: number;
    symbol?: string;
    affectedCount?: number;
    [key: string]: unknown;
  };
}

type IssueKind =
  // Connectivity issues
  | "ENTRY_MISSING_HANDLER"    // Entrypoint exists, handler not found
  | "HANDLER_UNREACHABLE"      // Handler exists, not reachable from entrypoints
  | "NOT_REGISTERED"           // Implementation exists, not registered
  
  // Resolution issues
  | "DYNAMIC_EDGE_UNKNOWN"     // Dynamic import, target unknown
  | "BROKEN_EXPORT_CHAIN"      // Re-export of non-existent symbol
  | "CIRCULAR_REEXPORT"        // Circular re-export chain
  
  // Architecture issues
  | "CYCLE_RISK"               // Circular dependency detected
  | "LAYER_VIOLATION"          // Violates defined layer rules
  
  // Quality issues
  | "ORPHAN_EXPORT"            // Exported but never imported
  | "BARREL_BLOAT"             // Barrel file re-exports too much
  | "DEEP_IMPORT"              // Importing from deep internal path

type IssueSeverity = "error" | "warning" | "info";
```


---

## GraphStore Design

```typescript
/**
 * Central storage for the code graph
 * Optimized for:
 * - Fast node/edge lookup by ID
 * - Fast edge traversal (from/to)
 * - Incremental updates
 * - Persistence to disk
 */
class GraphStore {
  // Primary storage
  private nodes: Map<string, GraphNode>;
  private edges: Map<string, GraphEdge>;
  private issues: GraphIssue[];
  
  // Indexes for fast lookup
  private edgesByFrom: Map<string, Set<string>>;  // nodeId → edgeIds
  private edgesByTo: Map<string, Set<string>>;    // nodeId → edgeIds
  private nodesByKind: Map<NodeKind, Set<string>>; // kind → nodeIds
  private nodesByPath: Map<string, string>;        // filePath → nodeId
  
  // Metadata
  private meta: GraphMeta;
  
  // ============================================
  // Node Operations
  // ============================================
  
  addNode(node: GraphNode): void;
  getNode(id: string): GraphNode | undefined;
  getNodeByPath(path: string): GraphNode | undefined;
  getNodesByKind(kind: NodeKind): GraphNode[];
  removeNode(id: string): void;
  
  // ============================================
  // Edge Operations
  // ============================================
  
  addEdge(edge: GraphEdge): void;
  getEdge(id: string): GraphEdge | undefined;
  getEdgesFrom(nodeId: string): GraphEdge[];
  getEdgesTo(nodeId: string): GraphEdge[];
  removeEdge(id: string): void;
  removeEdgesForNode(nodeId: string): void;
  
  // ============================================
  // Batch Operations (for indexing)
  // ============================================
  
  updateFile(
    filePath: string,
    nodes: GraphNode[],
    edges: GraphEdge[]
  ): void {
    // 1. Remove old nodes/edges for this file
    // 2. Add new nodes/edges
    // 3. Update indexes
  }
  
  // ============================================
  // Persistence
  // ============================================
  
  async save(path: string): Promise<void>;
  async load(path: string): Promise<void>;
  
  // ============================================
  // Queries (delegated to GraphQuery)
  // ============================================
  
  query(): GraphQuery {
    return new GraphQuery(this);
  }
}

interface GraphMeta {
  version: string;
  lastIndexed: number;
  indexDuration: number;
  fileCount: number;
  nodeCount: number;
  edgeCount: number;
  issueCount: number;
  config: GraphConfig;
}
```

---

## Indexer Architecture

### Base Indexer Interface

```typescript
/**
 * Abstract base for language-specific indexers
 */
abstract class BaseIndexer {
  abstract readonly supportedExtensions: string[];
  abstract readonly name: string;
  
  /**
   * Index a single file
   */
  abstract index(filePath: string, content: string): IndexResult;
  
  /**
   * Check if this indexer can handle a file
   */
  canHandle(filePath: string): boolean {
    const ext = path.extname(filePath);
    return this.supportedExtensions.includes(ext);
  }
}

interface IndexResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  errors?: IndexError[];
}

interface IndexError {
  file: string;
  line?: number;
  message: string;
  recoverable: boolean;
}
```

### Indexer Registry

```typescript
/**
 * Manages multiple indexers with fallback
 */
class IndexerRegistry {
  private indexers: BaseIndexer[] = [];
  private fallback: GenericIndexer;
  
  register(indexer: BaseIndexer): void {
    this.indexers.push(indexer);
  }
  
  getIndexer(filePath: string): BaseIndexer {
    for (const indexer of this.indexers) {
      if (indexer.canHandle(filePath)) {
        return indexer;
      }
    }
    return this.fallback;
  }
  
  async indexFile(filePath: string): Promise<IndexResult> {
    const content = await fs.readFile(filePath, "utf-8");
    const indexer = this.getIndexer(filePath);
    return indexer.index(filePath, content);
  }
}
```

---

## Framework Adapter Architecture

### Adapter Interface

```typescript
/**
 * Framework-specific entrypoint detection
 */
interface FrameworkAdapter {
  readonly name: string;
  readonly frameworks: string[];  // e.g., ["nextjs", "next"]
  
  /**
   * Detect if this framework is used in the project
   */
  detect(projectRoot: string): Promise<boolean>;
  
  /**
   * Extract entrypoints from the codebase
   */
  extractEntrypoints(store: GraphStore): Promise<GraphNode[]>;
  
  /**
   * Extract registration edges (route → handler, etc.)
   */
  extractRegistrations(store: GraphStore): Promise<GraphEdge[]>;
  
  /**
   * Framework-specific issue detection
   */
  detectIssues?(store: GraphStore): Promise<GraphIssue[]>;
}
```

### Supported Languages

| Language | Parser | Extensions | Confidence |
|----------|--------|------------|------------|
| TypeScript | TS Compiler API | `.ts`, `.tsx`, `.mts`, `.cts` | High |
| JavaScript | TS Compiler API | `.js`, `.jsx`, `.mjs`, `.cjs` | High |
| Python | tree-sitter | `.py`, `.pyi` | High |
| Rust | tree-sitter | `.rs` | High |
| Go | tree-sitter | `.go` | Medium |
| Java | tree-sitter | `.java` | Medium |
| C# | tree-sitter | `.cs` | Medium |
| Ruby | tree-sitter | `.rb` | Medium |
| PHP | tree-sitter | `.php` | Medium |
| Other | Regex fallback | `*` | Low |

### Supported Frameworks

| Framework | Language | Entrypoint Type | Detection |
|-----------|----------|-----------------|-----------|
| Express | JS/TS | Routes | `app.get()`, `router.use()` |
| Koa | JS/TS | Routes | `router.get()`, middleware |
| Fastify | JS/TS | Routes | `fastify.get()`, plugins |
| Hono | JS/TS | Routes | `app.get()`, `Hono()` |
| Next.js | JS/TS | Pages, API | File-based (`pages/`, `app/`) |
| Nuxt | JS/TS | Pages, API | File-based (`pages/`, `server/`) |
| SvelteKit | JS/TS | Routes | File-based (`routes/`) |
| Remix | JS/TS | Routes | File-based (`routes/`) |
| Astro | JS/TS | Pages | File-based (`pages/`) |
| NestJS | TS | Controllers | `@Controller`, `@Module` |
| Spring Boot | Java | Controllers | `@RestController`, `@RequestMapping` |
| Django | Python | Views | `urls.py`, `views.py` |
| FastAPI | Python | Routes | `@app.get()`, `APIRouter` |
| Flask | Python | Routes | `@app.route()`, blueprints |
| Actix-web | Rust | Routes | `#[get]`, `web::resource` |
| Axum | Rust | Routes | `Router::new()`, handlers |
| Rocket | Rust | Routes | `#[get]`, `#[post]` |
| Gin | Go | Routes | `r.GET()`, `gin.Default()` |
| Echo | Go | Routes | `e.GET()`, groups |
| Rails | Ruby | Controllers | `routes.rb`, controllers |
| Laravel | PHP | Controllers | `routes/`, controllers |
| CLI (commander) | JS/TS | Commands | `.command()` |
| CLI (yargs) | JS/TS | Commands | `.command()` |
| CLI (clap) | Rust | Commands | `#[command]`, `App::new()` |
| CLI (click) | Python | Commands | `@click.command()` |
| CLI (cobra) | Go | Commands | `&cobra.Command{}` |

### Example: Express Adapter

```typescript
class ExpressAdapter implements FrameworkAdapter {
  readonly name = "express";
  readonly frameworks = ["express", "koa", "fastify", "hono"];
  
  async detect(projectRoot: string): Promise<boolean> {
    const pkg = await readPackageJson(projectRoot);
    return !!(
      pkg.dependencies?.express ||
      pkg.dependencies?.koa ||
      pkg.dependencies?.fastify ||
      pkg.dependencies?.hono
    );
  }
  
  async extractEntrypoints(store: GraphStore): Promise<GraphNode[]> {
    const entrypoints: GraphNode[] = [];
    
    // Find route registration patterns
    for (const node of store.getNodesByKind("file")) {
      const content = await fs.readFile(node.path!, "utf-8");
      
      // Match: app.get('/path', handler)
      const routePattern = /\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g;
      let match;
      
      while ((match = routePattern.exec(content)) !== null) {
        entrypoints.push({
          id: `entrypoint:${node.path}:${match[2]}`,
          kind: "entrypoint",
          name: `${match[1].toUpperCase()} ${match[2]}`,
          path: node.path,
          meta: {
            entrypointType: "route",
            httpMethod: match[1].toUpperCase(),
            routePath: match[2],
            framework: "express"
          }
        });
      }
    }
    
    return entrypoints;
  }
  
  async extractRegistrations(store: GraphStore): Promise<GraphEdge[]> {
    // Extract handler references from route definitions
    // ...
  }
}
```

---

## Query Layer Design

```typescript
/**
 * High-level query interface
 * All methods return token-aware, truncatable results
 */
class GraphQuery {
  constructor(private store: GraphStore) {}
  
  // ============================================
  // Digest Queries (ultra-compact)
  // ============================================
  
  digest(options?: DigestOptions): DigestResult {
    return {
      summary: this.getSummary(),
      entrypoints: this.getEntrypointsSummary(options?.scope),
      hotspots: this.getHotspots(options?.limit ?? 10),
      issues: this.getIssuesSummary(),
      meta: this.getMeta()
    };
  }
  
  // ============================================
  // Impact Queries
  // ============================================
  
  impact(target: string, options?: ImpactOptions): ImpactResult {
    const depth = options?.depth ?? 2;
    const limit = options?.limit ?? 30;
    
    const nodeId = this.resolveTarget(target);
    const dependents = this.findDependents(nodeId, depth);
    const affected = this.findAffectedEntrypoints(dependents);
    
    return {
      target,
      directDependents: dependents.depth1,
      transitiveImpact: {
        depth1: dependents.depth1.length,
        depth2: dependents.depth2.length,
        depth3: dependents.depth3?.length ?? 0
      },
      affectedEntrypoints: affected.slice(0, limit),
      riskAssessment: this.assessRisk(dependents, affected),
      meta: { tokensEstimate: this.estimateTokens(dependents) }
    };
  }
  
  // ============================================
  // Path Queries
  // ============================================
  
  path(from: string, to: string, options?: PathOptions): PathResult {
    const maxDepth = options?.maxDepth ?? 5;
    const paths = this.findPaths(from, to, maxDepth);
    
    return {
      from,
      to,
      paths: paths.slice(0, 3),  // Top 3 shortest
      connected: paths.length > 0,
      meta: { tokensEstimate: this.estimateTokens(paths) }
    };
  }
  
  // ============================================
  // Issue Queries
  // ============================================
  
  issues(options?: IssueQueryOptions): IssueListResult {
    let filtered = this.store.issues;
    
    if (options?.kind) {
      filtered = filtered.filter(i => i.kind === options.kind);
    }
    if (options?.severity) {
      filtered = filtered.filter(i => 
        this.severityRank(i.severity) >= this.severityRank(options.severity!)
      );
    }
    if (options?.scope) {
      filtered = filtered.filter(i => 
        i.meta?.filePath?.startsWith(options.scope!)
      );
    }
    
    const limit = options?.limit ?? 20;
    
    return {
      issues: filtered.slice(0, limit).map(this.formatIssue),
      stats: this.getIssueStats(filtered),
      meta: {
        total: filtered.length,
        returned: Math.min(filtered.length, limit),
        truncated: filtered.length > limit
      }
    };
  }
  
  // ============================================
  // Module Queries
  // ============================================
  
  module(target: string): ModuleResult {
    const node = this.resolveTarget(target);
    const imports = this.store.getEdgesFrom(node);
    const importedBy = this.store.getEdgesTo(node);
    
    return {
      id: node,
      path: this.store.getNode(node)?.path,
      imports: imports.map(e => e.to),
      importedBy: importedBy.map(e => e.from),
      exports: this.getExports(node),
      entrypoints: this.getRelatedEntrypoints(node),
      meta: { tokensEstimate: this.estimateTokens({ imports, importedBy }) }
    };
  }
}
```

---

## Token Estimation

```typescript
/**
 * Estimate token count for output
 * Used to enforce limits and warn about truncation
 */
class TokenEstimator {
  // Rough estimate: 1 token ≈ 4 characters for code/JSON
  private readonly CHARS_PER_TOKEN = 4;
  
  estimate(data: unknown): number {
    const json = JSON.stringify(data);
    return Math.ceil(json.length / this.CHARS_PER_TOKEN);
  }
  
  truncateToLimit(
    items: unknown[],
    limit: number,
    itemEstimator: (item: unknown) => number
  ): { items: unknown[]; truncated: boolean } {
    let total = 0;
    const result: unknown[] = [];
    
    for (const item of items) {
      const itemTokens = itemEstimator(item);
      if (total + itemTokens > limit) {
        return { items: result, truncated: true };
      }
      result.push(item);
      total += itemTokens;
    }
    
    return { items: result, truncated: false };
  }
}
```

---

## Persistence Format

### Graph State File

```json
// .ouroboros/graph/state.json
{
  "version": "1.0.0",
  "meta": {
    "lastIndexed": 1704844800000,
    "indexDuration": 2340,
    "fileCount": 142,
    "nodeCount": 487,
    "edgeCount": 1203
  },
  "nodes": [
    {
      "id": "file:src/index.ts",
      "kind": "file",
      "name": "index.ts",
      "path": "src/index.ts"
    }
  ],
  "edges": [
    {
      "id": "edge:src/index.ts:src/app.ts",
      "from": "file:src/index.ts",
      "to": "file:src/app.ts",
      "kind": "imports",
      "confidence": "high"
    }
  ],
  "issues": []
}
```

### Configuration File

```json
// .ouroboros/graph/config.json
{
  "version": "1.0.0",
  "indexing": {
    "include": [
      "**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx",
      "**/*.py", "**/*.rs", "**/*.go", "**/*.java",
      "**/*.cs", "**/*.rb", "**/*.php"
    ],
    "exclude": [
      "**/*.test.ts", "**/*.spec.ts", 
      "**/__tests__/**", "**/test/**",
      "**/node_modules/**", "**/dist/**", "**/build/**",
      "**/.git/**", "**/target/**", "**/vendor/**"
    ],
    "maxFileSize": 1048576,
    "languages": ["auto"]
  },
  "entrypoints": {
    "patterns": [
      { "glob": "src/pages/**/*.tsx", "type": "page" },
      { "glob": "src/app/**/page.tsx", "type": "page" },
      { "glob": "src/api/**/*.ts", "type": "api" },
      { "glob": "src/routes/**/*.ts", "type": "route" },
      { "glob": "app/routes/**/*.py", "type": "route" },
      { "glob": "src/main.rs", "type": "entrypoint" },
      { "glob": "**/main.go", "type": "entrypoint" }
    ],
    "frameworks": ["auto"]
  },
  "analysis": {
    "detectCycles": false,
    "layerRules": []
  },
  "output": {
    "digestTokenLimit": 500,
    "issuesTokenLimit": 800,
    "impactTokenLimit": 600
  }
}
```

### Annotations File

```json
// .ouroboros/graph/annotations.json
{
  "version": "1.0.0",
  "edges": [
    {
      "from": "file:src/loader.ts",
      "to": "file:src/plugins/auth.ts",
      "kind": "imports",
      "confidence": "high",
      "reason": "manual annotation: dynamic require resolved"
    }
  ],
  "entrypoints": [
    {
      "path": "src/workers/cleanup.ts",
      "type": "job",
      "name": "Cleanup Worker"
    }
  ],
  "ignores": [
    {
      "issueKind": "HANDLER_UNREACHABLE",
      "path": "src/legacy/**",
      "reason": "Legacy code, scheduled for removal"
    }
  ]
}
```

---

## Error Handling Strategy

```typescript
/**
 * Graceful degradation for indexing errors
 */
class IndexingErrorHandler {
  private errors: IndexError[] = [];
  
  handle(error: IndexError): void {
    this.errors.push(error);
    
    if (error.recoverable) {
      // Log and continue
      console.warn(`[CodeGraph] ${error.file}: ${error.message}`);
    } else {
      // Create issue for visibility
      this.createIssue(error);
    }
  }
  
  private createIssue(error: IndexError): GraphIssue {
    return {
      id: `issue:index-error:${error.file}`,
      kind: "DYNAMIC_EDGE_UNKNOWN",
      severity: "info",
      title: `Indexing incomplete: ${error.file}`,
      evidence: [error.message],
      suggestedFix: ["Check file syntax", "Add manual annotation if needed"],
      meta: { filePath: error.file, line: error.line }
    };
  }
}
```

---

## Performance Considerations

### Indexing Performance

| Operation | Target | Strategy |
|-----------|--------|----------|
| Full index (1000 files) | < 5s | Parallel file reading, batch processing |
| Incremental update | < 200ms | Only re-index changed files |
| Query (digest) | < 50ms | Pre-computed summaries |
| Query (impact) | < 100ms | Indexed edge lookups |

### Memory Management

```typescript
class MemoryManager {
  private readonly MAX_NODES = 50000;
  private readonly MAX_EDGES = 200000;
  
  checkLimits(store: GraphStore): void {
    if (store.nodeCount > this.MAX_NODES) {
      console.warn("[CodeGraph] Node limit exceeded, consider scoping");
    }
  }
  
  // For very large repos: stream processing
  async indexLargeRepo(files: string[]): AsyncGenerator<IndexResult> {
    const BATCH_SIZE = 100;
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
      const batch = files.slice(i, i + BATCH_SIZE);
      yield await this.indexBatch(batch);
    }
  }
}
```
