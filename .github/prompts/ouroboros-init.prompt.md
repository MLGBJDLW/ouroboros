# /ouroboros-init — Project Initialization

> **Inherits**: All rules from `ouroboros.prompt.md`
> **Purpose**: First-time project research and architecture documentation

---

## 🎯 Objective

Initialize Ouroboros for a new project by:
1. Researching the project structure and architecture
2. Creating `project-arch.md` from template
3. Setting up `history/context-YYYY-MM-DD.md`

---

## 📋 Initialization Checklist

### Phase 1: Project Research

```
runSubagent(
  description: "Research project architecture",
  prompt: "
    You are [Project_Researcher] - Codebase archaeologist.
    
    TASK:
    1. Scan the project root directory structure
    2. Identify: language, framework, build tools, package manager
    3. Find entry points and key configuration files
    4. Detect architecture patterns (MVC, microservices, monolith, etc.)
    5. List main dependencies from lockfiles
    
    OUTPUT:
    Create .ouroboros/project-arch.md by copying from project-arch-template.md
    and filling in ALL sections with your findings.
    
    CONSTRAINT: Read-only analysis. Do NOT modify any project files.
  "
)
```

### Phase 2: Context Initialization

```
runSubagent(
  description: "Initialize session context",
  prompt: "
    You are [Tech_Writer] - Documentation specialist.
    
    TASK:
    1. Copy .ouroboros/context-template.md → .ouroboros/history/context-YYYY-MM-DD.md
    2. Fill in Tech Stack section based on project-arch.md findings
    3. Set Current Goal to: 'Project initialized, awaiting first task'
    
    OUTPUT: Updated context file in history/
  "
)
```

### Phase 3: Confirmation

After both phases complete:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ OUROBOROS INITIALIZED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📁 Project: [project name]
🏗️ Architecture: [detected pattern]
🛠️ Tech Stack: [key technologies]
📄 Created:
   - .ouroboros/project-arch.md
   - .ouroboros/history/context-YYYY-MM-DD.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Then execute CCL:
```python
python -c "task = input('[Ouroboros] > ')"
```

---

## ⚠️ Skip Conditions

If `.ouroboros/project-arch.md` already exists with status ≠ "NOT INITIALIZED":
- Skip Phase 1 (already researched)
- Proceed to normal session flow

---

## 🔄 Re-initialization

To force re-research (e.g., after major refactoring):
```
/ouroboros-init --force
```
This will overwrite existing `project-arch.md`.
