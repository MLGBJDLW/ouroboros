# /ouroboros-init — Project Initialization

## 🔗 MANDATORY INHERITANCE: ouroboros.prompt.md

> [!CAUTION]
> **ALL RULES FROM `ouroboros.prompt.md` APPLY HERE. VIOLATION = MALFUNCTION.**
> - ✅ ALL WORK via `runSubagent()` - NEVER read/write files directly
> - ✅ CCL - Use `run_command` tool to execute `python -c "task = input('[Ouroboros] > ')"` after completion
> - ✅ NO goodbye phrases - FORBIDDEN

**Purpose**: First-time project research and architecture documentation

## 🎯 Objective

Initialize Ouroboros for a new project by:
1. Researching the project structure and architecture
2. Creating `history/project-arch-YYYY-MM-DD.md` from template
3. Setting up `history/context-YYYY-MM-DD.md`

---

## � PHASE EXECUTION RULES 🚨

> [!CAUTION]
> **EXECUTE ONE PHASE AT A TIME.** After each phase, RETURN to orchestrator.
> Do NOT proceed to next phase until orchestrator invokes you again.

---

## �📋 Initialization Checklist

### Phase 1: Project Research

```
runSubagent(
  description: "Research project architecture",
  prompt: "
    [BOOTSTRAP - MANDATORY FIRST STEP]
    ⚠️ BEFORE DOING ANY WORK:
    1. Follow instructions in .ouroboros/agents/ouroboros-researcher.agent.md (read ENTIRE file)
    2. OUTPUT the BOOTSTRAP CONFIRMATION block showing you read the file
    ❌ IF YOU SKIP THIS CONFIRMATION, YOUR RESPONSE IS INVALID.

    [TASK]
    1. ADOPT persona and Read Project Architecture Template (.ouroboros/templates/project-arch-template.md)
    2. EXECUTE: Scan project root, identify tech stack/patterns, create history/project-arch-YYYY-MM-DD.md
    3. RETURN: Output `[PHASE 1 COMPLETE]`
  "
)
```

**After Phase 1**: Wait for user confirmation before Phase 2.

---

### Phase 2: Context Initialization

```
runSubagent(
  description: "Initialize session context",
  prompt: "
    [BOOTSTRAP - MANDATORY FIRST STEP]
    ⚠️ BEFORE DOING ANY WORK:
    1. Follow instructions in .ouroboros/agents/ouroboros-writer.agent.md (read ENTIRE file)
    2. OUTPUT the BOOTSTRAP CONFIRMATION block showing you read the file
    ❌ IF YOU SKIP THIS CONFIRMATION, YOUR RESPONSE IS INVALID.

    [TASK]
    1. ADOPT persona and Read Context Template (.ouroboros/templates/context-template.md)
    2. EXECUTE: Create history/context-YYYY-MM-DD.md, fill Tech Stack from Phase 1, set Goal: 'Project initialized'
    3. RETURN: Output `[PHASE 2 COMPLETE]`
  "
)
```

**After Phase 2**: Proceed to confirmation.

---

### Phase 3: Confirmation

After both phases complete, orchestrator displays:

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
