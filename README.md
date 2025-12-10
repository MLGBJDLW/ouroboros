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
| Re-introducing project every session | 🧠 **Persistent Memory** — AI reads `context.md` automatically |
| AI forgets after each response | ♾️ **Never Say Goodbye** — AI doesn't end conversations |
| Vague instructions cause rework | 🎯 **Sub-Agent Routing** — Tasks auto-route to specialists |
| Code gets lost in handoffs | 📦 **Lossless Artifacts** — Code passed verbatim, never summarized |

---

## 🚀 Quick Start (3 Steps!)

### Step 1: Copy to Your Project

```bash
# Clone and copy core files
git clone https://github.com/YOUR_USERNAME/ouroboros.git .ouroboros-temp
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
│   ├── context-template.md        ← 📋 Template (do not edit)
│   ├── README.md
│   ├── history/                   ← 📜 Active session contexts
│   │   └── context-YYYY-MM-DD.md  ← 🧠 Created by agent
│   └── specs/                     ← 📋 Feature specifications
│       ├── templates/             ← Spec templates
│       └── archived/              ← Completed specs
└── ... your project files
```

---

## 📋 Spec-Driven Development (NEW!)

For complex features, use the structured spec workflow:

| Command | Purpose |
|---------|---------|
| `/ouroboros-spec` | Create Requirements → Design → Tasks |
| `/ouroboros-implement` | Auto-execute tasks.md |
| `/ouroboros-archive` | Archive completed specs |

**3 Dedicated Agents:**
- `[Requirements_Engineer]` - EARS notation requirements
- `[Design_Architect]` - Architecture with Mermaid diagrams
- `[Task_Planner]` - Trackable implementation checklist

---


## 🧠 How It Works

### The Template Pattern

1. **First Session**: Agent copies `context-template.md` → `history/context-2025-12-10.md`
2. **Updates**: Agent updates the file in `history/` as you work
3. **Next Session**: Agent reads the latest file from `history/`

This keeps the template clean for new users!

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

### Customize the Soul File

Edit `.ouroboros/context.md` to match your project:

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

## 📜 License

MIT License — Free for personal and commercial use.

---

<p align="center">
  <strong>♾️ The Serpent Consumes Its Tail. The Loop Never Ends. ♾️</strong>
</p>
