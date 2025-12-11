# /ouroboros-init — Project Initialization

> **Inherits**: All rules from `ouroboros.prompt.md`
> **Purpose**: First-time project research and architecture documentation

---

## 🎯 Objective

Initialize Ouroboros for a new project by:
1. Researching the project structure and architecture
2. Creating `history/project-arch-YYYY-MM-DD.md` from template
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
    1. **READ TEMPLATE FIRST**: `.ouroboros/templates/project-arch-template.md`
    2. Scan the project root directory structure
    3. Identify: language, framework, build tools, package manager
    4. Find entry points and key configuration files
    5. Detect architecture patterns (MVC, microservices, monolith, etc.)
    6. List main dependencies from lockfiles
    
    OUTPUT:
    Create `.ouroboros/history/project-arch-YYYY-MM-DD.md` following the template structure,
    filling in ALL sections with your findings.
    
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
    1. **READ TEMPLATE FIRST**: `.ouroboros/templates/context-template.md`
    2. Create `.ouroboros/history/context-YYYY-MM-DD.md` following the template structure
    3. Fill in Tech Stack section based on project-arch findings
    4. Set Current Goal to: 'Project initialized, awaiting first task'
    
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
   - .ouroboros/history/project-arch-YYYY-MM-DD.md
   - .ouroboros/history/context-YYYY-MM-DD.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Then execute CCL:
```python
python -c "task = input('[Ouroboros] > ')"
```

---

## ⚠️ Skip Conditions

If `.ouroboros/history/project-arch-*.md` already exists with status ≠ "NOT INITIALIZED":
- Skip Phase 1 (already researched)
- Proceed to normal session flow

---

## 🔄 Re-initialization

To force re-research (e.g., after major refactoring):
```
/ouroboros-init --force
```
This will create a new `history/project-arch-YYYY-MM-DD.md`.
