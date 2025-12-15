# Ouroboros Enhanced CCL Scripts v3.1

> **Version**: 3.1.0 | **Requires**: Python 3.9+ | **Dependencies**: None (stdlib only)

```
    ╭───◯───╮
   ◜  ◉━━◉  ◝
   │   ∞   │    OUROBOROS
   ◟  ◉━━◉  ◞    Enhanced CCL Input System
    ╰───◯───╯
```

Enhanced terminal input system for the Ouroboros Continuous Command Loop.
Built with a proper TUI (Text User Interface) using Python's curses library.

---

## 🚀 Quick Start

**Double-Click**:
- Windows: `toggle.bat`
- Mac/Linux: `toggle.sh` (run `chmod +x toggle.sh` first)

**Command Line**:
```bash
python ouroboros_input.py                    # Run TUI input
python ouroboros_input.py --version          # Show version
python ouroboros_input.py --help             # Show all options
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
| `Ctrl+C` | Cancel and exit (with animation) |
| `Ctrl+R` | Reverse history search |

### Slash Commands
| Key | Action |
|-----|--------|
| `/` | Start command mode (shows dropdown) |
| `↑` / `↓` | Navigate command suggestions |
| `Tab` | Complete selected command |
| `Escape` | Cancel command mode |

---

## ✨ Features

### Curses-Based TUI
- **Flicker-free rendering** using double-buffered screen updates
- **Graceful resize handling** with SIGWINCH (Unix) and polling (Windows)
- **Alternate screen buffer** preserves terminal history
- **ANSI fallback** when curses is unavailable

### Mystic Purple Theme
- Magenta borders (`\x1b[95m`)
- Cyan prompts (`\x1b[96m`)
- Green success indicators (`\x1b[92m`)
- Yellow warnings (`\x1b[93m`)
- Red errors (`\x1b[91m`)
- Monochrome fallback for unsupported terminals

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
- Agent instruction auto-prepending

### File & Folder Drag & Drop
Drag files or folders into the terminal:
- Display: `[ filename.ext ]` or `[ foldername ]` (compact badge)
- Storage: Full path sent to AI via `«path»` markers
- Supports Windows paths (`C:\...`) and Unix paths (`/...`)
- Folders are detected automatically

### Clipboard Paste (Ctrl+V)
Reliable paste detection by reading clipboard directly:
- Press `Ctrl+V` to paste from clipboard
- Large pastes (5+ lines) show as `[ Pasted N Lines ]` badge
- Full content preserved via `‹PASTE:N›...‹/PASTE›` markers
- Cross-platform: Windows (ctypes), macOS (pbpaste), Linux (xclip/xsel)

### Atomic Badge Operations
File path and paste badges can be manipulated atomically:
- `Backspace` after a badge deletes the entire badge at once
- `Delete` before a badge deletes the entire badge at once
- Cursor automatically skips past badge internals

### Dynamic Input Box
- Starts as 1 line, grows automatically (up to 5 lines)
- Virtual scrolling for longer content with `[start-end/total]` indicator
- Line numbers with 3-digit display and separator
- CJK character support (2-column width calculation)

### Command History
- `↑`/`↓` to browse previous commands (when on first line)
- `Ctrl+R` for reverse incremental search
- Persistent across sessions (saved to `ouroboros.history`)
- Max 1000 entries, avoids consecutive duplicates

### Selection Menu
For option selection prompts (`--options`):
- Arrow key navigation (Up/Down)
- Page Up/Down, Home/End support
- Number quick-select (1-9)
- Scroll indicators (`↑ N more above` / `↓ N more below`)
- Custom input option
- Yes/No detection from `[y/n]` pattern

---

## 📁 Module Architecture (v3.0)

The codebase has been refactored into a clean, modular structure:

```
.ouroboros/scripts/
├── ouroboros_input.py          # Entry point & CLI (~400 lines)
├── tui/                        # TUI layer
│   ├── __init__.py             # Lazy exports
│   ├── app.py                  # Main application loop
│   ├── screen.py               # Screen manager (curses init)
│   ├── window.py               # Window wrapper
│   ├── theme.py                # Color/theme management
│   ├── output.py               # Output formatting
│   └── fallback.py             # ANSI fallback renderer
├── components/                 # UI components
│   ├── __init__.py             # Lazy exports
│   ├── input_box.py            # Multi-line input box
│   ├── welcome_box.py          # Welcome header
│   ├── selection_menu.py       # Selection menu
│   └── status_bar.py           # Status bar
├── input/                      # Input handling
│   ├── __init__.py             # Lazy exports
│   ├── keybuffer.py            # Unified keyboard handler
│   ├── keybuffer_win.py        # Windows-specific input
│   ├── keybuffer_unix.py       # Unix-specific input
│   ├── paste.py                # Paste detection
│   ├── clipboard.py            # Clipboard access
│   └── commands.py             # Slash command handler
├── data/                       # Data layer
│   ├── __init__.py             # Lazy exports
│   ├── buffer.py               # TextBuffer
│   ├── history.py              # HistoryManager
│   └── config.py               # ConfigManager
├── utils/                      # Utilities
│   ├── __init__.py             # Lazy exports
│   ├── text.py                 # Text utilities (width, strip)
│   ├── badge.py                # Badge processing
│   └── filepath.py             # File path detection
└── tests/                      # Test suite
    ├── pbt_framework.py        # Property-based testing framework
    └── property/               # Property tests (10 properties)
        ├── test_char_width.py
        ├── test_file_marker.py
        ├── test_paste_marker.py
        ├── test_slash_filter.py
        ├── test_output_purity.py
        ├── test_enter_newline.py
        ├── test_history_search.py
        ├── test_menu_bounds.py
        ├── test_box_height.py
        └── test_agent_prepend.py
```

### Key Design Decisions

1. **Lazy imports** - All packages use lazy loading for <200ms startup
2. **Platform abstraction** - Separate Windows/Unix keyboard handlers
3. **Component-based UI** - Each UI element is self-contained
4. **Fallback support** - ANSI rendering when curses unavailable
5. **Property-based testing** - 10 correctness properties verified

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│  User Input (keyboard/paste/drag-drop)                      │
│         ↓                                                   │
│  input/keybuffer.py                                         │
│  ├── Platform detection (Windows/Unix)                      │
│  ├── ReadConsoleW (Windows) / termios (Unix)                │
│  ├── VK code → ANSI sequence normalization                  │
│  └── Special key detection (arrows, Ctrl+, etc.)            │
│         ↓                                                   │
│  input/paste.py                                             │
│  ├── Bracketed Paste Mode detection                         │
│  ├── ESC sequence filtering (paste vs arrow keys)           │
│  └── Paste content collection                               │
│         ↓                                                   │
│  tui/app.py                                                 │
│  ├── Key routing (navigation, editing, commands)            │
│  ├── Slash command handling                                 │
│  ├── File path detection and formatting                     │
│  └── History management                                     │
│         ↓                                                   │
│  data/buffer.py                                             │
│  ├── Text storage (multi-line)                              │
│  ├── Cursor position tracking                               │
│  └── Viewport scrolling                                     │
│         ↓                                                   │
│  components/*.py                                            │
│  ├── InputBox rendering                                     │
│  ├── WelcomeBox branding                                    │
│  ├── SelectionMenu navigation                               │
│  └── StatusBar indicators                                   │
│         ↓                                                   │
│  tui/output.py                                              │
│  ├── Marker expansion (file paths, pastes)                  │
│  ├── Agent instruction prepending                           │
│  └── ANSI code stripping                                    │
│         ↓                                                   │
│  Output:                                                    │
│  ├── stderr → UI decorations (user sees)                    │
│  └── stdout → Clean content (AI reads)                      │
└─────────────────────────────────────────────────────────────┘
```

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
| `--reset-config` | Reset configuration to defaults |
| `--version` | Show version number |

### Examples

```bash
# Standard CCL input
python ouroboros_input.py

# Selection menu
python ouroboros_input.py --options "Option A" "Option B" --prompt "Choose:"

# Simple prompt
python ouroboros_input.py --prompt "Feature name:" --var feature

# Yes/No confirmation (auto-detected from [y/n])
python ouroboros_input.py --header "Continue?" --prompt "[y/n]"
```

---

## 🧪 Testing

The project uses property-based testing to verify correctness properties.

```bash
# Run all property tests
cd .ouroboros/scripts
python -m pytest tests/ -v

# Run specific property test
python -m pytest tests/property/test_file_marker.py -v
```

### Correctness Properties

| Property | Description | Requirements |
|----------|-------------|--------------|
| 1. Character Width | CJK chars = 2 columns, ASCII = 1 | 2.7 |
| 2. File Marker Round-Trip | `create_file_marker` ↔ `expand_markers` | 6.1-6.6, 16.2 |
| 3. Paste Marker Round-Trip | `create_paste_marker` ↔ `expand_markers` | 7.1-7.6, 16.3 |
| 4. Slash Command Filtering | Fuzzy match with prefix priority | 8.1-8.6 |
| 5. Output Content Purity | No ANSI codes in stdout | 10.1-10.4, 16.6 |
| 6. Enter Key Newline | Line split + cursor move | 15.1-15.6 |
| 7. History Search | Substring match, recency order | 19.1-19.5 |
| 8. Selection Menu Bounds | 0 ≤ index < N always | 28.1-28.8 |
| 9. Input Box Height | 1 ≤ height ≤ 5 | 25.1-25.5 |
| 10. Agent Instruction | Correct prefix format | 32.1-32.6 |

---

## 🐛 Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Arrow keys show `[A[B[C[D` | Escape sequence not parsed | Check terminal VT mode |
| Colors not showing | Terminal doesn't support ANSI | Use `--no-color` flag |
| Boxes look broken | Terminal doesn't support Unicode | Use `--ascii` flag |
| Cursor position wrong | Terminal ANSI support issue | Try different terminal |
| Paste not detected | Bracketed Paste not supported | Use Ctrl+V instead |
| IME input issues | ReadConsoleW not available | Set `use_fallback_input: true` in config |
| Terminal too small | Window < 20x5 | Resize terminal window |

### Configuration File

Edit `ouroboros.config.json` to customize behavior:

```json
{
  "platform": "windows",
  "ansi_colors": true,
  "unicode_box": true,
  "theme": "mystic_purple",
  "auto_multiline": true,
  "compress_threshold": 10,
  "history_max_entries": 1000,
  "use_fallback_input": false
}
```

---

## 📦 Dependencies

**None!** Uses only Python standard library:

| Module | Platform | Purpose |
|--------|----------|---------|
| `curses` | Unix | TUI rendering |
| `windows-curses` | Windows | TUI rendering (optional) |
| `msvcrt` | Windows | Raw keyboard input |
| `ctypes` | Windows | ReadConsoleW API, clipboard |
| `tty`, `termios` | Unix | Raw keyboard input |
| `select` | Unix | Non-blocking input |
| `json` | All | Config file handling |
| `shutil` | All | Terminal size detection |
| `unicodedata` | All | Character width calculation |
| `atexit` | All | Terminal state restoration |
| `signal` | Unix | SIGWINCH resize handling |

---

## 📜 License

Part of the Ouroboros project. MIT License.

---

*◎ Enhanced input for the Ouroboros CCL system - v3.1.0*
