# Ouroboros System Limitations

> **Note**: This document describes inherent platform constraints that cannot be addressed by code changes.

---

## 1. Mode Switching (Simulated Only)

### Limitation
GitHub Copilot does not support true agent switching at runtime. When you type `/ouroboros-spec`, Copilot cannot actually "become" a different agent mid-conversation.

### Workaround
**Simulated mode switching** — The LLM reads the corresponding `.agent.md` file and *adopts* that behavior. This is implemented via the `SLASH COMMAND RECOGNITION` protocol in `copilot-instructions.md`.

| What Works | What Doesn't |
|------------|--------------|
| LLM reads agent file and follows its rules | True agent isolation (separate context) |
| Behavior changes according to agent persona | Automatic tool permission changes |
| Works for L0/L1 orchestrators | N/A for L2 workers (by design) |

---

## 2. Terminal Input Detection

### Limitation
Standard terminals cannot detect **Shift+Enter** as distinct from **Enter**. This is a fundamental limitation of terminal emulators like Windows Terminal, iTerm2, and most others.

### Workaround
- Use `Ctrl+D` for force submit
- Use `>>>` marker to end multi-line input
- Use `Ctrl+J` or `Ctrl+L` for explicit newline

---

## 3. Bracketed Paste Mode

### Limitation
Not all terminals support [Bracketed Paste Mode](https://cirw.in/blog/bracketed-paste). When unsupported, rapid input detection is used as a fallback, which may occasionally misdetect fast typing as paste.

### Supported Terminals
| Terminal | Support |
|----------|---------|
| Windows Terminal | ✅ |
| iTerm2 | ✅ |
| GNOME Terminal | ✅ |
| VS Code Terminal | ⚠️ Partial |
| cmd.exe (legacy) | ❌ |

---

## 4. Subagent Return Control

### Limitation
Subagents invoked via `runSubagent()` cannot programmatically "return" to the parent agent. The return is simulated via the `handoff` tool and `[TASK COMPLETE]` markers.

### Workaround
All agents follow the **Subagent Return Protocol**:
```
handoff("ouroboros", "[TASK COMPLETE] Summary of what was done")
```

The main orchestrator then reads this and resumes control.

---

## 5. Context Window Degradation

### Limitation
Long conversations degrade LLM performance. This is inherent to transformer-based models and cannot be fixed.

### Mitigation
- **Context files** in `.ouroboros/history/` preserve state
- **Milestone-based updates** reduce redundant context
- **Subagent specs** in `.ouroboros/subagent-docs/` are transient (auto-deleted after 3 days)

---

## 6. File Path Detection

### Limitation
The system uses heuristics to detect file paths, which may occasionally:
- Miss paths without extensions
- Misidentify text containing `/` or `\` as paths

### Current Heuristics
- Windows: `C:\path\file.ext`
- Unix: `/path/file.ext` (excludes `/ouroboros*` for slash commands)
- Relative: `./file.ext`, `../file.ext`
- Home: `~/path/file.ext`

---

## 7. IME (Input Method Editor) Support

### Limitation
Real-time character input conflicts with IME composition (Chinese, Japanese, Korean). Characters may appear incorrect during composition.

### Workaround
Set `use_fallback_input: true` in `ouroboros.config.json`:
```json
{
  "use_fallback_input": true
}
```

This switches to standard `input()` which has full IME support.

---

## Summary

| Limitation | Impact | Workaround Available |
|------------|--------|---------------------|
| Mode switching | Simulated only | ✅ Behavior adoption |
| Shift+Enter | Not detectable | ✅ Ctrl+D / >>> |
| Bracketed Paste | Terminal-dependent | ✅ Rapid input fallback |
| Subagent return | Simulated | ✅ Handoff protocol |
| Context window | Degrades over time | ✅ Context files |
| File detection | Heuristic-based | ⚠️ Manual correction |
| IME support | Conflicts with real-time | ✅ Fallback mode |

---

*These limitations are inherent to the platform and documented for transparency.*
