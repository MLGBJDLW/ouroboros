# Changelog

All notable changes to the Ouroboros AI VS Code Extension will be documented in this file.

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
