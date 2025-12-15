"""
Unix-specific keyboard input handler.

This module provides Unix keyboard handling using termios raw mode
and UTF-8 multi-byte reading.


"""

import sys
import os
import time
from typing import Optional

# Platform check
IS_POSIX = os.name == 'posix'

if IS_POSIX:
    import tty
    import termios
    import select


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


class UnixKeyBuffer:
    """Unix/Linux/macOS keyboard input handler using termios."""
    
    def __init__(self):
        self._old_settings = None
        self._fd = None
        self._last_key_time = 0
        self._paste_threshold = 0.02
        self._is_pasting = False
    
    def __enter__(self):
        """Enter raw mode for character-by-character input."""
        if not IS_POSIX:
            return self
        
        try:
            self._fd = sys.stdin.fileno()
            self._old_settings = termios.tcgetattr(self._fd)
            tty.setraw(self._fd)
        except (termios.error, ValueError, OSError):
            self._fd = None
            self._old_settings = None
        return self
    
    def __exit__(self, *args):
        """Restore terminal settings."""
        if self._old_settings is not None and self._fd is not None:
            try:
                termios.tcsetattr(self._fd, termios.TCSADRAIN, self._old_settings)
            except (termios.error, ValueError, OSError):
                pass
    
    def _read_char(self, timeout: Optional[float] = None) -> str:
        """Read a single character with optional timeout (supports UTF-8)."""
        if not IS_POSIX:
            return ''
        
        if self._fd is None:
            return sys.stdin.read(1) if sys.stdin.readable() else ''
        
        if timeout is not None:
            ready, _, _ = select.select([sys.stdin], [], [], timeout)
            if not ready:
                return ''
        
        try:
            first_byte = os.read(self._fd, 1)
            if not first_byte:
                return ''
            
            byte_val = first_byte[0]
            if byte_val < 0x80:
                return first_byte.decode('utf-8', errors='replace')
            elif byte_val < 0xC0:
                return first_byte.decode('utf-8', errors='replace')
            elif byte_val < 0xE0:
                remaining = os.read(self._fd, 1)
                return (first_byte + remaining).decode('utf-8', errors='replace')
            elif byte_val < 0xF0:
                remaining = os.read(self._fd, 2)
                return (first_byte + remaining).decode('utf-8', errors='replace')
            elif byte_val < 0xF8:
                remaining = os.read(self._fd, 3)
                return (first_byte + remaining).decode('utf-8', errors='replace')
            else:
                return first_byte.decode('utf-8', errors='replace')
        except (IOError, OSError):
            return ''

    def _read_escape_sequence(self) -> str:
        """Read and parse an escape sequence."""
        seq = '\x1b'
        
        char = self._read_char(timeout=0.05)
        if not char:
            return seq
        
        seq += char
        
        # CSI sequence: ESC [
        if char == '[':
            while True:
                char = self._read_char(timeout=0.02)
                if not char:
                    break
                seq += char
                if char.isalpha() or char == '~':
                    break
                if char == ';':
                    continue
                if char.isdigit():
                    continue
        
        # SS3 sequence: ESC O
        elif char == 'O':
            char = self._read_char(timeout=0.02)
            if char:
                seq += char
        
        # Alt+Enter: ESC + \r
        elif char == '\r':
            return Keys.ALT_ENTER
        
        return seq
    
    def getch(self, timeout: Optional[float] = None) -> str:
        """Read a single key or key sequence."""
        if not IS_POSIX:
            return ''
        
        char = self._read_char(timeout)
        if not char:
            return ''
        
        current_time = time.time()
        time_since_last = current_time - self._last_key_time
        self._is_pasting = time_since_last < self._paste_threshold
        self._last_key_time = current_time
        
        # Handle escape sequences
        if char == '\x1b':
            seq = self._read_escape_sequence()
            # Check for Ctrl+Shift+Enter
            if seq == '\x1b[13;6u':
                return Keys.CTRL_SHIFT_ENTER
            
            # Parse common sequences
            if seq == '\x1b[A':
                return Keys.UP
            elif seq == '\x1b[B':
                return Keys.DOWN
            elif seq == '\x1b[C':
                return Keys.RIGHT
            elif seq == '\x1b[D':
                return Keys.LEFT
            elif seq == '\x1b[H':
                return Keys.HOME
            elif seq == '\x1b[F':
                return Keys.END
            elif seq == '\x1b[3~':
                return Keys.DELETE
            elif seq == '\x1b[1~':
                return Keys.HOME
            elif seq == '\x1b[4~':
                return Keys.END
            elif seq == '\x1b[5~':
                return Keys.PAGE_UP
            elif seq == '\x1b[6~':
                return Keys.PAGE_DOWN
            elif seq == '\x1b[1;5A':
                return Keys.CTRL_UP
            elif seq == '\x1b[1;5B':
                return Keys.CTRL_DOWN
            elif seq == '\x1b[1;5C':
                return Keys.CTRL_RIGHT
            elif seq == '\x1b[1;5D':
                return Keys.CTRL_LEFT
            elif seq == '\x1bOA':
                return Keys.UP
            elif seq == '\x1bOB':
                return Keys.DOWN
            elif seq == '\x1bOC':
                return Keys.RIGHT
            elif seq == '\x1bOD':
                return Keys.LEFT
            
            return seq
        
        # Handle Enter variants
        if char == '\r':
            next_char = self._read_char(timeout=0.005)
            if next_char == '\n':
                return Keys.CTRL_ENTER
            return '\r'
        
        # Ctrl+J = Soft newline
        if char == '\n' or char == '\x0a':
            return Keys.SHIFT_ENTER
        
        return char
    
    def getch_nowait(self) -> str:
        """Non-blocking read."""
        return self.getch(timeout=0)
    
    @property
    def is_pasting(self) -> bool:
        """Check if currently in paste mode (rapid input)."""
        return self._is_pasting
    
    def is_enter(self, key: str) -> bool:
        """Check if key is any Enter variant."""
        return key in ('\r', '\n', Keys.ENTER, Keys.NEWLINE,
                       Keys.SHIFT_ENTER, Keys.CTRL_ENTER, Keys.ALT_ENTER,
                       Keys.CTRL_SHIFT_ENTER)
    
    def is_backspace(self, key: str) -> bool:
        """Check if key is Backspace."""
        return key in (Keys.BACKSPACE, Keys.BACKSPACE_WIN, Keys.CTRL_H, '\x08')
    
    def is_delete(self, key: str) -> bool:
        """Check if key is Delete."""
        return key == Keys.DELETE
    
    def is_printable(self, key: str) -> bool:
        """Check if key is a printable character (including CJK)."""
        if not key:
            return False
        if len(key) > 1:
            return False
        return is_printable(key)
    
    def flush(self) -> None:
        """Flush any pending input."""
        if IS_POSIX and self._fd is not None:
            termios.tcflush(self._fd, termios.TCIFLUSH)
