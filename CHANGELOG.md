# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

#### 🤖 Sub-Agent Routing (13 Specialists)

| Agent | Trigger | Role |
|-------|---------|------|
| `[Code_Core]` | implement, create, build | Full-stack development |
| `[Debugger]` | debug, error, fix, bug | Surgical patches only |
| `[Test_Engineer]` | test, mock, coverage | Test creation with assertions |
| `[Tech_Writer]` | document, explain | Documentation, no code mods |
| `[DevOps_Engineer]` | deploy, docker | Deployment with rollback steps |
| `[Security_Auditor]` | security, audit | Risk identification |
| `[Git_Specialist]` | merge, conflict, rebase | Git operations |
| `[Project_Analyst]` | how does, where is | Read-only codebase analysis |
| `[Project_Researcher]` | research, investigate | Structured research reports |
| `[Requirements_Engineer]` | requirements, user story | EARS notation requirements |
| `[Design_Architect]` | design, architecture | Mermaid diagrams required |
| `[Task_Planner]` | tasks, breakdown | File paths required |
| `[Spec_Validator]` | validate, verify | Coverage matrix output |

#### ⚡ Slash Commands

| Command | Purpose |
|---------|---------|
| `/ouroboros` | Full system activation and re-initialization |
| `/ouroboros-init` | First-time project research and architecture setup |
| `/ouroboros-spec` | 5-phase spec workflow (Research → Requirements → Design → Tasks → Validation) |
| `/ouroboros-implement` | Execute tasks.md with 3 speed modes |
| `/ouroboros-archive` | Archive completed specs with timestamp |

#### 📋 Spec-Driven Development (5 Phases)

| Phase | Agent | Output |
|-------|-------|--------|
| 1. Research | `[Project_Researcher]` | `research.md` — codebase analysis, affected files |
| 2. Requirements | `[Requirements_Engineer]` | `requirements.md` — EARS notation, numbered requirements |
| 3. Design | `[Design_Architect]` | `design.md` — architecture, Mermaid diagrams, correctness properties |
| 4. Tasks | `[Task_Planner]` | `tasks.md` — sub-task numbering, checkpoints, file paths |
| 5. Validation | `[Spec_Validator]` | `validation-report.md` — consistency check, impact analysis, risk assessment |

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
- **Verification Gate** — Code verified via `[Security_Auditor]` or `[Test_Engineer]` before delivery
- **Surgical Fix Protocol** — `[Debugger]` can only patch bugs, forbidden from rewriting files
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
