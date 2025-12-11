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
- `.github/` — Contains Copilot instructions
- `.ouroboros/` — Contains the persistent memory file

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

> **Note**: Ouroboros now uses a **Self-Bootstrap Protocol** where agents read their own definitions from `.ouroboros/agents/`. This ensures reliable execution without depending on experimental VS Code settings.

---

## 🤖 Custom Agents (Self-Bootstrapped)

Ouroboros includes 11 specialized agents now located in `.ouroboros/agents/`:

**Core Agents:**
| Agent | Trigger | Role |
|-------|---------|------|
| `ouroboros-coder` | implement, create, build | Full-stack development |
| `ouroboros-qa` | test, debug, fix, error, mock, coverage | Testing & debugging (unified) |
| `ouroboros-writer` | document, explain | Documentation only |
| `ouroboros-devops` | deploy, docker | Deployment with rollback |
| `ouroboros-security` | security, audit | Risk identification |
| `ouroboros-git` | merge, conflict, rebase | Git operations |
| `ouroboros-analyst` | how does, where is | Read-only codebase analysis |

**Spec Workflow Agents:**
| Agent | Trigger | Role |
|-------|---------|------|
| `ouroboros-researcher` | research, investigate | Structured research reports |
| `ouroboros-requirements` | requirements, user story | EARS notation |
| `ouroboros-architect` | design, architecture | Mermaid diagrams required |
| `ouroboros-tasks` | breakdown, plan, tasks | Task breakdown & estimation |
| `ouroboros-validator` | validate, verify | Consistency matrix |


---

## 📁 File Structure

After installation, your project will have:

```
your-project/
├── .github/
│   ├── copilot-instructions.md    ← Copilot reads this automatically
│   └── prompts/
│       ├── ouroboros.prompt.md    ← Full reference prompt
│       ├── ouroboros-spec.prompt.md      ← 📋 Spec workflow
│       ├── ouroboros-implement.prompt.md ← ⚡ Auto-implement
│       └── ouroboros-archive.prompt.md   ← 📦 Archive specs
├── .ouroboros/
│   ├── README.md
│   ├── agents/                    ← 🤖 Agent definitions (13 Specialists)
│   ├── templates/                 ← 📋 All templates (READ ONLY)
│   │   ├── context-template.md    ← Session context template
│   │   └── project-arch-template.md ← Architecture template
│   ├── history/                   ← 📜 Active session files
│   │   ├── context-YYYY-MM-DD.md  ← 🧠 Created by agent
│   │   └── project-arch-YYYY-MM-DD.md ← 🏗️ Created by agent
│   ├── subagent-docs/             ← 📄 Task specs for sub-agents
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
| **requirements.md** | Introduction, Glossary, Numbered EARS requirements |
| **design.md** | Design Principles, Code Interfaces, **Correctness Properties** |
| **tasks.md** | Sub-task numbering (1.1, 1.2), Checkpoints, Property test markers |

### 🤖 Spec Agents (5 Specialists)

| Agent | Role |
|-------|------|
| `ouroboros-researcher` | Codebase analysis and research |
| `ouroboros-requirements` | EARS notation requirements |
| `ouroboros-architect` | Architecture with Mermaid diagrams |
| `ouroboros-tasks` | Task breakdown with file paths |
| `ouroboros-validator` | Cross-document consistency check |

---

## 🧠 How It Works

### The Template Pattern

1. **First Session**: Agent **READS** `templates/context-template.md` → creates `history/context-2025-12-10.md`
2. **Updates**: Agent updates the file in `history/` as you work
3. **Next Session**: Agent reads the latest file from `history/`

This keeps the templates clean for new users!

This is your project's **persistent memory**. The AI:
- **Reads it** at session start to restore context
- **Updates it** when major milestones are reached

```markdown
# ♾️ Project Ouroboros: Global Context Anchor
> **Last Updated**: 2025-12-10
> **Status**: 🟢 Active

## 🎯 Current Goal
Implementing user authentication

## 🛠️ Tech Stack
- Python 3.11 + FastAPI
- React 18 + TypeScript

## 📋 Pending Issues
- [ ] Fix JWT refresh token bug
```

Your requests are automatically routed to specialized agents in `.github/agents/`:

| You Say | Routed To | Behavior |
|---------|-----------|----------|
| "Implement login" | `ouroboros-coder` | Full feature development |
| "Fix this error" | `ouroboros-qa` | **Tests & surgical patches** |
| "Add tests" | `ouroboros-qa` | Unit/E2E test creation |
| "Explain this code" | `ouroboros-analyst` | Architecture analysis |
| "Update the docs" | `ouroboros-writer` | Documentation updates |

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
- **Fail-Safe Protocols (New)**:
  - 🏗️ **Coder**: Must pass build/typecheck before completion
  - 🚀 **DevOps**: Auto-rollback if exit code > 0
  - 🛑 **Git**: Immediate halt on merge conflicts
- **Initialization Protocol**: All agents read project context before acting

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

```markdown
## 🎯 Current Goal
[Your current objective]

## 🛠️ Tech Stack
- [Your technologies]

## 📋 Pending Issues
- [ ] [Your known issues]
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
