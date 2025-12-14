"""
Unified cross-platform keyboard input handler.

This module provides the KeyBuffer class for reading keyboard input
across Windows and Unix platforms with curses integration.

Requirements: 4.1-4.10, 5.1-5.7
"""

import sys
import os
from typing import Optional, Union

# Platform detection
IS_WINDOWS = sys.platform == 'win32'
IS_POSIX = os.name == 'posix'


class Keys:
    """Key constants for special keys and modifiers."""
    
    # Basic keys
    ENTER = '\r'
    NEWLINE = '\n'
    TAB = '\t'
    ESCAPE = '\x1b'
    BACKSPACE = '\x7f'
    BACKSPACE_WIN = '\x08'
    
    # Ctrl combinations
    CTRL_A = '\x01'
    CTRL_B = '\x02'
    CTRL_C = '\x03'
    CTRL_D = '\x04'
    CTRL_E = '\x05'
    CTRL_F = '\x06'
    CTRL_G = '\x07'
    CTRL_H = '\x08'
    CTRL_I = '\x09'
    CTRL_J = '\x0a'
    CTRL_K = '\x0b'
    CTRL_L = '\x0c'
    CTRL_M = '\x0d'
    CTRL_N = '\x0e'
    CTRL_O = '\x0f'
    CTRL_P = '\x10'
    CTRL_Q = '\x11'
    CTRL_R = '\x12'
    CTRL_S = '\x13'
    CTRL_T = '\x14'
    CTRL_U = '\x15'
    CTRL_V = '\x16'
    CTRL_W = '\x17'
    CTRL_X = '\x18'
    CTRL_Y = '\x19'
    CTRL_Z = '\x1a'

    # Special Enter variants
    SHIFT_ENTER = 'SHIFT_ENTER'
    CTRL_ENTER = 'CTRL_ENTER'
    ALT_ENTER = 'ALT_ENTER'
    CTRL_SHIFT_ENTER = 'CTRL_SHIFT_ENTER'
    SOFT_NEWLINE = '\x0a'
    
    # Arrow keys (ANSI escape sequences)
    UP = '\x1b[A'
    DOWN = '\x1b[B'
    RIGHT = '\x1b[C'
    LEFT = '\x1b[D'
    
    # Arrow keys (alternate sequences)
    UP_ALT = '\x1bOA'
    DOWN_ALT = '\x1bOB'
    RIGHT_ALT = '\x1bOC'
    LEFT_ALT = '\x1bOD'
    
    # Navigation keys
    HOME = '\x1b[H'
    END = '\x1b[F'
    HOME_ALT = '\x1b[1~'
    END_ALT = '\x1b[4~'
    INSERT = '\x1b[2~'
    DELETE = '\x1b[3~'
    PAGE_UP = '\x1b[5~'
    PAGE_DOWN = '\x1b[6~'
    
    # Ctrl+Arrow
    CTRL_UP = '\x1b[1;5A'
    CTRL_DOWN = '\x1b[1;5B'
    CTRL_RIGHT = '\x1b[1;5C'
    CTRL_LEFT = '\x1b[1;5D'
    
    # Shift+Arrow
    SHIFT_UP = '\x1b[1;2A'
    SHIFT_DOWN = '\x1b[1;2B'
    SHIFT_RIGHT = '\x1b[1;2C'
    SHIFT_LEFT = '\x1b[1;2D'
    
    # Windows-specific key codes
    WIN_SPECIAL_PREFIX = '\x00'
    WIN_EXTENDED_PREFIX = '\xe0'
    WIN_UP = '\xe0H'
    WIN_DOWN = '\xe0P'
    WIN_LEFT = '\xe0K'
    WIN_RIGHT = '\xe0M'
    WIN_HOME = '\xe0G'
    WIN_END = '\xe0O'
    WIN_INSERT = '\xe0R'
    WIN_DELETE = '\xe0S'
    WIN_PAGE_UP = '\xe0I'
    WIN_PAGE_DOWN = '\xe0Q'
    WIN_CTRL_UP = '\xe0\x8d'
    WIN_CTRL_DOWN = '\xe0\x91'
    WIN_CTRL_LEFT = '\xe0s'
    WIN_CTRL_RIGHT = '\xe0t'
    
    # Function keys
    F1 = '\x1bOP'
    F2 = '\x1bOQ'
    F3 = '\x1bOR'
    F4 = '\x1bOS'
    F5 = '\x1b[15~'
    F6 = '\x1b[17~'
    F7 = '\x1b[18~'
    F8 = '\x1b[19~'
    F9 = '\x1b[20~'
    F10 = '\x1b[21~'
    F11 = '\x1b[23~'
    F12 = '\x1b[24~'


def is_printable(char: str) -> bool:
    """Check if character is printable (not control character). Supports Unicode."""
    if not char or len(char) != 1:
        return False
    code = ord(char)
    if code < 0x20 or code == 0x7f:
        return False
    if 0x80 <= code <= 0x9f:
        return False
    return True


def is_pipe_input() -> bool:
    """Check if stdin is a pipe (not interactive terminal)."""
    try:
        return not sys.stdin.isatty()
    except (AttributeError, ValueError):
        return True


class KeyBuffer:
    """
    Cross-platform keyboard input handler.
    Automatically selects the appropriate implementation.
    
    Usage:
        with KeyBuffer() as kb:
            while True:
                key = kb.getch()
                if key == Keys.CTRL_C:
                    break
                if kb.is_enter(key):
                    print("Enter pressed!")
                if kb.is_printable(key):
                    print(f"Typed: {key}")
    
    Key Mappings:
        - Enter (\\r)           -> Insert newline (default multi-line mode)
        - Ctrl+J (\\n)          -> Insert newline (alternative)
        - Ctrl+Enter (\\r\\n)    -> Force submit
        - Alt+Enter (ESC+\\r)   -> Alt+Enter
        - Ctrl+Shift+Enter     -> Format paste (if terminal supports)
    """
    
    def __init__(self):
        if IS_WINDOWS:
            from .keybuffer_win import WindowsKeyBuffer
            self._impl = WindowsKeyBuffer()
        else:
            from .keybuffer_unix import UnixKeyBuffer
            self._impl = UnixKeyBuffer()
    
    def __enter__(self):
        self._impl.__enter__()
        return self
    
    def __exit__(self, *args):
        self._impl.__exit__(*args)
    
    def getch(self, timeout: Optional[float] = None) -> str:
        """Read a single key or key sequence."""
        key = self._impl.getch(timeout)
        return self._normalize_key(key)
    
    def getch_nowait(self) -> str:
        """Non-blocking read."""
        key = self._impl.getch_nowait()
        return self._normalize_key(key)
    
    @property
    def is_pasting(self) -> bool:
        """Check if currently receiving rapid input (paste mode)."""
        return self._impl.is_pasting
    
    def _normalize_key(self, key: str) -> str:
        """Normalize platform-specific keys to common format."""
        if not key:
            return key
        
        # Windows to Unix arrow key normalization
        key_map = {
            Keys.WIN_UP: Keys.UP,
            Keys.WIN_DOWN: Keys.DOWN,
            Keys.WIN_LEFT: Keys.LEFT,
            Keys.WIN_RIGHT: Keys.RIGHT,
            Keys.WIN_HOME: Keys.HOME,
            Keys.WIN_END: Keys.END,
            Keys.WIN_INSERT: Keys.INSERT,
            Keys.WIN_DELETE: Keys.DELETE,
            Keys.WIN_PAGE_UP: Keys.PAGE_UP,
            Keys.WIN_PAGE_DOWN: Keys.PAGE_DOWN,
            Keys.WIN_CTRL_UP: Keys.CTRL_UP,
            Keys.WIN_CTRL_DOWN: Keys.CTRL_DOWN,
            Keys.WIN_CTRL_LEFT: Keys.CTRL_LEFT,
            Keys.WIN_CTRL_RIGHT: Keys.CTRL_RIGHT,
        }
        
        # Alternate Unix sequences
        alt_map = {
            Keys.UP_ALT: Keys.UP,
            Keys.DOWN_ALT: Keys.DOWN,
            Keys.LEFT_ALT: Keys.LEFT,
            Keys.RIGHT_ALT: Keys.RIGHT,
        }
        
        return key_map.get(key, alt_map.get(key, key))
    
    def is_enter(self, key: str) -> bool:
        """Check if key is any Enter variant."""
        return self._impl.is_enter(key)
    
    def is_soft_newline(self, key: str) -> bool:
        """Check if key is soft newline (Ctrl+J, used as Shift+Enter)."""
        return key == Keys.SHIFT_ENTER or key == Keys.SOFT_NEWLINE
    
    def is_submit(self, key: str) -> bool:
        """Check if key is a submit action (Enter or Ctrl+Enter)."""
        return key in ('\r', Keys.ENTER, Keys.CTRL_ENTER)
    
    def is_format_paste(self, key: str) -> bool:
        """Check if key is format paste trigger (Ctrl+Shift+Enter)."""
        return key == Keys.CTRL_SHIFT_ENTER
    
    def is_backspace(self, key: str) -> bool:
        """Check if key is Backspace."""
        return self._impl.is_backspace(key)
    
    def is_delete(self, key: str) -> bool:
        """Check if key is Delete."""
        return self._impl.is_delete(key)
    
    def is_printable(self, key: str) -> bool:
        """Check if key is a printable character."""
        return self._impl.is_printable(key)
    
    def is_arrow(self, key: str) -> bool:
        """Check if key is an arrow key."""
        return key in (Keys.UP, Keys.DOWN, Keys.LEFT, Keys.RIGHT)
    
    def is_navigation(self, key: str) -> bool:
        """Check if key is a navigation key (arrows, home, end, etc.)."""
        return key in (
            Keys.UP, Keys.DOWN, Keys.LEFT, Keys.RIGHT,
            Keys.HOME, Keys.END, Keys.HOME_ALT, Keys.END_ALT,
            Keys.PAGE_UP, Keys.PAGE_DOWN, Keys.INSERT, Keys.DELETE
        )
    
    def is_function_key(self, key: str) -> bool:
        """Check if key is a function key (F1-F12)."""
        return key in (
            Keys.F1, Keys.F2, Keys.F3, Keys.F4, Keys.F5, Keys.F6,
            Keys.F7, Keys.F8, Keys.F9, Keys.F10, Keys.F11, Keys.F12
        )
    
    def flush(self) -> None:
        """Flush any pending input."""
        self._impl.flush()
