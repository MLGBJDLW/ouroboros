# AGENTS.md — Ouroboros Quick Reference

> **For AI assistants.** This file points to detailed documentation.

---

## 📚 Documentation Index

| Document | Location | Purpose |
|----------|----------|---------|
| **Global Rules** | [`.github/copilot-instructions.md`](.github/copilot-instructions.md) | CCL, Return Protocol, Tool Lockdown |
| **Agent Definitions** | [`.github/agents/`](.github/agents/) | All 16 agent files |
| **Slash Commands** | [`.github/prompts/`](.github/prompts/) | User-invokable commands |
| **Templates** | [`.ouroboros/templates/`](.ouroboros/templates/) | READ-ONLY templates |
| **Spec Templates** | [`.ouroboros/specs/templates/`](.ouroboros/specs/templates/) | Spec phase templates |
| **Workflows** | [`.ouroboros/workflows/`](.ouroboros/workflows/) | Workflow definitions |

---

## 🎯 Core Concept (TL;DR)

```
User → ouroboros (Orchestrator) → Subagents → Return to Orchestrator
```

- **Orchestrator** delegates ALL work via `runSubagent()`
- **Subagents** execute work, then `handoff` back
- **CCL** keeps the loop alive — never terminate

---

## ⚡ Critical Rules

1. **Orchestrator CANNOT** read/edit files directly — must delegate
2. **ALL responses** end with CCL (`run_command` tool)
3. **SAY = DO** — If you announce an action, execute it immediately
4. **Mirror user language** — Reply in the same language

---

## 🚫 Forbidden Phrases

- ❌ "Let me know if you need anything else"
- ❌ "Feel free to ask"
- ❌ "Is there anything else"
- ❌ ANY conversation-ending phrase

---

## 📖 For Full Details

**Read:** [`.github/copilot-instructions.md`](.github/copilot-instructions.md)

This contains:
- Complete CCL Protocol (5 output types)
- Hub-and-Spoke architecture details
- Agent routing keywords
- Return protocol
- Artifact protocol
- Context management rules

---

♾️ **The Serpent Consumes Its Tail. The Loop Never Ends.** ♾️
