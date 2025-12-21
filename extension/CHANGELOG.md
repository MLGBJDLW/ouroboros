# Changelog

All notable changes to the Ouroboros VS Code Extension will be documented in this file.

## [3.2.0] - 2025-12-21

### Added

- **6 LM Tools** for native Copilot integration:
  - `ouroboros_ask` - Get user input (task, question, feature)
  - `ouroboros_menu` - Present multiple choice options
  - `ouroboros_confirm` - Yes/No confirmation dialogs
  - `ouroboros_plan_review` - Document/plan review and approval
  - `ouroboros_phase_progress` - Report workflow phase progress
  - `ouroboros_agent_handoff` - Track agent level transitions

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
