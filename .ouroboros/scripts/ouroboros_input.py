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
    from ouroboros_paste import PasteCollector
    from ouroboros_screen import StateMachine, InputState, InputEvent
    MODULES_AVAILABLE = True
    PASTE_AVAILABLE = True
    SCREEN_AVAILABLE = True
except ImportError:
    MODULES_AVAILABLE = False
    PASTE_AVAILABLE = False
    SCREEN_AVAILABLE = False

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
# FILE PATH DETECTION AND FORMATTING
# =============================================================================

# Common file extensions for different categories
FILE_EXTENSIONS = {
    # Code files
    'code': {'.py', '.js', '.ts', '.tsx', '.jsx', '.java', '.c', '.cpp', '.h', '.hpp',
             '.cs', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala', '.lua',
             '.pl', '.r', '.m', '.mm', '.sh', '.bash', '.zsh', '.ps1', '.bat', '.cmd'},
    # Config/data files
    'config': {'.json', '.yaml', '.yml', '.xml', '.toml', '.ini', '.cfg', '.conf',
               '.env', '.properties', '.lock'},
    # Documentation
    'doc': {'.md', '.markdown', '.rst', '.txt', '.rtf', '.doc', '.docx', '.pdf',
            '.tex', '.org', '.adoc'},
    # Images
    'image': {'.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.webp', '.ico',
              '.tiff', '.tif', '.psd', '.ai', '.eps'},
    # Audio/Video
    'media': {'.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a', '.wma',
              '.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm'},
    # Archives
    'archive': {'.zip', '.tar', '.gz', '.bz2', '.7z', '.rar', '.xz'},
    # Web
    'web': {'.html', '.htm', '.css', '.scss', '.sass', '.less'},
    # Data
    'data': {'.csv', '.tsv', '.sql', '.db', '.sqlite', '.parquet', '.arrow'},
}

# Flatten all extensions for quick lookup
ALL_EXTENSIONS = set()
for exts in FILE_EXTENSIONS.values():
    ALL_EXTENSIONS.update(exts)


def is_file_path(text: str) -> bool:
    """
    Check if the given text looks like a file path.
    Handles both Windows and Unix paths.
    """
    text = text.strip().strip('"').strip("'")  # Remove quotes often added by terminals
    
    if not text:
        return False
    
    # Check for common path patterns
    # Windows: C:\path\file.ext or \\server\share\file.ext
    # Unix: /path/file.ext or ~/path/file.ext or ./path/file.ext
    
    # Windows absolute path
    if len(text) >= 3 and text[1] == ':' and text[2] in ('\\', '/'):
        return True
    
    # Windows UNC path
    if text.startswith('\\\\'):
        return True
    
    # Unix absolute path
    if text.startswith('/'):
        return True
    
    # Home directory
    if text.startswith('~'):
        return True
    
    # Relative path with known extension
    ext = os.path.splitext(text)[1].lower()
    if ext in ALL_EXTENSIONS:
        return True
    
    # Check if it looks like a path (contains path separators and an extension)
    if ('/' in text or '\\' in text) and '.' in text:
        ext = os.path.splitext(text)[1].lower()
        if ext:
            return True
    
    return False


def format_file_display(path: str) -> str:
    """
    Format a file path for display as [ filename.ext ].
    Returns the formatted display string.
    """
    path = path.strip().strip('"').strip("'")
    
    # Extract filename
    filename = os.path.basename(path)
    
    if not filename:
        # Maybe it's a directory, use the last component
        parts = path.replace('\\', '/').rstrip('/').split('/')
        filename = parts[-1] if parts else path
    
    return f"[ {filename} ]"


def process_pasted_content(content: str) -> tuple:
    """
    Process pasted content to detect file paths.
    
    Returns:
        Tuple of (display_text, actual_text, is_file_path)
        - display_text: What to show in the UI
        - actual_text: What to store in the buffer (for AI)
        - is_file_path: Whether this is a file path
    """
    content = content.strip()
    
    # Check if it's a single file path (not multi-line)
    if '\n' not in content and is_file_path(content):
        display = format_file_display(content)
        # Store the actual path for AI, but display nicely
        return (display, content, True)
    
    # Check for multiple file paths (one per line)
    lines = content.split('\n')
    if len(lines) > 1 and all(is_file_path(line.strip()) for line in lines if line.strip()):
        # Multiple files - format each one
        display_lines = []
        for line in lines:
            if line.strip():
                display_lines.append(format_file_display(line.strip()))
        display = '\n'.join(display_lines)
        return (display, content, True)
    
    # Not a file path, return as-is
    return (content, content, False)


def convert_unmarked_file_paths(text: str) -> str:
    """
    Convert any unmarked file paths in text to the «path» format.
    
    This is a safety net for file paths that weren't detected during input
    (e.g., when Bracketed Paste Mode isn't supported and rapid input detection
    didn't trigger).
    
    Only converts paths that:
    1. Are not already marked with «»
    2. Look like absolute file paths (Windows or Unix)
    3. Are on their own line or surrounded by whitespace
    
    Args:
        text: The input text to process
        
    Returns:
        Text with file paths converted to «path» format
    """
    import re
    
    # Skip if text already contains markers (already processed)
    if '«' in text:
        return text
    
    # Pattern to match file paths:
    # - Windows: C:\path\to\file.ext or "C:\path with spaces\file.ext"
    # - Unix: /path/to/file or ~/path/to/file
    # Must be at start of line or after whitespace, and end at line end or before whitespace
    
    # Windows absolute path pattern (with optional quotes)
    win_pattern = r'(?:^|(?<=\s))("?[A-Za-z]:\\[^"\n]*"?)(?=\s|$)'
    # Unix absolute path pattern
    unix_pattern = r'(?:^|(?<=\s))((?:/|~/)[^\s\n]+)(?=\s|$)'
    
    result = text
    
    # Process Windows paths
    for match in re.finditer(win_pattern, result, re.MULTILINE):
        path = match.group(1).strip('"')
        if is_file_path(path):
            # Replace the match with marked version
            result = result[:match.start(1)] + f'«{path}»' + result[match.end(1):]
    
    # Process Unix paths (only if no Windows paths were found to avoid double processing)
    if '«' not in result:
        for match in re.finditer(unix_pattern, result, re.MULTILINE):
            path = match.group(1)
            if is_file_path(path):
                result = result[:match.start(1)] + f'«{path}»' + result[match.end(1):]
    
    return result


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
    # InputBox: start with 1 line, dynamically expands as content grows
    box = InputBox(height=1, show_line_numbers=True, show_status=True, full_width=True)
    box.set_mode("INPUT")  # Simple mode name
    
    if show_ui:
        box.render_initial()
    
    # Initialize state machine for clean state management
    state_machine = None
    if SCREEN_AVAILABLE:
        state_machine = StateMachine(InputState.IDLE)
        # Update UI mode based on state changes
        def on_paste_enter():
            box.set_mode("PASTE")
        def on_paste_exit():
            box.set_mode("INPUT")
        def on_history_enter():
            box.set_mode("HISTORY")
        def on_history_exit():
            box.set_mode("INPUT")
        state_machine.on_enter(InputState.PASTE_MODE, on_paste_enter)
        state_machine.on_exit(InputState.PASTE_MODE, on_paste_exit)
        state_machine.on_enter(InputState.HISTORY_BROWSE, on_history_enter)
        state_machine.on_exit(InputState.HISTORY_BROWSE, on_history_exit)
    
    history_browsing = False  # Track if we're browsing history (fallback)
    
    # Sync cursor position after render_initial
    if show_ui:
        box.set_cursor(0, 0, '')
    
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
        # Initialize Bracketed Paste Mode for reliable paste detection
        paste_collector = None
        if PASTE_AVAILABLE:
            paste_collector = PasteCollector()
            paste_collector.enable()
        
        # Rapid input detection for drag-drop (fallback when Bracketed Paste not supported)
        # This works with all languages including Chinese paths like D:\文档\项目\file.txt
        import time as _time
        rapid_input_buffer = []
        # 100ms threshold: generous for catching drag-drop while avoiding false positives
        # Drag-drop typically sends chars in < 10ms intervals
        # Human typing is typically 100-300ms between chars (even fast typists)
        # IME input has gaps during character selection
        rapid_input_threshold = 0.100  # 100ms between chars = likely system input
        rapid_input_min_length = 4     # Minimum chars to consider as potential path
        last_char_time = 0
        rapid_input_start_time = 0     # Track when rapid input started
        
        # Debug mode - set to True to see what's happening
        DEBUG_RAPID_INPUT = False
        
        def debug_log(msg: str):
            """Log debug message if debug mode is enabled."""
            if DEBUG_RAPID_INPUT:
                write(f"\n{THEME['dim']}[DEBUG] {msg}{THEME['reset']}\n")
        
        def process_rapid_input():
            """Process accumulated rapid input as potential file path."""
            nonlocal rapid_input_buffer, rapid_input_start_time
            if not rapid_input_buffer:
                return False
            
            content = ''.join(rapid_input_buffer)
            rapid_input_buffer = []
            rapid_input_start_time = 0
            
            debug_log(f"Processing rapid input: '{content[:50]}...' (len={len(content)})")
            
            # Safety check: if it's just repeated characters (key held down), treat as normal input
            if len(content) >= 2 and len(set(content)) == 1:
                debug_log("Detected key repeat, inserting as normal text")
                # All same character - likely key repeat, insert one by one
                for char in content:
                    buffer.insert_char(char)
                refresh_display()
                return True
            
            # Only check for file path if content is long enough and looks like a path
            # (contains path separators or starts with drive letter/slash)
            looks_like_path = (
                len(content) >= rapid_input_min_length and
                (
                    '\\' in content or 
                    '/' in content or 
                    (len(content) >= 3 and content[1] == ':') or  # Windows drive
                    content.startswith('~')  # Unix home
                )
            )
            
            debug_log(f"Looks like path: {looks_like_path}")
            
            if looks_like_path:
                # Check if it's actually a file path
                display_text, actual_text, is_file = process_pasted_content(content)
                
                debug_log(f"is_file_path result: {is_file}")
                
                if is_file:
                    # Format as file path marker
                    formatted = f"«{actual_text.strip()}»"
                    debug_log(f"Formatted as: {formatted}")
                    buffer.insert_text(formatted)
                    refresh_display()
                    return True
            
            # Not a file path or too short, insert as regular text
            buffer.insert_text(content)
            # Expand box if needed
            if buffer.line_count > box.height:
                box.expand_height(min(buffer.line_count, 15))
            refresh_display()
            return True
        
        try:
            while True:
                # Read input with paste detection if available
                if paste_collector:
                    key, is_paste = paste_collector.read(kb.getch)
                    if is_paste:
                        # Transition to paste mode
                        if state_machine:
                            state_machine.transition(InputEvent.PASTE_START)
                        
                        # Process pasted content - detect file paths
                        display_text, actual_text, is_file = process_pasted_content(key)
                        
                        if is_file:
                            # For file paths: store with special format
                            # Format: «/full/path/file.ext» 
                            # UI will render this as [ filename.ext ]
                            # AI receives the full path when text is extracted
                            formatted = f"«{actual_text.strip()}»"
                            buffer.insert_text(formatted)
                        else:
                            # Regular paste - insert as-is
                            buffer.insert_text(display_text)
                        
                        # Dynamically expand box if pasted content has multiple lines
                        if buffer.line_count > box.height:
                            box.expand_height(min(buffer.line_count, 15))
                        
                        # Transition out of paste mode
                        if state_machine:
                            state_machine.transition(InputEvent.PASTE_END)
                        
                        refresh_display()
                        continue
                else:
                    key = kb.getch()
                
                # Track time for rapid input detection
                current_time = _time.time()
                
                # Process any pending rapid input buffer on non-printable keys
                if rapid_input_buffer and not kb.is_printable(key):
                    process_rapid_input()
                
                if not key:
                    continue
                
                # Ctrl+C - Cancel
                if key == Keys.CTRL_C:
                    writeln(f"\n{THEME['error']}[x] Cancelled{THEME['reset']}")
                    sys.exit(130)
                
                # Handle Enter variants
                if kb.is_enter(key):
                    text = buffer.text.strip()
                    
                    # Ctrl+Enter - Force submit
                    if key == Keys.CTRL_ENTER:
                        if text:
                            # Convert any unmarked file paths before submitting
                            text = convert_unmarked_file_paths(text)
                            history.add(text)
                            if show_ui:
                                box.finish()
                            return text
                        continue
                    
                    # Check for >>> end marker
                    if text.rstrip().endswith('>>>'):
                        final_text = text.rsplit('>>>', 1)[0].rstrip()
                        if final_text:
                            # Convert any unmarked file paths before submitting
                            final_text = convert_unmarked_file_paths(final_text)
                            history.add(final_text)
                        if show_ui:
                            box.finish()
                        return final_text
                    
                    # Regular Enter - Add newline (default multi-line mode)
                    buffer.newline()
                    # Dynamically expand box as content grows
                    if buffer.line_count > box.height:
                        # Expand by 1 line at a time for smooth animation
                        box.expand_height(min(buffer.line_count, 15))
                    refresh_display()
                    continue
                
                # Ctrl+D - Force submit (reliable alternative to Ctrl+Enter)
                if key == Keys.CTRL_D:
                    text = buffer.text.strip()
                    if text:
                        # Convert any unmarked file paths before submitting
                        text = convert_unmarked_file_paths(text)
                        history.add(text)
                        if show_ui:
                            box.finish()
                        return text
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
                    # On first line (row 0): browse history
                    if buffer.cursor_row == 0 and not buffer.move_up():
                        # Can't move up - we're at top, browse history
                        if state_machine and state_machine.state != InputState.HISTORY_BROWSE:
                            state_machine.transition(InputEvent.HISTORY_UP)
                        hist_entry = history.go_back(buffer.text)
                        if hist_entry != buffer.text:
                            buffer.clear()
                            buffer.insert_text(hist_entry)
                            history_browsing = True
                            refresh_display()
                    else:
                        refresh_display()
                    continue
                if key == Keys.DOWN:
                    # On last line: browse history forward (if browsing)
                    if buffer.cursor_row == buffer.line_count - 1 and not buffer.move_down():
                        # Can't move down - we're at bottom
                        if history_browsing:
                            if state_machine:
                                state_machine.transition(InputEvent.HISTORY_DOWN)
                            hist_entry = history.go_forward()
                            buffer.clear()
                            buffer.insert_text(hist_entry)
                            if history.at_end:
                                history_browsing = False
                                # Exit history browsing mode
                                if state_machine:
                                    state_machine.transition(InputEvent.CHAR_INPUT)
                            refresh_display()
                    else:
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
                
                # Printable characters (including CJK from IME)
                if kb.is_printable(key):
                    # Rapid input detection for drag-drop (works with all languages)
                    # Key insight: IME input has gaps (user selecting characters)
                    # while drag-drop sends everything at once (< 100ms between chars)
                    time_since_last = current_time - last_char_time
                    
                    # 100ms threshold: fast enough to catch drag-drop
                    # but slow enough to not interfere with fast typing
                    is_rapid = time_since_last < rapid_input_threshold and last_char_time > 0
                    
                    debug_log(f"Char '{key}' time_since_last={time_since_last:.3f}s is_rapid={is_rapid} buffer_len={len(rapid_input_buffer)}")
                    
                    if is_rapid:
                        # Rapid input detected - accumulate in buffer
                        if not rapid_input_buffer:
                            rapid_input_start_time = current_time
                        rapid_input_buffer.append(key)
                        last_char_time = current_time
                        continue
                    elif rapid_input_buffer:
                        # Gap detected after rapid input - process buffer first
                        # DON'T add current char to buffer - it's the start of new input
                        process_rapid_input()
                        # Fall through to handle current char normally
                    
                    # Update last char time
                    last_char_time = current_time
                    
                    # Transition to typing state if needed
                    if state_machine and state_machine.state != InputState.TYPING:
                        state_machine.transition(InputEvent.CHAR_INPUT)
                    
                    # Insert character one by one
                    buffer.insert_char(key)
                    visible_row = buffer.get_visible_cursor_row()
                    if visible_row < box.height:
                        box.update_line(visible_row, buffer.lines[buffer.cursor_row])
                        # Skip status bar update during typing to avoid cursor flicker
                        text_before = buffer.lines[buffer.cursor_row][:buffer.cursor_col]
                        box.set_cursor(visible_row, buffer.cursor_col, text_before, update_status=False)
        except KeyboardInterrupt:
            writeln(f"\n{THEME['error']}[x] Cancelled{THEME['reset']}")
            sys.exit(130)
        finally:
            # Disable Bracketed Paste Mode on exit
            if paste_collector:
                paste_collector.disable()
    
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
    
    # Type C/D/E: Prompt with enhanced UI (unless --no-ui)
    if args.prompt:
        if args.no_ui:
            content = get_simple_input(args.prompt)
        else:
            # Show prompt as header, then use enhanced input
            writeln(f"\n{THEME['prompt']}  {args.prompt}{THEME['reset']}")
            content = get_interactive_input_advanced(show_ui=True)
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
