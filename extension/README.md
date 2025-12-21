# Ouroboros VS Code Extension

> Structured AI agent workflow with spec-driven development

![Ouroboros Logo](resources/icon.png)

## Features

- **LM Tools Integration**: 6 custom tools for Copilot/AI agents to interact with users
- **Sidebar UI**: Visual workflow progress, pending requests, agent hierarchy, and history
- **Dual-Mode Compatibility**: Works with both Extension mode and TUI mode
- **Spec-Driven Development**: Structured approach to feature development

## Installation

### From VS Code Marketplace

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "Ouroboros"
4. Click Install

### From VSIX

```bash
code --install-extension ouroboros-x.x.x.vsix
```

## Quick Start

1. Open a workspace folder
2. Run command: `Ouroboros: Initialize Project`
3. Start using Copilot with Ouroboros agents

## LM Tools

The extension provides 6 tools that AI agents can use:

| Tool | Purpose |
|:---|:---|
| `ouroboros_ask` | Get user input (task, question, feature description) |
| `ouroboros_menu` | Present multiple choice options |
| `ouroboros_confirm` | Get yes/no confirmation |
| `ouroboros_plan_review` | Present plan/document for approval |
| `ouroboros_phase_progress` | Report workflow phase progress |
| `ouroboros_agent_handoff` | Notify agent level transitions |

## Commands

| Command | Description |
|:---|:---|
| `Ouroboros: Initialize Project` | Set up Ouroboros in current workspace |
| `Ouroboros: Open Sidebar` | Focus the Ouroboros sidebar |
| `Ouroboros: Clear History` | Clear interaction history |
| `Ouroboros: Cancel Current Request` | Cancel pending request |

## Configuration

| Setting | Default | Description |
|:---|:---|:---|
| `ouroboros.executionMode` | `task-by-task` | Default execution mode |
| `ouroboros.showStatusBar` | `true` | Show status in status bar |
| `ouroboros.historyLimit` | `100` | Max history entries |

### Execution Modes

- **task-by-task**: Confirm each task before execution
- **phase-by-phase**: Confirm each phase before execution
- **auto-run**: Run all tasks automatically

## Requirements

- VS Code 1.95.0 or higher
- GitHub Copilot (recommended)

## Development

### Building

```bash
cd extension
npm install
npm run compile
```

### Testing

```bash
# Run extension in development mode
npm run watch

# Then press F5 in VS Code to launch Extension Development Host
```

### Packaging

```bash
npm run package
npx vsce package --no-dependencies
```

## License

MIT

---

**The Serpent Consumes Its Tail. The Loop Never Ends.**
