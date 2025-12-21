# Ouroboros Extension User Guide

> **Structured AI Agent Workflow with Spec-Driven Development**

This guide covers how to use the Ouroboros VS Code Extension for AI-assisted development workflows.

---

## Quick Start

### 1. Install the Extension

- Open VS Code Extensions (Ctrl+Shift+X)
- Search for "Ouroboros"
- Click Install

### 2. Initialize Your Project

1. Open a workspace folder
2. Press `Ctrl+Shift+P` to open Command Palette
3. Run: **Ouroboros: Initialize Project**

This creates:
- `.github/agents/` - Agent prompt files
- `.github/prompts/` - Workflow prompts
- `.ouroboros/` - Specs and templates

### 3. Start Using Ouroboros

The Ouroboros sidebar will appear in the Activity Bar (∞ icon). Click to open.

---

## Sidebar Views

### Pending Requests (1)

Displays pending agent requests that need your input:

| Request Type | Description |
|:---|:---|
| **Input** | Free-form text input |
| **Menu** | Multiple choice selection |
| **Confirm** | Yes/No confirmation |
| **Review** | Plan or document approval |

### Workflow Progress (2)

Shows the current spec or implement workflow:

- Spec workflow has 5 phases:
  1. Research
  2. Requirements
  3. Design
  4. Tasks
  5. Validation

- Progress bar shows overall completion
- Phase icons show status (✓ complete, ⟳ current, ○ pending)

### Agent Hierarchy (3)

Displays the active agent and handoff history:

| Level | Role |
|:---|:---|
| **L0** | God Mode (orchestrator) |
| **L1** | Lead agents (spec, implement, archive) |
| **L2** | Worker agents (coder, tester, etc.) |

### History (4)

Shows past interactions:
- View previous responses
- Clear history button
- Status badges (responded, cancelled, timeout)

---

## Keyboard Shortcuts

| Key | Action |
|:---|:---|
| `1` | Switch to Pending Requests |
| `2` | Switch to Workflow Progress |
| `3` | Switch to Agent Hierarchy |
| `4` | Switch to History |
| `←` / `→` | Navigate between tabs |

---

## Commands

Access via Command Palette (`Ctrl+Shift+P`):

| Command | Description |
|:---|:---|
| **Ouroboros: Initialize Project** | Set up Ouroboros in workspace |
| **Ouroboros: Open Sidebar** | Focus the sidebar |
| **Ouroboros: Clear History** | Clear interaction history |
| **Ouroboros: Cancel Current Request** | Cancel pending request |

---

## Configuration

Open Settings (`Ctrl+,`) and search for "Ouroboros":

| Setting | Default | Description |
|:---|:---|:---|
| `ouroboros.executionMode` | `task-by-task` | How tasks are confirmed |
| `ouroboros.showStatusBar` | `true` | Show status in status bar |
| `ouroboros.historyLimit` | `100` | Max history entries |

### Execution Modes

| Mode | Behavior |
|:---|:---|
| **task-by-task** | Confirm each task before execution |
| **phase-by-phase** | Confirm at phase boundaries |
| **auto-run** | Execute all tasks automatically |

---

## Using with GitHub Copilot

Ouroboros works with GitHub Copilot through Language Model Tools:

1. Open Copilot Chat
2. Ask Copilot to use Ouroboros workflows
3. Respond to requests in the Ouroboros sidebar

Example prompts:
- "Use Ouroboros to spec out a new authentication feature"
- "Start the implement workflow for the user-profile spec"

---

## Troubleshooting

### Sidebar Not Appearing

1. Check Activity Bar for ∞ icon
2. Right-click Activity Bar → ensure Ouroboros is checked
3. Run command: **Ouroboros: Open Sidebar**

### Requests Not Showing

1. Check the Pending Requests tab (press `1`)
2. Ensure the sidebar is visible
3. Check Output panel for errors (View → Output → Ouroboros)

### Extension Not Activating

1. Check VS Code version is 1.95.0+
2. Reload window (Ctrl+Shift+P → "Reload Window")
3. Check for extension errors in Output panel

---

## Dual-Mode Compatibility

Ouroboros supports two modes:

| Mode | Environment | CCL Method |
|:---|:---|:---|
| **Extension** | VS Code + Sidebar | LM Tools |
| **TUI** | Terminal | Python commands |

The system auto-detects which mode is available.

---

## Further Resources

- [Main README](../README.md)
- [Architecture Documentation](extension-architecture-analysis.md)
- [Agent Reference](.github/agents/)

---

**The Serpent Consumes Its Tail. The Loop Never Ends.** ♾️
