#!/usr/bin/env python3
"""
Cross-platform character-by-character keyboard input.
Uses msvcrt on Windows, tty/termios on Unix.
"""

import sys
import os

# Platform detection
IS_WINDOWS = sys.platform == 'win32'

if IS_WINDOWS:
    import msvcrt
else:
    import tty
    import termios
    import select

# Special key codes
class Keys:
    """Key constants for special keys."""
    ENTER = '\r'
    NEWLINE = '\n'
    BACKSPACE = '\x7f'
    BACKSPACE_WIN = '\x08'
    DELETE = '\x1b[3~'
    TAB = '\t'
    ESCAPE = '\x1b'
    
    # Arrow keys (ANSI sequences)
    UP = '\x1b[A'
    DOWN = '\x1b[B'
    RIGHT = '\x1b[C'
    LEFT = '\x1b[D'
    
    # Control keys
    CTRL_C = '\x03'
    CTRL_D = '\x04'
    CTRL_U = '\x15'  # Clear line
    CTRL_W = '\x17'  # Delete word
    CTRL_A = '\x01'  # Home
    CTRL_E = '\x05'  # End
    CTRL_K = '\x0b'  # Kill to end
    
    # Home/End (various terminals)
    HOME = '\x1b[H'
    END = '\x1b[F'
    HOME_ALT = '\x1b[1~'
    END_ALT = '\x1b[4~'


class KeyBuffer:
    """
    Cross-platform character input handler.
    Reads keystrokes one at a time without waiting for Enter.
    """
    
    def __init__(self):
        self._old_settings = None
        self._raw_mode = False
    
    def __enter__(self):
        """Enter raw mode for character-by-character input."""
        if not IS_WINDOWS:
            self._old_settings = termios.tcgetattr(sys.stdin.fileno())
            tty.setraw(sys.stdin.fileno())
        self._raw_mode = True
        return self
    
    def __exit__(self, *args):
        """Restore terminal settings."""
        if not IS_WINDOWS and self._old_settings:
            termios.tcsetattr(sys.stdin.fileno(), termios.TCSADRAIN, self._old_settings)
        self._raw_mode = False
    
    def getch(self) -> str:
        """
        Read a single character or escape sequence.
        Returns the character/sequence as a string.
        """
        if IS_WINDOWS:
            return self._getch_windows()
        else:
            return self._getch_unix()
    
    def _getch_windows(self) -> str:
        """Windows implementation using msvcrt."""
        ch = msvcrt.getwch()
        
        # Handle extended keys (arrows, function keys)
        if ch in ('\x00', '\xe0'):
            ch2 = msvcrt.getwch()
            # Map Windows key codes to ANSI sequences
            key_map = {
                'H': Keys.UP,
                'P': Keys.DOWN,
                'M': Keys.RIGHT,
                'K': Keys.LEFT,
                'G': Keys.HOME,
                'O': Keys.END,
                'S': Keys.DELETE,
            }
            return key_map.get(ch2, '')
        
        return ch
    
    def _getch_unix(self) -> str:
        """Unix implementation using tty/termios."""
        ch = sys.stdin.read(1)
        
        # Check for escape sequence
        if ch == '\x1b':
            # Check if more characters are available
            if self._has_input():
                ch += sys.stdin.read(1)
                if ch[-1] == '[':
                    # Read until we get a letter or ~
                    while self._has_input():
                        next_ch = sys.stdin.read(1)
                        ch += next_ch
                        if next_ch.isalpha() or next_ch == '~':
                            break
        
        return ch
    
    def _has_input(self, timeout: float = 0.01) -> bool:
        """Check if there's input available (Unix only)."""
        if IS_WINDOWS:
            return msvcrt.kbhit()
        else:
            return select.select([sys.stdin], [], [], timeout)[0] != []
    
    def is_printable(self, key: str) -> bool:
        """Check if key is a printable character."""
        if len(key) != 1:
            return False
        return key.isprintable() and key not in (Keys.TAB, Keys.ENTER, Keys.NEWLINE)
    
    def is_backspace(self, key: str) -> bool:
        """Check if key is backspace."""
        return key in (Keys.BACKSPACE, Keys.BACKSPACE_WIN, '\b')
    
    def is_enter(self, key: str) -> bool:
        """Check if key is enter/return."""
        return key in (Keys.ENTER, Keys.NEWLINE)
    
    def is_arrow(self, key: str) -> bool:
        """Check if key is an arrow key."""
        return key in (Keys.UP, Keys.DOWN, Keys.LEFT, Keys.RIGHT)


def is_pipe_input() -> bool:
    """Check if stdin is from a pipe (non-interactive)."""
    if IS_WINDOWS:
        return not sys.stdin.isatty()
    else:
        return not os.isatty(sys.stdin.fileno())


# Simple test
if __name__ == '__main__':
    print("KeyBuffer test. Press keys (Ctrl+C to exit):")
    print("Each keypress will be shown with its repr.")
    print()
    
    if is_pipe_input():
        print("Pipe input detected, reading line by line...")
        for line in sys.stdin:
            print(f"Line: {repr(line)}")
    else:
        with KeyBuffer() as kb:
            while True:
                try:
                    key = kb.getch()
                    print(f"\rKey: {repr(key):20s}", end='', flush=True)
                    
                    if key == Keys.CTRL_C:
                        print("\nExiting...")
                        break
                except KeyboardInterrupt:
                    print("\nExiting...")
                    break
