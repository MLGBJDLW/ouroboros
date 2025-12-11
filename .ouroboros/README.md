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
│   └── project-arch-YYYY-MM-DD.md # Architecture doc (created from template)
├── specs/                     # 📋 Feature specifications
│   ├── templates/             # Spec template files (READ ONLY)
│   │   ├── research-template.md
│   │   ├── requirements-template.md
│   │   ├── design-template.md
│   │   └── tasks-template.md
│   ├── archived/              # Completed specs (timestamped)
│   └── [feature-name]/        # Active feature specs
│       ├── research.md        # 🔬 Project analysis
│       ├── requirements.md    # 📋 EARS requirements
│       ├── design.md          # 🏗️ Architecture design
│       └── tasks.md           # ✅ Implementation tasks
└── subagent-docs/             # 📄 Subagent task documentation
    └── [task-name].md         # Detailed instructions for runSubagent()
```

## 🔄 How It Works

### On First Session
1. Agent **READS** `templates/context-template.md` (do not edit)
2. Agent **CREATES** `history/context-YYYY-MM-DD.md` following template structure
3. Agent updates the new file with current goal, tech stack, etc.
4. Subsequent updates go to this file

### On Each Session Start
1. Agent checks `history/` for the most recent `context-*.md`
2. Restores state from that file
3. Continues updating the same file (or creates new one if new day)

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
| `/ouroboros-spec` | Create spec (Research → Requirements → Design → Tasks) |
| `/ouroboros-implement` | Execute tasks.md with selectable mode |
| `/ouroboros-archive` | Archive completed specs |

---

## 📋 Specs System

Use **Spec-Driven Development** for complex features:

### Workflow

1. **`/ouroboros-init`** - Initialize project (first time only)
   - `[Project_Researcher]` **READS** `.ouroboros/project-arch-template.md`
   - Generates `.ouroboros/history/project-arch-YYYY-MM-DD.md`

2. **`/ouroboros-spec`** - Describe your feature
   - Each agent **READS** corresponding template from `specs/templates/`
   - `[Project_Researcher]` → `research.md`
   - `[Requirements_Engineer]` → `requirements.md`
   - `[Design_Architect]` → `design.md`
   - `[Task_Planner]` → `tasks.md`
   - `[Spec_Validator]` → cross-document validation
   - **⚠️ Each phase returns to orchestrator for user approval**

3. **`/ouroboros-implement`** - Execute tasks
   - Select execution mode (see below)
   - Routes to Ouroboros agents via `runSubagent()`
   - Updates checkboxes on completion

4. **`/ouroboros-archive`** - Archive when done
   - Moves to `specs/archived/[feature-YYYY-MM-DD]/`
   - Generates summary

### 🎮 Execution Modes (`/ouroboros-implement`)

| Mode | Description | Best For |
|------|-------------|----------|
| 🔧 **Task-by-Task** | Stop after each task for review | High-risk changes |
| 📦 **Phase-by-Phase** | Stop at checkpoints only | Normal development |
| 🚀 **Auto-Run All** | Execute all without stopping | Low-risk, trusted tasks |

---

## 📄 Template Features

### requirements-template.md
- **Introduction** section with core goals
- **Glossary** for project-specific terms
- **Numbered requirements** (1, 2, 3...) with EARS notation

### design-template.md
- **Design Principles** section
- **Components & Interfaces** with code snippets
- **Correctness Properties** linking to requirements
- **Testing Strategy** (unit, property, integration)

### tasks-template.md
- **Sub-task numbering** (1.1, 1.2, etc.)
- **Checkpoint tasks** between phases
- **Property test markers** (`*` for optional tests)
- **Requirements mapping** inline

---

## 🤖 Sub-Agents

### Core Agents
| Agent | Role |
|-------|------|
| `[Code_Core]` | Full-stack implementation |
| `[Debugger]` | Bug fixing (surgical only) |
| `[Test_Engineer]` | Testing & QA |
| `[Tech_Writer]` | Documentation |
| `[DevOps_Engineer]` | Deployment |
| `[Security_Auditor]` | Security review |
| `[Git_Specialist]` | Git operations |
| `[Project_Analyst]` | Codebase questions |

### Spec Agents
| Agent | Role |
|-------|------|
| `[Project_Researcher]` | Codebase analysis |
| `[Requirements_Engineer]` | EARS requirements |
| `[Design_Architect]` | Architecture design |
| `[Task_Planner]` | Task breakdown |
| `[Spec_Validator]` | Consistency validation |

---

## 📄 Subagent Docs

The `subagent-docs/` folder holds detailed task instructions for `runSubagent()` calls:

```javascript
runSubagent(
  description: "Implement login feature",
  prompt: "Read spec at .ouroboros/subagent-docs/login.md. Implement using ARTIFACT blocks."
)
```

This pattern allows complex task context to be passed without bloating the orchestrator's context window.

---

## ⚠️ Important Notes

- **Never edit root templates** — `context-template.md`, `project-arch-template.md` are READ ONLY
- **Never edit spec templates** — `specs/templates/*.md` are READ ONLY  
- **Edit files in `history/`** — Active session states and architecture docs
- **Commit `history/`** — Share context with team via version control
- **Agents MUST read template first** — Before creating ANY file from template
- **Use `subagent-docs/`** — For complex task instructions

---

## Related Files

| File | Location |
|------|----------|
| Core prompt | `.github/copilot-instructions.md` |
| Session prompt | `.github/prompts/ouroboros.prompt.md` |
| Init prompt | `.github/prompts/ouroboros-init.prompt.md` |
| Spec prompt | `.github/prompts/ouroboros-spec.prompt.md` |
| Implement prompt | `.github/prompts/ouroboros-implement.prompt.md` |
| Archive prompt | `.github/prompts/ouroboros-archive.prompt.md` |
