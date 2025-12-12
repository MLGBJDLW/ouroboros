# 🐍 .ouroboros/ — The Serpent's Nest

This folder is the **persistent memory core** of Project Ouroboros.

## 📁 Structure

```
.ouroboros/
├── README.md                  # 📖 This file
├── templates/                 # 📋 All templates (READ ONLY)
│   ├── context-template.md    # Session context template
│   └── project-arch-template.md # Project architecture template
├── history/                   # 📜 Active/generated files
│   ├── context-YYYY-MM-DD.md  # Session context (created from template)
│   ├── project-arch-YYYY-MM-DD.md # Architecture doc (created from template)
│   └── archived/              # Old history files (>7 days)
├── specs/                     # 📋 Feature specifications
│   ├── templates/             # Spec template files (READ ONLY)
│   │   ├── research-template.md
│   │   ├── requirements-template.md
│   │   ├── design-template.md
│   │   ├── tasks-template.md
│   │   └── validation-template.md
│   ├── archived/              # Completed specs (timestamped)
│   └── [feature-name]/        # Active feature specs
│       ├── research.md        # 🔬 Project analysis
│       ├── requirements.md    # 📋 EARS requirements
│       ├── design.md          # 🏗️ Architecture design
│       ├── tasks.md           # ✅ Implementation tasks
│       └── validation-report.md # ✓ Consistency check
└── subagent-docs/             # 📄 Subagent task documentation (auto-cleanup)
    └── [agent]-[task]-YYYY-MM-DD.md
```

---

## 🤖 Agent System

> **Agents are now located in `.github/agents/`**

### Orchestrator
| Agent | Role |
|-------|------|
| `ouroboros` | Main orchestrator, context window manager, CCL controller |

### Core Agents (6)
| Agent | Tools | Role |
|-------|-------|------|
| `ouroboros-coder` | read, edit, execute | Full-stack implementation |
| `ouroboros-qa` | read, edit, execute, search | Testing & debugging |
| `ouroboros-writer` | read, edit **(unrestricted)** | Any file writing |
| `ouroboros-devops` | read, edit, execute | CI/CD, Git operations |
| `ouroboros-analyst` | read, search | Codebase analysis |
| `ouroboros-security` | read, search | Vulnerability assessment |

### Spec Agents (5)
| Agent | Tools | Role |
|-------|-------|------|
| `ouroboros-researcher` | read, search, web, edit | Project research (Phase 1) |
| `ouroboros-requirements` | read, edit | EARS requirements (Phase 2) |
| `ouroboros-architect` | read, search, edit | Design & ADRs (Phase 3) |
| `ouroboros-tasks` | read, edit | Task breakdown (Phase 4) |
| `ouroboros-validator` | read, search, edit | Consistency validation (Phase 5) |

---

## 🔧 Customizing Agent Tools

**Users can customize tools for any agent!**

### Edit Agent Tools

Each agent file in `.github/agents/*.agent.md` has a `tools:` field:

```yaml
---
description: "Agent description"
tools: ['read', 'edit', 'execute']  # ← Add your tools here!
---
```

### Adding MCP (Model Context Protocol) Tools

To add MCP tools to an agent, simply add them to the `tools:` array:

```yaml
---
description: "⚙️ Senior Principal Engineer..."
tools: ['read', 'edit', 'execute', 'mcp_database_query', 'mcp_slack_notify']
---
```

### Available Native Tools

| Tool | Capability |
|------|------------|
| `read` | Read files |
| `edit` | Edit/create files |
| `execute` | Run terminal commands |
| `search` | Search files (ripgrep) |
| `web` | HTTP requests |
| `agent` | Call other agents |
| `memory` | Persistent memory |
| `todo` | Task tracking |

### Creating Custom Agents

Create a new file `.github/agents/my-agent.agent.md`:

```yaml
---
description: "🎨 My Custom Agent. Specialized for [domain]."
tools: ['read', 'edit', 'mcp_my_tool']
handoffs:
  - label: "Return to Orchestrator"
    agent: ouroboros
    prompt: "Task complete. Returning control."
    send: true
---

# 🎨 My Custom Agent

[Your instructions here...]

## 🔙 RETURN PROTOCOL

1. Output `[TASK COMPLETE]` marker
2. Use handoff to return to `ouroboros`
```

---

## 🔄 How It Works

### On First Session
1. Agent **READS** `templates/context-template.md` (do not edit)
2. Agent **CREATES** `history/context-YYYY-MM-DD.md` following template structure
3. Agent updates the new file with current goal, tech stack, etc.

### On Each Session Start
1. Agent checks `history/` for the most recent `context-*.md`
2. Restores state from that file
3. Continues updating (or creates new one if new day)

### On Major Milestone
Agent updates `history/context-YYYY-MM-DD.md` with:
- New goal status
- Modified files
- Pending issues

---

## ⚡ Slash Commands

| Command | Purpose |
|---------|---------|
| `/ouroboros` | Initialize session and enter CCL |
| `/ouroboros-init` | Research project & generate architecture doc |
| `/ouroboros-spec` | Create spec (Research → Requirements → Design → Tasks → Validation) |
| `/ouroboros-implement` | Execute tasks.md with selectable mode |
| `/ouroboros-archive` | Archive completed specs & cleanup old files |

---

## 📋 Spec Workflow

### Phases

| Phase | Agent | Template | Output |
|-------|-------|----------|--------|
| 1 | `ouroboros-researcher` | `project-arch-template.md` | `research.md` |
| 2 | `ouroboros-requirements` | `requirements-template.md` | `requirements.md` |
| 3 | `ouroboros-architect` | `design-template.md` | `design.md` |
| 4 | `ouroboros-tasks` | `tasks-template.md` | `tasks.md` |
| 5 | `ouroboros-validator` | `validation-template.md` | `validation-report.md` |

**⚠️ Each phase returns to orchestrator for user approval before proceeding.**

### 🎮 Execution Modes (`/ouroboros-implement`)

| Mode | Description | Best For |
|------|-------------|----------|
| 🔧 **Task-by-Task** | Stop after each task for review | High-risk changes |
| 📦 **Phase-by-Phase** | Stop at checkpoints only | Normal development |
| 🚀 **Auto-Run All** | Execute all without stopping | Low-risk tasks |

---

## 📄 Template Features

### requirements-template.md
- **Introduction** section with core goals
- **Glossary** for project-specific terms
- **Numbered requirements** (REQ-001, REQ-002...) with EARS notation
- **MoSCoW prioritization** (Must/Should/Could/Won't)
- **Acceptance criteria** (Given/When/Then)

### design-template.md
- **Design Principles** section
- **Components & Interfaces** with code snippets
- **Correctness Properties** linking to requirements
- **ADR format** with consequence codes (POS-001, NEG-001)
- **Mermaid diagrams** for architecture

### tasks-template.md
- **Sub-task numbering** (TASK-1.1, TASK-1.2, etc.)
- **Checkpoint tasks** between phases
- **Effort estimation** (S/M/L)
- **Dependency mapping**
- **Requirements traceability** (Links: REQ-XXX)

### validation-template.md
- **Coverage matrix** (REQ → Design → Tasks)
- **Issue severity levels** (CRITICAL/WARNING/INFO)
- **Pass/Fail verdict**

---

## 📄 Subagent Docs

The `subagent-docs/` folder holds long outputs from agents (>500 lines):

```
.ouroboros/subagent-docs/
├── analyst-dependency-analysis-2025-12-11.md
├── security-audit-2025-12-11.md
└── researcher-tech-stack-2025-12-11.md
```

> [!CAUTION]
> **Transient Storage Policy**
> Files in `subagent-docs/` are **TEMPORARY**.
> The system automatically **DELETES** any file in this folder that hasn't been modified in **3 days**.
> Do not store permanent documentation here.

---

## ⚠️ Important Notes

- **Never edit root templates** — `templates/*.md` are READ ONLY
- **Never edit spec templates** — `specs/templates/*.md` are READ ONLY  
- **Edit files in `history/`** — Active session states and architecture docs
- **Agents MUST read template first** — Before creating ANY file from template
- **All subagents MUST return** — Via handoff or Emergency CCL

---

## 📂 Related Files

| File | Location |
|------|----------|
| Core prompt | `.github/copilot-instructions.md` |
| Main orchestrator | `.github/agents/ouroboros.agent.md` |
| Session prompt | `.github/prompts/ouroboros.prompt.md` |
| Init prompt | `.github/prompts/ouroboros-init.prompt.md` |
| Spec prompt | `.github/prompts/ouroboros-spec.prompt.md` |
| Implement prompt | `.github/prompts/ouroboros-implement.prompt.md` |
| Archive prompt | `.github/prompts/ouroboros-archive.prompt.md` |

---

<p align="center">
  <strong>♾️ The Serpent's Nest Persists. Memory Never Fades. ♾️</strong>
</p>
