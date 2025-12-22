# Changelog

All notable changes to the Ouroboros AI VS Code Extension will be documented in this file.

## [3.2.8] - 2025-12-22

### Changed

- **Sent Message Bubble Size** — Increased width from 320px to 420px to match request card size
- **Sent Message Text** — Increased max height from 120px to 180px, line clamp from 4 to 6 lines
- **Progress Bar** — Now shows tasks completion only (phases shown in timeline)
- **Tab Shortcuts** — Changed from number keys to Alt+number to avoid input conflicts
- **Send Button** — Replaced icon with Ouroboros logo
- **Tabs Reduced** — Removed Agent Hierarchy tab (merged into Pending Requests)

### Added

- **Agent Activity Box** — Collapsible box in Pending Requests showing current agent and recent handoffs

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
