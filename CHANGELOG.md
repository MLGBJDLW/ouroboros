# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.2.15] - 2026-01-02

### Extension
- **UI Redesign**: Deployed "Native Avant-Garde" (V5) Handoff Card redesign.
    - Features fully theme-compliant cyberpunk aesthetic.
    - Dynamic agent identity icons.
    - Interactive "neural" animations.
- **Input History Navigation**: Added up/down arrow key support for input history.
    - Navigate through previous inputs using ↑/↓ arrow keys.
    - History persisted to localStorage (max 50 entries).
    - Works in Ask, Menu (custom), and Confirm (custom) inputs.
    - Updated placeholder hints to show `↑↓ for history`.

## [3.2.13] - 2025-12-29

### 📊 Copilot Usage Insights

#### Added
- **Copilot Insights Card** — New card on Welcome page showing GitHub Copilot usage:
  - SVG circular progress ring showing usage percentage
  - Shows "used" percentage (increasing) — more intuitive than "remaining"
  - Precision to 0.1%
  - Color-coded ring (green < 75%, orange < 90%, red ≥ 90%)
  - Plan type display (Free/Pro/Enterprise)
  - Reset countdown (days/hours until quota resets)
  - Manual refresh button
  - Disclaimer noting internal API usage

- **New Components**:
  - `CopilotInsights` — React component with idle/loading/success/error states
  - `copilotInsights` service — Fetches data from `api.github.com/copilot_internal/user`

#### Tests
- 7 tests for `CopilotInsights` component (render states, message handling, retry)
- 7 tests for `copilotInsights` service (auth, API responses, error handling)

### 🔧 Agent Improvements

#### Added
- **Coder Agent Linting Rules** — Universal code quality requirements:
  - `Pass linter` — Run project's lint command before completion
  - `No lint suppressions` — Never add `eslint-disable`, `noqa`, `@SuppressWarnings`
  - `Strong typing` — Avoid `any` (TS), `Object` (Java), `dynamic` (C#)
  - `Match project style` — Follow existing codebase conventions
  - `No unused code` — Remove unused imports/variables/functions
  - Added `lint` gate to verification output format

- **QA Agent** — Added `Lint-clean` rule to TEST DESIGN RULES table

### 🔍 Agent Quality Rules Enhancement

#### Added
- **PRD Validation** — Validator agent now checks spec consistency against PRD:
  - PRD path provided by spec orchestrator (not fixed locations)
  - Validates scope alignment, priority match, acceptance criteria
  - Detects scope creep (spec items not in PRD)
  - Added PRD Alignment section to `validation-template.md`

- **Complete Document Reading** — All spec agents now require full document reading:
  - Large documents (>500 lines) must be read completely
  - Partial reading = incomplete validation = FAILED TASK
  - Added warnings to validator and researcher agents

- **Cross-Document Validation** — Tasks agent now validates against design/requirements:
  - Builds mental traceability matrix (REQ → Design → Task)
  - Detects gaps: REQs without tasks, orphan tasks
  - Feasibility checks for file paths and dependencies

- **Evidence-Based Design** — Architect agent now requires evidence for decisions:
  - Technology choices need benchmarks/team expertise/ecosystem data
  - Performance claims need measurements or credible sources
  - Anti-patterns table: "best practice" → cite specific reasons

- **PRD Alignment** — Requirements agent now validates against PRD:
  - Scope match, priority match, no scope creep
  - PRD conflict detection with resolution suggestions

- **Information Verification** — Researcher agent now requires sources:
  - Every claim needs file:line citation
  - Version numbers from config files only
  - Outdated information warnings

#### Changed
- **Spec Agent Phase 5** — Now passes `[PRD]` field to validator with path or "None"

### 🔧 Smart YAML Preservation

#### Changed
- **Field-Level YAML Merge** — Update Prompts now intelligently merges YAML frontmatter:
  - Preserves user-customized fields: `tools`, `description`
  - Updates other fields from new remote content
  - Previously preserved entire user YAML, now does smart field-level merge

---

## [3.2.12] - 2025-12-25

### 📝 Spec Agent Format Enforcement

#### Added
- **FORMAT LOCK Sections** — All 5 spec phase agents now have immutable format constraints:
  - `🔒 FORMAT LOCK (IMMUTABLE)` — Tables defining exact required formats and forbidden variations
  - `✅ POST-CREATION VALIDATION (MANDATORY)` — Checklist to verify after file creation
  - `❌ FORMAT VIOLATIONS (REDO REQUIRED)` — Consequences table for violations

- **Agent-Specific Format Rules**:
  - **researcher**: Version `X.Y.Z`, Risk levels with emoji prefix, 4-column Tech Stack table
  - **requirements**: `REQ-001` IDs, numbered AC list (not `AC-XXX-N`), `(Priority: P1)` format, EARS keywords
  - **architect**: `(NEW)/(MODIFY)` tags, `**Why This Design**:` section, `**Covers**: REQ-XXX` traceability
  - **tasks**: `T001` IDs (not `task-001`), `- [ ] **TXXX**` checkbox, `Effort: S/M/L`, `🔍 **CHECKPOINT**:`
  - **validator**: `CRT-001/WRN-001/INF-001` IDs, `✅ **PASS**/❌ **FAIL**` verdict, 7-column traceability matrix

#### Changed
- **Core Workflow** — Changed `Step 2: Read Template` to `Step 2: Copy Template` in all 5 agents
- **Response Format** — Changed `📌 Template: ✅ Read` to `📌 Template: ✅ Copied`
- **Priority Format** — Replaced `MoSCoW` references with `P1/P2/P3` in requirements agent

#### Removed
- **Duplicate Format Sections** — Removed redundant format examples that duplicated FORMAT LOCK content:
  - researcher: `📊 Tech Stack Evaluation Format`
  - requirements: `📝 Requirement Format`
  - tasks: `📊 Task Format`
  - validator: `📊 Coverage Matrix Format`, `📝 Issue Format`

#### Fixed
- **Effort Estimation Guide** — Fixed corrupted emoji/typo `## � Effkort Estimation Guide` → `## 📏 Effort Estimation Guide`

### 🐛 Extension Bug Fixes

#### Fixed
- **Multi-Workspace Command Bug** — Initialize and Update Prompts commands now correctly use the workspace selected in Welcome page:
  - Commands accept optional `targetPath` parameter from Welcome page
  - No longer shows workspace picker when called from Welcome page with selection
  - Updates `selectedWorkspacePath` state after successful operation
  - Fixes UI showing "Not Initialized" after Update Prompts in multi-root workspaces

---

## [3.2.11] - 2025-12-25

### 🎨 Plan Review UI Improvements

#### Added
- **Markdown Rendering** — Plan review content now renders as formatted Markdown:
  - Headings, lists, code blocks with syntax highlighting
  - Tables, blockquotes, links
  - GFM (GitHub Flavored Markdown) support via `remark-gfm`
  - New `Markdown` component with custom styling

- **Larger Panel** — Plan review uses full-width layout instead of 420px max:
  - Scrollable content area for long plans
  - Expand/collapse toggle for content area
  - Fixed action buttons at bottom

#### Changed
- **Plan Review Layout** — Redesigned from chat bubble to dedicated panel:
  - Header with title, mode badge, and collapse toggle
  - Scrollable markdown content area
  - Action buttons with icons (Approve, Request Changes, Reject)

#### Tests
- Added 14 new tests for `Markdown` component
- Updated `PendingRequests` tests for new markdown rendering

---

## [3.2.10] - 2025-12-24

### 🎨 Extension UI Improvements

#### Added
- **Copilot-Style Attachment System** — Full support for file and image attachments in all input types:
  - **Paste Images** — Ctrl+V to paste clipboard images directly into any input
  - **Drag & Drop** — Drop files onto any input area with visual feedback
  - **File Picker** — Click attach button to browse and select files
  - **Badge Display** — Images show thumbnails, files show type icons with names
  - **Preview Tooltip** — Hover over image badges for larger preview
  - **Size Limits** — Max 5MB per file, up to 10 attachments per message
  - **Type Detection** — Auto-detects image/code/file types with language hints
  - **Send Confirmation** — Shows attachment count in sent message bubble

- **Attachment Helper Module** — New `attachmentHelper.ts` for processing attachments:
  - Converts image attachments to `LanguageModelDataPart` for Copilot vision support
  - Converts code/file attachments to formatted markdown text blocks
  - Handles base64 data URL decoding

#### Changed
- **Input Areas** — All textarea inputs now support drag-over visual feedback
- **Textarea Max Height** — Increased from 120px to 240px (~10-12 lines)
- **Type Definitions** — Extended all response types (`AskOutput`, `MenuOutput`, `ConfirmOutput`, `PlanReviewOutput`) to include optional `attachments` field

#### Fixed
- **Attachment Passthrough** — Fixed attachments not being passed from webview to Copilot:
  - All tools (ask, menu, confirm, planReview) now include attachments in output
  - Image-only responses now show `[See attached image(s)]` instead of empty string
  - Added debug logging for attachment processing

---

## [3.2.9] - 2025-12-23

### 🎨 Extension UI Improvements

#### Fixed
- **Custom Input Multiline Support** — Menu, Confirm, and Plan Review custom inputs now support Shift+Enter for new lines:
  - Changed `<input type="text">` to `<textarea>` for all custom input fields
  - Enter sends message, Shift+Enter inserts new line (consistent with Ask input)
  - Auto-resize up to 120px height
  - Updated shortcut hints to include "Shift+Enter for new line"

- **Newline Escape Parsing** — Fixed `\n` literal strings not rendering as actual line breaks in question text:
  - Added `parseNewlines()` utility function to convert `\n` to real newlines
  - Applied to all question displays (Ask, Menu, Confirm) and plan text (Plan Review)

---

## [3.2.8] - 2025-12-22

### 🎨 Extension UI Improvements

#### Changed
- **Chat-Style Request Cards** — All request types (Ask, Menu, Confirm, Plan Review) now use chat bubble layout:
  - Agent question appears in left-aligned bubble with avatar
  - User input area below with rounded styling
  - More conversational feel vs form-like appearance
- **Agent Avatar** — Ouroboros logo in semi-transparent bubble (replaces solid blue circle)
- **Sent Message Bubble Size** — Increased to 520px width, 280px max height, 10 line clamp
- **Request Cards Centered** — Cards now vertically centered instead of top-aligned
- **Progress Bar** — Now shows tasks completion only; phases displayed in timeline below
- **Tab Shortcuts** — Changed to Alt+0-3 to avoid conflicts with text input
- **Send Button** — Replaced generic icon with Ouroboros logo
- **Tabs Reduced** — 4 tabs now (removed Agent Hierarchy, merged into Pending Requests)

#### Added
- **Agent Activity Box** — Collapsible panel in Pending Requests showing:
  - Current active agent with level badge
  - Last 3 handoff transitions (expandable)

#### Removed
- **`ouroborosai_phase_progress` Tool** — Removed redundant tool; progress tracked via file system
- **Agent Hierarchy Tab** — Functionality merged into Agent Activity box

#### Fixed
- **Newline Parsing** — Question text correctly renders `\n` as line breaks
- **Keyboard Conflicts** — Arrow keys and number keys no longer interfere with textarea/input

### 📝 Agent Improvements

#### Changed
- **Implement Agent** — Strengthened task update constraints:
  - Task status must be updated IMMEDIATELY after each task completes
  - Update step now comes BEFORE verification step
  - Added critical warnings about delayed updates breaking UI

### 🧪 Test Coverage

#### Added
- **updatePrompts.ts** — Full test coverage (21% → 100%)
- **SidebarProvider.ts** — Improved coverage (60% → 95%)

---

## [3.2.7] - 2025-12-22

### 🎨 Extension UI Enhancements

#### Added
- **Sent Message Confirmation** — Chat-style bubble shows what you sent to Copilot:
  - Right-aligned bubble with tail (chat style)
  - Color variants based on request type (blue/green/yellow)
  - Shows timestamp and type badge (Response/Selection/Confirmation/Review)
  - Slide-in animation with bounce, fades out after 4 seconds

#### Fixed
- **Multi-Workspace Spec Detection** — SpecWatcher now restarts when switching workspaces
  - Fixed "No specs yet" showing despite specs existing in selected workspace
- **WorkflowProgress Tests** — Updated tests to match new `useSpecs` hook implementation

---

## [3.2.5] - 2025-12-22

### 🎨 Extension UI Redesign

#### Added
- **File-Based Workflow Progress** — Workflow tab now reads from file system instead of tool state:
  - Scans `.ouroboros/specs/` for active specs
  - Scans `.ouroboros/specs/archived/` for archived specs
  - Parses `tasks.md` checkboxes for progress calculation
  - Real-time updates via `vscode.FileSystemWatcher`

#### Changed
- **Welcome Logo Effect** — Replaced CSS pseudo-elements with SVG arc paths:
  - Left arc: Purple (`#9C6ADE`) matching infinity logo color
  - Right arc: Blue (`#3794ff`) brand color
  - Breathing scale animation synchronized with glow
  - Flowing particle dots with color-shifting effect
- **Workflow Card Border** — Updated to brand blue gradient (removed rainbow AI effect)

#### Technical
- Added 3 new backend services: `specScanner.ts`, `tasksParser.ts`, `specWatcher.ts`
- 29 new unit tests (323 total tests passing)
- All services include comprehensive mocks for testing

---

## [3.2.4] - 2025-12-21

### 🎨 Pending Requests UI Overhaul

#### Added
- **Keyboard Shortcuts** — Full keyboard navigation support:
  - Menu: Press 1-9 to select options, C for custom input
  - Confirm: Y for yes, N for no
  - All types: Esc to cancel
  - Plan Review: Ctrl+Enter to approve
- **Numbered Menu Options** — Each option displays its number for quick keyboard selection
- **Request Type Visual Distinction** — Color-coded left border indicates request type:
  - Ask: Blue | Menu: Green | Confirm: Yellow | Plan Review: Blue
- **Empty State Animation** — Breathing animation on idle icon indicates waiting state
- **Shortcut Hints** — Inline hints show available keyboard shortcuts for each request type

#### Changed
- **Centered Layout** — Request card now displays centered in the panel (single request focus)
- **Menu Options Layout** — Options display vertically (stacked) instead of horizontally wrapping
- **Custom Input Toggle** — Custom input now collapsed by default, expands on click or 'C' key
- **Cancel Button Redesign** — Moved to header as subtle X icon instead of footer button

#### Fixed
- **ESLint Warnings** — Fixed unused `prompt` parameters in `promptTransformer.ts` (changed to `_prompt`)
- **Test Type Safety** — Replaced `as any` with proper types in `promptTransformer.test.ts`

---

## [3.2.3] - 2025-12-21

### 🎨 Extension UI Modernization & Multi-Root Support

#### Added
- **Multi-Root Workspace Selector** — Choose which workspace to initialize in multi-root projects:
  - Dropdown appears in Step 1 when multiple workspaces are open
  - Shows initialization status (✓) for each workspace
  - Selection persists across extension reloads

#### Fixed
- **Template Download on Update** — `.ouroboros/templates/` files (including `skill-template.md`) now download during "Update Prompts" operation
  - Previously only downloaded during initial setup
  - Added template files loop to `smartUpdatePrompts()` function

- **Copilot Chat Step Detection** — "Start Ouroboros" step (Step 2) now shows ✓ after clicking "Open Copilot Chat" button
  - Added `hasCopilotChatOpened` state tracking in `WorkspaceState`
  - Step 2 badge updates from "2" to green "✓" when Copilot Chat is opened via our button
  - State persists across extension reloads

- **State Update Bug** — Fixed workspace detection breaking after clicking "Open Copilot Chat"
  - `stateUpdate` message now correctly includes `projectName` and `isInitialized`

#### Changed
- **Modernized Chat UI** — Upgraded Pending Requests interface:
  - Message bubbles: Gradient backgrounds, hover lift effect, modern shadows
  - Textarea: Larger input area (60px → 100px min-height), focus glow effect
  - Added "Shift+Enter for new line" hint below input
  - Improved visual hierarchy with better spacing and animations

---

## [3.2.2] - 2025-12-21

### 🛠️ Agent Skills Integration

Full integration of the [Agent Skills](https://agentskills.io) open standard for extending AI agent capabilities.

#### Added

- **Smart Prompt Update** — New feature to update prompts from GitHub while preserving user customizations:
  - `ouroboros.updatePrompts` command with YAML frontmatter preservation
  - `ouroboros.checkPromptsVersion` command for version checking
  - "Update Prompts" button in Home tab (shows after initialization)
  - Custom `tools:` array in YAML frontmatter now preserved during updates
  - `versionService.ts` for comparing local vs remote versions
  - `smartUpdatePrompts()` function preserves user YAML while updating content body

- **Skill Template** — `.ouroboros/templates/skill-template.md` following official agentskills.io specification:
  - YAML frontmatter (`name`, `description`, optional `license`, `compatibility`, `metadata`, `allowed-tools`)
  - Standard directory structure (`scripts/`, `references/`, `assets/`)
  - Progressive loading guidelines (< 500 lines, < 5000 tokens)

- **Skill Creation Protocol** — Writer agent can now create skills using COPY-THEN-MODIFY pattern:
  - `mkdir -p .github/skills/[name]/` → `cp skill-template.md SKILL.md` → Edit

- **Skills Protocol (Progressive Disclosure)** — Updated `copilot-instructions.md` with:
  - **Level 0/1 Orchestrators**: Scan `.github/skills/`, read only `name` + `description`, include in `[Skills]` field
  - **Level 2 Workers**: Load full `SKILL.md` when matched, follow instructions

- **Skill Suggestion (Auto-Learning)** — Orchestrators can proactively suggest creating skills:
  - **Triggers**: Repetition (2+ times), Complex fix (5+ steps), User praise, Novel approach
  - **CCL Type D**: Standard confirmation format with `confirm = input('[y/n]: ')`
  - Delegates to Writer for creation if approved

- **`[Skills]` Field in Dispatches** — All 5 orchestrators now include `[Skills]` in task packets:
  - `ouroboros`, `ouroboros-init`, `ouroboros-spec`, `ouroboros-implement`, `ouroboros-archive`

---

## [3.2.1] - 2025-12-21

### 🔧 Extension Rename & Fixes

#### Changed
- **Extension Renamed** — `ouroboros` → `ouroboros-ai` (marketplace name conflict)
- **Publisher Changed** — `ouroboros` → `MLGBJDLW`
- **Tool Names Renamed** — All tools from `ouroboros_*` to `ouroborosai_*`:
  | Old Name | New Name |
  |:---|:---|
  | `ouroboros_ask` | `ouroborosai_ask` |
  | `ouroboros_menu` | `ouroborosai_menu` |
  | `ouroboros_confirm` | `ouroborosai_confirm` |
  | `ouroboros_plan_review` | `ouroborosai_plan_review` |
  | `ouroboros_phase_progress` | `ouroborosai_phase_progress` |
  | `ouroboros_agent_handoff` | `ouroborosai_agent_handoff` |

#### Added
- **`.vscodeignore`** — Reduces package size from 3000+ files to ~15 files
- **`LICENSE.md`** — MIT license file for extension

---

## [3.2.0] - 2025-12-21

### 🧩 VS Code Extension

Major release introducing the Ouroboros VS Code Extension with rich Sidebar UI and LM Tools integration.

#### Added

- **VS Code Extension** — Complete extension implementation in `extension/` directory:
  - `package.json` with 6 Language Model Tools definitions
  - ESBuild bundler with TypeScript compilation
  - Webview provider with message handling

- **6 LM Tools** — Native Copilot tool integration:
  | Tool | Purpose |
  |:---|:---|
  | `ouroborosai_ask` | Get user input (task, question, feature) |
  | `ouroborosai_menu` | Present multiple choice options |
  | `ouroborosai_confirm` | Yes/No confirmation dialogs |
  | `ouroborosai_plan_review` | Document/plan review and approval |
  | `ouroborosai_phase_progress` | Report workflow phase progress |
  | `ouroborosai_agent_handoff` | Track agent level transitions |

- **React Webview UI** — Rich sidebar interface with 4 views:
  | View | Key | Features |
  |:---|:---|:---|
  | Pending Requests | `1` | Input forms for ask/menu/confirm/review |
  | Workflow Progress | `2` | Phase progress bar, status icons |
  | Agent Hierarchy | `3` | Current agent, handoff history, level legend |
  | History | `4` | Past interactions, clear button |

- **9 UI Components** — Reusable React components:
  - Icon, Button, Card (with Header/Body/Footer), Badge
  - ProgressBar, List (with ListItem), Spinner, EmptyState, Tooltip

- **Keyboard Navigation** — Full keyboard accessibility:
  - Press `1-4` to switch views
  - Arrow keys `←`/`→` for tab navigation
  - Focus management with ARIA roles

- **Dual-Mode CCL Detection** — Auto-detect Extension vs TUI mode:
  - Extension Mode: Uses LM Tools when available
  - TUI Mode: Falls back to Python commands
  - Updated `copilot-instructions.md` with mode detection logic

- **CI/CD Integration** — New `build-extension` job in GitHub Actions:
  - Installs dependencies (extension + webview)
  - Builds webview (Vite) and extension (ESBuild)
  - Verifies build outputs exist
  - Uploads extension artifact (7-day retention)

- **Extension Documentation**:
  - `extension/README.md` — Development guide
  - `docs/extension-guide.md` — User guide with shortcuts
  - Updated main `README.md` with Extension section

#### Technical Details

- **Bundle Sizes**:
  | Component | Size |
  |:---|:---|
  | Extension (`dist/extension.js`) | 170 KB |
  | Webview JS (`webview/dist/assets/index.js`) | 161 KB |
  | Webview CSS (`webview/dist/assets/index.css`) | 13 KB |

- **Dependencies**:
  - Extension: `zod` for schema validation, `esbuild` for bundling
  - Webview: `react`, `react-dom`, `vite`, `@vitejs/plugin-react`

- **VS Code Integration**:
  - Minimum VS Code version: 1.95.0
  - Sidebar view with Activity Bar icon
  - Status bar item with dynamic updates
  - Commands: Initialize, Open Sidebar, Clear History, Cancel Request

---

## [3.1.14] - 2025-12-20

### Added
- **Integration Coverage in Spec Templates** — Added dedicated Integration sections to 4 spec templates to ensure features are properly wired into existing systems:

  **tasks-template.md**:
  - Added **Phase 6: Integration & Wiring** between requirement phases and Polish phase
  - Includes tasks for: Route registration, Navigation UI, Config/Feature flags, Type exports, Service registration
  - Added `[INTEGRATE]` task tag for integration-specific tasks
  - Updated Progress Summary table to include Phase 6: Integration and renumbered Phase 7: Polish

  **design-template.md**:
  - Added **Integration Architecture** section with Entry Point Diagram (Mermaid)
  - Added Integration Points table (Route, Navigation, Config, Types, Services)
  - Added Integration Dependencies table showing what the feature needs from existing code

  **validation-template.md**:
  - Added **Integration Verification** section with Integration Points Check table
  - Added Integration Test Scenarios (navigate, build, toggle, import)
  - Added Integration Traceability table linking tasks to verification status

  **research-template.md**:
  - Added **Integration Entry Points** section to identify system entry points early
  - Added Existing Patterns for Integration table to follow established patterns
  - Added Integration Constraints checklist

---

## [3.1.13] - 2025-12-20

### Changed
- **Spec Agents Template Workflow Enhancement** — Strengthened COPY-THEN-MODIFY pattern enforcement across all 5 spec workflow agents:
  - `ouroboros-researcher`, `ouroboros-requirements`, `ouroboros-architect`, `ouroboros-tasks`, `ouroboros-validator`
  - Added explicit 3-step workflow: COPY template → MODIFY placeholders → PRESERVE structure
  - Added clear VIOLATIONS list to prevent agents from reading template then writing from scratch
  - Removed platform-specific commands — agents now use `execute` tool directly for cross-platform compatibility

- **Spec Orchestrator Delegation Prompts** — Updated all 5 phase delegation prompts in `ouroboros-spec.agent.md`:
  - Unified format: `## Template — COPY-THEN-MODIFY (MANDATORY)` with Source/Target paths
  - Added `⚠️ FAILURE TO COPY TEMPLATE FIRST = INVALID OUTPUT` warning to all phases
  - Consistent instruction: "COPY template to target using execute tool"

- **Comprehensive Template Upgrades** — Major enhancements to all 7 templates:

  **research-template.md**:
  - Added `## Existing Tests` section with coverage metrics and test commands
  - Added `## API & External Integrations` section for internal/external APIs
  - Added `## Performance Baseline` section with metrics and targets
  - Enhanced Tech Stack table with Config File column
  - Enhanced Key Dependencies table with Used In column

  **requirements-template.md**:
  - Added `Depends On` and `Verified By` fields to each requirement
  - Added `## Requirement Dependencies` section with Mermaid graph
  - Added Edge Cases table with ID and Related REQ columns
  - Expanded NFRs into 5 categories: Performance, Security, Reliability, Usability, Maintainability
  - Added Estimated Effort to Requirements Summary

  **design-template.md**:
  - Added `## Sequence Diagrams` section with Happy Path and Error Path examples
  - Added `## State Diagram` section with state transition table
  - Added `## API Contract` section with endpoints and request/response schemas
  - Added `## Security Considerations` section with sensitive data handling
  - Enhanced Error Handling table with HTTP codes and error codes
  - Enhanced Testing Strategy with test cases from requirements
  - Added Backup Plan column to Files to MODIFY table

  **tasks-template.md**:
  - Added Effort Conversion table (S=0.5h, M=1.5h, L=3h) with totals
  - Added `Done When` criteria to every task
  - Added `Acceptance Criteria` reference from requirements to each phase
  - Added `## Rollback Plan` section with strategies per phase
  - Added `## Estimated Timeline` section with day-by-day breakdown
  - Enhanced Critical Path with Mermaid diagram
  - Added Parallel Opportunities table with reasoning

  **validation-template.md**:
  - Added `Confidence Level` (High/Medium/Low) to verdict
  - Added `## Automated Checks` section for programmatically verifiable items
  - Added Test Coverage column to Traceability Matrix
  - Added P1 Requirements Status summary table
  - Added `## Dependency Validation` section for REQ and Task dependencies
  - Enhanced Risk Assessment with Likelihood and Owner columns
  - Added Risk Score calculation table
  - Added Implementation Time estimate table
  - Added Rationale field to Recommended Execution Mode

  **project-arch-template.md**:
  - Added `## Environment Setup` section with prerequisites and setup steps
  - Added `## Common Commands` table with all dev commands
  - Added `## CI/CD Pipeline` section with stages and triggers
  - Enhanced Tech Stack table with Config File column
  - Enhanced Key Components table with Dependencies column
  - Enhanced Design Patterns with Evidence column
  - Enhanced Gotchas as structured table
  - Added Quality Self-Check section

  **context-template.md**:
  - Simplified structure, removed unused fields
  - Added `## Active Tasks` table with status tracking
  - Added `## Completed` table with timestamps
  - Added `## Pending Issues` table with severity
  - Added `## Files Modified This Session` table
  - Streamlined Session Stats

---

## [3.1.12] - 2025-12-18

### Fixed
- **CJK Border Overflow** — Fixed `WelcomeBox` text overflow issue by using `visible_len` instead of `len` for text wrapping and centering calculations, ensuring correct display for double-width characters (e.g., Chinese/Japanese).

---

## [3.1.11] - 2025-12-18

### Fixed
- **Question Context Persistence** — Fixed issue where question text disappeared after selecting "[Custom input...]" from a selection menu. The question now remains visible in the custom input TUI header.

---

## [3.1.10] - 2025-12-18

### Added
- **CCL Question Text Integration** — LLM agents can now include contextual question text directly in CCL commands using `print('question')` before options:
  - **Type A+Q: TASK with Inquiry** — New variant for asking questions before receiving general input
  - **6 Output Types** — Upgraded from 5 types (TASK, MENU, CONFIRM, FEATURE, QUESTION → add TASK+Q)
  - **`--question` CLI Argument** — New parameter for `ouroboros_input.py` to display question text in TUI header

- **TUI Word-Wrap Support** — Question text auto-wraps to fit terminal width:
  - `WelcomeBox` — Added `_wrap_text()` method with multi-line rendering + separator line
  - `SelectionMenu` — Title/question now wraps across multiple lines with dynamic height calculation + separator line
  - **Visual Separator** — Horizontal line (`───`) between question and options/input for clarity

### Changed
- **All Level 1 Orchestrator CCL Examples** — Updated with question text in `python -c` format:
  - `ouroboros-spec.agent.md` — 3 locations
  - `ouroboros-init.agent.md` — 1 location
  - `ouroboros-implement.agent.md` — 3 locations
  - `ouroboros-archive.agent.md` — 2 locations

- **Toggle Script Patterns** — Updated `PATTERNS` dictionary in `ouroboros_toggle.py`:
  - Added `Type A_Q` for TASK with question
  - Types B, C, D, E now capture question from initial `print()` statement
  - Enhanced mode uses `--question` parameter
  - **Bidirectional Conversion** — Full support for converting all 6 types between DEFAULT and ENHANCED modes
  - **Simple Format Support** — Added patterns for `print('Q'); var = input('P')` format

- **Documentation Updates**:
  - `copilot-instructions.md` — Added Question Text tip block, updated output types table
  - `ouroboros.agent.md` — Renamed "FIVE OUTPUT TYPES" to "SIX OUTPUT TYPES" with new examples

---

## [3.1.9] - 2025-12-16

### Added
- **GPT Compliance Rules** — Enhanced `copilot-instructions.md` with explicit behavior rules for better OpenAI GPT model compliance:
  - **EXIT TRIGGERS** — Only explicit commands (`quit`/`exit`/`stop`) end session; `thanks`/`ok` continue CCL
  - **INPUT ROUTING** — Table mapping user input types to required actions (delegate, continue, clarify, etc.)

### Changed
- **Spec Agents Template Workflow** — All 5 spec workflow agents now use **Copy-then-Modify** pattern instead of Read→Create:
  - `ouroboros-researcher`, `ouroboros-requirements`, `ouroboros-architect`, `ouroboros-tasks`, `ouroboros-validator`
  - Workflow: COPY template → MODIFY by filling placeholders → PRESERVE structure

- **Spec Templates Enhancement** — Major upgrade to all 5 spec templates (inspired by Spec-kit patterns):
  - **Unified Placeholder Format**: `{{PLACEHOLDER}}` for clear fill-in markers
  - **Action Comments**: `<!-- ACTION REQUIRED: ... -->` for critical sections
  - **Cross-Doc References**: `**Input**: [previous-phase.md]` headers linking phases
  - **Quality Self-Checks**: Each template ends with verification checklist
  - **Priority System**: P1/P2/P3 labels + "Why This Priority" rationale (requirements)
  - **Parallel Markers**: `[P]` tags for tasks that can run concurrently (tasks)
  - **REQ Traceability**: `[REQ-XXX]` tags linking tasks back to requirements
  - **Independent Tests**: Each requirement includes verification method
  - **`[NEEDS CLARIFICATION: ...]`**: Explicit uncertainty markers
  - **ADR-style Decisions**: "Why This Approach" + "Alternatives Rejected" sections (design)

- **Requirements Clarification Q&A Flow** — New interactive clarification process for Phase 2:
  - `ouroboros-requirements` outputs structured `CLQ-XXX` questions with 2-4 options + expert recommendation
  - `ouroboros-spec` presents questions **ONE BY ONE** using MENU format (not all at once)
  - After user answers, delegates to `ouroboros-writer` to update requirements.md
  - New **Phase 2.5** in spec workflow for handling clarifications


---



## [3.1.8] - 2025-12-16


### Fixed
- **Multi-line History Persistence** — Fixed input history saving/loading that was splitting multi-line entries into separate single-line entries. Now multi-line inputs are properly preserved as single history entries when navigating with Up/Down arrow keys.
  - Added `_escape()` / `_unescape()` methods in `data/history.py` to encode newlines as `\n` markers in the history file

---

## [3.1.7] - 2025-12-16

### Fixed
- **Arrow Key Direction** — Fixed reversed LEFT/RIGHT arrow key ANSI escape codes in `tui/app.py` that caused cursor movement to go in the opposite direction

---


## [3.1.5] - 2025-12-15

### Added
- **Text Wrapping Utility** — New `wrap_text()` function in `utils/text.py` for proper CJK-aware text wrapping with display width calculation

### Fixed
- **Input Box Shrinking** — Fixed `_shrink_height()` to correctly delete extra content lines when the input box shrinks, preventing ghost lines
- **Slash Command Completion** — Fixed `SlashCommandHandler.complete()` to properly return completed command with space suffix and cancel mode
- **Full Render on Char Input** — Added full `_render()` call after single-character input to keep wrapping, cursor positioning, and status bar consistent
- **Status Hint After Completion** — Slash command completion now restores "Ctrl+D: submit" hint after inserting completed command

---

## [3.1.2] - 2025-12-15

### Added
- **Skills Discovery (Optional)** — Level 2 worker agents can now optionally check for skill files in `.claude/skills/` (Claude) or `.cursor/skills/` (Cursor) on task start
  - Skills are loaded on-demand if the directory exists
  - Missing skills directories are gracefully ignored
  - Orchestrators (Level 0 & 1) delegate to Level 2, not use skills directly

---

## [3.1.0] - 2025-12-15

### Added
- **Anti-Recursion Protocol** — Level-based agent hierarchy (L0 → L1 → L2) preventing infinite delegation loops
- **Slash Command Autocomplete** — Type `/` in Enhanced CCL for orchestrator mode switching (Tab to complete)
- **File Badge Rendering** — Drag & drop files display as `[ filename.ext ]` in UI (full path sent to AI)
- **Folder Badge Rendering** — Drag & drop folders display as `[ foldername ]` in UI
- **Project Structure Check** — Agents now detect `.ouroboros/specs/` on invoke
- **docs/LIMITATIONS.md** — Documents known platform constraints
- **Ctrl+V Clipboard Paste** — Reliable paste detection by reading clipboard directly
  - Large pastes (5+ lines) show as `[ Pasted N Lines ]` badge
  - Full content preserved and sent to AI on submit
  - Cross-platform: Windows (ctypes), macOS (pbpaste), Linux (xclip/xsel/wl-paste)
- **Atomic Badge Deletion** — Backspace/Delete removes entire badge at once (file paths and paste badges)
- **Arrow Key Badge Navigation** — Cursor automatically skips past badge internals when navigating
- **Property-Based Testing Framework** — `tests/pbt_framework.py` with Hypothesis-style generators

### Changed
- **Complete Modular Rewrite** — Refactored `ouroboros_input.py` (~2000 lines) into clean package structure:
  | Package | Modules | Purpose |
  |---------|---------|---------|
  | `components/` | `input_box`, `selection_menu`, `status_bar`, `welcome_box` | UI Components |
  | `data/` | `buffer`, `config`, `history` | Data Management |
  | `input/` | `clipboard`, `commands`, `keybuffer`, `keybuffer_win`, `keybuffer_unix`, `paste` | Input Handling |
  | `tui/` | `app`, `fallback`, `output`, `screen`, `theme`, `window` | Terminal UI |
  | `utils/` | `badge`, `filepath`, `text` | Utilities |
  | `tests/` | `unit/`, `property/`, `pbt_framework` | Testing |
- All 16 agent files now include Level markers (`> **LEVEL X** — ...`)
- `is_file_path()` now detects both files and folders (directories without extensions)
- Scripts README completely rewritten with detailed documentation
- Root README Enhanced CCL section simplified (details moved to scripts/README.md)
- Removed legacy single-file modules: `ouroboros_buffer.py`, `ouroboros_clipboard.py`, `ouroboros_commands.py`, `ouroboros_config.py`, `ouroboros_filepath.py`, `ouroboros_keybuffer.py`, `ouroboros_paste.py`, `ouroboros_screen.py`, `ouroboros_toggle.py`, `ouroboros_ui.py`
- Removed old test scripts in favor of new `tests/` package structure

### Fixed
- **Paste Badge Navigation** — Fixed cursor navigation for paste markers (`‹PASTE:N›...‹/PASTE›`), now correctly skips entire badge as atomic unit
- **Paste Badge Backspace** — Backspace now correctly deletes entire paste badge when cursor is at badge end
- **Cursor Position Calculation** — `_get_cursor_display_col()` now correctly calculates display position for both file markers (`«path»`) and paste markers
- **Badge Detection Consistency** — All badge operations (move_left, move_right, backspace, delete) now handle both file and paste marker types
- **Multiline Threshold** — Fixed `process_pasted_content()` default threshold from 2 to 5 lines (matching `PASTE_LINE_THRESHOLD`)
- **Windows Paste Detection** — Added event count detection in `_main_loop()` to catch pastes before bracketed paste mode (threshold lowered to 5 events)
- **Ctrl+V Paste Detection (Windows Terminal)** — Detect Ctrl+V even when the terminal intercepts it, read clipboard directly, and prevent duplicate injected characters
- **Path Collection Display** — Characters are now displayed in buffer while collecting path, then converted to badge on timeout
- **Path Badge Prefix** — Fixed drive letter prefix tracking (`D:`) to ensure full path is captured in badge
- **Split Drive-Letter Paste** — Fixed cases where a path paste is split into `D` + `:\\...`, causing the drive letter to be dropped from the badge
- **Arrow Keys in VS Code Terminal** — Fixed escape sequence handling in `PasteCollector.read()` that was breaking arrow key navigation on Windows
- **Bracketed Paste Output Purity** — Bracketed paste enable/disable sequences now write to stderr, keeping stdout clean for AI consumption
- **Slash Command Status Clearing** — Status bar now clears correctly after backspacing away slash commands
- **Cursor Flickering** — Fixed cursor jumping to wrong positions during render by using save/restore cursor pattern
- **Incremental Line Update** — Added `update_current_line()` for single-character input to reduce full redraws
- **Windows Path Drag-Drop** — Pattern-based path detection (checks file extension/existence) instead of timeout-only
- **Ctrl+V Paste Badge** — `_handle_paste()` now uses `process_pasted_content()` for immediate badge display
- **Input Box Shrink Ghosting** — Removed stale bottom border/status lines when the input box shrinks in ANSI fallback mode
- **Submit Feedback Missing** — Restored `OutputBox` class in `output.py` and added `render_transmitted()` to show "✓ Transmitted to Copilot" feedback on submit
- **Submit Task Box** — After submit, render a visible `[>] TASK` box with a safe preview + transmission stats (stderr), while sending the full payload to Copilot via stdout

---

## [3.0.3] - 2025-12-13

### Added
- **AGENTS.md** — Comprehensive development guidelines for AI assistants working on Ouroboros
  - Hub-and-Spoke architecture constraints with strict delegation rules
  - Complete CCL Five Output Types reference (Type A-E)
  - `runSubagent()` mandatory usage with format examples
  - Action-Commitment rule with correct/wrong examples
  - Forbidden patterns and phrases enforcement
  - Development guidelines for modifying/adding agents
  - Key protocols reference table

### Changed
- **Toggle Script** — Updated `ouroboros_toggle.py` to scan root directory
  - Now includes `AGENTS.md` when switching between Default/Enhanced CCL modes
  - Added `Path(".")` to `SEARCH_DIRS` for root-level markdown files

### Documentation
- AGENTS.md serves as steering rules for Copilot and other AI tools
- Ensures consistent architecture enforcement across all AI interactions
- Provides clear examples of correct delegation patterns

---

## [3.0.1] - 2025-12-13

### Fixed
- **Windows Arrow Keys** — Fixed `'\x00'` char handling in Console API
- **Menu Refresh** — In-place update, no more flickering
- **Text Overflow** — Long titles wrap, options truncate with `...`
- **[y/n] Prompts** — Now show interactive Yes/No menu
- **InputBox Scrolling** — Max 10 lines, then internal scroll

### Added
- **Menu Scrolling** — Auto-scroll with `↑ N more above` / `↓ N more below`
- **Page Up/Down** — Jump by page in long menus
- **Home/End** — Jump to first/last option
- **Escape to Cancel** — Alternative to Ctrl+C
- **Test Suite** — 200+ tests in `.ouroboros/scripts/test/`
- **CI/CD Tests** — GitHub Actions (Win/Linux/Mac × Py 3.8/3.11)
- **Changelog Generator** — `.github/scripts/generate-changelog.sh`

### Changed
- **English-Only UI** — `[y/n]` shows `Yes`/`No` only
- **Prompt Optimization** — Streamlined instruction and orchestrator prompts for better LLM compatibility while maintaining quality

---

## [3.0.0] - 2025-12-12

### 🎨 Enhanced CCL Input System & CI/CD

Major milestone release introducing the Enhanced Continuous Command Loop (CCL) input system and GitHub Actions automation.

#### Added
- **GitHub Actions CI/CD** — Automated markdown validation, structure checking, and release automation
  - `ci.yml`: Runs on PR/push to `main`/`dev` — validates markdown, checks project structure, verifies links
  - `release.yml`: Creates GitHub Releases when `v*` tags are pushed
- **Enhanced Input Scripts** — `.ouroboros/scripts/` with:
  - Mystic Purple themed terminal UI
  - Display compression for large pastes
  - Auto multi-line detection
  - File/image drag detection
  - Command history persistence
- **Toggle System** — Easy switch between default and enhanced input modes via `ouroboros_toggle.py`

#### Changed
- Version bump to 3.0 to mark Enhanced CCL Scripts as stable feature
- README badges updated to v3.0 with CI status badge

#### Technical Notes
- Zero external dependencies maintained (Python stdlib only)
- All scripts require Python 3.6+
- CHANGELOG updates remain **manual** for precision

---

## [2.2.0] - 2025-12-12

### 📌 Agent Communication Protocol Upgrade

Minimal, backward-compatible upgrade to agent response formats and dispatch protocols.

#### Added
- **Status Field** — All 13 worker agents now include `📌 Status: OK | PARTIAL | FAIL | BLOCKED` in their response headers
- **Dispatch Metadata** — Entry points (`spec`, `implement`, `init`) now include structured metadata in dispatch prompts:
  ```
  [Feature]: auth-system
  [Spec]: .ouroboros/specs/auth-system/
  [Phase]: 1/5 - Research
  ```
- **Phase Numbering** — `spec` response format now shows `2/5 - Requirements` instead of just `Requirements`
- **Non-Interactive Command Guidelines** — Added comprehensive reference tables to `coder`, `qa`, `devops`:
  | Tool | ❌ Interactive | ✅ Non-Interactive |
  |------|---------------|--------------------|
  | pnpm test | `pnpm test` (waits h/q) | `pnpm test --run` or `CI=true pnpm test` |
  | vitest | `vitest` (watch mode) | `vitest run` |
  | jest | `jest --watch` | `jest --ci` |

#### Changed
- **13 Agent Files Updated** — All worker agents now have Status field in response format
- **3 Dispatch Formats Enhanced** — `spec`, `implement`, `init` now include context metadata

#### Technical Notes
- All changes are **additive** — no existing fields removed
- Changes are **backward compatible** — old format still readable
- `archive` agent unchanged — already had complete format

---

## [2.1.0] - 2025-12-12

### 🔄 Workflow Orchestrator Architecture

Introduced dedicated **Workflow Orchestrators** — sub-orchestrators that manage major workflows while inheriting CCL enforcement and delegation rules from the main orchestrator.

#### Added
- **4 New Workflow Agents** — Created specialized orchestrators for each major workflow:
  | Agent | Purpose |
  |-------|---------|
  | `ouroboros-init` | Project initialization workflow |
  | `ouroboros-spec` | 5-phase spec creation workflow |
  | `ouroboros-implement` | Task execution workflow |
  | `ouroboros-archive` | Archive management workflow |

- **Prompt-to-Agent Routing** — Each prompt file now routes to its dedicated agent:
  - `ouroboros-init.prompt.md` → `agent: ouroboros-init`
  - `ouroboros-spec.prompt.md` → `agent: ouroboros-spec`
  - `ouroboros-implement.prompt.md` → `agent: ouroboros-implement`
  - `ouroboros-archive.prompt.md` → `agent: ouroboros-archive`

- **Orchestrator Constraints on Workflow Agents**:
  - **BLIND/MUTE Rules**: Cannot read/write files directly → DELEGATE
  - **CCL Enforcement**: Mandatory heartbeat after every response
  - **Tool Lockdown**: `edit` and `read` tools forbidden (delegate to workers)
  - **Handoff Protocol**: Return to main orchestrator after completion

#### Changed
- **Agent Count**: 12 → 16 agents (added 4 workflow orchestrators)
- **Architecture Diagram**: Updated mermaid diagram to show workflow orchestrators
- **Routing Table**: `copilot-instructions.md` now shows agent targets for slash commands
- **File Structure**: Updated to show new agent organization

#### Fixed
- **Instructions Confusion**: Previously, prompts with `agent: ouroboros` caused instruction mixing. Now each workflow has its dedicated agent with clear boundaries.

---

## [2.0.0] - 2025-12-11

### 🚀 Major Architecture Overhaul: Centralized Orchestration

Ouroboros v2.0 introduces a strict **Hub-and-Spoke** architecture where the main `ouroboros` agent acts as the sole orchestrator, managing all subagent interactions via the native `runSubagent()` tool.

#### Changed
- **Centralized Orchestration** — The `ouroboros.agent.md` file is now the single entry point. Users should no longer interact with subagents directly.
- **Strict Subagent Delegation** — All subagent calls are now routed through `runSubagent()`. This ensures that the orchestrator maintains the context and project state.
- **Return Protocol** — Subagents are now explicitly programmed to return control to the orchestrator after completing their specific tasks, preventing "hallucinated" completions or hangs.
- **Agent Location** — Confirmed all agents reside in `.github/agents/`.

#### Added
- **TaskSync V5 Integration** — Enhanced persistence guarantees and stronger protection against context window degradation.
- **Workflow Assurance** — The new architecture guarantees that multi-step workflows (like Spec -> Implement -> Test) execute sequentially and correctly.

### 🧠 Agent Prompts Enhancement

Major upgrade to all 12 subagent prompts, leveraging the Self-Bootstrap architecture to add comprehensive guidance without impacting the orchestrator's context window.

#### Changed

**Core Agents (8 files):**

| Agent | Key Additions |
|-------|---------------|
| `ouroboros-coder` | Persona, Design Patterns table, Language-specific examples (TS, Python, React), Anti-Patterns, Few-shot example |
| `ouroboros-qa` | Debugging Mindset (5 Whys, Bisection), Test Pyramid, Mock Patterns, Error Classification, Bug Pattern recognition |
| `ouroboros-analyst` | C4 Model framework, Investigation Techniques, Diagram Templates (Component, Sequence, Data Flow) |
| `ouroboros-architect` | ADR Template, Trade-off Analysis Framework, Architecture Patterns Catalog, NFR Checklist |
| `ouroboros-devops` | Deployment Strategies (Blue-Green, Canary), Platform Quick References (Docker, GitHub Actions, K8s), Observability Checklist |
| `ouroboros-git` | Git Workflow Models, Rebase vs Merge comparison, Interactive Rebase Recipes, Advanced Git Commands |
| `ouroboros-security` | OWASP Top 10 Deep Dive with code examples, Secure Coding Patterns, Security Headers Checklist |
| `ouroboros-writer` | Inverted Pyramid, Documentation Templates (README, API), Writing Style Guide, Changelog Format |

**Spec Workflow Agents (4 files):**

| Agent | Key Additions |
|-------|---------------|
| `ouroboros-researcher` | Research Methodology, Exploration Patterns, Key Files Reference, Documentation Mining |
| `ouroboros-requirements` | Complete EARS Examples, User Story Format, MoSCoW Prioritization, Given-When-Then patterns |
| `ouroboros-tasks` | Task Format, T-Shirt Sizing, Dependency Mapping diagram, Risk Identification |
| `ouroboros-validator` | Gap Analysis Framework, Coverage Matrices, Impact Analysis, Validation Report Template |

#### Metrics

| Metric | Before | After | Growth |
|--------|--------|-------|--------|
| Total Lines | ~974 | ~2554 | +162% |
| Average Lines/Agent | ~81 | ~213 | +163% |
| Largest Agent | ~165 (QA) | ~349 (QA) | +112% |

#### Added

- **Structured Task Handoff Protocol** - Enhanced orchestrator-to-subagent communication with:
  - `[BOOTSTRAP]` section: Explicit file reads for persona and context
  - `[TASK]` section: Structured Target/Action/Context format
  - `[ARTIFACTS]` section: Optional code passing
  - Standardized response format with `📌 Status` field

- **TaskSync V5 Enforcement Mechanisms** - Borrowed from TaskSync protocol for stronger compliance:
  - **EMERGENCY OVERRIDE Protocols**: Self-check mechanisms before every response
  - **Explicit Tool Naming**: CCL must use `run_command` tool, not just display
  - **Announce-Then-Execute Pattern**: Say "Task completed..." then execute CCL
  - **ANTI-TERMINATION Protocol**: Detection of session-ending behavior with override
  - **Expanded FORBIDDEN Phrases List**: More comprehensive goodbye phrase blocking

---

## [1.1.0] - 2025-12-10

### 🚀 Architecture Upgrade: Self-Bootstrap Agents

#### Changed
- **Agent Relocation** — Agents now in `.github/agents/` with `.agent.md` extension, enabling native Copilot `runSubagent(agent: "name")` calls.
- **Dispatch Protocol** — Replaced "Self-Bootstrap" with **Native Agent Dispatch**.
  - **Old**: `Read .ouroboros/agents/ouroboros-coder.prompt.md then execute...`
  - **New**: `runSubagent(agent: "ouroboros-coder", prompt: ...)` (native Copilot integration)
- **Prompt Updates** — Updated `copilot-instructions.md`, `ouroboros-implement.prompt.md`, and `ouroboros-spec.prompt.md` to enforce the new file-reading dispatch pattern.

#### Added
- **Auto-Cleanup Protocol** — Added automatic maintenance to `/ouroboros-archive`:
  - **Subagent Specs**: `.ouroboros/subagent-docs/` files older than 3 days **deleted** (transient data).
  - **Context History**: `.ouroboros/history/` files older than 7 days moved to archive (persistent data).
- **Architectural Awareness** — Subagents now automatically read the latest `history/context-*.md` before execution, ensuring they align with the current project state without prompt repetition.

---

## [1.0.0] - 2025-12-10

### 🎉 Initial Release

Project Ouroboros is a persistent context system for GitHub Copilot that reduces redundant conversations and maximizes subscription value through intelligent memory management and specialized sub-agent routing.

---

### Added

#### ♾️ Core Session System
- **Never-Ending Sessions** — AI continues indefinitely until user explicitly says "stop", "end", "terminate", or "quit"
- **Goodbye Phrase Ban** — Forbidden phrases like "Let me know if you need help" enforced system-wide
- **Continuous Command Loop (CCL)** — Terminal-based interaction via `python -c "task = input('[Ouroboros] > ')"`
- **Lossless Artifact Protocol** — Code passed verbatim between agents, never summarized or truncated

#### 🧠 Persistent Memory System
- **Template Pattern** — Templates in `templates/` are READ-ONLY; active files created in `history/`
  - `context-template.md` → `history/context-YYYY-MM-DD.md`
  - `project-arch-template.md` → `history/project-arch-YYYY-MM-DD.md`
- **Automatic Context Restoration** — Session state restored from latest `history/context-*.md` on startup
- **Milestone-Based Updates** — Context files updated on major milestones, not every action

#### 🤖 Custom Agents (12 Specialists in `.github/agents/`)

**Core Agents:**
| Agent | Trigger | Role |
|-------|---------|------|
| `ouroboros-coder` | implement, create, build | Full-stack development |
| `ouroboros-qa` | test, debug, fix, error, mock, coverage | Testing \& debugging (unified) |
| `ouroboros-writer` | document, explain | Documentation, no code mods |
| `ouroboros-devops` | deploy, docker | Deployment with rollback steps |
| `ouroboros-security` | security, audit | Risk identification |
| `ouroboros-git` | merge, conflict, rebase | Git operations |
| `ouroboros-analyst` | how does, where is | Read-only codebase analysis |

**Spec Workflow Agents:**
| Agent | Trigger | Role |
|-------|---------|------|
| `ouroboros-researcher` | research, investigate | Structured research reports |
| `ouroboros-requirements` | requirements, user story | EARS notation requirements |
| `ouroboros-architect` | design, architecture | Mermaid diagrams required |
| `ouroboros-validator` | validate, verify | Coverage matrix output |

**VS Code Settings Required:**
| Setting | Purpose |
|---------|---------|
| `github.copilot.chat.codeGeneration.useInstructionFiles` | Load custom instructions |
| `github.copilot.chat.agent` | Enable agent mode |
| `chat.customAgentInSubagent.enabled` | Allow custom subagents (experimental) |

#### ⚡ Slash Commands

| Command | Purpose |
|---------|---------|
| `/ouroboros` | Full system activation and re-initialization |
| `/ouroboros-init` | First-time project research and architecture setup |
| `/ouroboros-spec` | 5-phase spec workflow (Research → Requirements → Design → Tasks → Validation) |
| `/ouroboros-implement` | Execute tasks.md with 3 speed modes |
| `/ouroboros-archive` | Archive completed specs with timestamp |

#### 📋 Spec-Driven Development (4 Phases)

| Phase | Agent | Output |
|-------|-------|--------|
| 1. Research | `ouroboros-researcher` | `research.md` — codebase analysis, affected files |
| 2. Requirements | `ouroboros-requirements` | `requirements.md` — EARS notation, numbered requirements |
| 3. Design | `ouroboros-architect` | `design.md` — architecture, Mermaid diagrams, correctness properties |
| 4. Validation | `ouroboros-validator` | `validation-report.md` — consistency check, impact analysis, risk assessment |

**Validation Phase (A+B Approach):**
- **Part A**: Generate persistent `validation-report.md` with full analysis
- **Part B**: Interactive terminal confirmation (`yes` / `revise X` / `abort`)

**Phase Execution Rules:**
- Each phase executes via `runSubagent()` and RETURNS to orchestrator
- User approval required before proceeding to next phase
- File whitelist enforced (5 allowed files per feature spec)

#### 🎮 Implementation Modes (`/ouroboros-implement`)

| Mode | Speed | Control | Best For |
|------|-------|---------|----------|
| 🔧 Task-by-Task | Slowest | Highest | High-risk changes, learning |
| 📦 Phase-by-Phase | Medium | Medium | Normal development |
| 🚀 Auto-Run All | Fastest | Lowest | Low-risk, trusted tasks |

#### 📄 Enhanced Templates

| Template | Key Features |
|----------|--------------|
| `research-template.md` | Tech stack tables, frontend/backend file mapping, recommended approach |
| `requirements-template.md` | Introduction, Glossary, numbered EARS requirements (REQ-XXX) |
| `design-template.md` | Design principles, component interfaces, **correctness properties**, testing strategy |
| `tasks-template.md` | Sub-task numbering (1.1, 1.2), checkpoint markers (🔍), property test indicators (*) |
| `validation-template.md` | Consistency check, impact analysis, risk assessment, user decision options |

#### 🛡️ Safety & Guardrails
- **Destructive Command Protection** — `rm -rf`, `git reset --hard`, `git push --force` require confirmation
- **Verification Gate** — Code verified via `ouroboros-security` or `ouroboros-qa` before delivery
- **QA Fix-Verify Cycle** — `ouroboros-qa` handles test+debug with 3-cycle limit to prevent infinite loops
- **Phase Reset Protocol** — Explicit rules for returning to earlier spec phases
- **File Whitelist** — Only 5 files allowed in specs: `research.md`, `requirements.md`, `design.md`, `tasks.md`, `validation-report.md`

#### 🌐 Internationalization
- **Language Mirroring** — AI replies in user's language (Chinese, English, Japanese, etc.)

---

### Documentation

- Comprehensive `README.md` with quick start (3 steps), file structure, and usage examples
- `.ouroboros/README.md` with detailed specs system documentation
- Context window degradation warnings and mitigation strategies
- Acknowledgment of [TaskSync](https://github.com/4regab/TaskSync) as inspiration

---

### Technical Notes

**Orchestrator Constraints:**
- ✅ CAN: Spawn subagents, run terminal commands, answer quick questions, discuss planning
- ❌ CANNOT: Read/write files directly, use `agentName` parameter, end session without user command

**Agent Activation Format:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 [Agent_Name] ACTIVATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 Task: [one-line summary]
📌 Constraint: [what this agent CANNOT do]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Artifact Format:**
```
=== ARTIFACT START: [filename] ===
[COMPLETE raw content - no omissions]
=== ARTIFACT END ===
```

---
