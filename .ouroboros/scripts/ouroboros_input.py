#!/usr/bin/env python3
"""
ouroboros_input.py - Enhanced CCL Input Handler v2.0

Part of the Ouroboros system. Provides enhanced terminal input with:
- Real-time character input with dynamic UI
- Pre-reserved input box with visible borders
- Mystic Purple theme
- Multi-line support (<<< to start, >>> to end)
- Auto paste detection
- File path detection

Output separation:
- stderr: UI decorations (user sees)
- stdout: Clean formatted output (Copilot reads)

Usage:
    python ouroboros_input.py                                    # Type A: CCL
    python ouroboros_input.py --header "MENU" --prompt "Choice:" # Type B: Menu
    python ouroboros_input.py --prompt "Name:" --var feature     # Type C: Free-form

Dependencies: Python 3.6+ standard library only (msvcrt/tty/termios)
"""

import sys
import os
import argparse
import json

# Add script directory to path for imports
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

# Config and history file paths
CONFIG_FILE = os.path.join(SCRIPT_DIR, 'ouroboros.config.json')
HISTORY_FILE = os.path.join(SCRIPT_DIR, 'ouroboros.history')

try:
    from ouroboros_keybuffer import KeyBuffer, Keys, is_pipe_input
    from ouroboros_ui import (
        ANSI, THEME, BOX, WelcomeBox, InputBox, OutputBox, SelectMenu,
        write, writeln, get_terminal_size, visible_len, pad_text, strip_ansi
    )
    MODULES_AVAILABLE = True
except ImportError:
    MODULES_AVAILABLE = False

VERSION = "2.0.0"

# =============================================================================
# CONFIG MANAGER
# =============================================================================

DEFAULT_CONFIG = {
    "platform": "windows" if sys.platform == 'win32' else "unix",
    "ansi_colors": True,
    "unicode_box": True,
    "theme": "mystic_purple",
    "auto_multiline": True,
    "compress_threshold": 10,
    "history_max_entries": 1000,
    "use_fallback_input": False,  # Set to True if IME input doesn't work
}


class ConfigManager:
    """Manages configuration with file persistence."""

    def __init__(self, config_file: str = CONFIG_FILE):
        self.config_file = config_file
        self.config = dict(DEFAULT_CONFIG)
        self._load()

    def _load(self) -> None:
        """Load config from file, create with defaults if not exists."""
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    loaded = json.load(f)
                    self.config.update(loaded)
            else:
                # Create default config file
                self._save()
        except (IOError, OSError, json.JSONDecodeError):
            pass

    def _save(self) -> None:
        """Save config to file."""
        try:
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, indent=2)
        except (IOError, OSError):
            pass

    def get(self, key: str, default=None):
        """Get config value."""
        return self.config.get(key, default)

    def set(self, key: str, value) -> None:
        """Set config value and save."""
        self.config[key] = value
        self._save()


# Global config instance
_config = None


def get_config() -> ConfigManager:
    """Get or create global config manager."""
    global _config
    if _config is None:
        _config = ConfigManager()
    return _config


# =============================================================================
# HISTORY MANAGER
# =============================================================================

class HistoryManager:
    """Manages command history with file persistence."""

    def __init__(self, history_file: str = HISTORY_FILE, max_entries: int = None):
        self.history_file = history_file
        # Use config value if not specified
        if max_entries is None:
            max_entries = get_config().get('history_max_entries', 1000)
        self.max_entries = max_entries
        self.entries = []
        self.position = 0  # Current position in history (0 = newest)
        self._temp_current = ''  # Temp storage for current input when browsing
        self._load()
    
    def _load(self) -> None:
        """Load history from file."""
        try:
            if os.path.exists(self.history_file):
                with open(self.history_file, 'r', encoding='utf-8') as f:
                    lines = f.read().strip().split('\n')
                    self.entries = [line for line in lines if line.strip()]
        except (IOError, OSError):
            self.entries = []
        self.position = len(self.entries)  # Start at end (newest)
    
    def _save(self) -> None:
        """Save history to file."""
        try:
            # Keep only max_entries
            entries_to_save = self.entries[-self.max_entries:]
            with open(self.history_file, 'w', encoding='utf-8') as f:
                f.write('\n'.join(entries_to_save) + '\n')
        except (IOError, OSError):
            pass
    
    def add(self, entry: str) -> None:
        """Add entry to history (avoid duplicates of last entry)."""
        entry = entry.strip()
        if not entry:
            return
        # Avoid duplicate of last entry
        if self.entries and self.entries[-1] == entry:
            return
        self.entries.append(entry)
        self._save()
        self.reset_position()
    
    def reset_position(self) -> None:
        """Reset position to end of history."""
        self.position = len(self.entries)
        self._temp_current = ''
    
    def go_back(self, current_input: str = '') -> str:
        """Go back in history (older). Returns the history entry or current input."""
        if not self.entries:
            return current_input
        
        # Save current input when starting to browse
        if self.position == len(self.entries):
            self._temp_current = current_input
        
        if self.position > 0:
            self.position -= 1
            return self.entries[self.position]
        
        return self.entries[0] if self.entries else current_input
    
    def go_forward(self) -> str:
        """Go forward in history (newer). Returns the history entry or temp current."""
        if self.position < len(self.entries) - 1:
            self.position += 1
            return self.entries[self.position]
        elif self.position == len(self.entries) - 1:
            self.position = len(self.entries)
            return self._temp_current
        return self._temp_current
    
    def search(self, prefix: str) -> list:
        """Search history entries starting with prefix."""
        if not prefix:
            return self.entries[-10:]  # Return last 10
        return [e for e in self.entries if e.startswith(prefix)][-10:]
    
    @property
    def at_end(self) -> bool:
        """Check if at end of history (newest position)."""
        return self.position >= len(self.entries)
    
    @property
    def at_start(self) -> bool:
        """Check if at start of history (oldest position)."""
        return self.position <= 0


# Global history instance
_history = None

def get_history() -> HistoryManager:
    """Get or create global history manager."""
    global _history
    if _history is None:
        _history = HistoryManager()
    return _history


# =============================================================================
# FALLBACK IMPLEMENTATIONS (if modules not available)
# =============================================================================

if not MODULES_AVAILABLE:
    # Minimal fallback - use standard input()
    def is_pipe_input():
        return not sys.stdin.isatty()
    
    class THEME:
        pass
    THEME = {
        'border': '\033[95m',
        'prompt': '\033[96m',
        'success': '\033[92m',
        'warning': '\033[93m',
        'error': '\033[91m',
        'info': '\033[94m',
        'reset': '\033[0m',
    }
    
    def write(text):
        sys.stderr.write(text)
        sys.stderr.flush()
    
    def writeln(text=''):
        write(text + '\n')

# =============================================================================
# TEXT BUFFER
# =============================================================================

class TextBuffer:
    """Multi-line text buffer with cursor management."""
    
    def __init__(self):
        self.lines = ['']
        self.cursor_row = 0
        self.cursor_col = 0
        self.scroll_offset = 0  # For viewport scrolling
    
    @property
    def text(self) -> str:
        return '\n'.join(self.lines)
    
    @property
    def line_count(self) -> int:
        return len(self.lines)
    
    def insert_char(self, char: str) -> None:
        line = self.lines[self.cursor_row]
        self.lines[self.cursor_row] = line[:self.cursor_col] + char + line[self.cursor_col:]
        self.cursor_col += 1
    
    def insert_text(self, text: str) -> None:
        """Insert multi-character text (e.g., paste)."""
        for char in text:
            if char == '\n':
                self.newline()
            elif char != '\r':
                self.insert_char(char)
    
    def insert_formatted_paste(self, text: str) -> None:
        """Insert text with formatting preserved (for Ctrl+Shift+Enter paste)."""
        # Normalize line endings
        text = text.replace('\r\n', '\n').replace('\r', '\n')
        # Strip trailing whitespace from each line but preserve structure
        lines = [line.rstrip() for line in text.split('\n')]
        # Remove empty lines at start/end
        while lines and not lines[0]:
            lines.pop(0)
        while lines and not lines[-1]:
            lines.pop()
        # Insert
        for i, line in enumerate(lines):
            if i > 0:
                self.newline()
            for char in line:
                self.insert_char(char)
    
    def newline(self) -> None:
        line = self.lines[self.cursor_row]
        self.lines[self.cursor_row] = line[:self.cursor_col]
        self.lines.insert(self.cursor_row + 1, line[self.cursor_col:])
        self.cursor_row += 1
        self.cursor_col = 0
    
    def backspace(self) -> bool:
        if self.cursor_col > 0:
            line = self.lines[self.cursor_row]
            self.lines[self.cursor_row] = line[:self.cursor_col-1] + line[self.cursor_col:]
            self.cursor_col -= 1
            return True
        elif self.cursor_row > 0:
            prev_line = self.lines[self.cursor_row - 1]
            curr_line = self.lines[self.cursor_row]
            self.lines[self.cursor_row - 1] = prev_line + curr_line
            del self.lines[self.cursor_row]
            self.cursor_row -= 1
            self.cursor_col = len(prev_line)
            return True
        return False
    
    def delete(self) -> bool:
        """Delete character at cursor (like Delete key)."""
        line = self.lines[self.cursor_row]
        if self.cursor_col < len(line):
            self.lines[self.cursor_row] = line[:self.cursor_col] + line[self.cursor_col+1:]
            return True
        elif self.cursor_row < len(self.lines) - 1:
            # Merge with next line
            next_line = self.lines[self.cursor_row + 1]
            self.lines[self.cursor_row] = line + next_line
            del self.lines[self.cursor_row + 1]
            return True
        return False
    
    def move_left(self) -> bool:
        if self.cursor_col > 0:
            self.cursor_col -= 1
            return True
        elif self.cursor_row > 0:
            self.cursor_row -= 1
            self.cursor_col = len(self.lines[self.cursor_row])
            return True
        return False
    
    def move_right(self) -> bool:
        line = self.lines[self.cursor_row]
        if self.cursor_col < len(line):
            self.cursor_col += 1
            return True
        elif self.cursor_row < len(self.lines) - 1:
            self.cursor_row += 1
            self.cursor_col = 0
            return True
        return False
    
    def move_up(self) -> bool:
        if self.cursor_row > 0:
            self.cursor_row -= 1
            self.cursor_col = min(self.cursor_col, len(self.lines[self.cursor_row]))
            return True
        return False
    
    def move_down(self) -> bool:
        if self.cursor_row < len(self.lines) - 1:
            self.cursor_row += 1
            self.cursor_col = min(self.cursor_col, len(self.lines[self.cursor_row]))
            return True
        return False
    
    def home(self) -> None:
        self.cursor_col = 0
    
    def end(self) -> None:
        self.cursor_col = len(self.lines[self.cursor_row])
    
    def clear(self) -> None:
        self.lines = ['']
        self.cursor_row = 0
        self.cursor_col = 0
        self.scroll_offset = 0
    
    def clear_line(self) -> None:
        """Clear current line."""
        self.lines[self.cursor_row] = ''
        self.cursor_col = 0
    
    def get_visible_lines(self, viewport_height: int) -> list:
        """Get lines visible in viewport with scrolling."""
        # Adjust scroll to keep cursor visible
        if self.cursor_row < self.scroll_offset:
            self.scroll_offset = self.cursor_row
        elif self.cursor_row >= self.scroll_offset + viewport_height:
            self.scroll_offset = self.cursor_row - viewport_height + 1
        
        # Return visible lines
        start = self.scroll_offset
        end = min(start + viewport_height, len(self.lines))
        return self.lines[start:end]
    
    def get_visible_cursor_row(self) -> int:
        """Get cursor row relative to viewport."""
        return self.cursor_row - self.scroll_offset


# =============================================================================
# CONTENT DETECTION
# =============================================================================

import re

# File path patterns
FILE_PATH_PATTERNS = [
    # Windows paths: C:\path\to\file.ext or "C:\path with spaces\file.ext"
    re.compile(r'^[A-Za-z]:\\(?:[^\\/:*?"<>|\r\n]+\\)*[^\\/:*?"<>|\r\n]*$'),
    # Unix paths: /path/to/file or ~/path/to/file
    re.compile(r'^(?:/|~/)(?:[^/\0]+/)*[^/\0]*$'),
    # Relative paths: ./file or ../file
    re.compile(r'^\.\.?/(?:[^/\0]+/)*[^/\0]*$'),
]

# Image extensions
IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg', '.ico', '.tiff', '.tif'}

# Document extensions
DOC_EXTENSIONS = {'.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.md', '.rtf'}

# Code extensions
CODE_EXTENSIONS = {'.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.c', '.cpp', '.h', '.hpp',
                   '.cs', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala', '.sh', '.bash',
                   '.html', '.css', '.scss', '.sass', '.less', '.json', '.xml', '.yaml', '.yml',
                   '.sql', '.r', '.m', '.lua', '.pl', '.pm'}


def detect_file_path(text: str) -> str:
    """Detect if text is a file path. Returns the path or empty string."""
    text = text.strip().strip('"').strip("'")
    for pattern in FILE_PATH_PATTERNS:
        if pattern.match(text):
            return text
    return ''


def get_file_extension(path: str) -> str:
    """Get lowercase file extension from path."""
    if '.' in path:
        return '.' + path.rsplit('.', 1)[-1].lower()
    return ''


def format_file_reference(path: str) -> str:
    """Format a file path as a reference string."""
    ext = get_file_extension(path)
    filename = path.replace('\\', '/').rsplit('/', 1)[-1] if '/' in path or '\\' in path else path
    
    if ext in IMAGE_EXTENSIONS:
        # For images, try to get dimensions (placeholder - would need PIL)
        return f"[image: {filename}]"
    elif ext in DOC_EXTENSIONS:
        return f"[doc: {filename}]"
    elif ext in CODE_EXTENSIONS:
        return f"[code: {filename}]"
    else:
        return f"[file: {filename}]"


def format_paste_summary(text: str) -> str:
    """Format a multi-line paste as a summary."""
    lines = text.split('\n')
    line_count = len(lines)
    
    if line_count == 1:
        return text
    
    # Check if it looks like code
    code_indicators = ['{', '}', 'def ', 'function ', 'class ', 'import ', 'from ', '#include']
    is_code = any(indicator in text for indicator in code_indicators)
    
    if is_code:
        return f"[code: {line_count} lines]"
    else:
        return f"[text: {line_count} lines]"


def detect_and_format_input(text: str) -> tuple:
    """
    Detect input type and format appropriately.
    Returns (formatted_display, actual_content, input_type)
    
    input_type: 'text', 'file', 'image', 'doc', 'code', 'multiline'
    """
    text = text.strip()
    
    # Check for file path
    file_path = detect_file_path(text)
    if file_path:
        ext = get_file_extension(file_path)
        if ext in IMAGE_EXTENSIONS:
            return (format_file_reference(file_path), file_path, 'image')
        elif ext in DOC_EXTENSIONS:
            return (format_file_reference(file_path), file_path, 'doc')
        elif ext in CODE_EXTENSIONS:
            return (format_file_reference(file_path), file_path, 'code')
        else:
            return (format_file_reference(file_path), file_path, 'file')
    
    # Check for multi-line content
    if '\n' in text:
        line_count = len(text.split('\n'))
        return (format_paste_summary(text), text, 'multiline')
    
    return (text, text, 'text')


# =============================================================================
# INPUT FUNCTIONS
# =============================================================================

def get_interactive_input_advanced(show_ui: bool = True) -> str:
    """
    Get input using real-time character-by-character reading.
    
    Key bindings:
        Enter           - Insert new line (default multi-line mode)
        Ctrl+D          - Force submit (always works)
        Ctrl+Enter      - Force submit (may not work in some terminals)
        Ctrl+Shift+Enter- Format paste mode
        >>>             - Submit and exit
        <<<             - Legacy multi-line start (still works)
        Ctrl+C          - Cancel
        Ctrl+U          - Clear current line
        Ctrl+K          - Delete to end of line
        ↑/↓             - History navigation (first line) / Cursor move
        ←/→             - Cursor navigation
        Home/End        - Line start/end
        Backspace       - Delete before cursor
        Delete          - Delete at cursor
    """
    # Check if fallback mode is enabled (for IME support)
    if not MODULES_AVAILABLE or get_config().get('use_fallback_input', False):
        return get_fallback_input(show_ui)
    
    if show_ui:
        WelcomeBox.render()
    
    buffer = TextBuffer()
    history = get_history()
    # InputBox: start with 3 lines, always multiline mode
    box = InputBox(height=3, show_line_numbers=True, show_status=True, full_width=True)
    box.set_mode("INPUT")  # Simple mode name
    
    if show_ui:
        box.render_initial()
    
    history_browsing = False  # Track if we're browsing history
    
    def refresh_display():
        """Refresh the entire input box display."""
        visible_lines = buffer.get_visible_lines(box.height)
        for i in range(box.height):
            line_text = visible_lines[i] if i < len(visible_lines) else ''
            box.update_line(i, line_text)
        visible_row = buffer.get_visible_cursor_row()
        box.set_scroll_info(buffer.line_count, buffer.scroll_offset)
        # Pass text before cursor for correct CJK width calculation
        current_line = buffer.lines[buffer.cursor_row]
        text_before = current_line[:buffer.cursor_col]
        box.set_cursor(visible_row, buffer.cursor_col, text_before)
    
    def show_status(msg: str):
        """Show a status message in the first line."""
        box.update_line(0, f"{THEME['info']}{msg}{THEME['reset']}")
    
    with KeyBuffer() as kb:
        while True:
            try:
                key = kb.getch()
                
                # Ctrl+C - Cancel
                if key == Keys.CTRL_C:
                    writeln(f"\n{THEME['error']}[x] Cancelled{THEME['reset']}")
                    sys.exit(130)
                
                # Handle Enter variants
                if kb.is_enter(key):
                    text = buffer.text.strip()
                    
                    # Ctrl+Enter - Submit
                    if key == Keys.CTRL_ENTER:
                        if text:
                            history.add(text)
                            if show_ui:
                                box.finish()
                            return text
                        continue
                
                # Ctrl+D - Force submit (reliable alternative to Ctrl+Enter)
                if key == Keys.CTRL_D:
                    text = buffer.text.strip()
                    if text:
                        history.add(text)
                        if show_ui:
                            box.finish()
                        return text
                    continue
                    
                    # Check for >>> end marker
                    if text.rstrip().endswith('>>>'):
                        final_text = text.rsplit('>>>', 1)[0].rstrip()
                        if final_text:
                            history.add(final_text)
                        if show_ui:
                            box.finish()
                        return final_text
                    
                    # Regular Enter or Ctrl+J/L - Add newline
                    buffer.newline()
                    if buffer.line_count > box.height:
                        box.expand_height(min(buffer.line_count + 2, 15))
                    refresh_display()
                    continue
                
                # Backspace
                if kb.is_backspace(key):
                    old_row = buffer.cursor_row
                    if buffer.backspace():
                        refresh_display()
                    continue
                
                # Delete
                if kb.is_delete(key):
                    if buffer.delete():
                        refresh_display()
                    continue
                
                # Arrow keys - Up for history when on first line
                if key == Keys.UP:
                    if multiline_mode:
                        # Multiline: move cursor up
                        if buffer.move_up():
                            refresh_display()
                    else:
                        # Single line: browse history (older)
                        hist_entry = history.go_back(buffer.text)
                        if hist_entry != buffer.text:
                            buffer.clear()
                            buffer.insert_text(hist_entry)
                            history_browsing = True
                            refresh_display()
                    continue
                if key == Keys.DOWN:
                    if multiline_mode:
                        # Multiline: move cursor down
                        if buffer.move_down():
                            refresh_display()
                    else:
                        # Single line: browse history (newer)
                        if history_browsing:
                            hist_entry = history.go_forward()
                            buffer.clear()
                            buffer.insert_text(hist_entry)
                            if history.at_end:
                                history_browsing = False
                            refresh_display()
                    continue
                if key == Keys.LEFT:
                    if buffer.move_left():
                        visible_row = buffer.get_visible_cursor_row()
                        text_before = buffer.lines[buffer.cursor_row][:buffer.cursor_col]
                        box.set_cursor(visible_row, buffer.cursor_col, text_before)
                    continue
                if key == Keys.RIGHT:
                    if buffer.move_right():
                        visible_row = buffer.get_visible_cursor_row()
                        text_before = buffer.lines[buffer.cursor_row][:buffer.cursor_col]
                        box.set_cursor(visible_row, buffer.cursor_col, text_before)
                    continue
                
                # Home/End
                if key in (Keys.HOME, Keys.HOME_ALT, Keys.CTRL_A):
                    buffer.home()
                    visible_row = buffer.get_visible_cursor_row()
                    box.set_cursor(visible_row, buffer.cursor_col, '')  # At start, no text before
                    continue
                if key in (Keys.END, Keys.END_ALT, Keys.CTRL_E):
                    buffer.end()
                    visible_row = buffer.get_visible_cursor_row()
                    text_before = buffer.lines[buffer.cursor_row][:buffer.cursor_col]
                    box.set_cursor(visible_row, buffer.cursor_col, text_before)
                    continue
                
                # Ctrl+U - Clear current line
                if key == Keys.CTRL_U:
                    buffer.clear_line()
                    refresh_display()
                    continue
                
                # Ctrl+K - Delete to end of line
                if key == Keys.CTRL_K:
                    line = buffer.lines[buffer.cursor_row]
                    buffer.lines[buffer.cursor_row] = line[:buffer.cursor_col]
                    refresh_display()
                    continue
                
                # Printable characters
                if kb.is_printable(key):
                    # Check for paste (rapid input)
                    if kb.is_pasting and format_paste_mode:
                        # Read rest of paste
                        paste_text = kb.read_paste(key)
                        buffer.insert_formatted_paste(paste_text)
                        format_paste_mode = False
                        multiline_mode = True
                        update_mode()
                        refresh_display()
                    else:
                        buffer.insert_char(key)
                        visible_row = buffer.get_visible_cursor_row()
                        if visible_row < box.height:
                            box.update_line(visible_row, buffer.lines[buffer.cursor_row])
                            # Skip status bar update during typing to avoid cursor flicker
                            # (especially important for IME input like Chinese pinyin)
                            text_before = buffer.lines[buffer.cursor_row][:buffer.cursor_col]
                            box.set_cursor(visible_row, buffer.cursor_col, text_before, update_status=False)
                
            except KeyboardInterrupt:
                writeln(f"\n{THEME['error']}[x] Cancelled{THEME['reset']}")
                sys.exit(130)
    
    return buffer.text


def get_fallback_input(show_ui: bool = True) -> str:
    """Fallback input using standard input() when modules not available."""
    c = THEME
    
    if show_ui:
        writeln()
        writeln(f"{c['border']}╔{'═' * 50}╗{c['reset']}")
        writeln(f"{c['border']}║{c['reset']}  [*]  Ouroboros - Awaiting Command{' ' * 15}{c['border']}║{c['reset']}")
        writeln(f"{c['border']}╚{'═' * 50}╝{c['reset']}")
        writeln()
    
    write(f"{c['prompt']}>{c['reset']} ")
    
    try:
        line = input()
        if line.strip() == '<<<':
            # Multiline mode
            writeln(f"  {c['info']}Multi-line mode. Type >>> to submit:{c['reset']}")
            lines = []
            while True:
                try:
                    next_line = input("  │ ")
                    if next_line.strip() == '>>>':
                        break
                    lines.append(next_line)
                except EOFError:
                    break
            return '\n'.join(lines)
        return line
    except EOFError:
        return ""
    except KeyboardInterrupt:
        writeln(f"\n{c['error']}[x] Cancelled{c['reset']}")
        sys.exit(130)


def get_pipe_input() -> str:
    """Read input from pipe/stdin."""
    return sys.stdin.read().strip()


def get_simple_input(prompt: str = "") -> str:
    """Simple input for Type B/C/D/E prompts."""
    if prompt:
        write(prompt + " ")
    try:
        return input()
    except EOFError:
        return ""
    except KeyboardInterrupt:
        writeln(f"\n{THEME['error']}[x] Cancelled{THEME['reset']}")
        sys.exit(130)


def get_selection_input(options: list, title: str = "Select an option:", 
                        allow_custom: bool = True) -> str:
    """
    Interactive selection menu with arrow key navigation.
    Returns the selected option or custom input.
    
    Controls:
        Up/Down     - Navigate options
        Enter       - Select current option
        1-9         - Quick select by number
        /           - Start typing to filter (if many options)
        Ctrl+C      - Cancel
    """
    if not MODULES_AVAILABLE:
        # Fallback to numbered selection
        writeln(title)
        for i, opt in enumerate(options):
            writeln(f"  {i+1}. {opt}")
        if allow_custom:
            writeln(f"  {len(options)+1}. [Custom input...]")
        choice = get_simple_input("Enter number: ")
        try:
            idx = int(choice) - 1
            if 0 <= idx < len(options):
                return options[idx]
            elif allow_custom and idx == len(options):
                return get_simple_input("Enter custom input: ")
        except ValueError:
            pass
        return choice  # Return as-is if invalid
    
    menu = SelectMenu(options, title=title, allow_custom=allow_custom)
    menu.render()
    
    with KeyBuffer() as kb:
        while True:
            try:
                key = kb.getch()
                
                if key == Keys.CTRL_C:
                    writeln(f"\n{THEME['error']}[x] Cancelled{THEME['reset']}")
                    sys.exit(130)
                
                # Arrow navigation
                if key == Keys.UP:
                    menu.move_up()
                    continue
                
                if key == Keys.DOWN:
                    menu.move_down()
                    continue
                
                # Quick number selection (1-9)
                if key.isdigit() and key != '0':
                    num = int(key) - 1
                    total = len(options) + (1 if allow_custom else 0)
                    if 0 <= num < total:
                        menu.selected_index = num
                        menu.clear_and_rerender()
                    continue
                
                # Home/End for quick navigation
                if key in (Keys.HOME, Keys.HOME_ALT):
                    menu.selected_index = 0
                    menu.clear_and_rerender()
                    continue
                if key in (Keys.END, Keys.END_ALT):
                    menu.selected_index = len(menu.options) - 1
                    menu.clear_and_rerender()
                    continue
                
                # Enter to select
                if kb.is_enter(key):
                    idx, value, is_custom = menu.get_selected()
                    writeln()  # Clear line
                    
                    if is_custom:
                        # Show enhanced custom input box
                        writeln(f"\n{THEME['prompt']}Custom input:{THEME['reset']}")
                        return get_interactive_input_advanced(show_ui=True)
                    else:
                        return value
                
            except KeyboardInterrupt:
                writeln(f"\n{THEME['error']}[x] Cancelled{THEME['reset']}")
                sys.exit(130)


# =============================================================================
# OUTPUT FUNCTIONS
# =============================================================================

def format_output(marker: str, content: str) -> None:
    """Output formatted content to stdout for Copilot."""
    if MODULES_AVAILABLE:
        OutputBox.render(marker, content)
    else:
        # Fallback output
        print(f"┌{'─' * 40}┐")
        print(f"│ [>] {marker.upper()}")
        print(f"├{'─' * 40}┤")
        print(content)
        print(f"└{'─' * 40}┘")


def print_header_box(header: str) -> None:
    """Print a header/menu box (Type B)."""
    c = THEME
    writeln()
    writeln(f"{c['border']}╔{'═' * 50}╗{c['reset']}")
    for line in header.split('\\n'):
        padded = line[:48].ljust(48)
        writeln(f"{c['border']}║{c['reset']} {padded} {c['border']}║{c['reset']}")
    writeln(f"{c['border']}╚{'═' * 50}╝{c['reset']}")
    writeln()


# =============================================================================
# MAIN
# =============================================================================

def parse_args():
    parser = argparse.ArgumentParser(
        description='Ouroboros Enhanced Input Handler v2',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument('--var', default='task', help='Variable name for output marker')
    parser.add_argument('--prompt', default='', help='Custom prompt text')
    parser.add_argument('--header', default='', help='Header/menu text (Type B)')
    parser.add_argument('--options', nargs='+', help='Options for selection menu (space-separated)')
    parser.add_argument('--no-custom', action='store_true', help='Disable custom input in selection menu')
    parser.add_argument('--no-ui', action='store_true', help='Disable UI decorations')
    parser.add_argument('--ascii', action='store_true', help='Use ASCII characters')
    parser.add_argument('--no-color', action='store_true', help='Disable colors')
    parser.add_argument('--reset-config', action='store_true', help='Reset configuration')
    parser.add_argument('--version', action='version', version=f'%(prog)s {VERSION}')
    return parser.parse_args()


def main():
    args = parse_args()
    
    # Update theme if colors disabled
    if args.no_color:
        for key in THEME:
            THEME[key] = ''
    
    # Type B: Header/Menu
    if args.header:
        print_header_box(args.header)
        if args.prompt:
            content = get_simple_input(args.prompt)
        else:
            content = get_simple_input()
        format_output(args.var, content)
        return
    
    # Selection menu mode
    if args.options and MODULES_AVAILABLE:
        content = get_selection_input(
            options=args.options,
            title=args.prompt or "Select an option:",
            allow_custom=not args.no_custom
        )
        format_output(args.var, content)
        return
    
    # Type C/D/E: Simple prompt
    if args.prompt:
        content = get_simple_input(args.prompt)
        format_output(args.var, content)
        return
    
    # Type A: CCL (main mode)
    if is_pipe_input():
        content = get_pipe_input()
    else:
        content = get_interactive_input_advanced(show_ui=not args.no_ui)
    
    if content:
        format_output(args.var, content)


if __name__ == '__main__':
    main()
