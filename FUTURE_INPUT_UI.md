# 🎨 Enhanced CCL System - Complete Implementation Plan

> **Status**: 📋 Planning Complete - Ready for Implementation
> **Priority**: Medium
> **Last Updated**: 2025-12-12
> **Document Version**: 6.0 (Display Compression + Auto Multi-line Detection)

---

## Table of Contents

1. [Problem Statement](#-problem-statement)
2. [Solution Overview](#-solution-overview)
3. [Dependency Analysis](#-dependency-analysis)
4. [Architecture Design](#-architecture-design)
5. [Display Compression](#-display-compression) ⭐ NEW
6. [Auto Multi-line Detection](#-auto-multi-line-detection) ⭐ NEW
7. [Multi-line Input Methods](#-multi-line-input-methods)
8. [Input Command Standardization](#-input-command-standardization)
9. [Edge Cases & Solutions](#-edge-cases--solutions)
10. [File Detection Feature](#-file-detection-feature)
11. [UI Design Specification](#-ui-design-specification)
12. [Implementation Plan](#-implementation-plan)
13. [File Inventory](#-file-inventory)
14. [Toggle Script Design](#-toggle-script-design)
15. [Risk Assessment](#-risk-assessment)
16. [Testing Plan](#-testing-plan)

---

## 📋 Problem Statement

### Current Limitations

The current CCL (Continuous Command Loop) uses:
```python
python -c "task = input('[Ouroboros] > ')"
```

**Limitations:**
- Single line input only
- No multi-line support
- No Shift+Enter newline support (see analysis below)
- No command history
- No visual feedback
- No file drag-and-drop support
- Basic terminal experience

### Goal

Create an **optional enhanced mode** that provides:
- Multi-line input support
- Visual beautification (colors, borders)
- Command history (where available)
- File path detection and formatting
- Shortcut key hints
- Consistent experience across all input types
- **Zero breaking changes** to default behavior

---

## 🎯 Solution Overview

### Dual-Mode System

| Mode | Command | Features |
|------|---------|----------|
| **Default** | `python -c "..."` | Simple, stable, universal |
| **Enhanced** | `python .ouroboros/scripts/ouroboros_input.py` | Colors, multi-line, history, file detection |

### Toggle Mechanism

Users can switch between modes using:
```bash
python .ouroboros/scripts/ouroboros_toggle.py
```

This script will:
1. Scan all `.github/*.md` files
2. Replace all standardized input commands
3. Toggle between Default ↔ Enhanced mode

---

## 🔬 Dependency Analysis

### Critical Question: What Libraries Do We Use?

#### Python Standard Library Only

| Module | Purpose | Availability |
|--------|---------|--------------| 
| `sys` | System functions | ✅ Always available |
| `argparse` | Command line parsing | ✅ Python 2.7+, 3.2+ |
| `pathlib` | Path operations | ✅ Python 3.4+ |
| `re` | Regular expressions | ✅ Always available |
| `os` | OS operations, file detection | ✅ Always available |
| `msvcrt` | Windows keyboard input | ✅ Windows only |
| `termios`/`tty` | Unix keyboard input | ✅ Unix/macOS only |

> [!IMPORTANT]
> **ZERO EXTERNAL DEPENDENCIES GUARANTEE**
> 
> All core features (display compression, auto multi-line detection, file detection, colors, box drawing) use **ONLY Python standard library modules**. No `pip install` required!

### Feature Dependency Matrix

| Feature | Required Modules | External Deps? | Windows Status |
|---------|-----------------|----------------|----------------|
| **Display Compression** | `time`, `sys`, `os`, `pathlib` | ❌ None | ✅ Works |
| **Auto Multi-line Detection** | `time`, `sys` | ❌ None | ✅ Works |
| **Paste Speed Detection** | `time` | ❌ None | ✅ Works |
| **File/Image Detection** | `os`, `pathlib` | ❌ None | ✅ Works |
| **ANSI Colors** | None (just strings) | ❌ None | ✅ Works on Win10+ |
| **Unicode Box Drawing** | None (just strings) | ❌ None | ✅ Works on Win10+ |
| **Command History** | `readline` | ⚠️ Optional | ⚠️ Graceful fallback |

### About readline (Optional, NOT Required)

`readline` is the ONLY module that differs by platform, and it's **completely optional**:

| Platform | readline Status | What Happens Without It |
|----------|-----------------|------------------------|
| **Linux** | ✅ Built-in | Full command history |
| **macOS** | ✅ Built-in | Full command history |
| **Windows** | ❌ Not built-in | **Everything still works!** Just no ↑/↓ history |

```python
# Safe import pattern - NEVER crashes!
try:
    import readline  # Linux/macOS
except ImportError:
    # Windows: No history feature, but ALL other features work!
    # We do NOT require pyreadline3 or any external package
    pass
```

> [!TIP]
> **Windows Users**: All core features work perfectly. You only lose the ability to press ↑/↓ to recall previous commands - this is a minor convenience feature.

### ANSI Color Support

| Platform | Terminal | ANSI Support |
|----------|----------|--------------|
| Windows 10+ | Windows Terminal | ✅ |
| Windows 10+ | cmd.exe | ✅ (after Win10 1511) |
| Windows < 10 | cmd.exe | ❌ Degraded |
| macOS | Terminal.app | ✅ |
| Linux | Most terminals | ✅ |

**Fallback for old Windows**: Colors just don't show, but script still works.

### Unicode Box Drawing Support

| Platform | Support |
|----------|---------|
| Windows 10+ | ✅ With UTF-8 codepage |
| macOS | ✅ |
| Linux | ✅ |

**Solution for old Windows**: ASCII fallback mode:
```python
if os.name == 'nt' and sys.getwindowsversion().major < 10:
    BOX_TL, BOX_TR, BOX_BL, BOX_BR = '+', '+', '+', '+'
    BOX_H, BOX_V = '-', '|'
else:
    BOX_TL, BOX_TR, BOX_BL, BOX_BR = '╔', '╗', '╚', '╝'
    BOX_H, BOX_V = '═', '║'
```

---

## 🏗️ Architecture Design

### File Structure

```
.ouroboros/
├── scripts/
│   ├── ouroboros_input.py       # ♾️ Enhanced input handler
│   ├── ouroboros_toggle.py      # ♾️ Mode toggle script
│   └── ouroboros.config.json    # ♾️ Cached environment config
└── ...

.github/
├── copilot-instructions.md      # Contains CCL commands
├── agents/
│   ├── ouroboros.agent.md       # Contains CCL commands
│   ├── ouroboros-*.agent.md     # Contain CCL commands
│   └── ...
└── prompts/
    ├── ouroboros.prompt.md      # Contains CCL commands
    └── ...
```

### Config Caching System

```json
// .ouroboros/scripts/ouroboros.config.json (auto-generated on first run)
{
    "platform": "windows",           // Cached: "windows" | "unix"
    "ansi_colors": true,             // Terminal supports ANSI?
    "unicode_box": true,             // Terminal supports Unicode?
    "readline_available": false,     // Has readline?
    "theme": "mystic_purple",        // User preference
    "auto_multiline": true,          // Enable auto-detection?
    "compress_threshold": 10,        // Lines before compression
    "last_verified": "2025-12-12"    // When was this verified?
}
```

**Cache Behavior:**
- **First run**: Detect environment → Save config
- **Subsequent runs**: Load config → Skip detection (fast!)
- **On failure**: Re-detect → Update config → Continue

### ouroboros_input.py Features

```
┌─────────────────────────────────────────────────────┐
│  ouroboros_input.py                                 │
├─────────────────────────────────────────────────────┤
│  Arguments:                                         │
│  --prompt "text"    Custom prompt text              │
│  --header "text"    Pre-input display text          │
│  --var "name"       Variable name for output marker │
│  --no-ui            Disable fancy border            │
│  --no-color         Disable ANSI colors             │
│  --ascii            Use ASCII instead of Unicode    │
│  --reset-config     Force re-detect environment     │
├─────────────────────────────────────────────────────┤
│  Features:                                          │
│  - Config caching (fast startup)                    │
│  - Multi-line input (auto-detect or <<<)            │
│  - Display compression for large pastes             │
│  - Command history (if readline available)          │
│  - ANSI colors (Mystic Purple theme)                │
│  - Unicode box drawing (with ASCII fallback)        │
│  - File path detection ([FILE], [IMAGE], [VIDEO])   │
│  - Shortcut key hints in UI                         │
│  - Clear output markers for Copilot parsing         │
└─────────────────────────────────────────────────────┘
```

---

## 📦 Display Compression

> [!TIP]
> **Key UX Feature**: Show compressed preview in terminal, but send FULL content to Copilot!

### The Problem

When users paste large content (logs, code blocks, data), the terminal becomes cluttered:

```
❯ [user pastes 200 lines of logs]
2024-12-12 10:00:01 ERROR: Connection failed
2024-12-12 10:00:02 ERROR: Retry attempt 1
2024-12-12 10:00:03 ERROR: Retry attempt 2
... (197 more lines scrolling by)
2024-12-12 10:03:45 INFO: Connection restored
```

**Problems:**
- Terminal history flooded
- Hard to see what was pasted
- Overwhelming visual noise

### The Solution

**Display compressed, transmit full!**

```
❯ [user pastes 200 lines]

╭─────────────────────────────────────╮
│ 📋 Content Received                 │
│    Lines: 200                       │
│    Size: 15.3 KB                    │
│    Type: Log data (detected)        │
│                                     │
│ ┌─ Preview ───────────────────────┐ │
│ │ 2024-12-12 10:00:01 ERROR: Co...│ │
│ │ 2024-12-12 10:00:02 ERROR: Re...│ │
│ │ ... (196 lines hidden) ...      │ │
│ │ 2024-12-12 10:03:45 INFO: Con...│ │
│ └─────────────────────────────────┘ │
╰─────────────────────────────────────╯

→ Full 200 lines sent to Copilot ✓
```

### Implementation

```python
import time

# Configuration
COMPRESS_THRESHOLD_LINES = 10      # Compress if > 10 lines
COMPRESS_THRESHOLD_CHARS = 500     # Or > 500 chars
PREVIEW_LINES_HEAD = 2             # Show first 2 lines
PREVIEW_LINES_TAIL = 2             # Show last 2 lines
LINE_TRUNCATE_WIDTH = 50           # Truncate long lines in preview

def smart_display(content: str) -> str:
    """
    Display compressed preview in terminal, return full content.
    
    Args:
        content: The raw input content
        
    Returns:
        The FULL content (unchanged) for transmission to Copilot
    """
    lines = content.split('\n')
    line_count = len(lines)
    char_count = len(content)
    
    # Check if compression is needed
    if line_count <= COMPRESS_THRESHOLD_LINES and char_count <= COMPRESS_THRESHOLD_CHARS:
        # Small content - show as-is
        return content
    
    # Detect content type
    content_type = detect_content_type(content)
    
    # Build compressed display
    print()
    print("╭─────────────────────────────────────╮")
    print("│ 📋 Content Received                 │")
    print(f"│    Lines: {line_count:<25} │")
    print(f"│    Size: {format_size(char_count):<26} │")
    print(f"│    Type: {content_type:<26} │")
    print("│                                     │")
    print("│ ┌─ Preview ───────────────────────┐ │")
    
    # Show head lines
    for i in range(min(PREVIEW_LINES_HEAD, line_count)):
        truncated = truncate_line(lines[i], LINE_TRUNCATE_WIDTH)
        print(f"│ │ {truncated:<34}│ │")
    
    # Show hidden count
    if line_count > PREVIEW_LINES_HEAD + PREVIEW_LINES_TAIL:
        hidden = line_count - PREVIEW_LINES_HEAD - PREVIEW_LINES_TAIL
        print(f"│ │ ... ({hidden} lines hidden) ...{' '*6}│ │")
    
    # Show tail lines
    for i in range(max(0, line_count - PREVIEW_LINES_TAIL), line_count):
        if i >= PREVIEW_LINES_HEAD:  # Don't repeat head lines
            truncated = truncate_line(lines[i], LINE_TRUNCATE_WIDTH)
            print(f"│ │ {truncated:<34}│ │")
    
    print("│ └─────────────────────────────────┘ │")
    print("╰─────────────────────────────────────╯")
    print()
    print(f"→ Full {line_count} lines sent to Copilot ✓")
    
    # Return FULL content unchanged!
    return content

def detect_content_type(content: str) -> str:
    """Detect the type of pasted content."""
    # Log patterns
    if any(kw in content.lower() for kw in ['error:', 'warn:', 'info:', 'debug:']):
        return "Log data (detected)"
    # JSON
    if content.strip().startswith('{') or content.strip().startswith('['):
        return "JSON data (detected)"
    # Code patterns
    if any(kw in content for kw in ['def ', 'function ', 'class ', 'import ', 'const ', 'let ']):
        return "Code (detected)"
    # Stack trace
    if 'Traceback' in content or 'at ' in content and '(' in content:
        return "Stack trace (detected)"
    return "Text content"

def truncate_line(line: str, max_width: int) -> str:
    """Truncate a line to fit display width."""
    if len(line) <= max_width:
        return line
    return line[:max_width-3] + "..."

def format_size(chars: int) -> str:
    """Format character count as human-readable size."""
    if chars < 1024:
        return f"{chars} chars"
    elif chars < 1024 * 1024:
        return f"{chars/1024:.1f} KB"
    else:
        return f"{chars/(1024*1024):.1f} MB"
```

### Image/File Path Compression

When users drag files, show compressed display:

```python
def display_file_compressed(file_path: str) -> str:
    """Display file info in compressed format."""
    from pathlib import Path
    import os
    
    path = Path(file_path)
    if not path.exists():
        return file_path  # Not a file, return as-is
    
    size = path.stat().st_size
    ext = path.suffix.lower()
    
    # Determine icon and type
    if ext in {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp'}:
        icon = "📷"
        file_type = "IMAGE"
        note = "Attach in Chat UI for visual analysis"
    elif ext in {'.mp4', '.mov', '.avi', '.webm', '.mkv'}:
        icon = "🎬"
        file_type = "VIDEO"
        note = "Video path provided for reference"
    else:
        icon = "📄"
        file_type = "FILE"
        note = "Agent can read this file"
    
    # Display compressed
    print()
    print(f"  {icon} [{path.name}] ({format_file_size(size)})")
    print(f"  ℹ️  {note}")
    print()
    
    # Return tagged path for Copilot
    return f"[{file_type}] {path.absolute()}"

def format_file_size(bytes: int) -> str:
    """Format bytes as human-readable."""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes < 1024:
            return f"{bytes:.1f} {unit}"
        bytes /= 1024
    return f"{bytes:.1f} TB"
```

### Visual Examples

**Large log paste:**
```
❯ [pastes 500 lines of npm install output]

╭─────────────────────────────────────╮
│ 📋 Content Received                 │
│    Lines: 523                       │
│    Size: 48.2 KB                    │
│    Type: Log data (detected)        │
│                                     │
│ ┌─ Preview ───────────────────────┐ │
│ │ npm WARN deprecated glob@7.2... │ │
│ │ npm WARN deprecated inflight... │ │
│ │ ... (519 lines hidden) ...      │ │
│ │ added 847 packages in 32s       │ │
│ │ 127 packages are looking for... │ │
│ └─────────────────────────────────┘ │
╰─────────────────────────────────────╯

→ Full 523 lines sent to Copilot ✓
```

**Image file drop:**
```
❯ "C:\Users\me\Desktop\screenshot.png"

  📷 [screenshot.png] (1.2 MB)
  ℹ️  Attach in Chat UI for visual analysis

→ [IMAGE] C:\Users\me\Desktop\screenshot.png sent to Copilot
```

**Code block paste:**
```
❯ [pastes 150 lines of Python code]

╭─────────────────────────────────────╮
│ 📋 Content Received                 │
│    Lines: 150                       │
│    Size: 4.8 KB                     │
│    Type: Code (detected)            │
│                                     │
│ ┌─ Preview ───────────────────────┐ │
│ │ import os                       │ │
│ │ from pathlib import Path        │ │
│ │ ... (146 lines hidden) ...      │ │
│ │     return result               │ │
│ │ if __name__ == "__main__":      │ │
│ └─────────────────────────────────┘ │
╰─────────────────────────────────────╯

→ Full 150 lines sent to Copilot ✓
```

---

## 🔍 Auto Multi-line Detection

> [!IMPORTANT]
> **No more `<<<` required!** The system auto-detects multi-line content.

### The Problem (Old Approach)

Previously, users had to manually type `<<<` to enter multi-line mode:
```
❯ <<<
  (Multi-line mode. End with: empty line+Enter)
  │ def hello():
  │     print("world")
  │ 
❯ 
```

**Issues:**
- Extra step for users to remember
- Not intuitive
- Friction in workflow

### The Solution: Smart Auto-Detection

**Paste Detection** (Primary Method):
```python
import time
import sys

def auto_detect_input(prompt="❯ "):
    """
    Automatically detect multi-line paste vs single-line typing.
    
    Detection methods:
    1. Input speed (paste is instant, typing is slow)
    2. Newline characters in input (some terminals preserve them)
    3. Content patterns (incomplete syntax)
    """
    
    # Measure input timing
    start_time = time.time()
    first_line = input(prompt)
    elapsed = time.time() - start_time
    
    # Calculate typing speed (chars per second)
    if elapsed > 0:
        chars_per_sec = len(first_line) / elapsed
    else:
        chars_per_sec = float('inf')  # Instant = paste
    
    # Detection logic
    is_paste = False
    is_incomplete = False
    
    # Method 1: Speed detection (paste is very fast)
    # Typical typing: 5-10 chars/sec
    # Paste: 100+ chars/sec (essentially instant)
    if chars_per_sec > 50 and len(first_line) > 20:
        is_paste = True
    
    # Method 2: Check for embedded newlines (some terminals preserve them)
    if '\n' in first_line or '\r' in first_line:
        # Terminal preserved the paste with newlines!
        lines = first_line.replace('\r\n', '\n').replace('\r', '\n').split('\n')
        return '\n'.join(lines)  # Return as multi-line
    
    # Method 3: Syntax pattern detection (looks incomplete)
    incomplete_patterns = [
        # Python
        (':', 'Python function/class definition'),
        # JavaScript/TypeScript
        ('{', 'JavaScript object/function'),
        ('[', 'Array definition'),
        ('(', 'Function call or tuple'),
        # String continuations
        ('"""', 'Python docstring'),
        ("'''", 'Python docstring'),
        ('`', 'Template literal'),
    ]
    
    stripped = first_line.rstrip()
    for pattern, description in incomplete_patterns:
        if stripped.endswith(pattern):
            is_incomplete = True
            break
    
    # If detected as multi-line, prompt for more
    if is_paste or is_incomplete:
        return continue_multiline_input(first_line)
    
    # Single line - return as-is
    return first_line

def continue_multiline_input(first_line: str) -> str:
    """
    Continue collecting multi-line input after detection.
    """
    print("  ↳ Multi-line detected. Continue typing (double-Enter to submit):")
    
    lines = [first_line]
    empty_count = 0
    
    while True:
        try:
            line = input("  │ ")
            
            if line == "":
                empty_count += 1
                if empty_count >= 2:
                    # Two empty lines = submit
                    break
                lines.append("")  # Preserve single empty line
            else:
                empty_count = 0
                lines.append(line)
                
        except EOFError:
            # Ctrl+D pressed
            break
        except KeyboardInterrupt:
            # Ctrl+C - cancel
            print("\n  ✗ Cancelled")
            return ""
    
    return '\n'.join(lines).rstrip()
```

### Detection Methods Summary

| Method | How It Works | Reliability |
|--------|-------------|-------------|
| **Speed Detection** | Paste is instant (>50 chars/sec), typing is slow | ⭐⭐⭐ High |
| **Newline Preservation** | Some terminals keep `\n` in paste | ⭐⭐ Medium (terminal-dependent) |
| **Syntax Patterns** | Lines ending with `:`, `{`, `[` etc. | ⭐⭐ Medium (heuristic) |
| **Length Heuristic** | Very long lines (>100 chars) likely pasted | ⭐ Low (supplementary) |

### User Experience Flow

**Automatic detection (no user action needed):**
```
❯ def calculate_total(items):        # User types/pastes this
  ↳ Multi-line detected. Continue typing (double-Enter to submit):
  │     total = 0
  │     for item in items:
  │         total += item.price
  │     return total
  │ 
  │ 
❯ [submitted automatically]
```

**Instant paste detection:**
```
❯ [user Ctrl+V pastes 50 lines instantly]
  ↳ Multi-line detected. Continue typing (double-Enter to submit):
  │ ... (paste continues)
  │ 
  │ 
❯ [submitted automatically]
```

### Manual Override Still Available

Users can still use explicit triggers if preferred:

| Trigger | Action |
|---------|--------|
| `<<<` | Force multi-line mode |
| `>>>` | End multi-line mode |
| Double-Enter | Submit current input |
| Ctrl+D | Submit (EOF signal) |
| Ctrl+C | Cancel input |

### Configuration Options

```python
# In ccl.py configuration
AUTO_DETECT_ENABLED = True         # Enable auto-detection
PASTE_SPEED_THRESHOLD = 50         # chars/sec to consider as paste
MIN_PASTE_LENGTH = 20              # Minimum chars to trigger paste detection
DETECT_INCOMPLETE_SYNTAX = True    # Check for : { [ etc.
DOUBLE_ENTER_SUBMIT = True         # Two empty lines = submit
```

---

## ⌨️ Multi-line Input Methods

### Shift+Enter Analysis

> [!IMPORTANT]
> **Can we support Shift+Enter for newlines like in modern chat UIs?**

#### Answer: ⚠️ **PARTIALLY POSSIBLE** - With significant complexity

#### Technical Analysis

| Approach | Feasibility | Complexity | Platform Support |
|----------|-------------|------------|------------------|
| Python `input()` | ❌ Not possible | - | None |
| Raw keyboard input | ✅ Possible | High | Platform-specific |
| `curses` library | ✅ Possible | High | Unix only |
| `msvcrt` (Windows) | ✅ Possible | High | Windows only |

#### Why `input()` Cannot Detect Shift+Enter

Python's built-in `input()` function:
1. Reads characters until it receives a newline (`\n`)
2. Strips the trailing newline before returning
3. Has no access to modifier key states (Shift, Ctrl, Alt)
4. Cannot distinguish between Enter and Shift+Enter

When you press Shift+Enter in a terminal:
- Most terminals treat it exactly the same as Enter
- Both produce the same `\n` character
- There's no additional information sent to Python

#### Implementation Options

##### Option A: Raw Keyboard Input (RECOMMENDED)

```python
import sys
import os

if os.name == 'nt':  # Windows
    import msvcrt
    
    def get_key():
        """Get a single keypress on Windows."""
        ch = msvcrt.getwch()
        if ch in ('\x00', '\xe0'):  # Arrow keys, function keys
            ch += msvcrt.getwch()
        return ch
    
    def is_shift_pressed():
        """Check if Shift key is pressed on Windows."""
        import ctypes
        VK_SHIFT = 0x10
        return ctypes.windll.user32.GetKeyState(VK_SHIFT) & 0x8000 != 0

else:  # Unix/macOS
    import tty
    import termios
    
    def get_key():
        """Get a single keypress on Unix."""
        fd = sys.stdin.fileno()
        old_settings = termios.tcgetattr(fd)
        try:
            tty.setraw(sys.stdin.fileno())
            ch = sys.stdin.read(1)
            # Handle escape sequences for arrow keys, etc.
            if ch == '\x1b':
                ch += sys.stdin.read(2)
        finally:
            termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)
        return ch

def enhanced_multiline_input(prompt="❯ "):
    """
    Custom input that supports Shift+Enter for newlines.
    
    - Enter: Submit input
    - Shift+Enter (Windows): Insert newline
    - Ctrl+Enter: Insert newline (fallback)
    - Ctrl+D: Submit input (EOF)
    """
    lines = []
    current_line = ""
    
    print(prompt, end="", flush=True)
    
    while True:
        if os.name == 'nt':  # Windows
            key = get_key()
            
            if key == '\r':  # Enter pressed
                if is_shift_pressed():
                    # Shift+Enter: add newline
                    lines.append(current_line)
                    current_line = ""
                    print()  # Move to next line
                    print("  │ ", end="", flush=True)
                else:
                    # Just Enter: submit
                    lines.append(current_line)
                    print()
                    break
            elif key == '\x03':  # Ctrl+C
                raise KeyboardInterrupt
            elif key == '\x04':  # Ctrl+D
                lines.append(current_line)
                break
            elif key == '\x08':  # Backspace
                if current_line:
                    current_line = current_line[:-1]
                    print('\b \b', end="", flush=True)
            elif key.isprintable():
                current_line += key
                print(key, end="", flush=True)
        else:
            # Unix implementation (simplified)
            key = get_key()
            if key == '\r' or key == '\n':
                lines.append(current_line)
                print()
                break
            elif key == '\x03':
                raise KeyboardInterrupt
            elif key.isprintable():
                current_line += key
                print(key, end="", flush=True)
    
    return '\n'.join(lines)
```

##### Option B: Use Explicit Multi-line Trigger (CURRENT APPROACH)

This is the simpler, more reliable approach we're currently planning:

```
❯ <<<                     # User types <<< to enter multi-line mode
  (Multi-line mode. End with: empty line+Enter, or Ctrl+D)
  │ def hello():
  │     print("world")
  │                       # Empty line
  │                       # Another empty line = submit
```

##### Option C: Ctrl+J for Newline

Some terminals interpret Ctrl+J as a literal newline (`\n`), which can work with `input()`:
- Ctrl+J produces `\n` directly
- May work in some terminals without special handling

#### Recommended Approach

> [!TIP]
> **Use a hybrid approach for best compatibility:**

| Priority | Method | When to Use |
|----------|--------|-------------|
| 1 | `<<<` trigger | Always available, most reliable |
| 2 | Shift+Enter (Windows) | Enhanced mode on Windows with raw input |
| 3 | Two empty lines | Universal fallback for ending multi-line |
| 4 | Ctrl+D | Unix standard EOF signal |

### Multi-line Mode Exit Methods

| Method | How | Works On |
|--------|-----|----------|
| `>>>` on its own line | Type `>>>` and Enter | All platforms |
| Two empty lines | Press Enter twice on empty lines | All platforms |
| Ctrl+D | Press Ctrl+D | All platforms |
| Ctrl+Z + Enter | Press Ctrl+Z then Enter | Windows |

---

## 📐 Input Command Standardization

> [!IMPORTANT]
> **All input commands are now standardized. See `.ouroboros/INPUT_STANDARDS.md` for full documentation.**

### Command Type Classification

| Type | Variable | Standard Pattern | Count |
|------|----------|------------------|-------|
| **A** | `task` | `python -c "task = input('[Ouroboros] > ')"` | 37 |
| **B** | `choice` | `python -c "print('\\n[1] X\\n[2] Y'); choice = input('Choice (1-N): ')"` | 5 |
| **C** | `feature` | `python -c "feature = input('Feature name: ')"` | 3 |
| **D** | `confirm` | `python -c "confirm = input('[y/n]: ')"` | 2 |
| **E** | `question` | `python -c "question = input('Question: ')"` | 1 |

### Type B Menu Format (STRICT)

```python
# Standard menu format - each option on its own line
python -c "print('\\n[1] Option A\\n[2] Option B\\n[3] Option C'); choice = input('Choice (1-3): ')"
```

**Rules:**
- Options MUST use `[1]`, `[2]`, `[3]` (numbers only)
- Each option on own line with `\\n`  
- Prompt MUST end with `Choice (1-N):` showing valid range

### Type D Confirmation Format

```python
# Standard confirmation format
python -c "confirm = input('[y/n]: ')"

# With context
python -c "print('Ready to proceed?'); confirm = input('[y/n]: ')"
```

**Rules:**
- Variable MUST be `confirm` (not `choice`)
- Prompt MUST include `[y/n]:`

### Enhanced Mode Mappings

| Type | Default Mode | Enhanced Mode |
|------|--------------|---------------|
| A | `python -c "task = input('[Ouroboros] > ')"` | `python .ouroboros/scripts/ouroboros_input.py` |
| B | `python -c "print('MENU'); choice = input('Choice (1-N): ')"` | `python .ouroboros/scripts/ouroboros_input.py --header "MENU" --prompt "Choice (1-N):" --var choice` |
| C | `python -c "feature = input('Feature name: ')"` | `python .ouroboros/scripts/ouroboros_input.py --prompt "Feature name:" --var feature` |
| D | `python -c "confirm = input('[y/n]: ')"` | `python .ouroboros/scripts/ouroboros_input.py --prompt "[y/n]:" --var confirm --no-ui` |
| E | `python -c "question = input('Question: ')"` | `python .ouroboros/scripts/ouroboros_input.py --prompt "Question:" --var question` |

---

## ⚠️ Edge Cases & Solutions

### 1. Input Box Dynamic Expansion

**Problem**: Can the visual box expand as user types newlines?

**Answer**: ❌ NOT POSSIBLE with Python `input()`

**Reason**: 
- `input()` captures one line at a time
- No control over terminal display during input
- Would require `curses` or similar library

**Accepted Limitation**: Border is decoration only, does not dynamically resize.

---

### 2. Multi-line Mode End Detection

| Problem | Scenario | Solution |
|---------|----------|----------|
| User forgets `>>>` | Stuck waiting | Support Ctrl+D (EOF) as alternative |
| Text contains `>>>` | Premature end | Use more unique marker OR empty-line-confirm |
| Accidental `<<<` | Unwanted mode | Empty line + Enter to quickly exit |

**Improved Algorithm**:
```python
def get_multiline_input():
    """Robust multi-line input with multiple exit methods"""
    print("  (Multi-line mode. End with: empty line+Enter, or Ctrl+D)")
    lines = []
    empty_count = 0
    
    while True:
        try:
            line = input("  │ ")
            
            if line == "":
                empty_count += 1
                if empty_count >= 2:
                    # Two consecutive empty lines = submit
                    break
                # First empty line - add it and continue
                lines.append("")
            else:
                empty_count = 0
                if line.strip() == ">>>":
                    break
                lines.append(line)
                
        except EOFError:
            # Ctrl+D pressed
            break
    
    return "\n".join(lines).rstrip()
```

---

### 3. Pasting Multi-line Content

**Problem**: User pastes multi-line text in single-line mode

**What happens**:
```
User pastes:
def hello():
    print("world")

Captured: only "def hello():"  ← Other lines LOST!
```

**Solutions**:

1. **Detection + Warning**:
```python
# If input looks truncated (common code patterns)
if first_line.rstrip().endswith((':' , '{', '[')):
    print("  ⚠️  Looks like multi-line code. Type '<<<' first, then paste.")
```

2. **Documentation**: Clear instruction in UI

3. **Auto-detect paste** (advanced):
```python
# Check if input arrived very fast (paste detection)
import time
start = time.time()
line = input()
elapsed = time.time() - start
if elapsed < 0.1 and len(line) > 50:
    print("  ⚠️  Long input detected. For multi-line, use '<<<' mode.")
```

---

### 4. Windows vs Unix Line Endings

| System | Line Ending | Handling |
|--------|-------------|----------|
| Windows | `\r\n` | Python auto-handles |
| Unix | `\n` | OK |
| Mixed (paste) | Both | Normalize |

**Solution**:
```python
# Normalize all line endings
task = task.replace('\r\n', '\n').replace('\r', '\n')
```

---

### 5. Special Characters in Input

| Character | Risk | Mitigation |
|-----------|------|------------|
| `<<<` / `>>>` | Mode triggers | Only trigger at line start |
| ANSI codes | Display issues | Strip on output |
| Unicode | Encoding | Use UTF-8 everywhere |

---

## 📁 File Detection Feature

### Purpose

When users drag files into terminal, detect and format the path for Copilot.

### Implementation

```python
import os
from pathlib import Path

# File type categories
IMAGE_EXTS = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'}
VIDEO_EXTS = {'.mp4', '.mov', '.avi', '.webm', '.mkv'}
CODE_EXTS = {'.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.c', '.cpp', '.h', 
             '.cs', '.go', '.rs', '.rb', '.php', '.swift', '.kt'}
DOC_EXTS = {'.md', '.txt', '.json', '.yaml', '.yml', '.xml', '.html', '.css'}

def detect_file_input(input_text):
    """Detect and format file paths in input"""
    # Clean path (Windows drag adds quotes)
    cleaned = input_text.strip().strip('"').strip("'")
    
    # Check if it's a valid file path
    if not os.path.isfile(cleaned):
        return None  # Not a file
    
    path = Path(cleaned)
    ext = path.suffix.lower()
    size = path.stat().st_size
    size_str = format_size(size)
    
    # Categorize
    if ext in IMAGE_EXTS:
        return {
            'type': 'IMAGE',
            'path': str(path.absolute()),
            'name': path.name,
            'size': size_str,
            'note': 'Copilot cannot view image content from path. Attach in Chat UI for visual analysis.'
        }
    elif ext in VIDEO_EXTS:
        return {
            'type': 'VIDEO',
            'path': str(path.absolute()),
            'name': path.name,
            'size': size_str,
            'note': 'Video file detected. Path provided for reference.'
        }
    elif ext in CODE_EXTS or ext in DOC_EXTS:
        return {
            'type': 'FILE',
            'path': str(path.absolute()),
            'name': path.name,
            'size': size_str,
            'note': 'Agent can read this file content.'
        }
    else:
        return {
            'type': 'FILE',
            'path': str(path.absolute()),
            'name': path.name,
            'size': size_str,
            'note': 'Unknown file type.'
        }

def format_size(bytes):
    """Format file size for display"""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes < 1024:
            return f"{bytes:.1f} {unit}"
        bytes /= 1024
    return f"{bytes:.1f} TB"
```

### Output Format

When file is detected:
```
❯ "C:\Users\me\screenshot.png"

📁 File Detected:
   Type: IMAGE
   Name: screenshot.png
   Size: 245.3 KB
   Note: Copilot cannot view image content from path. Attach in Chat UI for visual analysis.

=== TASK START ===
[IMAGE] C:\Users\me\screenshot.png
=== TASK END ===
```

When code file is detected:
```
❯ "D:\project\src\main.py"

📁 File Detected:
   Type: FILE
   Name: main.py
   Size: 4.2 KB
   Note: Agent can read this file content.

=== TASK START ===
[FILE] D:\project\src\main.py
=== TASK END ===
```

### Agent Response Guidelines

Add to `copilot-instructions.md`:

```markdown
## File Input Handling

When task starts with `[FILE]`, `[IMAGE]`, or `[VIDEO]`:

| Prefix | Action |
|--------|--------|
| `[FILE] path` | Use `ouroboros-analyst` to read file content |
| `[IMAGE] path` | Acknowledge path. Inform user to attach in Chat UI for visual analysis |
| `[VIDEO] path` | Acknowledge path. Video content cannot be analyzed |
```

---

## 🎨 UI Design Specification

### Enhanced Mode Display

```
╔═══════════════════════════════════════════════════════╗
║  ♾️  Ouroboros - Awaiting Command                     ║
╠═══════════════════════════════════════════════════════╣
║  ⌨️  Shortcuts:                                       ║
║  • Multi-line: Type '<<<' or paste, end with '>>>'    ║
║  • Submit: Enter (single) | Empty line x2 (multi)     ║
║  • Cancel: Ctrl+C                                     ║
╚═══════════════════════════════════════════════════════╝

❯ _
```

### ASCII Fallback Mode

```
+-------------------------------------------------------+
|  Ouroboros - Awaiting Command                         |
+-------------------------------------------------------+
|  Shortcuts:                                           |
|  * Multi-line: Type '<<<' or paste, end with '>>>'    |
|  * Submit: Enter (single) | Empty line x2 (multi)     |
|  * Cancel: Ctrl+C                                     |
+-------------------------------------------------------+

> _
```

### Color Scheme — Mystic Purple Theme ♾️

> [!TIP]
> **Brand Identity**: Magenta/Purple represents infinity, mysticism, and makes Ouroboros instantly recognizable.

| Element | Color | ANSI Code | Rationale |
|---------|-------|-----------|-----------|
| **Border** | Magenta | `\033[95m` | ♾️ Infinity, brand identity |
| **Prompt ❯** | Cyan | `\033[96m` | Modern, clean contrast |
| **Success** | Green | `\033[92m` | Universal "OK" signal |
| **Hints/Notes** | Yellow | `\033[93m` | Attention, informational |
| **Errors** | Red | `\033[91m` | Universal error signal |
| **Info** | Blue | `\033[94m` | Supplementary info |
| **Bold** | Bold | `\033[1m` | Emphasis |
| **Reset** | - | `\033[0m` | Clear formatting |

```python
# Ouroboros Brand Colors (Python implementation)
COLORS = {
    'border':    '\033[95m',  # Magenta (♾️ infinity, brand identity)
    'prompt':    '\033[96m',  # Cyan (modern, clean)
    'success':   '\033[92m',  # Green (confirmation)
    'warning':   '\033[93m',  # Yellow (hints, notes)
    'error':     '\033[91m',  # Red (errors)
    'info':      '\033[94m',  # Blue (informational)
    'reset':     '\033[0m',   # Reset all formatting
    'bold':      '\033[1m',   # Bold text
}
```

---

## 📝 Implementation Plan

### Phase 1: Core Scripts (Priority: High)

- [ ] **Task 1.1**: Create `.ouroboros/scripts/ccl.py`
  - All argument parsing (`--prompt`, `--header`, `--var`, `--no-ui`, `--no-color`, `--ascii`)
  - Multi-line support with robust exit detection
  - Optional Shift+Enter support via raw input (Windows)
  - Color/Unicode with fallbacks
  - File path detection and formatting
  - Shortcut key hints in UI
  - Clear output markers

- [ ] **Task 1.2**: Create `.ouroboros/scripts/toggle-enhanced.py`
  - Scan all `.github/*.md` files
  - Pattern matching for all input types (A-E)
  - Bidirectional toggle
  - Dry-run mode
  - Backup before changes

### Phase 2: Standardization (Priority: High)

- [ ] **Task 2.1**: Audit all agent files
  - List every input command
  - Categorize by type (A-E)
  - Note any non-standard formats

- [ ] **Task 2.2**: Update non-standard commands
  - Convert to standard format
  - Test each file

### Phase 3: Documentation (Priority: Medium)

- [ ] **Task 3.1**: Update README.md
  - Add "Optional Enhanced Mode" section
  - Platform compatibility notes
  - How to enable/disable

- [ ] **Task 3.2**: Update copilot-instructions.md
  - Add file input handling guidelines
  - Document `[FILE]`, `[IMAGE]`, `[VIDEO]` prefixes

- [ ] **Task 3.3**: Create INPUT_STANDARDS.md
  - Document all input types
  - Examples for contributors
  - Rules for new agents

### Phase 4: Testing (Priority: High)

- [ ] **Task 4.1**: Test on Windows 10+
- [ ] **Task 4.2**: Test on macOS
- [ ] **Task 4.3**: Test on Linux
- [ ] **Task 4.4**: Test on Windows < 10 (if available)
- [ ] **Task 4.5**: Verify Copilot correctly parses output markers
- [ ] **Task 4.6**: Test file drag-and-drop
- [ ] **Task 4.7**: Test multi-line paste scenarios
- [ ] **Task 4.8**: Test Shift+Enter on Windows (if implemented)

---

## 📁 File Inventory

### Files Containing Input Commands

| File | Input Types | Count |
|------|-------------|-------|
| `.github/copilot-instructions.md` | A | 3 |
| `.github/agents/ouroboros.agent.md` | A | 8 |
| `.github/prompts/ouroboros.prompt.md` | A, E | 7 |
| `.github/agents/ouroboros-init.agent.md` | A, D | 4 |
| `.github/agents/ouroboros-spec.agent.md` | A, B, C | 5 |
| `.github/agents/ouroboros-implement.agent.md` | A, B, C | 5 |
| `.github/agents/ouroboros-archive.agent.md` | A, B, D | 5 |
| `.github/agents/ouroboros-requirements.agent.md` | A, C | 2 |
| Other agent files | A (fallback only) | ~10 |

**Total estimated replacements**: ~50 input commands

---

## 🔄 Toggle Script Design

### Algorithm

```python
def toggle():
    # 1. Detect current mode
    sample_file = Path(".github/copilot-instructions.md")
    content = sample_file.read_text()
    current_mode = "enhanced" if "ccl.py" in content else "default"
    
    # 2. Define mappings
    mappings = get_mappings(current_mode)
    
    # 3. Backup files
    create_backup()
    
    # 4. Process all files
    for file in Path(".github").rglob("*.md"):
        update_file(file, mappings)
    
    # 5. Report
    new_mode = "default" if current_mode == "enhanced" else "enhanced"
    print(f"✅ Switched from {current_mode} to {new_mode}")
    print(f"   Updated X files with Y replacements")
```

### CLI Options

```bash
# Toggle mode
python .ouroboros/scripts/toggle-enhanced.py

# Dry run (preview changes)
python .ouroboros/scripts/toggle-enhanced.py --dry-run

# Force specific mode
python .ouroboros/scripts/toggle-enhanced.py --mode enhanced
python .ouroboros/scripts/toggle-enhanced.py --mode default

# Restore from backup
python .ouroboros/scripts/toggle-enhanced.py --restore
```

---

## ⚠️ Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Copilot fails to parse new format | High | Low | Clear `=== TASK START/END ===` markers |
| Windows < 10 display issues | Medium | Low | ASCII fallback mode |
| readline not available | Low | Medium | Graceful fallback, still works |
| Regex misses some patterns | Medium | Medium | Manual audit of all files |
| Toggle breaks a file | High | Low | Backup before toggle, dry-run mode |
| Multi-line paste lost | Medium | Medium | Documentation, warning messages |
| File path with spaces | Medium | Medium | Quote handling in detection |
| Shift+Enter fails on some terminals | Low | Medium | Fallback to `<<<` trigger |

---

## 🧪 Testing Plan

### Unit Tests for ccl.py

1. **Single-line input**: Standard task entry
2. **Multi-line input**: `<<<` / `>>>`, empty line confirm, Ctrl+D
3. **All argument combinations**: `--prompt`, `--header`, `--var`, etc.
4. **Fallback modes**: `--no-color`, `--ascii`, `--no-ui`
5. **Output format**: Verify `=== TASK START/END ===` markers
6. **File detection**: Various file types and paths
7. **Edge cases**: Paths with spaces, unicode filenames
8. **Shift+Enter** (Windows): Verify newline insertion if implemented

### Integration Tests

1. **Toggle script**: Run toggle, verify all files updated correctly
2. **Copilot parsing**: Ensure Copilot extracts correct task from markers
3. **CCL loop**: Verify Agent continues loop after input
4. **File handling**: Drag file, verify agent receives formatted path

### Platform Tests

| Platform | Test Items |
|----------|------------|
| Windows 10+ | Full features, file paths with backslashes, Shift+Enter |
| Windows < 10 | ASCII fallback, no color |
| macOS | Full features, file paths with forward slashes |
| Linux | Full features |

### Manual Test Scenarios

1. **Basic flow**: Start session → type task → verify loop continues
2. **Multi-line**: Enter multi-line code block → verify complete capture
3. **Paste test**: Paste 10-line code → verify all lines captured (after `<<<`)
4. **File drag**: Drag .py file → verify `[FILE]` output
5. **Image drag**: Drag .png → verify `[IMAGE]` output with warning
6. **Cancel**: Type partial input → Ctrl+C → verify clean exit
7. **Toggle**: Switch modes → verify all commands updated
8. **Shift+Enter** (Windows): Verify newline insertion in enhanced mode

---

## 🚀 CI/CD & Version Control

### Why CI/CD for Ouroboros?

| Purpose | Necessity | Benefit |
|---------|-----------|---------|
| Python syntax validation | ⭐⭐ Medium | Catch errors before merge |
| Markdown link checking | ⭐ Low | Maintain documentation quality |
| Automated release packaging | ⭐⭐⭐ High | Easy distribution |
| Version management | ⭐⭐ Medium | Track changes |
| Cross-platform testing | ⭐⭐⭐ High | Ensure ccl.py works everywhere |

### Proposed Workflow Files

#### 1. Validation Workflow (on PR/Push)

```yaml
# .github/workflows/validate.yml
name: Validate

on:
  push:
    branches: [main, dev]
  pull_request:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.x'
      
      - name: Check Python syntax
        run: |
          python -m py_compile .ouroboros/scripts/*.py
          echo "✅ Python syntax OK"
      
      - name: Check markdown links
        uses: gaurav-nelson/github-action-markdown-link-check@v1
        with:
          folder-path: '.'
        continue-on-error: true
```

#### 2. Release Workflow (on Tag)

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags: ['v*']

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Get version
        id: version
        run: echo "VERSION=${GITHUB_REF#refs/tags/}" >> $GITHUB_OUTPUT
      
      - name: Create release package
        run: |
          mkdir -p dist
          zip -r dist/ouroboros-${{ steps.version.outputs.VERSION }}.zip \
            .github/ .ouroboros/ README.md CHANGELOG.md LICENSE \
            -x "*.git*" -x "*workflow*"
      
      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: dist/*.zip
          generate_release_notes: true
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

#### 3. Cross-Platform Test Workflow

```yaml
# .github/workflows/test-ccl.yml
name: Test CCL Script

on:
  push:
    paths: ['.ouroboros/scripts/**']
  pull_request:
    paths: ['.ouroboros/scripts/**']

jobs:
  test:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        python: ['3.8', '3.10', '3.12']
    
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: ${{ matrix.python }}
      - run: python -m py_compile .ouroboros/scripts/ccl.py
      - run: python .ouroboros/scripts/ccl.py --help
```

### Version Control Strategy

#### Semantic Versioning
```
MAJOR.MINOR.PATCH
MAJOR: Breaking changes
MINOR: New features (like Enhanced CCL)
PATCH: Bug fixes
```

#### Release Process
1. Update `CHANGELOG.md`
2. Create tag: `git tag v2.1.0 && git push origin v2.1.0`
3. GitHub Actions creates release with zip

### Package Contents

```
ouroboros-v2.1.0.zip
├── .github/
│   ├── copilot-instructions.md
│   ├── agents/*.agent.md
│   └── prompts/*.prompt.md
├── .ouroboros/
│   ├── scripts/ccl.py, toggle-enhanced.py
│   ├── templates/
│   └── specs/
├── README.md, CHANGELOG.md, LICENSE
```

---

## 🔐 Subagent Terminal Permission Decision

### Question: Should subagents have permission to use `python -c` to ask users?

### Decision: ❌ **NO** — Subagents should NOT have independent terminal input permission.

### Rationale

| Concern | Problem if Allowed | Solution |
|---------|-------------------|----------|
| **Control flow confusion** | User doesn't know which agent is asking | All interactions handled by Orchestrator |
| **Context fragmentation** | Subagent Q&A cannot be effectively tracked | Subagent returns "needs confirmation" status to Orchestrator |
| **Architecture consistency** | Violates Ouroboros delegation design | Maintain clear hierarchical structure |

### Correct Pattern

```
User → Orchestrator (CCL) → Subagent (execute task)
                ↑                    ↓
                ╰─── When user input needed ←──┘
                  Subagent returns to Orchestrator
                  Orchestrator collects questions and asks user uniformly
```

### What Subagents SHOULD Do

When a subagent needs user input:

1. **STOP** execution
2. **RETURN** to orchestrator with status:
   ```
   [NEED_USER_INPUT]
   Question: [specific question]
   Options: [if multiple choice, list options]
   Context: [why this information is needed]
   ```
3. **WAIT** for orchestrator to collect user input via CCL
4. **RECEIVE** input from orchestrator in next dispatch

### Implementation Location

This rule should be added to:
- `copilot-instructions.md` (Section: Subagent Behavior)
- All subagent files under "FORBIDDEN BEHAVIORS"

---

## 📐 Terminal Input Standardization Specification

> [!IMPORTANT]
> **Strict Specification** - Must be written into each agent file to ensure compliance

### Purpose

Standardize all `python -c` input commands to enable:
1. Reliable toggle script replacement
2. Future UI layer parsing and enhancement
3. Consistent user experience across all agents

### Input Type Classification

| Type | Variable | Pattern | Purpose |
|------|----------|---------|---------|
| **A** | `task` | `input('[Ouroboros] > ')` | Standard task input |
| **B** | `choice` | `print('[1] X [2] Y'); input('Choice: ')` | Menu selection |
| **C** | `feature` | `input('Feature name: ')` | Free-form naming |
| **D** | `confirm` | `input('[y/n]: ')` | Yes/No confirmation |
| **E** | `question` | `input('Question: ')` | Free-form question |

### Menu Selection Standardization (Type B) — **STRICT FORMAT**

> [!CAUTION]
> **Menu selections must use the following format exactly, no deviations allowed!**

#### Required Format

```python
# Two options
python -c "print('\\n[1] Option A\\n[2] Option B'); choice = input('Choice (1/2): ')"

# Three options
python -c "print('\\n[1] Option A\\n[2] Option B\\n[3] Option C'); choice = input('Choice (1-3): ')"

# Multiple options
python -c "print('\\n[1] Option A\\n[2] Option B\\n[3] Option C\\n[4] Option D'); choice = input('Choice (1-4): ')"
```

#### Forbidden Formats

```python
# ❌ WRONG: Using letters
python -c "print('[a] X [b] Y'); choice = input('Choice: ')"

# ❌ WRONG: Non-bracket format
python -c "print('1) Option 1\\n2) Option 2'); ..."

# ❌ WRONG: Using dashes
python -c "print('- Option 1\\n- Option 2'); ..."

# ❌ WRONG: No numbering
python -c "print('Option A\\nOption B'); ..."
```

#### Why Numbers, Not Letters?

| Reason | Explanation |
|--------|-------------|
| **Keyboard efficiency** | Numbers on top row, reachable with one hand |
| **Universality** | Numbers are consistent across all languages |
| **UI parsing** | `[1]`, `[2]`, `[3]` easy to match with regex |
| **Future expansion** | Numbers can support more options (1-9+) |

### Confirmation Standardization (Type D)

```python
# Standard confirmation
python -c "confirm = input('Confirm execution? [y/n]: ')"

# With context
python -c "print('Will delete all test data'); confirm = input('[y/n]: ')"
```

**Accepted inputs**: `y`, `Y`, `yes`, `Yes`, `n`, `N`, `no`, `No`

### UI Layer Parsing Rules

Future `ccl.py` or advanced UI can parse these patterns:

```python
# Detect menu options
pattern = r'\[(\d+)\]\s*([^\[]+)'  # Matches [1] Label

# Detect confirmation
pattern = r'\[y/n\]'

# Detect standard CCL
pattern = r"\[Ouroboros\] >"
```

**UI Transformation Examples:**

| Terminal Command | UI Can Transform To |
|-----------------|---------------------|
| `[1] Deploy [2] Cancel` | Two buttons |
| `[y/n]:` | Yes/No buttons |
| `[1] [2] [3] [4]` | Dropdown selector or button group |

---

## 📝 Agent-Level Enforcement Template

> [!IMPORTANT]
> **The following specification should be added to each agent file**

### Template to Add to ALL Agent Files

```markdown
## 🚨 TERMINAL INPUT STANDARDIZATION (MANDATORY)

> [!CAUTION]
> **All terminal input must follow standard format. Violation = System error.**

### Menu Selection Format

When presenting choices to user via CCL, MUST use:

\`\`\`python
python -c "print('\\n[1] Option1\\n[2] Option2\\n[3] Option3'); choice = input('Choice (1-3): ')"
\`\`\`

**Rules:**
- Use `[1]`, `[2]`, `[3]` numbering ONLY (no letters, no other formats)
- Each option on its own line with `\\n`
- Prompt ends with `Choice (1-N):` format

### Confirmation Format

\`\`\`python
python -c "confirm = input('[y/n]: ')"
\`\`\`

### ❌ FORBIDDEN

- ❌ Using letters `[a]`, `[b]`, `[c]`
- ❌ Using dashes `- Option`
- ❌ Using parentheses `1)`, `2)`
- ❌ Free-form option formats
- ❌ Asking user questions directly without returning to orchestrator
```

### Files to Update

| File | Has Menu Selection? | Priority |
|------|---------------------|----------|
| `copilot-instructions.md` | N/A (global rules) | ⭐⭐⭐ High |
| `ouroboros.agent.md` | ✅ Yes (CCL) | ⭐⭐⭐ High |
| `ouroboros-spec.agent.md` | ✅ Yes (phase menu) | ⭐⭐⭐ High |
| `ouroboros-implement.agent.md` | ✅ Yes (mode menu) | ⭐⭐⭐ High |
| `ouroboros-archive.agent.md` | ✅ Yes (action menu) | ⭐⭐ Medium |
| `ouroboros-init.agent.md` | ⚠️ Possibly | ⭐⭐ Medium |
| All other agents | ⚠️ Fallback CCL only | ⭐ Low |

---

## 📋 Implementation Checklist (Input Standardization)

### Phase A: Document Rules (This Document) ✅
- [x] Define subagent permission decision
- [x] Define standardization format
- [x] Create enforcement template

### Phase B: Update Agent Files (TODO)
- [ ] **B.1**: Add standardization section to `copilot-instructions.md`
- [ ] **B.2**: Update `ouroboros.agent.md`
- [ ] **B.3**: Update `ouroboros-spec.agent.md`
- [ ] **B.4**: Update `ouroboros-implement.agent.md`
- [ ] **B.5**: Update `ouroboros-archive.agent.md`
- [ ] **B.6**: Update `ouroboros-init.agent.md`
- [ ] **B.7**: Audit all other agents for non-standard patterns

### Phase C: Verify Existing Commands (TODO)
- [ ] **C.1**: Grep all `python -c` in `.github/`
- [ ] **C.2**: Identify non-standard patterns
- [ ] **C.3**: Fix non-compliant commands

---

## ✅ Summary

### What We're Building

1. **ccl.py**: Enhanced input with multi-line, colors, file detection
   - Optional Shift+Enter support via raw keyboard input (Windows)
   - Fallback to `<<<`/`>>>` triggers for all platforms
2. **toggle-enhanced.py**: One-click mode switcher
3. **Standardized input formats**: Consistent patterns
4. **Documentation**: README, INPUT_STANDARDS
5. **CI/CD**: GitHub Actions for validation, testing, releases

### Dependencies

| Required | Optional |
|----------|----------|
| Python 3.6+ | `readline` (Linux/macOS) |
| `sys`, `argparse`, `pathlib`, `re`, `os` | `pyreadline3` (Windows) |
| `msvcrt` (Windows) / `termios` (Unix) for Shift+Enter | |

### Compatibility

| Platform | Status |
|----------|--------|
| Windows 10+ | ✅ Full support (including Shift+Enter) |
| Windows < 10 | ⚠️ Degraded (ASCII, no color) |
| macOS | ✅ Full support |
| Linux | ✅ Full support |

### Feature Matrix

| Feature | Default | Enhanced |
|---------|---------|----------|
| Single-line | ✅ | ✅ |
| Multi-line | ❌ | ✅ |
| Shift+Enter | ❌ | ⚠️ Windows only |
| History | ❌ | ⚠️ Platform-dependent |
| Colors | ❌ | ✅ |
| File detection | ❌ | ✅ |

---

*Plan documented 2025-12-12 v5.0. Ready for implementation upon approval.*
