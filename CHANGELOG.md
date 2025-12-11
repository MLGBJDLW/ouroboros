# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-12-10

### 🚀 Architecture Upgrade: Self-Bootstrap Agents

#### Changed
- **Agent Relocation** — Moved all agent definitions from `.github/agents/` to `.ouroboros/agents/`. This declutters the VS Code UI while maintaining functionality.
- **Dispatch Protocol** — Replaced "Implicit Dispatch" with **Self-Bootstrap Dispatch Protocol**.
  - **Old**: `Run the ouroboros-coder agent...` (relied on unstable VS Code agent detection)
  - **New**: `Read .ouroboros/agents/ouroboros-coder.agent.md then execute...` (guarantees correct persona adoption)
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
| `ouroboros-debugger` | debug, error, fix, bug | Surgical patches only |
| `ouroboros-tester` | test, mock, coverage | Test creation with assertions |
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
- **Verification Gate** — Code verified via `ouroboros-security` or `ouroboros-tester` before delivery
- **Surgical Fix Protocol** — `ouroboros-debugger` can only patch bugs, forbidden from rewriting files
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
