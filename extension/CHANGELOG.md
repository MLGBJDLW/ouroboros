# Changelog

All notable changes to the Ouroboros AI VS Code Extension will be documented in this file.

## [3.3.13] - 2026-01-16

### Fixed
- **Send Button Icon** — Replaced Logo with codicon `send` icon in PendingRequests
- **Attachment Button Visibility** — Higher contrast (0.85 opacity) and blue hover border
- **Graph Orphan Filtering** — Config files, test files, and type definitions no longer reported as unreachable
- **Barrel Re-export Detection** — Files exported via `export * from` chains now correctly marked as reachable
- **Graph Edge Visualization** — Graph now includes reexport edges and expands to 50+ connected nodes
- **Graph Auto-Refresh** — Fixed stale closure causing auto-refresh interval to not work

---

## [3.3.12] - 2026-01-13


### Added
- **CuratorCompat Layer** — Unified search API with automatic fallback: Graph → Indexer → Curator → Regex
- **Context Persistence Protocol** — Mandatory context updates with 2-Action Rule and 5-Question Reboot
- **Tool Execution Mandate** — All agent prompts enforce "ANNOUNCE → EXECUTE → VERIFY"
- **Output Constraints** — Token budget rules and anti-verbosity guidelines
- **Handoff Report Format** — Mandatory context update info in every handoff

### Changed
- **Context Template** — Enhanced with Findings, Errors, Reboot sections (Planning-with-Files pattern)
- **Agent Response Format** — Shortened separator lines (46→30 chars)

### Fixed
- **GraphQuery CIRCULAR_DEPENDENCY** — Added missing `CIRCULAR_DEPENDENCY` to `IssueKind` enum

---

## [3.3.11] - 2026-01-13

### Added
- **Welcome Page Version Display** — Shows extension version (e.g., v3.3.11) in top-right corner
- **Dependency-Cruiser Install Hint** — Graph tab shows installation hint when dependency-cruiser is not available

### Changed
- **DependencyCruiserAdapter** — Now uses workspace-local installation only (user must install `dependency-cruiser` in their project)
  - Removed bundled dependency-cruiser (too many transitive dependencies to bundle)
  - Falls back to built-in TypeScriptIndexer if not installed

### Fixed
- **Package Manager Support** — DependencyCruiserAdapter now supports npm, pnpm, yarn, and yarn berry (PnP):
  - npm/yarn classic: `node_modules/.bin/depcruise`
  - pnpm workspace: Searches up for `pnpm-workspace.yaml` and checks workspace root
  - yarn berry: Checks `.yarn/unplugged/` and node-modules linker mode

---

## [3.3.10] - 2026-01-13

### Fixed
- **DependencyCruiserAdapter Production Build** — Fixed dependency-cruiser not working in published extension:
  - Added `copy-dependency-cruiser.js` build script to bundle CLI binary with extension
  - Adapter now checks `dist/node_modules` first (production), then `node_modules` (development)
  - Pass `extensionPath` from VS Code context for correct path resolution

---

## [3.3.8] - 2026-01-12

### Hybrid External Tool Architecture

Major upgrade to Code Graph with external tool integration for more accurate dependency analysis.

#### Added
- **WaspAdapter** — Full-stack framework support for Wasp projects with `excludePatterns` for `.wasp/out` exclusion
- **Graph Context Badge** — Visual feedback for items added to context
- **DependencyCruiserAdapter** — Integrates dependency-cruiser for JS/TS (bundled, no installation required)
- **GoModGraphAdapter** — Integrates Go's `go mod graph` (built into Go toolchain)
- **JdepsAdapter** — Integrates JDK's `jdeps` for Java (built into JDK 8+)
- **ExtensionMapper** — Centralized ESM extension mapping (`.js` → `.ts`, etc.)
- **ExternalToolsConfig** — Configurable external tool preferences (`auto`/`external`/`builtin`)
- **CIRCULAR_DEPENDENCY Issue Kind** — New issue type for circular imports

#### Enhanced
- **PythonIndexer** — Python 3.11+ stdlib, dynamic import detection, `TYPE_CHECKING` handling
- **RustIndexer** — Visibility tracking, `#[path]` support, use tree parsing, `impl` block tracking

#### Fixed
- **ESM Extension Mapping** — Fixed 697 false positive issues in TypeScript ESM projects
- **DependencyCruiserAdapter Cross-Platform** — Windows/macOS/Linux compatibility:
  - Windows: Uses `.cmd` files with `shell: true` and quoted exclude patterns
  - Unix: Direct spawn without shell
  - Proper regex escaping for exclude directories (`.wasp`, `.git`, etc.)
- **FrameworkAdapter excludePatterns** — Adapters can now specify directories to exclude from analysis

#### Tests
- 784 tests passing, 70 test files
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
