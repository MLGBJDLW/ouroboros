# Changelog

All notable changes to the Ouroboros AI VS Code Extension will be documented in this file.

## [3.3.8] - 2026-01-12

### Hybrid External Tool Architecture

Major upgrade to Code Graph with external tool integration for more accurate dependency analysis.

#### Added
- **WaspAdapter** — Full-stack framework support for Wasp projects:
  - Parses `main.wasp` and `main.wasp.ts` configuration files
  - Extracts pages, routes, queries, actions, jobs, and APIs as entrypoints
  - Resolves `@src/`, `@server/`, `@client/` import aliases
  - Creates registration edges from routes to pages
  - Detects missing handlers and invalid route references
  - Solves ~650 false positive "unreachable" issues in Wasp projects

- **Graph Context Badge** — Visual feedback for items added to context:
  - Shows badge in empty state: "X item(s) in context"
  - Floating badge when active request exists
  - Syncs with backend via `graphContextUpdate` message
  - Smooth animation on badge appearance

- **DependencyCruiserAdapter** — Integrates battle-tested dependency-cruiser for JS/TS projects:
  - Bundled with extension (no user installation required)
  - Uses CLI via bundled binary for esbuild compatibility
  - Converts dependency-cruiser output to GraphNode/GraphEdge format
  - Detects circular dependencies with cycle paths
  - Falls back to built-in TypeScriptIndexer when not available

- **GoModGraphAdapter** — Integrates Go's built-in `go mod graph` command:
  - No extra installation needed (built into Go toolchain)
  - Provides module-level dependency information
  - Handles replace directives and workspace modules

- **JdepsAdapter** — Integrates JDK's built-in `jdeps` command for Java:
  - No extra installation needed (built into JDK 8+)
  - Provides class-level dependency analysis
  - Supports Java 9+ module system

- **ExtensionMapper** — Centralized ESM extension mapping module:
  - Maps `.js` → `.ts`, `.jsx` → `.tsx`, `.mjs` → `.mts`, `.cjs` → `.cts`
  - Handles TypeScript ESM `moduleResolution: NodeNext` imports
  - Supports index file resolution (`./dir` → `./dir/index.ts`)

- **ExternalToolsConfig** — Configurable external tool preferences:
  ```json
  {
    "externalTools": {
      "preferExternal": true,
      "javascript": { "tool": "auto" },
      "go": { "tool": "auto" },
      "java": { "tool": "auto" }
    }
  }
  ```
  - `auto`: Use external tool if available, fallback to builtin
  - `external`: Require external tool (warn if unavailable)
  - `builtin`: Always use built-in indexer

- **CIRCULAR_DEPENDENCY Issue Kind** — New issue type for circular import detection

- **CodeGraphManager Enhancements**:
  - `getExternalToolsConfig()` — Get current external tools configuration
  - `getExternalToolStatus()` — Check availability of all external tools

#### Enhanced (Based on pydeps & cargo-modules algorithms)

- **PythonIndexer Enhancements** (inspired by pydeps):
  - Comprehensive Python 3.11+ stdlib module list (200+ modules)
  - `pkgutil.walk_packages()` dynamic import detection
  - `typing.TYPE_CHECKING` conditional import handling
  - Enhanced `__all__` export validation
  - Better relative import level resolution

- **RustIndexer Enhancements** (inspired by cargo-modules):
  - Visibility level tracking (`pub`, `pub(crate)`, `pub(super)`, `pub(in path)`)
  - `#[path = "..."]` custom module path support
  - Use tree parsing for nested imports (`use crate::{foo, bar::{baz}};`)
  - `macro_definition` export detection
  - `impl` block associated item tracking
  - Crate root detection (`lib.rs`, `main.rs`)
  - Export visibility metadata in file nodes

#### Fixed
- **ESM Extension Mapping** — Fixed 697 false positive `HANDLER_UNREACHABLE` issues in TypeScript ESM projects
- **GraphStore ESM Support** — `getNode()` and `getNodeByPath()` now try alternative extensions
- **DependencyCruiserAdapter Cross-Platform** — Fixed shell spawn for Windows/macOS/Linux compatibility:
  - Windows: Uses `cmd.exe /c` for `.cmd` file execution (avoids shell argument parsing issues)
  - Unix: Uses direct spawn without shell for better performance
  - Removed problematic parentheses from exclude patterns

#### Improved
- **fullIndex() Performance** — External tools process files first, built-in indexers handle remaining files
- **Issue Detection** — External tool issues merged with built-in issue detection

#### Tests
- 768 tests passing
- 69 test files

#### Documentation
- Updated `ARCHITECTURE.md` with hybrid architecture diagram and configuration guide

---

## [3.3.7] - 2026-01-12

### Added
- **graphSearch Tool** — AI can now search for files, symbols, and directories by name/keyword:
  - Fuzzy matching with scoring (exact > contains > fuzzy)
  - Filter by type: `file`, `symbol`, `directory`, or `all`
  - Scope limiting to specific directories
  - Returns import counts and hotspot/entrypoint flags

- **graphTree Tool** — AI can browse directory structure:
  - Configurable depth (1-5 levels)
  - File/directory stats (file count, imports, exports)
  - Pattern filtering (e.g., `*.test.ts`, `index.*`)
  - Identifies barrel files and entrypoints

### Fixed
- **Graph Analyzer Re-export Tracking** — Fixed false positives for `HANDLER_UNREACHABLE` (694→0) by tracking `export * from` re-exports:
  - **TypeScriptIndexer**: Added `REEXPORT_ALL_REGEX`, `REEXPORT_NAMESPACE_REGEX` for barrel/namespace/named/default re-exports
  - **PythonIndexer**: Added `from x import *` wildcard detection, `__init__.py` barrel file support
  - **RustIndexer**: Added `pub use` and `pub mod` re-export edge creation
  - **GoIndexer**: Added dot import (`import . "package"`) re-export detection
  - **JavaIndexer**: Added Java 9+ module system support (`exports`, `requires transitive`)
  - **ReachabilityAnalyzer**: Added `markReexportedFilesAsReachable()` iterative marking
  - **IssueDetector**: Added `isReexportedByReachableBarrel()` check, `isWorkspacePackageImport()` for @org/package

- **DYNAMIC_EDGE_UNKNOWN Severity** — Changed from 'warning' to 'info' (dynamic imports are intentional patterns)

- **Issues Tab Filter Bug** — Fixed filter dropdown not displaying filtered results

### Added
- **Add to Context Persistent Feedback** — Items added to context now show persistent indicator until consumed:
  - `addedToContext` state synced with backend via `graphContextUpdate` message
  - `recentlyAdded` flash animation (1.5s pulse) for newly added items
  - Context badge shows count of items pending in context

### Improved
- **Issues Tab UX** — Search box, display limit selector (20/50/100/200/All), clickable legend filters, load more button

---

## [3.3.6] - 2026-01-11

### Fixed
- **Monorepo Workspace Detection** — All language indexers now detect workspace packages:
  - **TypeScript/JavaScript**: `package.json` workspaces, `pnpm-workspace.yaml`, `tsconfig.json` path aliases
  - **TypeScript Project References**: `tsconfig.json` references for multi-project setups
  - **Package.json Exports**: Node.js conditional exports (`exports` field)
  - **Subpath Imports**: Private imports (`#internal` via `imports` field)
  - **Bundler Aliases**: Webpack `resolve.alias`, Vite `resolve.alias`
  - **Yarn PnP**: `.pnp.cjs` virtual path resolution
  - **Python**: `pyproject.toml`, `setup.py`, Poetry/PDM workspace packages, `src/` layout
  - **Go**: `go.work` modules, `go.mod` replace directives, `vendor/` packages
  - **Rust**: `Cargo.toml` workspace members, path dependencies
  - **Java**: Maven `pom.xml` modules, Gradle `settings.gradle` includes
  - **C#/.NET**: `.sln` solution files, `.csproj` project references
  - **PHP**: `composer.json` PSR-4/PSR-0 autoload, path repositories
  - **Monorepo Tools**: Nx, Turborepo, Lerna project detection

### Added
- **Multi-Language Workspace Cache** — `BaseIndexer.WorkspaceCache` structure for efficient cross-language workspace detection
- **TypeScript Path Alias Resolution** — Reads `tsconfig.json`/`jsconfig.json` paths for accurate import resolution
- **Subpath Import Resolution** — Resolves `#internal` imports from `package.json` imports field
- **Bundler Alias Detection** — Parses Webpack/Vite config files for alias mappings

---

## [3.3.5] - 2026-01-11

### Fixed
- **Graph Refresh** — Fixed refresh button not updating data (cache invalidation issue)
- **Graph Zoom** — Fixed graph shrinking to corner after refresh (now auto-fits to view)
- **Issues Categories** — Dynamic issue type filtering (shows all detected types, not just 3 hardcoded)
- **Real Dependency Edges** — Graph now displays actual import relationships instead of directory-based fake links

### Added
- **Auto-Refresh** — Graph data auto-refreshes every 2 minutes when visible
- **Graph Stats Bar** — Shows node/edge counts with warning when no connections exist
- **Backend Edge API** — New `getGraphEdges` message for fetching real import edges

### Improved
- **TypeScript Compilation** — Fixed multiple type errors in codeGraph tools

---

## [3.3.4] - 2026-01-11

### Fixed
- **Code Graph Tool Invoke** — Fixed `TypeError: i.tool.invoke is not a function` by refactoring 5 graph tools to use proper `vscode.LanguageModelTool<T>` interface with `invoke` method

---

## [3.3.3] - 2026-01-11

### Fixed
- **L2 Worker Tool Injection** — Fixed `preserveYamlFrontmatter` to inject Code Graph tools for L2 workers during Update Prompts
- **Template Directory Creation** — Fixed recursive directory creation for nested template paths
- **Removed phase_progress** — Cleaned up obsolete `ouroborosai_phase_progress` references from docs and README template
- **ESM .js Import Resolution** — Fixed false "broken export" issues for TypeScript projects using `moduleResolution: NodeNext`:
  - `BaseIndexer.addExtensionIfNeeded` now strips `.js`/`.jsx`/`.mjs`/`.cjs` extensions to find `.ts` source files
  - `PathResolver.normalizeAndResolve` handles ESM-style `.js` imports mapping to `.ts` files
  - `IssueDetector.detectBrokenExports` checks alternative extensions before reporting broken links

---

## [3.3.2] - 2026-01-11

### Fixed
- **parseToolsFromYaml** — Fixed YAML line number calculation (returned `startLine`/`endLine` instead of character positions)

---

## [3.3.1] - 2026-01-11

### Fixed
- **Tree-sitter WASM** — Windows `file://` URL conversion
- **Workspace Selection** — Tools register correctly after Marketplace install
- **vscode.open** — Webview path-to-Uri conversion
- **Hotspot Consistency** — Tree view now uses same logic as Overview

### Improved
- **Language Indexers** — Comprehensive framework detection for Go, Java, Python, Rust, TypeScript
- **Code Graph Tools** — All 8 tools injected for L0/L1/L2 agents via promptTransformer
- **Tool Parameters** — Fine-grained filtering (`include`, `limit`, `groupBy`, etc.)
- **UI** — Replaced emoji with codicon icons in Graph settings

---

## [3.3.0] - 2026-01-11

### 🚀 Code Graph v1.0 - Production Ready

#### New Features
- **8 LM Tools** for codebase structure analysis:
  - `ouroborosai_graph_digest` — Compact codebase overview (~500 tokens)
  - `ouroborosai_graph_issues` — Code quality issues with evidence
  - `ouroborosai_graph_impact` — Change impact analysis
  - `ouroborosai_graph_path` — Find dependency paths between modules
  - `ouroborosai_graph_module` — Get detailed module information
  - `ouroborosai_graph_annotations` — Manage manual annotations
  - `ouroborosai_graph_cycles` — Detect circular dependencies
  - `ouroborosai_graph_layers` — Architectural layer rule enforcement

- **Unified Envelope Format** — All tools return consistent JSON structure:
  - `{ success, data: { tool, version, requestId, generatedAt, workspace, result, meta } }`
  - `nextQuerySuggestion` guides optimal query flow
  - See `docs/code-graph/ENVELOPE.md` for full specification

- **Interactive Graph UI** — New "Graph" tab with force-directed visualization
  - Drag, zoom, pan support via `react-force-graph-2d`
  - Click nodes to view details (imports, exports, issues)
  - Visual indicators for entrypoints (🚀) and hotspots (🔥)
  - "Fix with Copilot" one-click button
- **Tree View** — New "Tree" tab with hierarchical file browsing and issue badges
- **Graph Controls** — Fit-to-view, freeze layout, show edges, label declutter
- **Mixed-Repo Indexing** — Expanded include patterns with `.ouroboros/graph/config.json` overrides

- **Performance** — QueryCache with LRU eviction, ParallelIndexer for batch processing

- **Multi-Language** — TypeScript, Python, Rust, Go, Java via tree-sitter

- **Framework Detection** — Express, Next.js, NestJS, FastAPI, Spring Boot, etc.

#### Fixes
- **Hotspot Detection** — Use resolved file imports and skip external modules
- **Import Path Resolution** — All languages now resolve local imports to file paths:
  - Python: Relative imports (`.module`, `..module`) → `path/to/module.py`
  - Rust: `crate::`, `super::`, `self::` → `src/path/to/module.rs`
  - Java: Local package imports → `src/main/java/path/Class.java`
  - Go: Relative imports (`./`, `../`) → resolved directory paths
- **Hotspot Fallback** — Shows files with most exports when no import-based hotspots found
- **Bundle Splitting** — Webview split into 4 chunks (react, markdown, graph, app)
- **Log Spam Reduction** — Tree-sitter fallback warnings now log only once per language
- **Tree-Sitter Init** — Normalize module exports and bundle WASM for reliable startup

#### Tests
- 677 tests passing (+317 from v3.2.20)

---

## [3.2.20] - 2026-01-10

### Fixed
- **YAML Tools Field Formatting** — Single-line arrays preserved during Update Prompts

---

## [3.2.19] - 2026-01-10

### Added
- **PRD Agent Support** — `/ouroboros-prd` slash command for AI-guided PRD creation

## [3.2.18] - 2026-01-02

### Added
- **Slash Command Autocomplete** — Type `/` for command suggestions with fuzzy matching and keyboard navigation

## [3.2.16] - 2026-01-02

### Fixed
- **History Real-Time Update** — History tab now updates immediately when new interactions are recorded

### Changed
- **Sent Message Card** — "Native Avant-Garde" style with scanline texture and pulse animation

## [3.2.15] - 2026-01-02

### Added
- **UI Redesign** — "Handoff Card" V5 with native theming, dynamic agent icons, holographic overlays
- **Input History** — Navigate previous inputs with ↑/↓ arrow keys (localStorage persistence)

## [3.2.13] - 2025-12-29

### Added
- **Copilot Usage Insights** — Welcome page card showing plan type, quota usage, reset countdown
- **Linting Rules** — Coder agent now enforces lint-clean code, no suppressions, strong typing

### Changed
- **Smart YAML Preservation** — Update Prompts preserves user-customized fields (`tools`, `description`)

## [3.2.12] - 2025-12-25

### Changed
- **Spec Agent Format Enforcement** — FORMAT LOCK sections prevent template format changes

### Fixed
- **Multi-Workspace Commands** — Initialize/Update now use selected workspace correctly

## [3.2.11] - 2025-12-25

### Added
- **Markdown Rendering** — Plan review renders formatted Markdown with GFM support
- **Larger Plan Review Panel** — Full-width layout with expand/collapse toggle

## [3.2.10] - 2025-12-24

### Added
- **Attachment System** — Paste images, drag & drop files, file picker (max 5MB, 10 attachments)

## [3.2.9] - 2025-12-23

### Fixed
- **Multiline Custom Input** — Shift+Enter for new lines in Menu/Confirm/Plan Review
- **Newline Parsing** — `\n` now renders as actual line breaks

## [3.2.8] - 2025-12-22

### Changed
- **Chat-Style UI** — Request cards use chat bubble layout with agent avatar
- **Tab Shortcuts** — Changed to Alt+number to avoid input conflicts

### Removed
- **`ouroborosai_phase_progress` Tool** — Progress now tracked via file system

## [3.2.7] - 2025-12-22

### Added
- **Sent Message Confirmation** — Chat bubble shows what you sent with slide-in animation

### Fixed
- **Multi-Workspace Spec Detection** — SpecWatcher restarts when switching workspaces

## [3.2.5] - 2025-12-22

### Added
- **File-Based Workflow Progress** — Reads directly from `.ouroboros/specs/` with FileSystemWatcher

### Changed
- **Welcome Logo** — SVG arc paths with breathing animation and flowing particles

## [3.2.4] - 2025-12-21

### Added
- **Keyboard Shortcuts** — 1-9 for menu, Y/N for confirm, Esc to cancel, Ctrl+Enter to approve

## [3.2.3] - 2025-12-21

### Added
- **Multi-Root Workspace Selector** — Choose workspace in multi-root projects

### Fixed
- **Template Download** — Templates now download during Update Prompts
- **Copilot Chat Step** — Shows ✓ after opening Copilot Chat

## [3.2.2] - 2025-12-21

### Added
- **Smart Prompt Update** — Preserves custom `tools:` array during updates
- **Agent Skills Support** — Compatible with agentskills.io standard

## [3.2.1] - 2025-12-21

### Changed
- Renamed to `ouroboros-ai`, tools to `ouroborosai_*`, publisher to `MLGBJDLW`

## [3.2.0] - 2025-12-21

### Added
- **6 LM Tools** — ask, menu, confirm, plan_review, phase_progress, agent_handoff
- **React Webview UI** — 4 tabs with keyboard navigation
- **Commands** — Initialize, Open Sidebar, Clear History, Cancel Request
- Minimum VS Code 1.95.0, 48 unit tests
