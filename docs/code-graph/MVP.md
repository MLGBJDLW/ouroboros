# Code Graph MVP Specification

> Minimum Viable Product - Target: 2-3 weeks

## Goals

1. Prove the core value: **token-efficient codebase querying**
2. Detect basic **Missing Links** (unreachable code, broken exports)
3. Provide **3 essential LM Tools** for Copilot
4. Show **visual feedback** in existing sidebar

## Scope

### In Scope (MVP)

- TypeScript/JavaScript static import analysis
- Basic entrypoint detection (configurable patterns)
- 3 core issue types
- 3 LM Tools
- Memory-based graph with JSON persistence
- Incremental file watching

### Out of Scope (MVP)

- Multi-language support (Python, Rust, Go, Java, etc.) - deferred to v0.4
- Framework-specific adapters (Next.js, Express, FastAPI, etc.) - deferred to v0.3
- Advanced cycle detection - deferred to v0.5
- Layer violation rules - deferred to v0.5
- Full visualization (D3/vis.js graph rendering) - deferred to v1.0
- Annotations system - deferred to v0.2

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    VS Code Extension                     │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │  LM Tools   │  │  Sidebar    │  │  File Watcher   │  │
│  │  (3 tools)  │  │  (webview)  │  │  (incremental)  │  │
│  └──────┬──────┘  └──────┬──────┘  └────────┬────────┘  │
│         │                │                   │           │
│         └────────────────┼───────────────────┘           │
│                          ▼                               │
│              ┌───────────────────────┐                   │
│              │     GraphQuery API    │                   │
│              └───────────┬───────────┘                   │
│                          ▼                               │
│              ┌───────────────────────┐                   │
│              │      GraphStore       │                   │
│              │  (nodes + edges +     │                   │
│              │   issues + meta)      │                   │
│              └───────────┬───────────┘                   │
│                          ▼                               │
│              ┌───────────────────────┐                   │
│              │   TypeScriptIndexer   │                   │
│              └───────────────────────┘                   │
└─────────────────────────────────────────────────────────┘
```


---

## File Structure

```
extension/src/codeGraph/
├── core/
│   ├── types.ts              # Node, Edge, Issue type definitions
│   ├── GraphStore.ts         # In-memory graph + persistence
│   └── GraphQuery.ts         # Query interface (digest, impact, issues)
├── indexers/
│   ├── BaseIndexer.ts        # Abstract base class
│   ├── TypeScriptIndexer.ts  # TS/JS static import parsing
│   └── EntrypointDetector.ts # Pattern-based entrypoint detection
├── analyzers/
│   ├── ReachabilityAnalyzer.ts  # BFS from entrypoints
│   └── IssueDetector.ts         # Generate issues from graph state
├── tools/
│   ├── graphDigest.ts        # ouroborosai_graph_digest
│   ├── graphIssues.ts        # ouroborosai_graph_issues
│   └── graphImpact.ts        # ouroborosai_graph_impact
└── watcher/
    └── IncrementalWatcher.ts # File change detection + partial re-index
```

---

## Core Types (MVP)

```typescript
// ============================================
// Confidence & Enums
// ============================================

type Confidence = "high" | "medium" | "low" | "unknown";

type NodeKind = 
  | "file"        // Physical file
  | "module"      // Logical module (may span files)
  | "symbol"      // Exported function/class/variable
  | "entrypoint"; // Route, command, job, page

type EdgeKind =
  | "imports"     // Static import/require
  | "exports"     // Export statement
  | "reexports"   // export * from / export { x } from
  | "calls"       // Function call (if tracked)
  | "registers"   // Route/command registration
  | "unknown";    // Dynamic, unresolved

type IssueKind =
  | "HANDLER_UNREACHABLE"    // Code exists but no path from entrypoints
  | "DYNAMIC_EDGE_UNKNOWN"   // Dynamic import detected, target unknown
  | "BROKEN_EXPORT_CHAIN";   // Barrel exports non-existent symbol

type IssueSeverity = "info" | "warning" | "error";

// ============================================
// Graph Nodes
// ============================================

interface GraphNode {
  id: string;                    // Stable unique ID
  kind: NodeKind;
  name: string;                  // Display name
  path?: string;                 // File path (for file/module nodes)
  meta?: {
    loc?: { line: number; column: number };
    framework?: string;          // "express" | "nextjs" | etc.
    entrypointType?: string;     // "route" | "command" | "page" | "job"
    [key: string]: unknown;
  };
}

// ============================================
// Graph Edges
// ============================================

interface GraphEdge {
  id: string;                    // Unique edge ID
  from: string;                  // Source node ID
  to: string;                    // Target node ID
  kind: EdgeKind;
  confidence: Confidence;
  reason?: string;               // "static import", "tsconfig paths", etc.
  meta?: {
    importPath?: string;         // Original import specifier
    isTypeOnly?: boolean;        // import type { X }
    [key: string]: unknown;
  };
}

// ============================================
// Issues (Missing Links)
// ============================================

interface GraphIssue {
  id: string;
  kind: IssueKind;
  severity: IssueSeverity;
  nodeId?: string;               // Related node
  entrypointId?: string;         // Related entrypoint (if applicable)
  evidence: string[];            // Short bullet points explaining why
  suggestedFix?: string[];       // Actionable suggestions
  meta?: {
    filePath?: string;
    symbol?: string;
    [key: string]: unknown;
  };
}

// ============================================
// Graph Store
// ============================================

interface GraphState {
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge>;
  issues: GraphIssue[];
  meta: {
    lastIndexed: number;         // Timestamp
    indexDuration: number;       // ms
    fileCount: number;
    nodeCount: number;
    edgeCount: number;
  };
}
```

---

## MVP Issue Types

### 1. HANDLER_UNREACHABLE

**Definition**: A file/module exists but cannot be reached from any entrypoint via the dependency graph.

**Detection Algorithm**:
```
1. Collect all entrypoint nodes
2. BFS/DFS from each entrypoint, following "imports" edges
3. Mark all visited nodes as "reachable"
4. Any file node NOT marked = HANDLER_UNREACHABLE
```

**Evidence Example**:
```json
{
  "kind": "HANDLER_UNREACHABLE",
  "severity": "warning",
  "nodeId": "file:src/utils/deadCode.ts",
  "evidence": [
    "File has 3 exports but 0 importers",
    "Not reachable from any of 12 entrypoints"
  ],
  "suggestedFix": [
    "Import from an active module",
    "Remove if no longer needed",
    "Add as explicit entrypoint if standalone"
  ]
}
```

### 2. DYNAMIC_EDGE_UNKNOWN

**Definition**: Code contains dynamic import/require that cannot be statically resolved.

**Detection**:
```typescript
// Patterns to detect:
import(variable)           // Dynamic import with variable
require(expression)        // Dynamic require
await import(`./routes/${name}`)  // Template literal
```

**Evidence Example**:
```json
{
  "kind": "DYNAMIC_EDGE_UNKNOWN",
  "severity": "info",
  "nodeId": "file:src/loader.ts",
  "evidence": [
    "Line 42: import(modulePath) - variable not resolvable",
    "Possible targets cannot be determined statically"
  ],
  "suggestedFix": [
    "Add annotation in .ouroboros/graph/annotations.json",
    "Refactor to static imports if possible"
  ]
}
```

### 3. BROKEN_EXPORT_CHAIN

**Definition**: A barrel file (index.ts) re-exports a symbol that doesn't exist in the source.

**Detection**:
```typescript
// index.ts
export { UserService } from './user';  // But user.ts has no UserService
export * from './missing';              // missing.ts doesn't exist
```

**Evidence Example**:
```json
{
  "kind": "BROKEN_EXPORT_CHAIN",
  "severity": "error",
  "nodeId": "file:src/services/index.ts",
  "evidence": [
    "Re-exports 'UserService' from './user'",
    "But './user.ts' does not export 'UserService'",
    "Available exports: UserRepository, createUser"
  ],
  "suggestedFix": [
    "Fix export name to match source",
    "Add missing export to source file"
  ]
}
```

---

## MVP LM Tools

### Tool 1: `ouroborosai_graph_digest`

**Purpose**: Ultra-compact overview for Copilot's "first look"

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "scope": {
      "type": "string",
      "description": "Optional: package name or directory path to scope the digest"
    }
  }
}
```

**Output Format** (target: ~500 tokens):
```json
{
  "summary": {
    "files": 142,
    "modules": 38,
    "entrypoints": 12,
    "edges": 487
  },
  "entrypoints": {
    "routes": ["GET /api/users", "POST /api/auth", "..."],
    "commands": ["build", "deploy"],
    "pages": ["/dashboard", "/settings"]
  },
  "hotspots": [
    { "path": "src/core/engine.ts", "importers": 24, "exports": 8 },
    { "path": "src/utils/helpers.ts", "importers": 19, "exports": 12 }
  ],
  "issues": {
    "HANDLER_UNREACHABLE": 3,
    "DYNAMIC_EDGE_UNKNOWN": 7,
    "BROKEN_EXPORT_CHAIN": 1
  },
  "meta": {
    "lastIndexed": "2025-01-10T10:30:00Z",
    "tokensEstimate": 480,
    "truncated": false
  }
}
```

**Model Description** (for package.json):
```
Returns a compact digest of the codebase graph. ALWAYS call this first before 
other graph tools. Output is limited to ~500 tokens. Use 'scope' parameter to 
focus on specific packages or directories.
```

### Tool 2: `ouroborosai_graph_issues`

**Purpose**: List Missing Links issues with actionable details

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "issueType": {
      "type": "string",
      "enum": ["HANDLER_UNREACHABLE", "DYNAMIC_EDGE_UNKNOWN", "BROKEN_EXPORT_CHAIN"],
      "description": "Filter by issue type"
    },
    "severity": {
      "type": "string",
      "enum": ["error", "warning", "info"],
      "description": "Minimum severity to include"
    },
    "scope": {
      "type": "string",
      "description": "Filter by file path prefix"
    },
    "limit": {
      "type": "number",
      "description": "Max issues to return (default: 20, max: 50)"
    }
  }
}
```

**Output Format**:
```json
{
  "issues": [
    {
      "id": "issue-001",
      "kind": "HANDLER_UNREACHABLE",
      "severity": "warning",
      "file": "src/utils/legacy.ts",
      "summary": "File not reachable from any entrypoint",
      "evidence": ["0 importers", "Not in any route/command path"],
      "suggestedFix": ["Import from active module or remove"]
    }
  ],
  "stats": {
    "total": 11,
    "returned": 11,
    "byKind": {
      "HANDLER_UNREACHABLE": 3,
      "DYNAMIC_EDGE_UNKNOWN": 7,
      "BROKEN_EXPORT_CHAIN": 1
    }
  },
  "meta": {
    "tokensEstimate": 650,
    "truncated": false,
    "nextQuerySuggestion": null
  }
}
```

**Model Description**:
```
Lists Missing Links issues in the codebase. Each issue includes evidence and 
suggested fixes. Use filters to narrow results. Default limit is 20 issues.
Call graph.digest first to see issue counts before querying details.
```

### Tool 3: `ouroborosai_graph_impact`

**Purpose**: Show what's affected by changing a file/symbol

**Input Schema**:
```json
{
  "type": "object",
  "required": ["target"],
  "properties": {
    "target": {
      "type": "string",
      "description": "File path or symbol name to analyze"
    },
    "depth": {
      "type": "number",
      "description": "Max traversal depth (default: 2, max: 4)"
    },
    "limit": {
      "type": "number",
      "description": "Max affected files to return (default: 30, max: 100)"
    }
  }
}
```

**Output Format**:
```json
{
  "target": "src/core/auth.ts",
  "directDependents": [
    "src/api/users.ts",
    "src/api/admin.ts",
    "src/middleware/requireAuth.ts"
  ],
  "transitiveImpact": {
    "depth1": 3,
    "depth2": 12,
    "depth3": 28
  },
  "affectedEntrypoints": [
    { "type": "route", "name": "POST /api/login" },
    { "type": "route", "name": "GET /api/me" }
  ],
  "riskAssessment": {
    "level": "high",
    "reason": "Core auth module, affects 28 files and 2 critical routes"
  },
  "meta": {
    "tokensEstimate": 420,
    "truncated": false
  }
}
```

**Model Description**:
```
Analyzes impact radius of changing a file or symbol. Shows direct dependents, 
transitive impact by depth, and affected entrypoints. Use to understand blast 
radius before making changes. Default depth is 2.
```

---

## Entrypoint Detection (MVP)

MVP uses **pattern-based detection** with user configuration:

### Default Configuration

```json
// .ouroboros/graph/config.json
{
  "entrypoints": {
    "patterns": [
      {
        "glob": "src/pages/**/*.{ts,tsx}",
        "type": "page",
        "confidence": "high"
      },
      {
        "glob": "src/app/**/page.{ts,tsx}",
        "type": "page",
        "confidence": "high"
      },
      {
        "glob": "src/api/**/*.ts",
        "type": "api",
        "confidence": "medium"
      },
      {
        "glob": "src/routes/**/*.ts",
        "type": "route",
        "confidence": "medium"
      },
      {
        "glob": "src/commands/**/*.ts",
        "type": "command",
        "confidence": "medium"
      },
      {
        "glob": "src/jobs/**/*.ts",
        "type": "job",
        "confidence": "medium"
      },
      {
        "glob": "**/index.ts",
        "type": "barrel",
        "confidence": "low"
      }
    ],
    "exclude": [
      "**/node_modules/**",
      "**/*.test.ts",
      "**/*.spec.ts",
      "**/dist/**"
    ]
  }
}
```

### Detection Logic

```typescript
class EntrypointDetector {
  detect(filePath: string, config: EntrypointConfig): GraphNode | null {
    for (const pattern of config.patterns) {
      if (minimatch(filePath, pattern.glob)) {
        return {
          id: `entrypoint:${filePath}`,
          kind: "entrypoint",
          name: this.extractName(filePath, pattern.type),
          path: filePath,
          meta: {
            entrypointType: pattern.type,
            confidence: pattern.confidence
          }
        };
      }
    }
    return null;
  }
}
```

---

## TypeScript Indexer (MVP)

### Core Implementation

```typescript
import * as ts from "typescript";

class TypeScriptIndexer {
  private program: ts.Program;
  
  index(filePath: string): { nodes: GraphNode[], edges: GraphEdge[] } {
    const sourceFile = this.program.getSourceFile(filePath);
    if (!sourceFile) return { nodes: [], edges: [] };
    
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    
    // Create file node
    const fileNode: GraphNode = {
      id: `file:${filePath}`,
      kind: "file",
      name: path.basename(filePath),
      path: filePath
    };
    nodes.push(fileNode);
    
    // Visit AST
    ts.forEachChild(sourceFile, (node) => {
      // Handle imports
      if (ts.isImportDeclaration(node)) {
        const edge = this.processImport(node, filePath);
        if (edge) edges.push(edge);
      }
      
      // Handle exports
      if (ts.isExportDeclaration(node)) {
        const result = this.processExport(node, filePath);
        edges.push(...result.edges);
      }
      
      // Handle dynamic imports
      if (this.isDynamicImport(node)) {
        edges.push(this.createUnknownEdge(node, filePath));
      }
    });
    
    return { nodes, edges };
  }
  
  private processImport(node: ts.ImportDeclaration, fromPath: string): GraphEdge | null {
    const moduleSpecifier = node.moduleSpecifier;
    if (!ts.isStringLiteral(moduleSpecifier)) {
      return this.createUnknownEdge(node, fromPath);
    }
    
    const importPath = moduleSpecifier.text;
    const resolvedPath = this.resolveModulePath(importPath, fromPath);
    
    return {
      id: `edge:${fromPath}:${resolvedPath}`,
      from: `file:${fromPath}`,
      to: `file:${resolvedPath}`,
      kind: "imports",
      confidence: resolvedPath ? "high" : "low",
      reason: "static import",
      meta: { importPath }
    };
  }
  
  private isDynamicImport(node: ts.Node): boolean {
    // import(expr) or require(expr) with non-literal
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (expr.kind === ts.SyntaxKind.ImportKeyword) {
        const arg = node.arguments[0];
        return !ts.isStringLiteral(arg);
      }
    }
    return false;
  }
  
  private createUnknownEdge(node: ts.Node, fromPath: string): GraphEdge {
    return {
      id: `edge:unknown:${fromPath}:${node.pos}`,
      from: `file:${fromPath}`,
      to: "unknown",
      kind: "unknown",
      confidence: "unknown",
      reason: "dynamic import - cannot resolve statically",
      meta: {
        loc: this.getLocation(node)
      }
    };
  }
}
```

### Path Resolution

```typescript
class PathResolver {
  private compilerOptions: ts.CompilerOptions;
  
  resolve(importPath: string, fromFile: string): string | null {
    // 1. Relative imports
    if (importPath.startsWith(".")) {
      return this.resolveRelative(importPath, fromFile);
    }
    
    // 2. tsconfig paths aliases
    if (this.compilerOptions.paths) {
      const aliased = this.resolveAlias(importPath);
      if (aliased) return aliased;
    }
    
    // 3. Node modules (skip for MVP, mark as external)
    if (!importPath.startsWith(".") && !importPath.startsWith("/")) {
      return null; // External dependency
    }
    
    return null;
  }
  
  private resolveAlias(importPath: string): string | null {
    const paths = this.compilerOptions.paths || {};
    for (const [pattern, targets] of Object.entries(paths)) {
      const regex = new RegExp(`^${pattern.replace("*", "(.*)")}$`);
      const match = importPath.match(regex);
      if (match) {
        const target = targets[0].replace("*", match[1] || "");
        return path.resolve(this.compilerOptions.baseUrl || ".", target);
      }
    }
    return null;
  }
}
```

---

## Reachability Analysis (MVP)

```typescript
class ReachabilityAnalyzer {
  analyze(store: GraphStore): Set<string> {
    const reachable = new Set<string>();
    const entrypoints = store.getNodesByKind("entrypoint");
    
    // BFS from each entrypoint
    for (const entry of entrypoints) {
      this.bfs(entry.id, store, reachable);
    }
    
    return reachable;
  }
  
  private bfs(startId: string, store: GraphStore, visited: Set<string>): void {
    const queue: string[] = [startId];
    
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);
      
      // Follow outgoing "imports" edges
      const edges = store.getEdgesFrom(nodeId);
      for (const edge of edges) {
        if (edge.kind === "imports" && edge.to !== "unknown") {
          queue.push(edge.to);
        }
      }
    }
  }
  
  findUnreachable(store: GraphStore): GraphIssue[] {
    const reachable = this.analyze(store);
    const issues: GraphIssue[] = [];
    
    for (const node of store.getNodesByKind("file")) {
      if (!reachable.has(node.id)) {
        issues.push({
          id: `issue:unreachable:${node.id}`,
          kind: "HANDLER_UNREACHABLE",
          severity: "warning",
          nodeId: node.id,
          evidence: [
            `File has ${store.getEdgesFrom(node.id).length} exports`,
            `But ${store.getEdgesTo(node.id).length} importers`,
            `Not reachable from any of ${store.getNodesByKind("entrypoint").length} entrypoints`
          ],
          suggestedFix: [
            "Import from an active module",
            "Remove if no longer needed",
            "Add as explicit entrypoint if standalone"
          ],
          meta: { filePath: node.path }
        });
      }
    }
    
    return issues;
  }
}
```

---

## Incremental Watcher (MVP)

```typescript
class IncrementalWatcher {
  private watcher: vscode.FileSystemWatcher;
  private debounceTimer: NodeJS.Timeout | null = null;
  private pendingChanges: Set<string> = new Set();
  
  constructor(
    private store: GraphStore,
    private indexer: TypeScriptIndexer
  ) {
    this.watcher = vscode.workspace.createFileSystemWatcher(
      "**/*.{ts,tsx,js,jsx}",
      false, // create
      false, // change
      false  // delete
    );
    
    this.watcher.onDidCreate((uri) => this.queueUpdate(uri.fsPath, "create"));
    this.watcher.onDidChange((uri) => this.queueUpdate(uri.fsPath, "change"));
    this.watcher.onDidDelete((uri) => this.queueUpdate(uri.fsPath, "delete"));
  }
  
  private queueUpdate(filePath: string, type: string): void {
    this.pendingChanges.add(`${type}:${filePath}`);
    
    // Debounce: wait 500ms for batch updates
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.processBatch(), 500);
  }
  
  private async processBatch(): Promise<void> {
    const changes = Array.from(this.pendingChanges);
    this.pendingChanges.clear();
    
    for (const change of changes) {
      const [type, filePath] = change.split(":", 2);
      
      if (type === "delete") {
        this.store.removeNode(`file:${filePath}`);
      } else {
        // Re-index single file
        const result = this.indexer.index(filePath);
        this.store.updateFile(filePath, result.nodes, result.edges);
      }
    }
    
    // Re-run issue detection
    this.store.refreshIssues();
  }
}
```

---

## Sidebar Integration (MVP)

Add a new section to existing sidebar webview:

### Message Types

```typescript
// Extension → Webview
interface GraphDigestMessage {
  type: "graphDigest";
  data: {
    summary: { files: number; entrypoints: number; issues: number };
    topIssues: Array<{ kind: string; count: number }>;
    lastIndexed: string;
  };
}

// Webview → Extension
interface RequestGraphDigestMessage {
  type: "requestGraphDigest";
}

interface RequestIssueDetailsMessage {
  type: "requestIssueDetails";
  issueId: string;
}
```

### UI Components (React/Preact in webview)

```tsx
function GraphOverview({ digest }: { digest: GraphDigest }) {
  return (
    <div className="graph-overview">
      <h3>Code Graph</h3>
      <div className="stats">
        <span>{digest.summary.files} files</span>
        <span>{digest.summary.entrypoints} entrypoints</span>
      </div>
      
      <div className="issues-summary">
        <h4>Missing Links</h4>
        {digest.topIssues.map(issue => (
          <div key={issue.kind} className={`issue-badge ${issue.kind.toLowerCase()}`}>
            {issue.count} {issue.kind}
          </div>
        ))}
      </div>
      
      <button onClick={() => vscode.postMessage({ type: "openIssuesPanel" })}>
        View All Issues
      </button>
    </div>
  );
}
```

---

## Testing Strategy (MVP)

### Unit Tests

```typescript
describe("TypeScriptIndexer", () => {
  it("should parse static imports", () => {
    const indexer = new TypeScriptIndexer();
    const result = indexer.index("fixtures/simple.ts");
    
    expect(result.edges).toContainEqual(
      expect.objectContaining({
        kind: "imports",
        confidence: "high"
      })
    );
  });
  
  it("should detect dynamic imports as unknown", () => {
    const indexer = new TypeScriptIndexer();
    const result = indexer.index("fixtures/dynamic.ts");
    
    expect(result.edges).toContainEqual(
      expect.objectContaining({
        kind: "unknown",
        confidence: "unknown"
      })
    );
  });
});

describe("ReachabilityAnalyzer", () => {
  it("should find unreachable files", () => {
    const store = createTestStore();
    const analyzer = new ReachabilityAnalyzer();
    
    const issues = analyzer.findUnreachable(store);
    
    expect(issues).toHaveLength(1);
    expect(issues[0].kind).toBe("HANDLER_UNREACHABLE");
  });
});
```

### Integration Tests

```typescript
describe("Graph Tools", () => {
  it("graph.digest should return under 500 tokens", async () => {
    const tool = new GraphDigestTool(store);
    const result = await tool.execute({});
    
    expect(result.meta.tokensEstimate).toBeLessThan(500);
  });
});
```

---

## Deliverables Checklist

### Week 1: Core Infrastructure
- [ ] `types.ts` - All type definitions
- [ ] `GraphStore.ts` - In-memory storage + JSON persistence
- [ ] `GraphQuery.ts` - Basic query methods
- [ ] `TypeScriptIndexer.ts` - Static import parsing
- [ ] Unit tests for indexer

### Week 2: Analysis & Tools
- [ ] `EntrypointDetector.ts` - Pattern-based detection
- [ ] `ReachabilityAnalyzer.ts` - BFS implementation
- [ ] `IssueDetector.ts` - Generate 3 issue types
- [ ] `graphDigest.ts` - First LM Tool
- [ ] `graphIssues.ts` - Second LM Tool
- [ ] `graphImpact.ts` - Third LM Tool

### Week 3: Integration & Polish
- [ ] `IncrementalWatcher.ts` - File watching
- [ ] Sidebar UI integration
- [ ] Tool registration in `package.json`
- [ ] Integration tests
- [ ] Documentation

---

## Success Metrics

| Metric | Target |
|--------|--------|
| `graph.digest` token count | < 500 |
| `graph.issues` token count | < 800 |
| `graph.impact` token count | < 600 |
| Full index time (1000 files) | < 5 seconds |
| Incremental update time | < 200ms |
| Issue detection accuracy | > 80% |

---

## Known Limitations (MVP)

1. **TypeScript/JavaScript only** - Python, Rust, Go, Java, etc. deferred to v0.4
2. **No framework adapters** - Generic pattern matching only; Express, FastAPI, etc. deferred to v0.3
3. **No cycle detection** - Deferred to v0.5
4. **No layer rules** - Deferred to v0.5
5. **Basic visualization** - Stats only, no graph rendering; full viz deferred to v1.0
6. **No annotations** - Manual hints deferred to v0.2

These are explicitly out of scope for MVP and documented in the [Upgrade Path](./UPGRADE_PATH.md).
