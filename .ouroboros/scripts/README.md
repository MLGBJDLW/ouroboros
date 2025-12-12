# Ouroboros Enhanced CCL Scripts

> **Version**: 1.1.0 | **Requires**: Python 3.6+

This directory contains the Enhanced Continuous Command Loop (CCL) input system.

---

## Quick Start

**Option 1: Double-Click (Recommended)**

- **Windows**: Double-click `.ouroboros/scripts/toggle.bat`
- **Mac/Linux**: Double-click `.ouroboros/scripts/toggle.sh` (run `chmod +x toggle.sh` first)

**Option 2: Command Line**

```bash
# Interactive menu
python .ouroboros/scripts/ouroboros_toggle.py

# Direct commands
python .ouroboros/scripts/ouroboros_toggle.py --mode enhanced
python .ouroboros/scripts/ouroboros_toggle.py --mode default
python .ouroboros/scripts/ouroboros_toggle.py --status
```

---

## Files

| File | Purpose |
|------|---------|
| `ouroboros_input.py` | Enhanced input handler with UI |
| `ouroboros_toggle.py` | Mode switcher (default ↔ enhanced) |
| `ouroboros.config.json` | Cached environment settings |
| `ouroboros.history` | Command history storage |

---

## How It Works

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  User types in terminal                                     │
│         ↓                                                   │
│  ouroboros_input.py                                         │
│  ├── Display UI → stderr (user sees beautiful prompt)       │
│  ├── Get input from user                                    │
│  ├── Detect: paste / multi-line / file path                 │
│  ├── Compress display for large pastes                      │
│  └── Output formatted → stdout (Copilot reads clean text)   │
│         ↓                                                   │
│  Copilot receives clean markers:                            │
│  === TASK START ===                                         │
│  user's actual content                                      │
│  === TASK END ===                                           │
└─────────────────────────────────────────────────────────────┘
```

### Output Separation (Key Principle)

| Stream | Content | Reader |
|--------|---------|--------|
| `stderr` | UI decorations, colors, boxes | User only |
| `stdout` | Clean formatted markers | Copilot |

This ensures Copilot never sees UI decorations.

---

## Features

### ✅ Advantages

| Feature | Benefit |
|---------|---------|
| **Mystic Purple Theme** | Beautiful, branded terminal UI |
| **Display Compression** | Large pastes show summary preview |
| **Auto Multi-line Detection** | No need to type `<<<` manually |
| **File Detection** | Recognizes dragged images/files |
| **Command History** | Recalls previous commands (↑/↓ on Linux/Mac) |
| **Config Caching** | Fast startup after first run |
| **Zero Dependencies** | Python stdlib only, no pip install |
| **Cross-platform** | Windows, Linux, macOS |

### ⚠️ Limitations

| Limitation | Reason | Workaround |
|------------|--------|------------|
| No Shift+Enter for manual newlines | Python `input()` can't detect key modifiers | Auto-detected for pastes; use `<<<` for manual |
| No ↑/↓ on Windows | No readline built-in | History saved to file |
| No Tab completion | Out of scope | Type full commands |
| Terminal-dependent | Some old terminals lack ANSI/Unicode | Fallback to ASCII |

---

## Input Types Supported

| Type | Usage | Output Marker |
|------|-------|---------------|
| **A (CCL)** | Default mode | `=== TASK START ===` |
| **B (Menu)** | `--var choice` | `=== CHOICE START ===` |
| **C (Feature)** | `--var feature` | `=== FEATURE START ===` |
| **D (Confirm)** | `--var confirm --no-ui` | `=== CONFIRM START ===` |
| **E (Question)** | `--var question` | `=== QUESTION START ===` |

---

## Usage Examples

### Type A: Standard CCL Input
```bash
python .ouroboros/scripts/ouroboros_input.py
```

### Type B: Menu Selection
```bash
python .ouroboros/scripts/ouroboros_input.py \
  --header "[1] Option A\n[2] Option B" \
  --prompt "Choice (1-2):" \
  --var choice
```

### Type D: Confirmation
```bash
python .ouroboros/scripts/ouroboros_input.py \
  --prompt "[y/n]:" \
  --var confirm \
  --no-ui
```

### All Arguments
```bash
python .ouroboros/scripts/ouroboros_input.py --help

Options:
  --prompt TEXT    Custom prompt text
  --header TEXT    Header/menu to display before prompt
  --var NAME       Variable name for output markers (default: task)
  --no-ui          Disable fancy border/box
  --no-color       Disable ANSI colors
  --ascii          Use ASCII instead of Unicode
  --reset-config   Force re-detect environment
```

---

## Toggle Script

Switch between default (`python -c`) and enhanced modes.

```bash
# Show current mode
python .ouroboros/scripts/ouroboros_toggle.py --status

# Preview changes without applying
python .ouroboros/scripts/ouroboros_toggle.py --dry-run

# Switch to enhanced mode
python .ouroboros/scripts/ouroboros_toggle.py --mode enhanced

# Switch back to default
python .ouroboros/scripts/ouroboros_toggle.py --mode default
```

**Backup**: Before modifying files, a backup is created in `.ouroboros/scripts/backups/`.

---

## Requirements

- **Python 3.6+** (standard library only)
- **No pip install needed**
- Works on: Windows 10+, Linux, macOS

---

## Configuration

Auto-generated on first run: `ouroboros.config.json`

```json
{
  "platform": "windows",
  "ansi_colors": true,
  "unicode_box": true,
  "theme": "mystic_purple",
  "auto_multiline": true,
  "compress_threshold": 10
}
```

Reset with: `python ouroboros_input.py --reset-config`

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Colors not showing | Add `--no-color` or update terminal |
| Boxes look broken | Add `--ascii` for ASCII fallback |
| History not working on Windows | Normal - Windows lacks readline |
| Script not found | Run from repo root |

---

*♾️ Enhanced input for the Ouroboros system*
