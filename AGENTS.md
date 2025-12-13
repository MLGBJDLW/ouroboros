# AGENTS.md — Ouroboros Development Guidelines

> **For AI assistants working on this project.** These rules ensure consistency with the Ouroboros architecture.

---

## 🎯 Project Overview

Ouroboros is a **persistent context system for GitHub Copilot** that reduces redundant conversations and maximizes subscription value through:

- **Continuous Command Loop (CCL)** — AI never terminates, always waits for next input
- **Hub-and-Spoke Architecture** — One orchestrator delegates to specialized subagents
- **Persistent Memory** — Context stored in `.ouroboros/history/context-*.md`

---

## 🏗️ Architecture Constraints

### Hub-and-Spoke Model (STRICT)

```
User → ouroboros (Main Orchestrator) → Subagents → Return to Orchestrator
```

| Layer | Agents | Role |
|-------|--------|------|
| **Orchestrator** | `ouroboros` | ONLY agent users interact with. Delegates ALL work. |
| **Sub-Orchestrators** | `ouroboros-init`, `ouroboros-spec`, `ouroboros-implement`, `ouroboros-archive` | Workflow coordinators. Also delegate, never code directly. |
| **Workers** | `ouroboros-coder`, `ouroboros-qa`, `ouroboros-writer`, `ouroboros-analyst`, `ouroboros-devops`, `ouroboros-security` | Execute actual work. |
| **Spec Workers** | `ouroboros-researcher`, `ouroboros-requirements`, `ouroboros-architect`, `ouroboros-tasks`, `ouroboros-validator` | Spec phase specialists. |

**RULES:**
- Main orchestrator (`ouroboros`) CANNOT read/edit files directly — must delegate
- Sub-orchestrators CANNOT write code — must delegate to workers
- ALL subagents MUST return to orchestrator via `handoff` after task completion
- Users should NEVER invoke subagents directly (except workflow sub-orchestrators via slash commands)

### Continuous Command Loop (CCL) — MANDATORY

Every orchestrator response MUST end with `run_command` tool executing one of the **Five Output Types**:

| Type | When | Command Format |
|------|------|----------------|
| **Type A: TASK** | Request next task | `python -c "task = input('[Ouroboros] > ')"` |
| **Type B: MENU** | Display options | `python -c "print('[1]...'); print('[2]...'); choice = input('Select: ')"` |
| **Type C: FEATURE** | Free-form input | `python -c "feature = input('Feature: ')"` |
| **Type D: CONFIRM** | Yes/No decision | `python -c "print('[y] Yes'); print('[n] No'); confirm = input('Confirm: ')"` |
| **Type E: QUESTION** | Ask clarification | `python -c "question = input('Question? ')"` |

**CCL Rules:**
- Execute CCL via `run_command` tool **AFTER** every response
- Execute CCL **EVEN IF** task seems complete
- Execute CCL **EVEN IF** user says "thanks"
- **ONLY** skip CCL if user explicitly says: `stop`, `exit`, `end`, `terminate`
- **MUST** use `run_command` tool — NOT just print text

### Subagent Delegation — MANDATORY `runSubagent()`

Orchestrators MUST use `runSubagent()` to delegate work. Direct tool calls are FORBIDDEN.

```javascript
runSubagent(
  agent: "ouroboros-[name]",
  prompt: `
    ## Context
    [Relevant project state]
    
    ## Task
    [Specific action required]
    
    ## Constraints
    - [Constraint 1]
    - [Constraint 2]
    
    ## Expected Output
    [What to return]
  `
)
```

**Delegation Rules:**
- **ALWAYS** use `runSubagent()` — never call tools directly from orchestrator
- **ALWAYS** include context, task, constraints, and expected output
- **NEVER** say "I will delegate..." without immediately calling `runSubagent()`

### Return Protocol (MANDATORY)

All subagents MUST:
1. Output `[TASK COMPLETE]` marker when done
2. Use `handoff` to return control to orchestrator
3. **NEVER** use conversation-ending phrases
4. If handoff fails → Execute CCL as fallback

---

## 📁 File Structure (DO NOT MODIFY)

```
.github/
├── copilot-instructions.md    ← Global rules (inherited by ALL agents)
├── agents/                    ← Agent definitions (16 total)
│   ├── ouroboros.agent.md     ← MAIN ORCHESTRATOR
│   ├── ouroboros-*.agent.md   ← Subagents
└── prompts/                   ← Slash command entry points

.ouroboros/
├── templates/                 ← READ-ONLY templates
├── history/                   ← Persistent context files
├── specs/                     ← Feature specifications
│   ├── templates/             ← Spec templates
│   └── archived/              ← Completed specs
├── subagent-docs/             ← Long output storage (>500 lines)
├── scripts/                   ← Enhanced CCL input system
└── workflows/                 ← Workflow definitions
```

---

## 🚫 Forbidden Patterns

### Forbidden Phrases (ALL agents)

- ❌ "Let me know if you need anything else"
- ❌ "Feel free to ask"
- ❌ "Is there anything else"
- ❌ "Hope this helps" / "Happy coding" / "Good luck"
- ❌ ANY phrase suggesting conversation end

### Forbidden Actions

| Agent Type | Forbidden |
|------------|-----------|
| **Orchestrator** | `read_file`, `edit_file`, `grep`, terminal commands (except CCL) |
| **Sub-Orchestrators** | `edit` (must delegate to workers) |
| **Workers** | Writing to `.ouroboros/` (except `subagent-docs/`) |

---

## ⚡ Action-Commitment Rule

**SAY = DO** — If an agent announces an action, it MUST execute immediately.

| If Agent Says | Agent MUST |
|---------------|------------|
| "Delegating to X" | Call `runSubagent()` immediately |
| "Dispatching to agent" | `runSubagent()` executes NOW |
| "Reading file X" | Execute `read` tool immediately |
| "Running tests" | Execute `execute` tool immediately |
| "Executing CCL" | Execute `run_command` tool immediately |
| "Updating context" | Delegate to `ouroboros-writer` via `runSubagent()` |

**NEVER** describe an action without executing it.

**WRONG:**
```
I will delegate this to ouroboros-coder.
[Response ends - NO tool call]
```

**CORRECT:**
```
Delegating to ouroboros-coder:
[runSubagent() tool call executes immediately]
```

---

## 🔧 Development Guidelines

### When Modifying Agents

1. **Preserve YAML frontmatter** — `description`, `tools`, `handoffs` are required
2. **Maintain tool lockdown** — Each agent has specific tool permissions
3. **Keep CCL enforcement** — Orchestrators must always end with CCL
4. **Preserve return protocol** — All subagents must handoff back

### When Adding New Agents

1. Follow naming convention: `ouroboros-[role].agent.md`
2. Include handoffs to ALL orchestrators (main + sub-orchestrators)
3. Define tool permissions explicitly
4. Add routing keywords to `copilot-instructions.md`
5. Create corresponding prompt file in `.github/prompts/` if user-invokable

### When Modifying Templates

Templates in `.ouroboros/templates/` and `.ouroboros/specs/templates/` are READ-ONLY references. Agents copy them to working directories before modification.

---

## 🧪 Testing Requirements

- Enhanced CCL scripts have tests in `.ouroboros/scripts/test/`
- Run tests: `python .ouroboros/scripts/test/run_all_tests.py --quick`
- All Python code must work with Python 3.6+ (standard library only)

---

## 📋 Key Protocols Reference

| Protocol | Location | Purpose |
|----------|----------|---------|
| CCL Protocol | `copilot-instructions.md` | Continuous input loop |
| Return Protocol | `copilot-instructions.md` | Subagent → Orchestrator handoff |
| Tool Lockdown | Each `*.agent.md` | Per-agent tool permissions |
| Spec Workflow | `ouroboros-spec.agent.md` | 5-phase spec process |
| Task Batching | `ouroboros-implement.agent.md` | 4-5 tasks per batch |
| Fix-Verify Cycle | `ouroboros-qa.agent.md` | Debug → Test → Fix → Verify |

---

## 🌐 Language

**MIRROR USER LANGUAGE** — Reply in the same language the user uses.

---

♾️ **The Serpent Consumes Its Tail. The Loop Never Ends.** ♾️
