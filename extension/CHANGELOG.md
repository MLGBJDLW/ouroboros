# Changelog

All notable changes to the Ouroboros AI VS Code Extension will be documented in this file.

## [3.2.15] - 2026-01-02

### Added
- **UI Redesign**: "Handoff Card" V5 "Native Avant-Garde" - A complete overhaul of the pending request widget.
  - **Native Theming**: Zero hardcoded colors; stricly uses VS Code theme variables for universal compatibility.
  - **Dynamic Icons**: Agents now have context-aware identities (e.g., Hubot for God Mode, Code for Coder) powered by Codicons.
  - **Idle State**: New pulsing idle animation and "SYSTEM_WAKE_MODE" status.
  - **Visual upgrade**: Holographic overlays, scanlines, and circuit-like data streams.
- **Input History Navigation**: Navigate through previous inputs using ↑/↓ arrow keys.
  - New `useInputHistory` hook with localStorage persistence (max 50 entries).
  - Works in Ask, Menu (custom input), and Confirm (custom input) components.
  - Updated placeholder hints from "Ctrl+V to paste" to "↑↓ for history".
  - 16 unit tests for the new hook.

## [3.2.13] - 2025-12-29

### Added

- **Copilot Usage Insights** — New card on Welcome page showing GitHub Copilot plan and quota:
  - SVG circular progress ring showing usage percentage
  - Shows "used" percentage (increasing) — more intuitive than "remaining"
  - Precision to 0.1%
  - Color-coded ring (green < 75%, orange < 90%, red ≥ 90%)
  - Plan type display (Free/Pro/Enterprise)
  - Reset countdown timer
  - Manual refresh button (uses internal GitHub API)
  - New `CopilotInsights` component with full test coverage
  - New `copilotInsights` service for fetching data

- **Linting Rules for Coder Agent** — Added universal code quality rules:
  - Pass project linter before completion
  - No lint suppression comments (`eslint-disable`, `noqa`, etc.)
  - Avoid weak types (`any`, `Object`, `dynamic`)
  - Match existing project code style
  - Added `lint` gate to verification checklist

### Changed

- **QA Agent** — Added `Lint-clean` rule to test design requirements

- **Smart YAML Preservation** — Update Prompts now intelligently merges YAML:
  - Preserves user-customized fields (`tools`, `description`)
  - Updates other fields from new content
  - Previously preserved entire YAML, now does field-level merge

### Tests

- Added 7 tests for `CopilotInsights` component
- Added 7 tests for `copilotInsights` service
- Updated `Welcome.test.tsx` to mock VSCode context
- Added `authentication` API to vscode mock

---

## [3.2.12] - 2025-12-25

### Changed

- **Spec Agent Format Enforcement** — All 5 spec phase agents now have stronger format constraints to prevent template format changes:
  - Added `FORMAT LOCK (IMMUTABLE)` sections with exact required formats
  - Added `POST-CREATION VALIDATION` checklists
  - Added `FORMAT VIOLATIONS (REDO REQUIRED)` consequence tables
  - Fixed workflow steps from "Read Template" to "Copy Template"
  - Removed duplicate format example sections

### Fixed

- **Multi-Workspace Command Bug** — Initialize and Update Prompts commands now correctly use the workspace selected in Welcome page:
  - Commands accept optional `targetPath` parameter from Welcome page
  - No longer shows workspace picker when called from Welcome page with selection
  - Updates `selectedWorkspacePath` state after successful operation
  - Fixes UI showing "Not Initialized" after Update Prompts in multi-root workspaces

---

## [3.2.11] - 2025-12-25

### Added

- **Markdown Rendering** — Plan review content now renders as formatted Markdown:
  - Headings, lists, code blocks with syntax highlighting
  - Tables, blockquotes, links with external link handling
  - GFM (GitHub Flavored Markdown) support via `remark-gfm`
  - New `Markdown` component (`components/Markdown/`)

- **Larger Plan Review Panel** — Full-width layout for better readability:
  - Scrollable content area for long plans
  - Expand/collapse toggle button
  - Fixed action buttons at bottom

### Changed

- **Plan Review Layout** — Redesigned from chat bubble to dedicated panel:
  - Header with title, mode badge, and collapse toggle
  - Scrollable markdown content area with custom styling
  - Action buttons with icons (Approve, Request Changes, Reject)

### Dependencies

- Added `react-markdown@^9.0.1` for markdown rendering
- Added `remark-gfm@^4.0.0` for GitHub Flavored Markdown support

---

## [3.2.10] - 2025-12-24

### Added

- **Copilot-Style Attachment System** — Full support for file and image attachments in all input types:
  - **Paste Images** — Ctrl+V to paste clipboard images directly
  - **Drag & Drop** — Drop files onto any input area
  - **File Picker** — Click attach button to browse files
  - **Badge Display** — Images show thumbnails, files show icons with names
  - **Preview Tooltip** — Hover over image badges for larger preview
  - **Size Limits** — Max 5MB per file, up to 10 attachments
  - **Type Detection** — Auto-detects image/code/file types
  - **Send Confirmation** — Shows attachment count in sent message bubble

- **Attachment Helper Module** — New `attachmentHelper.ts` for processing attachments:
  - Converts image attachments to `LanguageModelDataPart` for Copilot vision support
  - Converts code/file attachments to formatted markdown text blocks
  - Handles base64 data URL decoding

### Changed

- **Input Areas** — All textarea inputs now support drag-over visual feedback
- **Textarea Max Height** — Increased from 120px to 240px (~10-12 lines)
- **Type Definitions** — Extended all response types to include `attachments` field

### Fixed

- **Attachment Passthrough** — Fixed attachments not being passed from webview to Copilot:
  - All tools (ask, menu, confirm, planReview) now include attachments in output
  - Image-only responses now show `[See attached image(s)]` instead of empty string
  - Added debug logging for attachment processing

---

## [3.2.9] - 2025-12-23

### Fixed

- **Custom Input Multiline Support** — Menu, Confirm, and Plan Review custom inputs now support Shift+Enter for new lines:
  - Changed `<input type="text">` to `<textarea>` for all custom input fields
  - Enter sends message, Shift+Enter inserts new line (consistent with Ask input)
  - Auto-resize up to 120px height
  - Updated shortcut hints to include "Shift+Enter for new line"

- **Newline Escape Parsing** — Fixed `\n` literal strings not rendering as actual line breaks:
  - Added `parseNewlines()` utility to convert `\n` to real newlines
  - Applied to all question displays and plan text

---

## [3.2.8] - 2025-12-22

### Changed

- **Chat-Style Request Cards** — All request types now use chat bubble layout with agent avatar
- **Agent Avatar** — Ouroboros logo in semi-transparent bubble (replaces solid blue circle)
- **Sent Message Bubble Size** — Increased to 520px width, 280px max height, 10 line clamp
- **Request Cards Centered** — Cards now vertically centered instead of top-aligned
- **Progress Bar** — Now shows tasks completion only (phases shown in timeline)
- **Tab Shortcuts** — Changed from number keys to Alt+number to avoid input conflicts
- **Send Button** — Replaced icon with Ouroboros logo
- **Tabs Reduced** — Removed Agent Hierarchy tab (merged into Pending Requests)

### Added

- **Agent Activity Box** — Collapsible box in Pending Requests showing current agent and recent handoffs
- **Test Coverage** — Improved coverage for updatePrompts.ts (100%) and SidebarProvider.ts (95%)

### Removed

- **`ouroborosai_phase_progress` Tool** — Removed redundant tool; progress now tracked via file system

### Fixed

- **Newline Parsing** — Question text now correctly renders `\n` as line breaks
- **Keyboard Conflicts** — Arrow keys and number keys no longer interfere with text input

---

## [3.2.7] - 2025-12-22

### Added

- **Sent Message Confirmation** — Chat-style bubble shows what you sent to Copilot:
  - Right-aligned bubble with tail (chat style)
  - Color variants based on request type (blue/green/yellow)
  - Shows timestamp (HH:MM) and type badge (Response/Selection/Confirmation/Review)
  - Slide-in animation from right with bounce effect
  - Check icon pop animation
  - Fades out after 4 seconds
  - 4-line text clamp with ellipsis for long messages

### Fixed

- **Multi-Workspace Spec Detection** — SpecWatcher now restarts when switching workspaces:
  - Fixed "No specs yet" showing despite specs existing in selected workspace
  - `selectWorkspace` message handler now calls `specWatcher.start()` with new path
  - Added `setSpecWatcher()` method to SidebarProvider for workspace switching

- **WorkflowProgress Tests** — Updated tests to match new `useSpecs` hook:
  - Replaced `useWorkflow` mock with `useSpecs` mock
  - Updated test cases for file-based spec data structure

---

## [3.2.5] - 2025-12-22

### Added

- **File-Based Workflow Progress** — Redesigned Workflow tab reads directly from `.ouroboros/specs/` folder:
  - Active specs shown with phase indicators and progress bars
  - Archived specs shown in "Recent Archives" section
  - Real-time updates via FileSystemWatcher
- **New Backend Services**:
  - `specScanner.ts` — Scans specs folders for active/archived workflows
  - `tasksParser.ts` — Parses `tasks.md` checkboxes for progress calculation
  - `specWatcher.ts` — Watches file changes for live updates
- **29 New Unit Tests** — Full test coverage for new services (323 total tests)

### Changed

- **Welcome Logo Effect** — Replaced CSS-based effects with clean SVG arc paths:
  - Left arc: Purple (`#9C6ADE`) matching logo color
  - Right arc: Blue (`#3794ff`) brand color
  - Breathing scale animation (0.88 → 1.12)
  - Flowing particle dots with color-shifting animation
- **Workflow Card Border** — Updated gradient to use brand blue colors instead of rainbow

---

## [3.2.4] - 2025-12-21

### Changed

- **Menu Options Layout** — Options now display vertically instead of horizontally wrapping
- **Custom Input Always Visible** — Custom input field always shows in menu requests
- **Pending Request Centered** — Request card now displays centered in the panel
- **Cancel Button Redesign** — Moved to header as X icon, more subtle

### Added

- **Keyboard Shortcuts** — Full keyboard navigation support:
  - Menu: Press 1-9 to select options, C for custom input
  - Confirm: Y for yes, N for no
  - All types: Esc to cancel
  - Plan Review: Ctrl+Enter to approve
- **Numbered Menu Options** — Each option shows its number for quick keyboard selection
- **Request Type Visual Distinction** — Color-coded left border by type (blue/green/yellow)
- **Empty State Animation** — Breathing animation on idle icon indicates waiting state
- **Shortcut Hints** — Inline hints show available keyboard shortcuts

### Fixed

- **ESLint Warnings** — Fixed unused `prompt` parameters in `promptTransformer.ts`
- **Test Type Safety** — Replaced `as any` with proper types in `promptTransformer.test.ts`

---

## [3.2.3] - 2025-12-21

### Added

- **Multi-Root Workspace Selector** — Choose which workspace to initialize in multi-root projects:
  - Dropdown appears in Step 1 when multiple workspaces are open
  - Shows initialization status (✓) for each workspace
  - Selection persists across extension reloads

### Fixed

- **Template Download on Update** — `.ouroboros/templates/` files now download during "Update Prompts"
  - Previously only downloaded during initial setup via `fetchAndTransformPrompts()`
  - Added template files loop to `smartUpdatePrompts()` in `promptTransformer.ts`

- **Copilot Chat Step Detection** — "Start Ouroboros" step now shows ✓ after opening Copilot Chat
  - Added `hasCopilotChatOpened` state tracking
  - Step 2 badge updates from "2" to green "✓" after clicking "Open Copilot Chat"
  - State persists across extension reloads

- **State Update Bug** — Fixed workspace detection breaking after clicking "Open Copilot Chat"
  - `stateUpdate` message now includes `projectName` and `isInitialized`

### Changed

- **Modernized Chat UI** — Upgraded Pending Requests interface:
  - Message bubbles with gradient backgrounds and hover lift effect
  - Larger textarea (min-height 60px → 100px) with focus glow
  - Added "Shift+Enter for new line" hint
  - Improved shadows and animations

---

## [3.2.2] - 2025-12-21

### Added

- **Smart Prompt Update** — Update prompts while preserving your custom tools:
  - New command `Ouroboros: Update Prompts (Preserve Custom Tools)`
  - New command `Ouroboros: Check for Prompt Updates`
  - "Update Prompts" button in Home tab after initialization
  - Your custom `tools:` array in YAML frontmatter is preserved
  - Version checking compares local vs GitHub release versions

- **Agent Skills Support** — Extension now compatible with agentskills.io standard:
  - Skill Suggestion CCL uses standard Type D format (`confirm = input('[y/n]: ')`)
  - Skill name input uses Type C format (`feature = input(...)`)
  - Full compatibility with `promptTransformer.ts` patterns

### Fixed

- Fixed LM Tools prefix to use lowercase `mlgbjdlw.ouroboros-ai/` (matches VS Code runtime)

---

## [3.2.1] - 2025-12-21

### Changed

- Renamed extension from `ouroboros` to `ouroboros-ai` (marketplace name conflict)
- Renamed all tool names from `ouroboros_*` to `ouroborosai_*`
- Changed publisher to `MLGBJDLW`

### Fixed

- Added `.vscodeignore` to reduce package size
- Added `LICENSE.md` file

---

## [3.2.0] - 2025-12-21

### Added

- **6 LM Tools** for native Copilot integration:
  - `ouroborosai_ask` - Get user input (task, question, feature)
  - `ouroborosai_menu` - Present multiple choice options
  - `ouroborosai_confirm` - Yes/No confirmation dialogs
  - `ouroborosai_plan_review` - Document/plan review and approval
  - `ouroborosai_phase_progress` - Report workflow phase progress
  - `ouroborosai_agent_handoff` - Track agent level transitions

- **React Webview UI** with 4 views:
  - Pending Requests (key: 1)
  - Workflow Progress (key: 2)
  - Agent Hierarchy (key: 3)
  - History (key: 4)

- **Keyboard Navigation**:
  - Press `1-4` to switch views
  - Arrow keys for tab navigation
  - Full ARIA accessibility

- **Commands**:
  - `Ouroboros: Initialize Project`
  - `Ouroboros: Open Sidebar`
  - `Ouroboros: Clear History`
  - `Ouroboros: Cancel Current Request`

### Technical

- Minimum VS Code version: 1.95.0
- Built with esbuild + Vite
- 48 unit tests with vitest
