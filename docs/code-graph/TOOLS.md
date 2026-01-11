# Code Graph LM Tools Reference

> API specification for Copilot-callable tools

## Design Philosophy

1. **Token Budget First** - Every tool has a hard token limit
2. **Digest → Detail** - Always start with overview, drill down on demand
3. **Actionable Output** - Results include next steps, not just data
4. **Truncation Transparency** - Always indicate if output was cut

---

## Tool Overview

| Tool | Purpose | Token Budget | When to Use |
|------|---------|--------------|-------------|
| `graph.digest` | Codebase overview | ~500 | First call, always |
| `graph.issues` | Missing Links list | ~800 | After seeing issue counts |
| `graph.impact` | Change blast radius | ~600 | Before modifying files |
| `graph.path` | Dependency path | ~400 | Understanding connections |
| `graph.module` | Single module details | ~500 | Deep dive on one file |
| `graph.issue.explain` | Issue deep dive | ~600 | Understanding one issue |
| `graph.issue.fixPlan` | Fix instructions | ~400 | Ready to fix |

---

## Tool 1: `ouroborosai_graph_digest`

### Purpose
Ultra-compact codebase overview. **Always call this first.**

### Registration (package.json)

```json
{
  "name": "ouroborosai_graph_digest",
  "displayName": "Code Graph Digest",
  "toolReferenceName": "ouroborosai_graph_digest",
  "description": "Get a compact overview of the codebase structure",
  "modelDescription": "CRITICAL: Call this FIRST before any other graph tools. Returns a token-efficient summary (~500 tokens) of the codebase including file counts, entrypoints, hotspots, and issue statistics. Use the 'scope' parameter to focus on specific packages or directories.",
  "canBeReferencedInPrompt": true,
  "inputSchema": {
    "type": "object",
    "properties": {
      "scope": {
        "type": "string",
        "description": "Optional: package name or directory path (e.g., 'src/api', '@myorg/core')"
      }
    }
  }
}
```

### Input

```typescript
interface DigestInput {
  scope?: string;  // Filter to package/directory
}
```

### Output

```typescript
interface DigestOutput {
  summary: {
    files: number;
    modules: number;
    entrypoints: number;
    edges: number;
  };
  entrypoints: {
    routes: string[];      // Top 5, e.g., ["GET /api/users", "POST /api/auth"]
    commands: string[];    // Top 5
    pages: string[];       // Top 5
    jobs: string[];        // Top 5
  };
  hotspots: Array<{
    path: string;
    importers: number;     // How many files import this
    exports: number;       // How many symbols exported
  }>;  // Top 10
  issues: {
    HANDLER_UNREACHABLE: number;
    DYNAMIC_EDGE_UNKNOWN: number;
    BROKEN_EXPORT_CHAIN: number;
    ENTRY_MISSING_HANDLER: number;
    NOT_REGISTERED: number;
    CYCLE_RISK: number;
    LAYER_VIOLATION: number;
  };
  meta: {
    lastIndexed: string;   // ISO timestamp
    tokensEstimate: number;
    truncated: boolean;
    scopeApplied: string | null;
  };
}
```

### Example Response

```json
{
  "summary": {
    "files": 142,
    "modules": 38,
    "entrypoints": 12,
    "edges": 487
  },
  "entrypoints": {
    "routes": ["GET /api/users", "POST /api/auth", "DELETE /api/users/:id"],
    "commands": ["build", "deploy", "migrate"],
    "pages": ["/dashboard", "/settings", "/login"],
    "jobs": ["cleanup", "sync"]
  },
  "hotspots": [
    { "path": "src/core/engine.ts", "importers": 24, "exports": 8 },
    { "path": "src/utils/helpers.ts", "importers": 19, "exports": 12 },
    { "path": "src/db/client.ts", "importers": 15, "exports": 3 }
  ],
  "issues": {
    "HANDLER_UNREACHABLE": 3,
    "DYNAMIC_EDGE_UNKNOWN": 7,
    "BROKEN_EXPORT_CHAIN": 1,
    "ENTRY_MISSING_HANDLER": 0,
    "NOT_REGISTERED": 2,
    "CYCLE_RISK": 0,
    "LAYER_VIOLATION": 0
  },
  "meta": {
    "lastIndexed": "2025-01-10T10:30:00Z",
    "tokensEstimate": 480,
    "truncated": false,
    "scopeApplied": null
  }
}
```

---

## Tool 2: `ouroborosai_graph_issues`

### Purpose
List Missing Links issues with actionable details.

### Registration

```json
{
  "name": "ouroborosai_graph_issues",
  "displayName": "Code Graph Issues",
  "toolReferenceName": "ouroborosai_graph_issues",
  "description": "List code connectivity issues (Missing Links)",
  "modelDescription": "Lists Missing Links issues: unreachable handlers, broken exports, unregistered features. Each issue includes evidence and suggested fixes. Call graph.digest first to see issue counts, then use filters here. Default limit is 20 issues.",
  "canBeReferencedInPrompt": true,
  "inputSchema": {
    "type": "object",
    "properties": {
      "issueType": {
        "type": "string",
        "enum": [
          "HANDLER_UNREACHABLE",
          "DYNAMIC_EDGE_UNKNOWN",
          "BROKEN_EXPORT_CHAIN",
          "ENTRY_MISSING_HANDLER",
          "NOT_REGISTERED",
          "CYCLE_RISK",
          "LAYER_VIOLATION"
        ],
        "description": "Filter by specific issue type"
      },
      "severity": {
        "type": "string",
        "enum": ["error", "warning", "info"],
        "description": "Minimum severity to include"
      },
      "scope": {
        "type": "string",
        "description": "Filter by file path prefix (e.g., 'src/api')"
      },
      "limit": {
        "type": "number",
        "description": "Max issues to return (default: 20, max: 50)"
      }
    }
  }
}
```

### Input

```typescript
interface IssuesInput {
  issueType?: IssueKind;
  severity?: "error" | "warning" | "info";
  scope?: string;
  limit?: number;  // default 20, max 50
}
```

### Output

```typescript
interface IssuesOutput {
  issues: Array<{
    id: string;
    kind: IssueKind;
    severity: "error" | "warning" | "info";
    file: string;
    summary: string;
    evidence: string[];
    suggestedFix: string[];
  }>;
  stats: {
    total: number;
    returned: number;
    byKind: Record<IssueKind, number>;
    bySeverity: Record<string, number>;
  };
  meta: {
    tokensEstimate: number;
    truncated: boolean;
    nextQuerySuggestion: string | null;
  };
}
```

### Example Response

```json
{
  "issues": [
    {
      "id": "issue-001",
      "kind": "HANDLER_UNREACHABLE",
      "severity": "warning",
      "file": "src/utils/legacy.ts",
      "summary": "File not reachable from any entrypoint",
      "evidence": [
        "0 files import this module",
        "Exports 4 functions that are never used",
        "Not connected to any of 12 entrypoints"
      ],
      "suggestedFix": [
        "Import from an active module if still needed",
        "Remove file if functionality is obsolete"
      ]
    },
    {
      "id": "issue-002",
      "kind": "BROKEN_EXPORT_CHAIN",
      "severity": "error",
      "file": "src/services/index.ts",
      "summary": "Re-exports non-existent symbol 'UserService'",
      "evidence": [
        "Line 5: export { UserService } from './user'",
        "./user.ts exports: UserRepository, createUser, deleteUser",
        "No 'UserService' found in source"
      ],
      "suggestedFix": [
        "Change to: export { UserRepository as UserService }",
        "Or add UserService export to ./user.ts"
      ]
    }
  ],
  "stats": {
    "total": 13,
    "returned": 13,
    "byKind": {
      "HANDLER_UNREACHABLE": 3,
      "DYNAMIC_EDGE_UNKNOWN": 7,
      "BROKEN_EXPORT_CHAIN": 1,
      "NOT_REGISTERED": 2
    },
    "bySeverity": {
      "error": 1,
      "warning": 5,
      "info": 7
    }
  },
  "meta": {
    "tokensEstimate": 720,
    "truncated": false,
    "nextQuerySuggestion": null
  }
}
```


---

## Tool 3: `ouroborosai_graph_impact`

### Purpose
Analyze blast radius of changing a file or symbol.

### Registration

```json
{
  "name": "ouroborosai_graph_impact",
  "displayName": "Code Graph Impact",
  "toolReferenceName": "ouroborosai_graph_impact",
  "description": "Analyze impact of changing a file or symbol",
  "modelDescription": "Shows what's affected by changing a file. Returns direct dependents, transitive impact by depth, affected entrypoints, and risk assessment. Use BEFORE making changes to understand blast radius. Default depth is 2.",
  "canBeReferencedInPrompt": true,
  "inputSchema": {
    "type": "object",
    "required": ["target"],
    "properties": {
      "target": {
        "type": "string",
        "description": "File path (e.g., 'src/core/auth.ts') or symbol name"
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
}
```

### Input

```typescript
interface ImpactInput {
  target: string;    // File path or symbol
  depth?: number;    // default 2, max 4
  limit?: number;    // default 30, max 100
}
```

### Output

```typescript
interface ImpactOutput {
  target: string;
  targetType: "file" | "symbol";
  directDependents: string[];  // Files that directly import target
  transitiveImpact: {
    depth1: number;
    depth2: number;
    depth3: number;
    depth4?: number;
  };
  affectedEntrypoints: Array<{
    type: "route" | "page" | "command" | "job";
    name: string;
    path: string;
  }>;
  riskAssessment: {
    level: "low" | "medium" | "high" | "critical";
    reason: string;
    factors: string[];
  };
  keyPaths: Array<{
    path: string[];
    description: string;
  }>;  // Top 3 most important dependency chains
  meta: {
    tokensEstimate: number;
    truncated: boolean;
    depthReached: number;
  };
}
```

### Example Response

```json
{
  "target": "src/core/auth.ts",
  "targetType": "file",
  "directDependents": [
    "src/api/users.ts",
    "src/api/admin.ts",
    "src/middleware/requireAuth.ts",
    "src/services/session.ts"
  ],
  "transitiveImpact": {
    "depth1": 4,
    "depth2": 12,
    "depth3": 28
  },
  "affectedEntrypoints": [
    { "type": "route", "name": "POST /api/login", "path": "src/api/auth.ts" },
    { "type": "route", "name": "GET /api/me", "path": "src/api/users.ts" },
    { "type": "route", "name": "POST /api/admin/users", "path": "src/api/admin.ts" },
    { "type": "page", "name": "/dashboard", "path": "src/pages/dashboard.tsx" }
  ],
  "riskAssessment": {
    "level": "high",
    "reason": "Core authentication module with wide impact",
    "factors": [
      "28 files affected transitively",
      "4 critical entrypoints depend on this",
      "Used by middleware (affects all protected routes)"
    ]
  },
  "keyPaths": [
    {
      "path": ["src/core/auth.ts", "src/middleware/requireAuth.ts", "src/api/*.ts"],
      "description": "Auth → Middleware → All protected API routes"
    },
    {
      "path": ["src/core/auth.ts", "src/services/session.ts", "src/pages/*.tsx"],
      "description": "Auth → Session → All authenticated pages"
    }
  ],
  "meta": {
    "tokensEstimate": 580,
    "truncated": false,
    "depthReached": 3
  }
}
```

---

## Tool 4: `ouroborosai_graph_path`

### Purpose
Find dependency path between two files/symbols.

### Registration

```json
{
  "name": "ouroborosai_graph_path",
  "displayName": "Code Graph Path",
  "toolReferenceName": "ouroborosai_graph_path",
  "description": "Find dependency path between two files",
  "modelDescription": "Finds how two files are connected through imports. Returns shortest paths and explains the connection. Use to understand 'why does X depend on Y' or 'how does change in A affect B'.",
  "canBeReferencedInPrompt": true,
  "inputSchema": {
    "type": "object",
    "required": ["from", "to"],
    "properties": {
      "from": {
        "type": "string",
        "description": "Source file path or symbol"
      },
      "to": {
        "type": "string",
        "description": "Target file path or symbol"
      },
      "maxDepth": {
        "type": "number",
        "description": "Max path length to search (default: 5, max: 10)"
      }
    }
  }
}
```

### Output

```typescript
interface PathOutput {
  from: string;
  to: string;
  connected: boolean;
  paths: Array<{
    nodes: string[];
    length: number;
    confidence: "high" | "medium" | "low";
    edgeTypes: string[];  // e.g., ["imports", "imports", "reexports"]
  }>;
  shortestPath: number | null;
  explanation: string;
  meta: {
    tokensEstimate: number;
    searchDepth: number;
    pathsFound: number;
  };
}
```

### Example Response

```json
{
  "from": "src/pages/dashboard.tsx",
  "to": "src/db/client.ts",
  "connected": true,
  "paths": [
    {
      "nodes": [
        "src/pages/dashboard.tsx",
        "src/hooks/useData.ts",
        "src/services/dataService.ts",
        "src/db/client.ts"
      ],
      "length": 3,
      "confidence": "high",
      "edgeTypes": ["imports", "imports", "imports"]
    },
    {
      "nodes": [
        "src/pages/dashboard.tsx",
        "src/components/DataTable.tsx",
        "src/hooks/useData.ts",
        "src/services/dataService.ts",
        "src/db/client.ts"
      ],
      "length": 4,
      "confidence": "high",
      "edgeTypes": ["imports", "imports", "imports", "imports"]
    }
  ],
  "shortestPath": 3,
  "explanation": "Dashboard connects to DB through useData hook and dataService. Changes to db/client.ts will affect dashboard rendering.",
  "meta": {
    "tokensEstimate": 380,
    "searchDepth": 5,
    "pathsFound": 2
  }
}
```

---

## Tool 5: `ouroborosai_graph_module`

### Purpose
Deep dive on a single module/file.

### Registration

```json
{
  "name": "ouroborosai_graph_module",
  "displayName": "Code Graph Module",
  "toolReferenceName": "ouroborosai_graph_module",
  "description": "Get detailed info about a single module",
  "modelDescription": "Returns comprehensive information about one file: what it imports, what imports it, its exports, related entrypoints, and any issues. Use for deep understanding of a specific module.",
  "canBeReferencedInPrompt": true,
  "inputSchema": {
    "type": "object",
    "required": ["target"],
    "properties": {
      "target": {
        "type": "string",
        "description": "File path (e.g., 'src/services/auth.ts')"
      }
    }
  }
}
```

### Output

```typescript
interface ModuleOutput {
  path: string;
  name: string;
  kind: "file" | "module";
  
  imports: Array<{
    path: string;
    symbols: string[];
    confidence: Confidence;
  }>;
  
  importedBy: Array<{
    path: string;
    symbols: string[];
  }>;
  
  exports: Array<{
    name: string;
    kind: "function" | "class" | "variable" | "type";
    usedBy: number;  // How many files use this export
  }>;
  
  entrypoints: Array<{
    type: string;
    name: string;
    relationship: "defines" | "uses" | "registers";
  }>;
  
  issues: Array<{
    kind: IssueKind;
    summary: string;
  }>;
  
  metrics: {
    importCount: number;
    importerCount: number;
    exportCount: number;
    isHotspot: boolean;
    isOrphan: boolean;
  };
  
  meta: {
    tokensEstimate: number;
  };
}
```

---

## Tool 6: `ouroborosai_graph_issue_explain`

### Purpose
Deep explanation of a single issue.

### Registration

```json
{
  "name": "ouroborosai_graph_issue_explain",
  "displayName": "Explain Graph Issue",
  "toolReferenceName": "ouroborosai_graph_issue_explain",
  "description": "Get detailed explanation of a specific issue",
  "modelDescription": "Provides in-depth analysis of one issue including full evidence, affected code locations, and detailed fix suggestions. Use after graph.issues to understand a specific problem before fixing.",
  "canBeReferencedInPrompt": true,
  "inputSchema": {
    "type": "object",
    "required": ["issueId"],
    "properties": {
      "issueId": {
        "type": "string",
        "description": "Issue ID from graph.issues response"
      }
    }
  }
}
```

### Output

```typescript
interface IssueExplainOutput {
  issue: {
    id: string;
    kind: IssueKind;
    severity: string;
    title: string;
  };
  
  location: {
    file: string;
    line?: number;
    symbol?: string;
  };
  
  evidence: Array<{
    type: "code" | "graph" | "config";
    description: string;
    snippet?: string;  // Short code snippet if relevant
  }>;
  
  impact: {
    affectedFiles: string[];
    affectedEntrypoints: string[];
    riskLevel: string;
  };
  
  suggestedFixes: Array<{
    description: string;
    effort: "trivial" | "small" | "medium" | "large";
    steps: string[];
  }>;
  
  relatedIssues: string[];  // Other issue IDs that might be related
  
  meta: {
    tokensEstimate: number;
  };
}
```

---

## Tool 7: `ouroborosai_graph_issue_fixplan`

### Purpose
Generate executable fix plan for issues.

### Registration

```json
{
  "name": "ouroborosai_graph_issue_fixplan",
  "displayName": "Graph Issue Fix Plan",
  "toolReferenceName": "ouroborosai_graph_issue_fixplan",
  "description": "Generate a fix plan for graph issues",
  "modelDescription": "Creates an actionable fix plan for one or more issues. Returns specific file edits needed. Use when ready to fix issues - provides exact changes to make.",
  "canBeReferencedInPrompt": true,
  "inputSchema": {
    "type": "object",
    "required": ["issueIds"],
    "properties": {
      "issueIds": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Issue IDs to fix (max 5)"
      }
    }
  }
}
```

### Output

```typescript
interface FixPlanOutput {
  issues: string[];
  
  plan: {
    summary: string;
    totalEdits: number;
    estimatedEffort: "trivial" | "small" | "medium" | "large";
  };
  
  edits: Array<{
    file: string;
    action: "create" | "modify" | "delete";
    description: string;
    changes: Array<{
      type: "add" | "remove" | "replace";
      location: string;  // e.g., "line 42" or "after imports"
      content?: string;  // For add/replace
    }>;
  }>;
  
  verification: {
    steps: string[];
    expectedOutcome: string;
  };
  
  meta: {
    tokensEstimate: number;
    issuesAddressed: number;
  };
}
```

---

## Tool 8: `ouroborosai_graph_annotations`

### Purpose
Manage manual annotations for dynamic edges.

### Registration

```json
{
  "name": "ouroborosai_graph_annotations",
  "displayName": "Graph Annotations",
  "toolReferenceName": "ouroborosai_graph_annotations",
  "description": "View or add manual graph annotations",
  "modelDescription": "Manages user-provided hints for edges that cannot be detected statically (dynamic imports, DI, etc.). Use 'list' to see current annotations, 'add' to declare a known connection.",
  "canBeReferencedInPrompt": true,
  "inputSchema": {
    "type": "object",
    "required": ["action"],
    "properties": {
      "action": {
        "type": "string",
        "enum": ["list", "add"],
        "description": "Action to perform"
      },
      "annotation": {
        "type": "object",
        "description": "Annotation to add (required for 'add' action)",
        "properties": {
          "from": { "type": "string" },
          "to": { "type": "string" },
          "kind": { "type": "string" },
          "reason": { "type": "string" }
        }
      }
    }
  }
}
```

---

## Copilot Usage Guidelines

### Recommended Workflow

```
1. ALWAYS start with graph.digest
   → Understand codebase structure
   → See issue counts
   
2. If issues exist, call graph.issues
   → Filter by type/severity if many
   → Get actionable list
   
3. Before modifying files, call graph.impact
   → Understand blast radius
   → Identify affected entrypoints
   
4. For specific issues, call graph.issue.explain
   → Get full context
   → Understand root cause
   
5. When ready to fix, call graph.issue.fixplan
   → Get exact edits needed
   → Apply changes
```

### Token Budget Rules

| Scenario | Max Tokens | Strategy |
|----------|------------|----------|
| Initial exploration | 500 | Use digest only |
| Issue investigation | 1500 | digest + issues + 1 explain |
| Pre-change analysis | 1200 | digest + impact |
| Fix workflow | 2000 | digest + issues + explain + fixplan |

### Anti-Patterns to Avoid

❌ Calling `graph.issues` without `graph.digest` first
❌ Requesting `limit: 100` on first query
❌ Calling `graph.impact` on every file
❌ Ignoring `truncated: true` in responses
❌ Not using `scope` parameter for large repos

### Prompt Engineering Tips

Include in system prompt:
```
When working with code structure:
1. Always call ouroborosai_graph_digest first
2. Use scope parameter for large codebases
3. Check tokensEstimate in responses
4. If truncated=true, narrow your query
5. Use graph.path to understand connections
```
