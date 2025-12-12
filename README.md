# ♾️ Project Ouroboros v2.0

> **Save Money on GitHub Copilot** — A persistent context system that reduces redundant conversations and maximizes your Copilot subscription value.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Copilot Compatible](https://img.shields.io/badge/GitHub%20Copilot-Compatible-blue)](https://github.com/features/copilot)
[![Version: 2.0](https://img.shields.io/badge/Version-2.0-green)](https://github.com/MLGBJDLW/ouroboros)

---

## 💰 Why Ouroboros?

GitHub Copilot charges by **request count**. Every time you re-explain your project, tech stack, or rehash previous conversations, you're **wasting requests**.

Ouroboros solves this:

| Problem | Ouroboros Solution |
|---------|-------------------|
| Re-introducing project every session | 🧠 **Persistent Memory** — AI reads `history/context-*.md` automatically |
| AI forgets after each response | ♾️ **Never Say Goodbye** — AI doesn't end conversations |
| Vague instructions cause rework | 🎯 **Sub-Agent Routing** — Tasks auto-route to specialists via `runSubagent` |
| Code gets lost in handoffs | 📦 **Lossless Artifacts** — Code passed verbatim, never summarized |

---

## 🚀 Quick Start (3 Steps!)

### Step 1: Copy to Your Project

```bash
# Clone and copy core files
git clone https://github.com/MLGBJDLW/ouroboros.git .ouroboros-temp
cp -r .ouroboros-temp/.github .
cp -r .ouroboros-temp/.ouroboros .
rm -rf .ouroboros-temp
```

Or manually copy these folders to your project root:
- `.github/` — Contains Copilot instructions and agents
- `.ouroboros/` — Contains the persistent memory files

### Step 2: Enable Custom Instructions in VS Code

1. Open Settings (`Ctrl+,` / `Cmd+,`)
2. Search: `github.copilot.chat.codeGeneration.useInstructionFiles`
3. ✅ **Enable it**

### Step 3: Enable VS Code Settings (Important!)

Enable these settings for full functionality:

| Setting | Search For | Purpose |
|---------|------------|---------|
| 🔧 **Custom Instructions** | `github.copilot.chat.codeGeneration.useInstructionFiles` | Load `.github/copilot-instructions.md` |
| 🤖 **Agent Mode** | `github.copilot.chat.agent` | Enable agent-based interactions |

> **Note**: Ouroboros v2.0 requires the **Main Orchestrator Agent** (`ouroboros.agent.md`). Do not invoke subagents directly; always start with `/ouroboros`.

> [!WARNING]
> **Context Window Limitation**: Due to AI provider token limits, the context window may become exhausted after approximately **1 hour** of continuous use. When this happens:
> - The AI may lose track of previous context
> - Performance may degrade or the session may stop responding
>
> This is an inherent limitation of current AI technology, not a bug in Ouroboros.

### Step 4: Configure Agent Tools & MCP (Optional)

Each agent's tools can be configured via VS Code's agent settings:

1. Open agent file (e.g., `.github/agents/ouroboros-coder.agent.md`)
2. Click the ⚙️ gear icon to open tools configuration
3. Enable/disable tools as needed (`edit`, `execute`, `memory`, etc.)

**For MCP Servers**: Add your MCP configuration to `.vscode/mcp.json` or VS Code settings to extend agent capabilities with external tools.

---

## 🤖 Custom Agents (16 Total)

All agents are located in `.github/agents/`. The system uses a **hub-and-spoke** model with one main orchestrator and specialized subagents.

### Main Orchestrator
| Agent | Role |
|-------|------|
| `ouroboros` | **MAIN ORCHESTRATOR**. The only agent you talk to. Delegates everything via `runSubagent()`. |

### Workflow Orchestrators (Sub-Orchestrators)
These are specialized orchestrators for major workflows. They inherit CCL enforcement and delegation rules from the main orchestrator.

| Agent | Role | Invoked By |
|-------|------|------------|
| `ouroboros-init` | Project initialization workflow | `/ouroboros-init` |
| `ouroboros-spec` | 5-phase spec workflow | `/ouroboros-spec` |
| `ouroboros-implement` | Task execution workflow | `/ouroboros-implement` |
| `ouroboros-archive` | Archive management | `/ouroboros-archive` |

### Worker Agents (Specialists)
| Agent | Role |
|-------|------|
| `ouroboros-coder` | Full-stack development (Edit, Execute, Build) |
| `ouroboros-qa` | Unified Testing & Debugging (Fix-Verify Cycle) |
| `ouroboros-writer` | Documentation & File Writing (No code logic) |
| `ouroboros-devops` | CI/CD, Docker, Deployment |
| `ouroboros-analyst` | Read-only Codebase Analysis |
| `ouroboros-security`| Security Audits & Vulnerability Checks |

### Spec Phase Agents (Workers)
| Agent | Role |
|-------|------|
| `ouroboros-researcher` | Project Research (Phase 1) |
| `ouroboros-requirements` | EARS Requirements (Phase 2) |
| `ouroboros-architect` | System Design & ADRs (Phase 3) |
| `ouroboros-tasks` | Task Breakdown & Planning (Phase 4) |
| `ouroboros-validator` | Consistency & Logic Verification (Phase 5) |

---

## 🧠 How It Works: The v2.0 Architecture

### Centralized Orchestration

Ouroboros v2.0 uses a strict **Hub-and-Spoke** model. You never talk to the subagents; you talk to the Orchestrator, and it calls them for you.

```mermaid
flowchart TD
    User((User)) -->|Chat| Orch[Main Agent: ouroboros]
    
    subgraph Workflow_Orchestrators[Workflow Orchestrators]
        Init[ouroboros-init]
        Spec[ouroboros-spec]
        Impl[ouroboros-implement]
        Arch[ouroboros-archive]
    end
    
    subgraph Worker_Agents[Worker Agents]
        Coder[ouroboros-coder]
        QA[ouroboros-qa]
        Writer[ouroboros-writer]
        Analyst[ouroboros-analyst]
    end
    
    Orch -->|runSubagent| Init
    Orch -->|runSubagent| Spec
    Orch -->|runSubagent| Impl
    Orch -->|runSubagent| Arch
    Orch -->|runSubagent| Coder
    Orch -->|runSubagent| QA
    Orch -->|runSubagent| Writer
    
    Init -->|runSubagent| Analyst
    Init -->|runSubagent| Writer
    Spec -->|runSubagent| SpecAgents[Spec Phase Agents]
    Impl -->|runSubagent| Coder
    Impl -->|runSubagent| QA
    Arch -->|runSubagent| Writer
    
    Init -->|handoff| Orch
    Spec -->|handoff| Orch
    Impl -->|handoff| Orch
    Arch -->|handoff| Orch
    
    Orch -->|Updates| Memory[(context.md)]
```

### The Return Protocol

To prevent agents from "hallucinating" success or getting lost:
1. Orchestrator calls `runSubagent(agent: "ouroboros-coder", task: "Implement auth")`.
2. Subagent activates, reads context, does the work.
3. Subagent **MUST** return a structured result to the Orchestrator.
4. Orchestrator verifies the work and either completes the task or loops back.

---

## ♾️ Core Usage: Persistent Sessions

The foundation of Ouroboros is the **persistent session loop** — AI that never forgets and never says goodbye.

### Start a Session

```
/ouroboros
```

or simply type `/ouroboros` in Copilot Chat.

This command:
1. ✅ Loads your project context from `history/context-*.md`
2. ✅ Activates the **Continuous Command Loop (CCL)**
3. ✅ Routes tasks to specialized sub-agents automatically
4. ✅ Never ends until you say "stop", "end", "terminate", or "quit"

### The "Never Say Goodbye" Protocol

Once `/ouroboros` is active, the AI will:
- ❌ Never say "Let me know if you need anything else"
- ❌ Never end the conversation prematurely
- ✅ Always execute: `python -c "task = input('[Ouroboros] > ')"` after each task
- ✅ Wait for your next instruction continuously

---

## 📋 Spec-Driven Development

For complex features, use the structured spec workflow:

| Command | Purpose |
|---------|---------|
| `/ouroboros-init` | 🆕 First-time project research & setup |
| `/ouroboros-spec` | Create Research → Requirements → Design → Tasks |
| `/ouroboros-implement` | Auto-execute tasks.md |
| `/ouroboros-archive` | Archive completed specs |

### 🎮 Execution Modes (`/ouroboros-implement`)

Choose how to execute your implementation plan:

| Mode | Speed | Control | Best For |
|------|-------|---------|----------|
| 🔧 **Task-by-Task** | Slowest | Highest | High-risk changes, learning |
| 📦 **Phase-by-Phase** | Medium | Medium | Normal development |
| 🚀 **Auto-Run All** | Fastest | Lowest | Low-risk, trusted tasks |

---

## 🛡️ Safety & Reliability

- **Destructive Command Protection**: `rm -rf`, `git reset --hard` require confirmation
- **Verification Gate**: Code is verified before delivery
- **QA Agent Fix-Verify Cycle**: Self-contained testing and debugging with 3-cycle limit
- **Fail-Safe Protocols**:
  - 🏗️ **Coder**: Must pass build/typecheck before completion
  - 🚀 **DevOps**: Auto-rollback if exit code > 0
  - 🛑 **Git**: Immediate halt on merge conflicts
- **RETURN PROTOCOL**: All subagents return to orchestrator after completion

---

## 📁 File Structure

```
your-project/
├── .github/
│   ├── copilot-instructions.md    ← Copilot reads this automatically
│   ├── agents/                    ← 🤖 Agent definitions (16 agents)
│   │   ├── ouroboros.agent.md     ← MAIN ORCHESTRATOR
│   │   ├── ouroboros-init.agent.md    ← Workflow: Init
│   │   ├── ouroboros-spec.agent.md    ← Workflow: Spec
│   │   ├── ouroboros-implement.agent.md ← Workflow: Implement
│   │   ├── ouroboros-archive.agent.md ← Workflow: Archive
│   │   ├── ouroboros-coder.agent.md   ← Worker: Coder
│   │   └── ... (11 more workers)
│   └── prompts/                   ← Slash command prompts (lightweight refs)
│       ├── ouroboros.prompt.md    → agent: ouroboros
│       ├── ouroboros-init.prompt.md → agent: ouroboros-init
│       └── ...
├── .ouroboros/
│   ├── templates/                 ← 📋 All templates (READ ONLY)
│   ├── history/                   ← 📜 Active session files
│   ├── subagent-docs/             ← 📄 Long output storage
│   └── specs/                     ← 📋 Feature specifications
└── ... your project files
```

---

## 🙏 Acknowledgments

Ouroboros was inspired by:

- **[TaskSync](https://github.com/4regab/TaskSync)** — The original concept of persistent AI sessions and the "never say goodbye" protocol. Many of Ouroboros's core ideas evolved from TaskSync's pioneering work.

---

## 📋 Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and updates.

---

## 📜 License

MIT License — Free for personal and commercial use.

---

<p align="center">
  <strong>♾️ The Serpent Consumes Its Tail. The Loop Never Ends. ♾️</strong>
</p>
