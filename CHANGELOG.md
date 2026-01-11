# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
