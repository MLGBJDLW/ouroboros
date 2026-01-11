# Changelog

All notable changes to the Ouroboros AI VS Code Extension will be documented in this file.

## [3.3.0] - 2026-01-10

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

- **Performance** — QueryCache with LRU eviction, ParallelIndexer for batch processing

- **Multi-Language** — TypeScript, Python, Rust, Go, Java via tree-sitter

- **Framework Detection** — Express, Next.js, NestJS, FastAPI, Spring Boot, etc.

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
