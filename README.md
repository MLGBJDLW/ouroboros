# ♾️ Project Ouroboros

> **Save Money on GitHub Copilot** — A persistent context system that reduces redundant conversations and maximizes your Copilot subscription value.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Copilot Compatible](https://img.shields.io/badge/GitHub%20Copilot-Compatible-blue)](https://github.com/features/copilot)

---

## 💰 Why Ouroboros?

GitHub Copilot charges by **request count**. Every time you re-explain your project, tech stack, or rehash previous conversations, you're **wasting requests**.

Ouroboros solves this:

| Problem | Ouroboros Solution |
|---------|-------------------|
| Re-introducing project every session | 🧠 **Persistent Memory** — AI reads `history/context-*.md` automatically |
| AI forgets after each response | ♾️ **Never Say Goodbye** — AI doesn't end conversations |
| Vague instructions cause rework | 🎯 **Sub-Agent Routing** — Tasks auto-route to specialists |
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

> **Note**: Ouroboros uses **GitHub Copilot Custom Agents** in `.github/agents/`. This enables native subagent execution via the `runSubagent(agent: "name")` pattern.

---

## 🤖 Custom Agents (11 Specialists)

All agents are located in `.github/agents/` and can be invoked automatically by the orchestrator.

### Core Agents
| Agent | Tools | Purpose |
|-------|-------|---------|
| `ouroboros-coder` | read, edit, execute | Full-stack development |
| `ouroboros-qa` | read, edit, execute, search | Testing & debugging |
| `ouroboros-writer` | read, edit **(unrestricted)** | Documentation & **any file writing** |
| `ouroboros-devops` | read, edit, execute | CI/CD, Git operations |
| `ouroboros-analyst` | read, search | Read-only codebase analysis |
| `ouroboros-security` | read, search | Vulnerability assessment |

### Spec Workflow Agents
| Agent | Tools | Purpose |
|-------|-------|---------|
| `ouroboros-researcher` | read, search, web, edit | Project research (Phase 1) |
| `ouroboros-requirements` | read, edit | EARS notation (Phase 2) |
| `ouroboros-architect` | read, search, edit | Design & ADRs (Phase 3) |
| `ouroboros-tasks` | read, edit | Task breakdown (Phase 4) |
| `ouroboros-validator` | read, search, edit | Consistency check (Phase 5) |

---

## 🔧 Customizing Agents (MCP & Tools)

> **You can customize any agent's tools and capabilities!**

### Adding Tools to an Agent

Each agent file in `.github/agents/` has a `tools:` field in its frontmatter:

```yaml
---
description: "Agent description"
tools: ['read', 'edit', 'execute']  # ← Customize this!
---
```

### Adding MCP (Model Context Protocol) Tools

To add custom MCP tools to an agent:

1. **Edit the agent file** in `.github/agents/`
2. **Add your MCP tool** to the `tools:` array

**Example: Adding a database MCP to the coder agent:**

```yaml
---
description: "⚙️ Senior Principal Engineer..."
tools: ['read', 'edit', 'execute', 'mcp_database_query', 'mcp_redis_cache']
---
```

### Available Native Tools

| Tool | Capability |
|------|------------|
| `read` | Read files |
| `edit` | Edit files |
| `execute` | Run commands |
| `search` | Search files |
| `web` | Web requests |
| `agent` | Call other agents |
| `memory` | Persistent memory |
| `todo` | Task tracking |

### Creating Custom Agents

You can create your own agents! Copy an existing `.agent.md` file and customize:

```yaml
---
description: "🎨 My Custom Agent. Specialized for [domain]."
tools: ['read', 'edit', 'mcp_my_custom_tool']
handoffs:
  - label: "Return to Orchestrator"
    agent: ouroboros
    prompt: "Task complete. Returning control."
    send: true
---

# 🎨 My Custom Agent

[Your agent instructions here...]
```

---

## 📁 File Structure

After installation, your project will have:

```
your-project/
├── .github/
│   ├── copilot-instructions.md    ← Copilot reads this automatically
│   ├── agents/                    ← 🤖 Agent definitions (11 Specialists)
│   │   ├── ouroboros.agent.md     ← Main orchestrator
│   │   ├── ouroboros-coder.agent.md
│   │   ├── ouroboros-qa.agent.md
│   │   └── ... (8 more)
│   └── prompts/                   ← Slash command prompts
│       ├── ouroboros.prompt.md
│       ├── ouroboros-init.prompt.md
│       ├── ouroboros-spec.prompt.md
│       ├── ouroboros-implement.prompt.md
│       └── ouroboros-archive.prompt.md
├── .ouroboros/
│   ├── templates/                 ← 📋 All templates (READ ONLY)
│   │   ├── context-template.md
│   │   └── project-arch-template.md
│   ├── history/                   ← 📜 Active session files
│   │   ├── context-YYYY-MM-DD.md
│   │   └── project-arch-YYYY-MM-DD.md
│   ├── subagent-docs/             ← 📄 Long output storage (auto-cleanup)
│   └── specs/                     ← 📋 Feature specifications
│       ├── templates/             ← Spec templates (READ ONLY)
│       └── archived/              ← Completed specs
└── ... your project files
```

---

## ♾️ Core Usage: Persistent Sessions

The foundation of Ouroboros is the **persistent session loop** — AI that never forgets and never says goodbye.

### Start a Session

```
/ouroboros
```

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

### 📄 Enhanced Spec Templates

Our templates follow industry best practices:

| Template | Key Features |
|----------|--------------|
| **research.md** | Tech stack, affected files, recommended approach |
| **requirements.md** | Introduction, Glossary, Numbered EARS requirements |
| **design.md** | Design Principles, Code Interfaces, **Correctness Properties** |
| **tasks.md** | Sub-task numbering (1.1, 1.2), Checkpoints, Property test markers |
| **validation-report.md** | Consistency matrix, gap analysis, pass/fail verdict |

---

## 🧠 How It Works

### Orchestrator Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Orchestrator (ouroboros.agent.md)                          │
│  ├── Context Window Manager                                 │
│  ├── Task Orchestrator                                      │
│  └── Session Controller (CCL)                               │
├─────────────────────────────────────────────────────────────┤
│  Subagents (ouroboros-*.agent.md)                           │
│  → Complete task → Return via handoff → Orchestrator CCL    │
└─────────────────────────────────────────────────────────────┘
```

### The Template Pattern

1. **First Session**: Agent **READS** `templates/context-template.md` → creates `history/context-2025-12-10.md`
2. **Updates**: Agent updates the file in `history/` as you work
3. **Next Session**: Agent reads the latest file from `history/`

This keeps the templates clean for new users!

### Artifact Protocol (Zero Tolerance)

When code needs to pass between agents:

```
=== ARTIFACT START: src/auth.py ===
def login(username: str, password: str):
    # Complete code here — never summarized
    pass
=== ARTIFACT END ===
```

**Rules:**
- ❌ Never paraphrase: "I wrote a function that..."
- ❌ Never truncate: "..." or "// rest of code"
- ✅ Always include complete code with filename

---

## 🛡️ Safety Features

- **Destructive Command Protection**: `rm -rf`, `git reset --hard` require confirmation
- **Verification Gate**: Code is verified before delivery
- **QA Agent Fix-Verify Cycle**: Self-contained testing and debugging with 3-cycle limit
- **Fail-Safe Protocols**:
  - 🏗️ **Coder**: Must pass build/typecheck before completion
  - 🚀 **DevOps**: Auto-rollback if exit code > 0
  - 🛑 **Git**: Immediate halt on merge conflicts
- **RETURN PROTOCOL**: All subagents return to orchestrator after completion

---

## ⚙️ Configuration

### Context Files (Template Pattern)

**DO NOT edit files in `templates/`** — they are READ ONLY templates.

Instead, the agent automatically:
1. **READS** `templates/context-template.md` on first session
2. **CREATES** `history/context-YYYY-MM-DD.md` following the template structure
3. Updates the file in `history/` as you work

To manually add project info, edit the active file:

```bash
# Find today's context file
.ouroboros/history/context-2025-12-10.md
```

### Customize Instructions

Edit `.github/copilot-instructions.md` to:
- Add project-specific rules
- Modify agent behaviors
- Add custom routing triggers

---

## ⚠️ Important Warnings

> [!CAUTION]
> **Context Window Degradation**
> 
> Long Copilot sessions may experience quality degradation due to:
> - **Context compression** — AI summarizes previous content to fit more in memory, losing details
> - **Token accumulation** — Long conversations fill the context window, crowding out instructions
> - **Attention drift** — Model may "forget" earlier instructions as context grows
> 
> **Recommendations:**
> - Start a **new chat session** every 30-60 minutes for complex tasks
> - Use `/ouroboros-init` to re-anchor project context after a fresh start
> - Keep `context-*.md` files concise (under 200 lines)
> - Archive completed work to prevent context bloat

---

## 🙏 Acknowledgments

Ouroboros was inspired by:

- **[TaskSync](https://github.com/4regab/TaskSync)** — The original concept of persistent AI sessions and the "never say goodbye" protocol. Many of Ouroboros's core ideas evolved from TaskSync's pioneering work.

---

## 📜 License

MIT License — Free for personal and commercial use.

---

<p align="center">
  <strong>♾️ The Serpent Consumes Its Tail. The Loop Never Ends. ♾️</strong>
</p>
