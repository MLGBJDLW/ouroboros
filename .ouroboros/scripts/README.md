# Ouroboros Enhanced CCL Scripts

> **Version**: 2.2.0 | **Requires**: Python 3.6+ | **Dependencies**: None (stdlib only)

```
    ╭───◯───╮
   ◜  ◉━━◉  ◝
   │   ∞   │    OUROBOROS
   ◟  ◉━━◉  ◞    Enhanced CCL Input System
    ╰───◯───╯
```

Enhanced terminal input system for the Ouroboros Continuous Command Loop.

---

## 🚀 Quick Start

**Double-Click**:
- Windows: `toggle.bat`
- Mac/Linux: `toggle.sh` (run `chmod +x toggle.sh` first)

**Command Line**:
```bash
python ouroboros_toggle.py --mode enhanced   # Enable enhanced mode
python ouroboros_toggle.py --mode default    # Disable enhanced mode
python ouroboros_input.py                    # Run directly
```

---

## ⌨️ Keyboard Shortcuts

### Navigation
| Key | Action |
|-----|--------|
| `←` / `→` | Move cursor left/right |
| `↑` / `↓` | History browse (line 1) / Move cursor (multi-line) |
| `Ctrl+←` / `Ctrl+→` | Jump to previous/next word |
| `Home` / `End` | Jump to line start/end |
| `Ctrl+A` / `Ctrl+E` | Jump to line start/end (alternative) |

### Editing
| Key | Action |
|-----|--------|
| `Backspace` | Delete character before cursor (or entire badge) |
| `Delete` | Delete character at cursor (or entire badge) |
| `Ctrl+V` | Paste from clipboard (auto-detects large pastes) |
| `Ctrl+U` | Clear current line |
| `Ctrl+K` | Delete from cursor to end of line |

### Input Control
| Key | Action |
|-----|--------|
| `Enter` | Insert new line (multi-line mode) |
| `Ctrl+J` | Insert new line (alternative) |
| `Ctrl+D` | Force submit (always works) |
| `>>>` | Submit and exit (type at end) |
| `Ctrl+C` | Cancel and exit |

### Slash Commands
| Key | Action |
|-----|--------|
| `/` | Start command mode (shows dropdown) |
| `↑` / `↓` | Navigate command suggestions |
| `Tab` | Complete selected command |
| `Escape` | Cancel command mode |

---

## ✨ Features

### Arrow Key Navigation
Full cursor movement support in Windows VS Code Terminal, including:
- Basic arrow keys (Up/Down/Left/Right)
- Ctrl+Arrow for word jumping
- Home/End for line navigation

### Slash Command Autocomplete
Type `/` to see available orchestrator commands:

| Command | Description |
|---------|-------------|
| `/ouroboros` | Main Orchestrator |
| `/ouroboros-init` | Project Initialization |
| `/ouroboros-spec` | Spec Workflow (5 phases) |
| `/ouroboros-implement` | Task Implementation |
| `/ouroboros-archive` | Archive Management |

Features:
- Fuzzy matching: `/spec` finds `/ouroboros-spec`
- Dropdown display with descriptions
- Arrow key navigation
- Tab completion with auto-space

### File & Folder Drag & Drop
Drag files or folders into the terminal:
- Display: `[ filename.ext ]` or `[ foldername ]` (compact badge)
- Storage: Full path sent to AI
- Supports Windows paths (`C:\...`) and Unix paths (`/...`)
- Folders are detected automatically (no extension required)

### Clipboard Paste (Ctrl+V)
Reliable paste detection by reading clipboard directly:
- Press `Ctrl+V` to paste from clipboard
- Large pastes (5+ lines) show as `[ Pasted N Lines ]` badge
- Full content preserved and sent to AI on submit
- Cross-platform: Windows (ctypes), macOS (pbpaste), Linux (xclip/xsel)

### Atomic Badge Deletion
File path and paste badges can be deleted atomically:
- `Backspace` after a badge deletes the entire badge at once
- `Delete` before a badge deletes the entire badge at once
- No need to delete character by character

### Arrow Key Badge Navigation
Cursor automatically skips past badge internals:
- `←` before badge end jumps to badge start
- `→` after badge start jumps to badge end
- Cursor never gets "stuck" inside badge markers

### Dynamic Input Box
- Starts as 1 line
- Grows automatically as you type (up to 10 lines)
- Internal scrolling for longer content
- Line numbers and status bar

### Command History
- `↑`/`↓` to browse previous commands (when on first line)
- Persistent across sessions (saved to `ouroboros.history`)

---

## 📁 Module Architecture

| Module | Lines | Purpose |
|--------|-------|---------|
| `ouroboros_input.py` | ~1200 | Main input handler, orchestrates all modules |
| `ouroboros_keybuffer.py` | ~1270 | Cross-platform keyboard input |
| `ouroboros_ui.py` | ~800 | UI components (InputBox, WelcomeBox, SelectMenu) |
| `ouroboros_paste.py` | ~450 | Bracketed Paste Mode for reliable paste detection |
| `ouroboros_buffer.py` | ~180 | Multi-line text buffer with cursor management |
| `ouroboros_commands.py` | ~130 | Slash command handler and autocomplete |
| `ouroboros_filepath.py` | ~450 | File path detection, paste markers, badge formatting |
| `ouroboros_clipboard.py` | ~170 | Cross-platform clipboard reading (Win/Mac/Linux) |
| `ouroboros_config.py` | ~160 | Config and history management |
| `ouroboros_screen.py` | ~100 | State machine for input modes |
| `ouroboros_toggle.py` | ~200 | Mode switcher (default ↔ enhanced) |

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│  User Input (keyboard/paste/drag-drop)                      │
│         ↓                                                   │
│  ouroboros_keybuffer.py                                     │
│  ├── Platform detection (Windows/Unix)                      │
│  ├── ReadConsoleInputW (Windows) / termios (Unix)           │
│  ├── VK code → ANSI sequence normalization                  │
│  └── Special key detection (arrows, Ctrl+, etc.)            │
│         ↓                                                   │
│  ouroboros_paste.py                                         │
│  ├── Bracketed Paste Mode detection                         │
│  ├── ESC sequence filtering (paste vs arrow keys)           │
│  └── Paste content collection                               │
│         ↓                                                   │
│  ouroboros_input.py                                         │
│  ├── Key routing (navigation, editing, commands)            │
│  ├── Slash command handling                                 │
│  ├── File path detection and formatting                     │
│  └── History management                                     │
│         ↓                                                   │
│  ouroboros_buffer.py                                        │
│  ├── Text storage (multi-line)                              │
│  ├── Cursor position tracking                               │
│  └── Viewport scrolling                                     │
│         ↓                                                   │
│  ouroboros_ui.py                                            │
│  ├── InputBox rendering                                     │
│  ├── Dropdown menu for commands                             │
│  └── ANSI escape codes for styling                          │
│         ↓                                                   │
│  Output:                                                    │
│  ├── stderr → UI decorations (user sees)                    │
│  └── stdout → Clean content (AI reads)                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎨 UI Components

### WelcomeBox
Displays the Ouroboros logo and keyboard shortcuts on startup.

### InputBox
- Full terminal width
- Line numbers with syntax highlighting
- Status bar: mode indicator + cursor position
- Scroll indicator for long content
- Dynamic height (1-10 lines)

### SelectMenu
For option selection prompts:
- Arrow key navigation
- Number quick-select (1-9)
- Custom input option
- Home/End for quick navigation

### Dropdown
For slash command autocomplete:
- Shows below input box
- Highlights selected item
- Displays command descriptions

---

## 🔧 CLI Arguments

```bash
python ouroboros_input.py [OPTIONS]
```

| Argument | Description |
|----------|-------------|
| `--var NAME` | Variable name for output markers (default: `task`) |
| `--prompt TEXT` | Custom prompt text |
| `--header TEXT` | Header/menu to display |
| `--options LIST` | Options for selection menu |
| `--no-custom` | Disable custom input in selection |
| `--no-ui` | Disable fancy UI |
| `--no-color` | Disable ANSI colors |
| `--ascii` | Use ASCII instead of Unicode |

### Examples

```bash
# Standard CCL input
python ouroboros_input.py

# Selection menu
python ouroboros_input.py --options "Option A" "Option B" --prompt "Choose:"

# Simple prompt
python ouroboros_input.py --prompt "Feature name:" --var feature
```

---

## 🧪 Testing

```bash
cd test
python test_keyboard.py      # Interactive keyboard diagnostic
python run_all_tests.py      # Run all automated tests
```

| Test File | Coverage |
|-----------|----------|
| `test_keyboard.py` | Interactive keyboard input diagnostic |
| `test_keybuffer.py` | Keyboard input (Windows/Unix key codes) |
| `test_textbuffer.py` | Text buffer operations |
| `test_ui.py` | UI components (ANSI, themes, boxes) |
| `test_input_types.py` | Menu detection, prompts |
| `test_edge_cases.py` | Boundary conditions, Unicode |

---

## 🐛 Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Arrow keys show `[A[B[C[D` | Escape sequence not parsed | Update `ouroboros_paste.py` |
| Colors not showing | Terminal doesn't support ANSI | Use `--no-color` flag |
| Boxes look broken | Terminal doesn't support Unicode | Use `--ascii` flag |
| Ctrl+J not working | Terminal intercepts it | Use `Enter` or `<<<`/`>>>` |
| Cursor position wrong | Terminal ANSI support issue | Try different terminal |
| Paste not detected | Bracketed Paste not supported | Content still works, just no auto-detection |

---

## 📦 Dependencies

**None!** Uses only Python standard library:

| Module | Platform | Purpose |
|--------|----------|---------|
| `msvcrt` | Windows | Raw keyboard input |
| `ctypes` | Windows | ReadConsoleInputW API |
| `tty`, `termios` | Unix | Raw keyboard input |
| `select` | Unix | Non-blocking input |
| `json` | All | Config file handling |
| `shutil` | All | Terminal size detection |
| `unicodedata` | All | Character width calculation |

---

## 📜 License

Part of the Ouroboros project. MIT License.

---

*◎ Enhanced input for the Ouroboros CCL system*
