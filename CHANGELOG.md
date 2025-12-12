# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2025-12-11

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
