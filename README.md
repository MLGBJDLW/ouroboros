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

### Step 3: Enable Copilot Sub-Agents (Important!)

For the sub-agent routing to work, you need to enable Copilot's agent features:

1. Open Settings (`Ctrl+,` / `Cmd+,`)
2. Search: `github.copilot.chat.agent`
3. ✅ **Enable Agent Mode**

> **Note**: Sub-agent routing is a conceptual framework. The AI simulates specialized agents within its responses to provide more focused, role-specific outputs.

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
| `[Project_Researcher]` | Codebase analysis and research |
| `[Requirements_Engineer]` | EARS notation requirements |
| `[Design_Architect]` | Architecture with Mermaid diagrams |
| `[Task_Planner]` | Trackable implementation checklist |
| `[Spec_Validator]` | Cross-document consistency check |

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

### Sub-Agent Routing

Your requests are automatically routed to specialized "virtual agents":

| You Say | Routed To | Behavior |
|---------|-----------|----------|
| "Implement login" | `[Code_Core]` | Full feature development |
| "Fix this error" | `[Debugger]` | **Surgical patch only** — no file rewrites |
| "Add tests" | `[Test_Engineer]` | Unit/E2E test creation |
| "Explain this code" | `[Project_Analyst]` | Architecture analysis |
| "Update the docs" | `[Tech_Writer]` | Documentation updates |

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
- **Surgical Fix Protocol**: Debugger can only patch, never rewrite entire files

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
