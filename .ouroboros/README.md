# 🐍 .ouroboros/ — The Serpent's Nest

This directory serves as the **persistent memory** and **state management core** of Project Ouroboros. All executable agents and prompts reside in `.github/agents/` and `.github/prompts/`. This folder stores context, templates, and history that make the AI "smart" and persistent.

---

## 📁 Directory Structure

```
.ouroboros/
├── README.md                  # 📖 This file
├── templates/                 # 📋 READ-ONLY Templates (Do Not Edit)
│   ├── context-template.md    # Base structure for session context
│   └── project-arch-template.md # Base structure for architecture docs
├── history/                   # 📜 Active Session Memory
│   ├── context-YYYY-MM-DD.md  # The system's current "brain"
│   ├── project-arch-YYYY-MM-DD.md # Current architecture state
│   └── archived/              # Old/stale history files (>7 days)
├── specs/                     # 📋 Spec-Driven Development Files
│   ├── templates/             # 📋 READ-ONLY Spec Templates
│   │   ├── research-template.md
│   │   ├── requirements-template.md
│   │   ├── design-template.md
│   │   ├── tasks-template.md
│   │   └── validation-template.md
│   ├── archived/              # Finished/closed specs
│   └── [feature-name]/        # ACTIVE Feature Specs
│       ├── research.md        # Phase 1: Research
│       ├── requirements.md    # Phase 2: Requirements
│       ├── design.md          # Phase 3: Design
│       ├── tasks.md           # Phase 4: Tasks
│       └── validation-report.md # Phase 5: Validation
├── scripts/                   # 🎨 Enhanced CCL Input (Optional)
│   ├── ouroboros_input.py     # Enhanced input handler
│   ├── ouroboros_toggle.py    # Mode toggle script
│   ├── ouroboros.config.json  # Cached environment config
│   ├── ouroboros.history      # Command history
│   └── README.md              # Full documentation
└── subagent-docs/             # 📄 Transient Subagent Outputs
    └── [agent]-[task]-YYYY-MM-DD.md
```

---

## 🧠 Core Components

### 1. `templates/` (READ ONLY)
These files act as the "DNA" for new sessions.
*   **Protocol**: The AI receives strict instructions **NEVER** to edit these files.
*   **Usage**: On a fresh start, the AI reads `context-template.md` to understand *how* to structure its memory, then writes a new file to `history/`.

### 2. `history/` (ACTIVE MEMORY)
This is where the AI lives.
*   **`context-*.md`**: Contains the current project analysis, goal, technology stack, and recent events. The AI updates this file continuously.
*   **`project-arch-*.md`**: Detailed technical architecture. Updated only when major structural changes occur.
*   **Persistence**: When you start a new chat with `@ouroboros`, it automatically reads the latest file in this folder to restore its state.

### 3. `specs/` (FEATURE WORKFLOWS)
Structured storage for the 5-phase development workflow.
*   **`[feature-name]/`**: Each feature gets its own folder.
*   **Strict File Whitelist**: To prevent clutter, only the 5 specific markdown files (`research.md` through `validation-report.md`) are allowed in these folders.

### 4. `subagent-docs/` (TRANSIENT)
A scratchpad for subagents to dump large analysis.
*   **Purpose**: Prevents polluting the main chat context.
*   **Example**: `ouroboros-analyst` might write a 2000-line dependency tree here. The orchestrator reads the *summary*, but the full data is preserved if needed.
*   **Auto-Cleanup**: Files > 3 days old are automatically deleted.

---

## 🛠️ Usage Protocols

### The Template Pattern
The system strictly distinguishes between "Classes" (Templates) and "Instances" (History).

1.  **Instantiation**: `templates/context-template.md` → `history/context-2025-12-11.md`
2.  **Evolution**: The file in `history/` evolves as the project grows.
3.  **Restoration**: New sessions always load from `history/`.

### Manual User Overrides
If you need to manually injection information into the AI's brain:
1.  **DO NOT** tell the AI in chat (it might forget).
2.  **EDIT** the active file in `history/context-YYYY-MM-DD.md`.
3.  The AI will pick up the changes immediately on the next interaction.

---

## 🎨 Enhanced CCL Input System (Optional)

The Enhanced Continuous Command Loop provides an improved terminal input experience with visual UI, command history, and intelligent content detection.

### Quick Toggle

```bash
# Check current mode
python .ouroboros/scripts/ouroboros_toggle.py --status

# Enable enhanced mode
python .ouroboros/scripts/ouroboros_toggle.py --mode enhanced

# Disable enhanced mode
python .ouroboros/scripts/ouroboros_toggle.py --mode default
```

### ✅ Advantages

| Feature | Description |
|---------|-------------|
| **Mystic Purple Theme** | Beautiful, branded terminal UI with colors |
| **Display Compression** | Large pastes (>10 lines) show compact preview |
| **Auto Multi-line** | Automatically detects pasted content |
| **File Detection** | Recognizes dragged image/video/code files |
| **Command History** | Saves and recalls previous commands |
| **Zero Dependencies** | Python standard library only |

### ⚠️ Limitations

| Limitation | Reason |
|------------|--------|
| No Shift+Enter (manual) | Python `input()` can't detect key modifiers; pastes still auto-detected |
| No ↑/↓ on Windows | Windows lacks readline (history saved to file) |
| Terminal-dependent | Old terminals may lack ANSI/Unicode support |

### Requirements

- Python 3.6+
- No pip install needed
- Works on: Windows 10+, Linux, macOS

### Documentation

See [`.ouroboros/scripts/README.md`](scripts/README.md) for full usage guide.

---

<p align="center">
  <strong>The Memory Persists. The Loop Continues.</strong>
</p>

