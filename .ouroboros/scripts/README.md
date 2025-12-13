# Ouroboros Enhanced CCL Scripts

> **Version**: 2.1.0 | **Requires**: Python 3.6+ | **Dependencies**: None (stdlib only)

```
    ╭───◯───╮
   ◜  ◉━━◉  ◝
   │   ∞   │    OUROBOROS
   ◟  ◉━━◉  ◞    Continuous Command Loop
    ╰───◯───╯
```

Enhanced terminal input system for the Ouroboros CCL.

### ⚡ Quick Reference

| Action | Shortcut |
|--------|----------|
| **History** | `↑` / `↓` (when on first line) |
| **New Line** | `Enter` or `Ctrl+L` or `Ctrl+J` |
| **Submit** | `Ctrl+D` (force) or `>>>` to end |
| **Cancel** | `Ctrl+C` |
| **Multi-line** | Default mode, just type! |

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Command History** | `↑`/`↓` to browse previous commands |
| **Mystic Purple Theme** | Beautiful terminal UI with colors |
| **Real-time Input** | Character-by-character input with live updates |
| **Multi-line Support** | `<<<` / `>>>` blocks or Ctrl+J for newlines |
| **Dynamic InputBox** | Starts as 1 line, grows as you type (up to 10 lines, then scrolls) |
| **Scroll Support** | Viewport scrolling for long input |
| **Status Bar** | Shows mode and cursor position |
| **Selection Menu** | Arrow key navigation with custom input option |
| **Cross-platform** | Windows (msvcrt) / Unix (termios) |
| **Zero Dependencies** | Python stdlib only, no pip install |
| **Auto-generated Config** | Config and history files created automatically |
| **Bracketed Paste** | Reliable paste detection via terminal protocol (IME-friendly) |
| **File Drag & Drop** | Dropped files display as `[ filename.ext ]` (full path to AI) |

---

## 🚀 Quick Start

**Option 1: Double-Click**
- **Windows**: `toggle.bat`
- **Mac/Linux**: `toggle.sh` (run `chmod +x toggle.sh` first)

**Option 2: Command Line**
```bash
python .ouroboros/scripts/ouroboros_toggle.py --mode enhanced
```

---

## ⌨️ Key Bindings

| Key | Action |
|-----|--------|
| `↑` / `↓` | Browse command history (first line) / Navigate (multi-line) |
| `←` / `→` | Move cursor left/right |
| `Enter` | Insert new line |
| `Ctrl+L` / `Ctrl+J` | Insert new line (alternative) |
| `Ctrl+D` | Force submit (always works) |
| `<<<` ... `>>>` | Legacy multi-line block (still works) |
| `>>>` | Submit and exit |
| `Ctrl+C` | Cancel |
| `Ctrl+U` | Clear current line |
| `Ctrl+K` | Delete to end of line |
| `Home` / `End` | Line start/end |
| `Delete` | Delete at cursor |

> **Note**: True `Shift+Enter` detection is impossible in most terminals.
> Use `Ctrl+J` or just `Enter` to insert new lines.

---

## 📁 Files

| File | Purpose |
|------|---------|
| `ouroboros_input.py` | Main input handler (v2.0) with history support |
| `ouroboros_keybuffer.py` | Cross-platform keyboard input |
| `ouroboros_ui.py` | UI components (boxes, menus, theme) |
| `ouroboros_toggle.py` | Mode switcher (default ↔ enhanced) |
| `ouroboros.config.json` | Configuration (auto-generated) |
| `ouroboros.history` | Command history (auto-generated) |
| `toggle.bat` / `toggle.sh` | Quick launch scripts |

---

## 🎨 UI Components

### WelcomeBox
Shows the Ouroboros logo and keyboard shortcuts.

### InputBox
- Auto-stretches to full terminal width
- Line numbers with syntax highlighting
- Scroll indicator when content exceeds viewport
- Status bar showing mode and cursor position
- Truncation indicator for long lines
- Dynamic height based on terminal size

### SelectMenu
- Arrow key navigation
- Number quick-select (1-9)
- Custom input option
- Home/End for quick navigation

### OutputBox
- Clean formatted output for AI consumption
- Separates UI (stderr) from content (stdout)

---

## 🔧 Usage Examples

### Type A: Standard CCL Input
```bash
python .ouroboros/scripts/ouroboros_input.py
```

### Type B: Selection Menu
```bash
python .ouroboros/scripts/ouroboros_input.py \
  --options "Option A" "Option B" "Option C" \
  --prompt "Choose one:"
```

### Type C: Simple Prompt
```bash
python .ouroboros/scripts/ouroboros_input.py \
  --prompt "Enter feature name:" \
  --var feature
```

### All Arguments
```
--var NAME       Variable name for output markers (default: task)
--prompt TEXT    Custom prompt text
--header TEXT    Header/menu to display
--options LIST   Options for selection menu
--no-custom      Disable custom input in selection
--no-ui          Disable fancy UI
--no-color       Disable ANSI colors
--ascii          Use ASCII instead of Unicode
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  User types in terminal                                     │
│         ↓                                                   │
│  ouroboros_keybuffer.py                                     │
│  ├── Platform detection (Windows/Unix)                      │
│  ├── Raw keyboard input (msvcrt/termios)                    │
│  └── Key normalization (arrows, modifiers)                  │
│         ↓                                                   │
│  ouroboros_input.py                                         │
│  ├── ConfigManager (auto-generated config)                  │
│  ├── HistoryManager (command history with ↑/↓)              │
│  ├── TextBuffer (multi-line editing)                        │
│  ├── Mode management (INPUT/PASTE)                           │
│  └── Input validation                                       │
│         ↓                                                   │
│  ouroboros_ui.py                                            │
│  ├── ANSI escape codes                                      │
│  ├── Box drawing (InputBox, WelcomeBox, etc.)               │
│  └── Theme (Mystic Purple)                                  │
│         ↓                                                   │
│  Output separation:                                         │
│  ├── stderr → UI decorations (user sees)                    │
│  └── stdout → Clean content (AI reads)                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Dependencies

**None!** Uses only Python standard library:

| Module | Platform | Purpose |
|--------|----------|---------|
| `sys`, `os` | All | System interaction |
| `json` | All | Config file handling |
| `time` | All | Timing for paste detection |
| `argparse` | All | CLI argument parsing |
| `shutil` | All | Terminal size detection |
| `unicodedata` | All | Character width calculation |
| `re` | All | ANSI code stripping |
| `msvcrt` | Windows | Raw keyboard input |
| `tty`, `termios`, `select` | Unix | Raw keyboard input |

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Colors not showing | Use `--no-color` or update terminal |
| Boxes look broken | Use `--ascii` for ASCII fallback |
| Ctrl+J not working | Some terminals intercept it; use `<<<`/`>>>` |
| Cursor position wrong | Terminal may not support ANSI; try different terminal |

---

## 📜 License

Part of the Ouroboros project. MIT License.

---

---

## 🧪 Testing

Run the test suite to verify everything works:

```bash
cd .ouroboros/scripts/test
python run_all_tests.py --quick   # Run all automated tests
```

| Test File | Coverage |
|-----------|----------|
| `test_ui.py` | UI components (visible_len, ANSI, themes, BOX) |
| `test_keybuffer.py` | Keyboard input (Windows/Linux/Mac key codes) |
| `test_textbuffer.py` | Text buffer (cursor, insert, delete, scroll) |
| `test_input_types.py` | Menu detection, [y/n] prompts |
| `test_edge_cases.py` | Boundary conditions, Unicode, stress tests |
| `test_keys.py` | Interactive keyboard diagnostics |

---

*◎ Enhanced input for the Ouroboros CCL system*
