# 🐍 .ouroboros/ — The Serpent's Nest

This folder is the **persistent memory core** of Project Ouroboros.

## 📁 Structure

```
.ouroboros/
├── context-template.md   # 📋 Clean template (do not edit directly)
├── README.md             # 📖 This file
├── history/              # 📜 Active session contexts
│   └── context-YYYY-MM-DD.md
└── specs/                # 📋 Feature specifications (NEW!)
    ├── templates/        # Template files
    ├── archived/         # Completed specs (timestamped)
    └── [feature-name]/   # Active feature specs
```

## 🔄 How It Works

### On First Session
1. Agent copies `context-template.md` → `history/context-YYYY-MM-DD.md`
2. Agent updates the new file with current goal, tech stack, etc.
3. Subsequent updates go to this file

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

## 📋 Specs System

Use **Spec-Driven Development** for complex features:

### Slash Commands

| Command | Purpose |
|---------|---------|
| `/ouroboros-spec` | Create spec (Requirements → Design → Tasks) |
| `/ouroboros-implement` | Execute tasks.md automatically |
| `/ouroboros-archive` | Archive completed specs |

### Workflow

1. **`/ouroboros-spec`** - Describe your feature
   - `[Requirements_Engineer]` → `requirements.md`
   - `[Design_Architect]` → `design.md`
   - `[Task_Planner]` → `tasks.md`

2. **`/ouroboros-implement`** - Execute tasks
   - Reads `tasks.md`
   - Routes to Ouroboros agents
   - Updates checkboxes on completion

3. **`/ouroboros-archive`** - Archive when done
   - Moves to `specs/archived/[feature-YYYY-MM-DD]/`
   - Generates summary

---

## ⚠️ Important Notes

- **Never edit `context-template.md`** — It's the clean template for cloning
- **Edit files in `history/`** — These are the active session states
- **Commit `history/`** — Share context with team via version control
- **Use `specs/templates/`** — Reference for creating new specs

