# Code Graph Issue Taxonomy

> Standardized classification of Missing Links and structural problems

## Overview

Issues are categorized into three groups:

1. **Connectivity Issues** - Features not properly connected
2. **Resolution Issues** - Imports/exports that can't be resolved
3. **Architecture Issues** - Violations of structural rules

---

## Connectivity Issues

### ENTRY_MISSING_HANDLER

**Severity**: error

**Definition**: An entrypoint (route, command, page, job) is defined but its handler cannot be found.

**Detection**:
```typescript
// Entrypoint exists
app.get('/api/users', userController.list);

// But userController.list doesn't exist or isn't exported
```

**Evidence Format**:
```json
{
  "kind": "ENTRY_MISSING_HANDLER",
  "severity": "error",
  "title": "Route handler not found: GET /api/users",
  "evidence": [
    "Route registered at src/routes/api.ts:42",
    "Handler reference: userController.list",
    "userController imported from ./controllers/user",
    "But 'list' is not exported from that module",
    "Available exports: create, update, delete"
  ],
  "suggestedFix": [
    "Add 'list' export to src/controllers/user.ts",
    "Or change handler to existing export (create, update, delete)"
  ]
}
```

**Common Causes**:
- Typo in handler name
- Handler renamed but route not updated
- Missing export statement
- Circular dependency preventing resolution

---

### HANDLER_UNREACHABLE

**Severity**: warning

**Definition**: Code exists but cannot be reached from any entrypoint through the import graph.

**Detection Algorithm**:
```
1. Identify all entrypoints (routes, commands, pages, jobs)
2. BFS/DFS from each entrypoint following import edges
3. Mark all visited nodes as "reachable"
4. Any file NOT visited = HANDLER_UNREACHABLE
```

**Evidence Format**:
```json
{
  "kind": "HANDLER_UNREACHABLE",
  "severity": "warning",
  "title": "Unreachable code: src/utils/legacy.ts",
  "evidence": [
    "File exports 4 symbols: formatDate, parseDate, validateDate, DATE_FORMAT",
    "0 files import this module",
    "Not reachable from any of 15 entrypoints",
    "Last modified: 2024-03-15 (9 months ago)"
  ],
  "suggestedFix": [
    "Import from an active module if functionality is needed",
    "Remove file if obsolete",
    "Add as explicit entrypoint if standalone utility"
  ]
}
```

**Exceptions** (not flagged):
- Test files (`*.test.ts`, `*.spec.ts`)
- Type declaration files (`*.d.ts`)
- Config files
- Files in `.ouroboros/graph/annotations.json` ignore list

---

### NOT_REGISTERED

**Severity**: warning

**Definition**: Implementation exists and follows naming conventions, but isn't registered with the framework.

**Detection**:
```typescript
// File exists: src/routes/users.ts
// Exports: router with GET /users, POST /users

// But in src/app.ts:
app.use('/api/posts', postsRouter);
app.use('/api/comments', commentsRouter);
// Missing: app.use('/api/users', usersRouter);
```

**Evidence Format**:
```json
{
  "kind": "NOT_REGISTERED",
  "severity": "warning",
  "title": "Router not registered: src/routes/users.ts",
  "evidence": [
    "File exports Express router with 3 routes",
    "Located in src/routes/ (standard route directory)",
    "Other routers in same directory ARE registered",
    "No app.use() call found for this router"
  ],
  "suggestedFix": [
    "Add to src/app.ts: app.use('/api/users', usersRouter)",
    "Or move to different location if not a route"
  ]
}
```

**Framework-Specific Detection**:
- Express/Koa/Fastify/Hono: Check `app.use()`, `router.get()` calls
- NestJS: Check `@Module({ controllers: [...] })`
- Next.js/Nuxt/SvelteKit/Remix/Astro: File-based routing (auto-registered)
- FastAPI/Flask: Check `@app.route()`, `APIRouter` registration
- Django: Check `urls.py` patterns
- Actix/Axum/Rocket: Check route macros and `Router` configuration
- Gin/Echo: Check `r.GET()`, `e.GET()` calls
- Spring Boot: Check `@RestController` registration
- Rails: Check `routes.rb` configuration
- Laravel: Check `routes/` files
- CLI tools: Check command registration patterns

---

## Resolution Issues

### DYNAMIC_EDGE_UNKNOWN

**Severity**: info

**Definition**: Code contains dynamic import/require that cannot be statically resolved.

**Patterns Detected**:
```typescript
// Variable import
import(modulePath)

// Template literal
import(`./plugins/${name}`)

// Require with expression
require(config.moduleName)

// Reflect metadata
@Inject(TOKEN)
```

**Evidence Format**:
```json
{
  "kind": "DYNAMIC_EDGE_UNKNOWN",
  "severity": "info",
  "title": "Dynamic import at src/loader.ts:42",
  "evidence": [
    "Line 42: const mod = await import(pluginPath)",
    "Variable 'pluginPath' comes from runtime config",
    "Cannot determine possible targets statically",
    "This may cause false HANDLER_UNREACHABLE reports"
  ],
  "suggestedFix": [
    "Add annotation to .ouroboros/graph/annotations.json",
    "Example: { from: 'src/loader.ts', to: 'src/plugins/*.ts', kind: 'imports' }",
    "Or refactor to static imports if possible"
  ]
}
```

**Annotation Format**:
```json
{
  "edges": [
    {
      "from": "src/loader.ts",
      "to": "src/plugins/auth.ts",
      "kind": "imports",
      "confidence": "high",
      "reason": "manual: dynamic plugin loader"
    },
    {
      "from": "src/loader.ts", 
      "to": "src/plugins/cache.ts",
      "kind": "imports",
      "confidence": "high",
      "reason": "manual: dynamic plugin loader"
    }
  ]
}
```

---

### BROKEN_EXPORT_CHAIN

**Severity**: error

**Definition**: A barrel file (index.ts) re-exports a symbol that doesn't exist in the source.

**Patterns Detected**:
```typescript
// Named re-export of non-existent symbol
export { UserService } from './user';  // user.ts has no UserService

// Namespace re-export of missing file
export * from './missing';  // missing.ts doesn't exist

// Re-export with alias of non-existent
export { foo as bar } from './utils';  // utils.ts has no foo
```

**Evidence Format**:
```json
{
  "kind": "BROKEN_EXPORT_CHAIN",
  "severity": "error",
  "title": "Broken re-export in src/services/index.ts",
  "evidence": [
    "Line 5: export { UserService } from './user'",
    "Source file: src/services/user.ts",
    "Available exports: UserRepository, createUser, deleteUser",
    "Symbol 'UserService' not found",
    "This will cause runtime error when imported"
  ],
  "suggestedFix": [
    "Option 1: Change to existing export",
    "  export { UserRepository as UserService } from './user'",
    "Option 2: Add missing export to source",
    "  // In user.ts: export class UserService { ... }"
  ]
}
```

---

### CIRCULAR_REEXPORT

**Severity**: warning

**Definition**: Barrel files create a circular re-export chain.

**Example**:
```typescript
// src/a/index.ts
export * from '../b';

// src/b/index.ts  
export * from '../a';  // Circular!
```

**Evidence Format**:
```json
{
  "kind": "CIRCULAR_REEXPORT",
  "severity": "warning",
  "title": "Circular re-export chain detected",
  "evidence": [
    "Chain: src/a/index.ts → src/b/index.ts → src/a/index.ts",
    "This may cause undefined imports at runtime",
    "Depends on module evaluation order"
  ],
  "suggestedFix": [
    "Break the cycle by importing specific symbols",
    "Or restructure to avoid mutual barrel dependencies"
  ]
}
```

---

## Architecture Issues

### CYCLE_RISK

**Severity**: warning

**Definition**: Circular dependency detected in the import graph.

**Detection**: Tarjan's algorithm or DFS cycle detection

**Evidence Format**:
```json
{
  "kind": "CYCLE_RISK",
  "severity": "warning",
  "title": "Circular dependency detected",
  "evidence": [
    "Cycle: src/a.ts → src/b.ts → src/c.ts → src/a.ts",
    "Length: 3 files",
    "This may cause initialization issues",
    "Especially problematic with class inheritance"
  ],
  "suggestedFix": [
    "Extract shared code to a new module",
    "Use dependency injection",
    "Restructure to break the cycle"
  ]
}
```

---

### LAYER_VIOLATION

**Severity**: error (configurable)

**Definition**: Import violates defined architectural layer rules.

**Configuration**:
```json
{
  "layerRules": [
    {
      "name": "UI cannot import DB",
      "from": "src/ui/**",
      "cannotImport": "src/db/**"
    },
    {
      "name": "Services must go through API",
      "from": "src/pages/**",
      "cannotImport": "src/services/**",
      "mustGoThrough": "src/api/**"
    }
  ]
}
```

**Evidence Format**:
```json
{
  "kind": "LAYER_VIOLATION",
  "severity": "error",
  "title": "Layer violation: UI importing DB directly",
  "evidence": [
    "Rule: 'UI cannot import DB'",
    "File: src/ui/Dashboard.tsx",
    "Imports: src/db/client.ts",
    "This bypasses the service layer"
  ],
  "suggestedFix": [
    "Import through service layer instead",
    "src/ui/Dashboard.tsx → src/services/data.ts → src/db/client.ts"
  ]
}
```


---

## Quality Issues (Future)

### ORPHAN_EXPORT

**Severity**: info

**Definition**: Symbol is exported but never imported anywhere.

```json
{
  "kind": "ORPHAN_EXPORT",
  "severity": "info",
  "title": "Unused export: formatLegacyDate",
  "evidence": [
    "Exported from src/utils/date.ts",
    "0 files import this symbol",
    "Consider removing or marking as @internal"
  ]
}
```

---

### BARREL_BLOAT

**Severity**: info

**Definition**: Barrel file re-exports too many symbols, causing bundle bloat.

```json
{
  "kind": "BARREL_BLOAT",
  "severity": "info",
  "title": "Large barrel file: src/components/index.ts",
  "evidence": [
    "Re-exports 47 symbols",
    "Importing anything pulls entire barrel",
    "Consider splitting or using direct imports"
  ]
}
```

---

### DEEP_IMPORT

**Severity**: info

**Definition**: Importing from deep internal path instead of public API.

```json
{
  "kind": "DEEP_IMPORT",
  "severity": "info",
  "title": "Deep import detected",
  "evidence": [
    "File: src/pages/Dashboard.tsx",
    "Imports: @mylib/core/dist/internal/utils/format",
    "Should use: @mylib/core (public API)"
  ]
}
```

---

## Issue Severity Guidelines

| Severity | Meaning | Action Required |
|----------|---------|-----------------|
| `error` | Will cause runtime failure | Fix immediately |
| `warning` | Potential problem, may work | Review and fix |
| `info` | Code smell, optimization opportunity | Consider fixing |

---

## Issue Lifecycle

```
┌─────────────┐
│  Detected   │  ← Indexer/Analyzer finds issue
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Active    │  ← Shown in tools/UI
└──────┬──────┘
       │
       ├──────────────────┐
       │                  │
       ▼                  ▼
┌─────────────┐    ┌─────────────┐
│   Fixed     │    │  Ignored    │  ← User adds to ignore list
└─────────────┘    └─────────────┘
```

---

## Ignoring Issues

Users can ignore issues via annotations:

```json
// .ouroboros/graph/annotations.json
{
  "ignores": [
    {
      "issueKind": "HANDLER_UNREACHABLE",
      "path": "src/legacy/**",
      "reason": "Legacy code, scheduled for removal in Q2"
    },
    {
      "issueId": "issue-specific-id",
      "reason": "False positive, dynamic loading handled elsewhere"
    }
  ]
}
```

---

## Issue Detection Priority

For MVP, implement in this order:

1. **HANDLER_UNREACHABLE** - High value, straightforward BFS
2. **DYNAMIC_EDGE_UNKNOWN** - Easy to detect, important for accuracy
3. **BROKEN_EXPORT_CHAIN** - High severity, prevents runtime errors

For v2:
4. **ENTRY_MISSING_HANDLER** - Requires framework adapters
5. **NOT_REGISTERED** - Requires framework adapters
6. **CYCLE_RISK** - Tarjan's algorithm

For v3:
7. **LAYER_VIOLATION** - Requires user configuration
8. **CIRCULAR_REEXPORT** - Edge case
9. Quality issues (ORPHAN_EXPORT, BARREL_BLOAT, DEEP_IMPORT)
