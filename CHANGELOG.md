# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.3.13] - 2026-01-16

### Fixed
- **Send Button Icon** — Replaced Logo with codicon `send` icon in pending requests
- **Attachment Button Visibility** — Enhanced contrast and hover states for attach button
- **Graph Orphan Filtering** — `DependencyCruiserAdapter` now filters config/test files from orphan reports
- **Barrel Re-export Detection** — Orphan detection delegated to `IssueDetector` for proper `export * from` chain handling

---

## [3.3.12] - 2026-01-13


### Added
- **CuratorCompat Layer** — Unified search API with automatic fallback: Graph → Indexer → Curator → Regex
- **Context Persistence Protocol (CPP)** — Mandatory context updates with 2-Action Rule and 5-Question Reboot
- **Tool Execution Mandate** — All 17 agent prompts enforce "ANNOUNCE → EXECUTE → VERIFY"
- **Output Constraints** — Token budget rules and anti-verbosity guidelines
- **Handoff Report Format** — Mandatory context update info in every handoff

### Changed
- **Context Template** — Enhanced with Findings, Errors, 5-Question Reboot sections (Planning-with-Files pattern)
- **Spec/Implement Agents** — Context update now MANDATORY after each phase/task

### Fixed
- **Agent Response Format** — Shortened separator lines (46→30 chars) to prevent UI wrapping
- **GraphQuery CIRCULAR_DEPENDENCY** — Added missing issue kind to enum

---

## [3.3.11] - 2026-01-13

### Added
- **Welcome Page Version Display** — Shows extension version in top-right corner
- **Dependency-Cruiser Install Hint** — Graph tab shows installation hint when not available

### Changed
- **DependencyCruiserAdapter** — Uses workspace-local installation only (user must install in their project)

### Fixed
- **Package Manager Support** — DependencyCruiserAdapter now supports npm, pnpm, yarn, and yarn berry (PnP)

---

## [3.3.10] - 2026-01-13

### Fixed
- **DependencyCruiserAdapter Production Build** — Fixed dependency-cruiser not working in published extension by bundling CLI binary

---

## [3.3.8] - 2026-01-12

### Hybrid External Tool Architecture

Major upgrade to Code Graph with external tool integration for more accurate dependency analysis.

### Added
- **WaspAdapter** — Full-stack framework support for Wasp projects with `excludePatterns` for `.wasp/out` exclusion
- **Graph Context Badge** — Visual feedback for items added to context
- **DependencyCruiserAdapter** — Integrates dependency-cruiser for JS/TS (bundled)
- **GoModGraphAdapter** — Integrates Go's `go mod graph`
- **JdepsAdapter** — Integrates JDK's `jdeps` for Java
- **ExtensionMapper** — Centralized ESM extension mapping
- **ExternalToolsConfig** — Configurable external tool preferences (`auto`/`external`/`builtin`)

### Fixed
- **ESM Extension Mapping** — Fixed 697 false positive issues in TypeScript ESM projects
- **DependencyCruiserAdapter Cross-Platform** — Windows/macOS/Linux compatibility with proper shell handling and regex escaping
- **FrameworkAdapter excludePatterns** — Adapters can specify directories to exclude from analysis

### Tests
- 784 tests passing, 70 test files

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
- **Code Graph Tool Invoke** — Fixed `TypeError: i.tool.invoke is not a function` by refactoring graph tools (`graphModule`, `graphPath`, `graphAnnotations`, `graphCycles`, `graphLayers`) to use proper `vscode.LanguageModelTool<T>` interface

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
- **Hotspot Consistency** — Tree view now uses same logic as Overview (limit=10, exports fallback)

### Improved
- **Language Indexers** — Comprehensive framework detection for Go (20+), Java (60+ packages), Python, Rust, TypeScript
- **Code Graph Tools** — All 8 tools now injected for L0/L1/L2 agents via promptTransformer
- **EntrypointType** — Added `test`, `job`, `component`, `middleware`, `story`
- **Tool Parameters** — Fine-grained filtering for all Code Graph tools:
  - `graph_digest`: `include`, `hotspotLimit`, `entrypointLimit`
  - `graph_issues`: `groupBy`, all 9 issue kinds
  - `graph_impact`: `include`, `dependentLimit`, `entrypointLimit`
  - `graph_module`: `include`, `importLimit`, `importedByLimit`
  - `graph_path`: `includeEdgeDetails`
  - `graph_cycles`: `severityFilter`, `includeBreakPoints`
  - `graph_layers`: `severityFilter`, `limit`, `groupByRule`
- **UI** — Replaced emoji with codicon icons in Graph settings

---

## [3.3.0] - 2026-01-11

### 🚀 Code Graph v1.0 - Production Ready

Complete codebase structure analysis system for Copilot integration.

#### Features
- **8 LM Tools** — digest, issues, impact, path, module, annotations, cycles, layers
- **Unified Envelope Format** — Consistent JSON response structure with `nextQuerySuggestion`
- **Interactive Graph UI** — Force-directed visualization with drag/zoom/click interactions
- **Tree View** — Hierarchical file tree with entrypoint/hotspot badges and issue counts
- **Multi-Language** — TypeScript, Python, Rust, Go, Java via tree-sitter
- **Framework Detection** — Express, Next.js, NestJS, FastAPI, Spring Boot, etc.
- **Architecture Analysis** — Cycle detection (Tarjan's), layer rule enforcement
- **Performance** — QueryCache (LRU), ParallelIndexer (batch processing)
- **Graph Controls** — Fit-to-view, freeze layout, show edges, label declutter
- **Mixed-Repo Indexing** — Expanded include patterns with `.ouroboros/graph/config.json` overrides
- **Bundle Splitting** — Webview split into 4 chunks for faster loading

#### Fixes
- **Hotspot Detection** — Use resolved file imports and skip external modules
- **Import Path Resolution** — All languages now resolve local imports to file paths:
  - Python: Relative imports (`.module`, `..module`) → `path/to/module.py`
  - Rust: `crate::`, `super::`, `self::` → `src/path/to/module.rs`
  - Java: Local package imports → `src/main/java/path/Class.java`
  - Go: Relative imports (`./`, `../`) → resolved directory paths
- **Hotspot Fallback** — Shows files with most exports when no import-based hotspots found
- **Tree-Sitter Init** — Normalize module exports and bundle WASM for reliable startup
- **Log Spam Reduction** — Tree-sitter fallback warnings now log only once per language

#### Version History
| Version | Tests | Key Features |
|---------|-------|--------------|
| v0.1 | 432 | TS indexing, 3 issue types, 3 LM Tools |
| v0.2 | 514 | tsconfig paths, barrel handling, annotations |
| v0.3 | 564 | Express/Next.js/NestJS/CLI adapters |
| v0.4 | 602 | Python/Rust/Go/Java + tree-sitter |
| v0.5 | 653 | Cycle detection, layer rules |
| v1.0 | 677 | Query cache, parallel indexing, unified envelope, interactive UI |

#### Documentation
- `docs/code-graph/ENVELOPE.md` — Envelope format specification
- `docs/code-graph/TOOLS.md` — All 8 tools reference
- `docs/code-graph/ARCHITECTURE.md` — System design

---

## [3.2.20] - 2026-01-10

### Fixed
- **YAML Tools Field Formatting** — Single-line arrays preserved during Update Prompts

---

## [3.2.19] - 2026-01-10

### Added
- **PRD Agent** — `/ouroboros-prd` for AI-guided PRD creation with 5-phase workflow

---

## [3.2.18] - 2026-01-02

### Added
- **Slash Command Autocomplete** — Type `/` for command suggestions with fuzzy matching

---

## [3.2.16] - 2026-01-02

### Fixed
- **History Real-Time Update** — History tab updates immediately
- **Sent Message Card** — "Native Avant-Garde" style with scanline texture

---

## [3.2.15] - 2026-01-02

### Added
- **UI Redesign** — "Handoff Card" V5 with native theming, dynamic agent icons
- **Input History** — Navigate previous inputs with ↑/↓ arrow keys

---

## [3.2.13] - 2025-12-29

### Added
- **Copilot Usage Insights** — Welcome page card showing plan type, quota, reset countdown
- **Linting Rules** — Coder agent enforces lint-clean code, no suppressions, strong typing
- **Smart YAML Preservation** — Update Prompts preserves user-customized fields

---

## [3.2.12] - 2025-12-25

### Changed
- **Spec Agent Format Enforcement** — FORMAT LOCK sections prevent template format changes

### Fixed
- **Multi-Workspace Commands** — Initialize/Update now use selected workspace correctly

---

## [3.2.11] - 2025-12-25

### Added
- **Markdown Rendering** — Plan review renders formatted Markdown with GFM support

---

## [3.2.10] - 2025-12-24

### Added
- **Attachment System** — Paste images, drag & drop files (max 5MB, 10 attachments)

---

## [3.2.9] - 2025-12-23

### Fixed
- **Multiline Custom Input** — Shift+Enter for new lines
- **Newline Parsing** — `\n` renders as actual line breaks

---

## [3.2.8] - 2025-12-22

### Changed
- **Chat-Style UI** — Request cards use chat bubble layout with agent avatar
- **Tab Shortcuts** — Changed to Alt+number to avoid input conflicts

---

## [3.2.7] - 2025-12-22

### Added
- **Sent Message Confirmation** — Chat bubble shows what you sent

### Fixed
- **Multi-Workspace Spec Detection** — SpecWatcher restarts when switching workspaces

---

## [3.2.5] - 2025-12-22

### Added
- **File-Based Workflow Progress** — Reads from `.ouroboros/specs/` with FileSystemWatcher

---

## [3.2.4] - 2025-12-21

### Added
- **Keyboard Shortcuts** — 1-9 for menu, Y/N for confirm, Esc to cancel

---

## [3.2.3] - 2025-12-21

### Added
- **Multi-Root Workspace Selector** — Choose workspace in multi-root projects

### Fixed
- **Template Download** — Templates now download during Update Prompts

---

## [3.2.2] - 2025-12-21

### Added
- **Smart Prompt Update** — Preserves custom `tools:` array during updates
- **Agent Skills Support** — Compatible with agentskills.io standard

---

## [3.2.1] - 2025-12-21

### Changed
- Renamed to `ouroboros-ai`, tools to `ouroborosai_*`, publisher to `MLGBJDLW`

---

## [3.2.0] - 2025-12-21

### VS Code Extension

- **6 LM Tools** — ask, menu, confirm, plan_review, phase_progress, agent_handoff
- **React Webview UI** — 4 tabs with keyboard navigation
- **Dual-Mode CCL** — Auto-detect Extension vs TUI mode
- Minimum VS Code 1.95.0, 48 unit tests

---

## [3.1.14] - 2025-12-20

### Added
- **Integration Coverage** — Added Integration sections to 4 spec templates

---

## [3.1.13] - 2025-12-20

### Changed
- **Spec Agents** — COPY-THEN-MODIFY pattern enforcement
- **Template Upgrades** — Major enhancements to all 7 templates

---

## [3.1.12] - 2025-12-18

### Fixed
- **CJK Border Overflow** — Fixed `WelcomeBox` text overflow for double-width characters

---

## [3.1.10] - 2025-12-18

### Added
- **CCL Question Text** — LLM agents can include contextual question text in CCL commands
- **TUI Word-Wrap** — Question text auto-wraps to fit terminal width

---

## [3.1.9] - 2025-12-16

### Added
- **GPT Compliance Rules** — Enhanced behavior rules for OpenAI GPT models

### Changed
- **Spec Agents** — Copy-then-Modify pattern, enhanced templates

---

## [3.1.8] - 2025-12-16

### Fixed
- **Multi-line History** — Multi-line inputs preserved as single history entries

---

## [3.1.5] - 2025-12-15

### Fixed
- **Input Box Shrinking** — Fixed ghost lines when input box shrinks
- **Slash Command Completion** — Properly returns completed command

---

## [3.1.2] - 2025-12-15

### Added
- **Skills Discovery** — Level 2 workers can check for skill files

---

## [3.1.0] - 2025-12-15

### Added
- **Anti-Recursion Protocol** — Level-based agent hierarchy (L0 → L1 → L2)
- **Slash Command Autocomplete** — Type `/` for orchestrator mode switching
- **File/Folder Badge Rendering** — Drag & drop displays as badges
- **Ctrl+V Clipboard Paste** — Large pastes show as badges
- **Property-Based Testing** — Hypothesis-style generators

### Changed
- **Complete Modular Rewrite** — Refactored `ouroboros_input.py` into clean package structure

---

## [3.0.3] - 2025-12-13

### Added
- **AGENTS.md** — Development guidelines for AI assistants

---

## [3.0.1] - 2025-12-13

### Fixed
- **Windows Arrow Keys** — Fixed `'\x00'` char handling
- **Menu Refresh** — In-place update, no flickering
- **InputBox Scrolling** — Max 10 lines, then internal scroll

### Added
- **Menu Scrolling** — Auto-scroll with indicators
- **Test Suite** — 200+ tests with CI/CD

---

## [3.0.0] - 2025-12-12

### Enhanced CCL Input System

- **GitHub Actions CI/CD** — Automated validation and release automation
- **Enhanced Input Scripts** — Mystic Purple themed terminal UI
- **Toggle System** — Easy switch between default and enhanced input modes

---

## [2.2.0] - 2025-12-12

### Agent Communication Protocol

- **Status Field** — All 13 worker agents include status in response headers
- **Dispatch Metadata** — Entry points include structured metadata
- **Non-Interactive Commands** — Guidelines for CI-friendly commands

---

## [2.1.0] - 2025-12-12

### Workflow Orchestrators

- **4 New Workflow Agents** — init, spec, implement, archive
- **Prompt-to-Agent Routing** — Each prompt routes to dedicated agent
- **Agent Count** — 12 → 16 agents

---

## [2.0.0] - 2025-12-11

### Centralized Orchestration

- **Hub-and-Spoke Architecture** — `ouroboros` as sole orchestrator
- **Strict Subagent Delegation** — All calls via `runSubagent()`
- **Return Protocol** — Subagents return control after completion
- **TaskSync V5** — Enhanced persistence guarantees
