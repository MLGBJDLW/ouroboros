#!/usr/bin/env python3
"""
ouroboros_keybuffer.py - Cross-platform Keyboard Input Handler

Provides real-time character-by-character keyboard input for the Ouroboros
CCL system. Uses only Python standard library:
- Windows: msvcrt
- Unix/Linux/macOS: tty, termios

Features:
- Single character reading without Enter
- Special key detection (arrows, Home, End, etc.)
- Modifier key detection (Shift+Enter, Ctrl+Enter, Ctrl+C, etc.)
- Context manager for terminal mode switching
- Paste detection (rapid input)

Dependencies: Python 3.6+ standard library only
"""

import sys
import os
import time
from typing import Optional, Union

# =============================================================================
# PLATFORM DETECTION
# =============================================================================

IS_WINDOWS = sys.platform == 'win32'
IS_POSIX = os.name == 'posix'

# Platform-specific imports
if IS_WINDOWS:
    import msvcrt
else:
    import tty
    import termios
    import select

# =============================================================================
# KEY CONSTANTS
# =============================================================================

class Keys:
    """
    Key constants for special keys and modifiers.
    Values are strings that represent the key sequences.
    """
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
    CTRL_H = '\x08'  # Same as Backspace on some systems
    CTRL_I = '\x09'  # Same as Tab
    CTRL_J = '\x0a'  # Ctrl+J = newline, we use as SOFT_NEWLINE
    CTRL_K = '\x0b'
    CTRL_L = '\x0c'
    CTRL_M = '\x0d'  # Same as Enter
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
    
    # Special Enter variants (detected via timing/sequence)
    # Note: True Shift+Enter detection is impossible in most terminals
    # We use Ctrl+J as "soft newline" (like Shift+Enter)
    # and Ctrl+Enter sends \r\n quickly or ESC sequence in some terminals
    SHIFT_ENTER = 'SHIFT_ENTER'      # Virtual - mapped from Ctrl+J
    CTRL_ENTER = 'CTRL_ENTER'        # Virtual - detected via timing
    ALT_ENTER = 'ALT_ENTER'          # ESC + Enter
    CTRL_SHIFT_ENTER = 'CTRL_SHIFT_ENTER'  # For format paste
    
    # Soft newline (Ctrl+J) - use this as Shift+Enter alternative
    SOFT_NEWLINE = '\x0a'
    
    # Arrow keys (ANSI escape sequences)
    UP = '\x1b[A'
    DOWN = '\x1b[B'
    RIGHT = '\x1b[C'
    LEFT = '\x1b[D'
    
    # Arrow keys (alternate sequences - some terminals)
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
    
    # Windows-specific key codes (from msvcrt)
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
    WIN_F1 = '\x00;'
    WIN_F2 = '\x00<'
    WIN_F3 = '\x00='
    WIN_F4 = '\x00>'
    WIN_F5 = '\x00?'
    WIN_F6 = '\x00@'
    WIN_F7 = '\x00A'
    WIN_F8 = '\x00B'
    WIN_F9 = '\x00C'
    WIN_F10 = '\x00D'
    WIN_F11 = '\xe0\x85'
    WIN_F12 = '\xe0\x86'
    
    # Ctrl+Arrow (Windows)
    WIN_CTRL_UP = '\xe0\x8d'
    WIN_CTRL_DOWN = '\xe0\x91'
    WIN_CTRL_LEFT = '\xe0s'
    WIN_CTRL_RIGHT = '\xe0t'
    
    # Ctrl+Arrow (Unix - some terminals)
    CTRL_UP = '\x1b[1;5A'
    CTRL_DOWN = '\x1b[1;5B'
    CTRL_RIGHT = '\x1b[1;5C'
    CTRL_LEFT = '\x1b[1;5D'
    
    # Shift+Arrow (Unix - some terminals)
    SHIFT_UP = '\x1b[1;2A'
    SHIFT_DOWN = '\x1b[1;2B'
    SHIFT_RIGHT = '\x1b[1;2C'
    SHIFT_LEFT = '\x1b[1;2D'


# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

def is_pipe_input() -> bool:
    """Check if stdin is a pipe (not interactive terminal)."""
    try:
        return not sys.stdin.isatty()
    except (AttributeError, ValueError):
        return True


def is_printable(char: str) -> bool:
    """Check if character is printable (not control character). Supports Unicode."""
    if not char or len(char) != 1:
        return False
    code = ord(char)
    # Control characters: 0x00-0x1F and 0x7F
    if code < 0x20 or code == 0x7f:
        return False
    # C1 control characters: 0x80-0x9F
    if 0x80 <= code <= 0x9f:
        return False
    # Everything else is printable (including CJK, emoji, etc.)
    return True


# =============================================================================
# WINDOWS KEYBOARD HANDLER
# =============================================================================

class WindowsKeyBuffer:
    """Windows-specific keyboard input handler with IME support."""
    
    def __init__(self):
        self._last_key_time = 0
        self._paste_threshold = 0.02  # 20ms between keys = paste
        self._paste_buffer = []       # Buffer for paste detection
        self._is_pasting = False
        self._use_readconsole = False
        self._handle = None
        self._old_mode = None
    
    def __enter__(self):
        # Try to use ReadConsoleW for better IME support
        try:
            import ctypes
            from ctypes import wintypes
            
            kernel32 = ctypes.windll.kernel32
            
            # Get console input handle
            STD_INPUT_HANDLE = -10
            self._handle = kernel32.GetStdHandle(STD_INPUT_HANDLE)
            
            # Save old mode
            self._old_mode = wintypes.DWORD()
            kernel32.GetConsoleMode(self._handle, ctypes.byref(self._old_mode))
            
            # Set mode for character input with IME support
            # ENABLE_PROCESSED_INPUT = 0x0001 (handle Ctrl+C)
            # ENABLE_ECHO_INPUT = 0x0004 (we don't want this)
            # ENABLE_LINE_INPUT = 0x0002 (we don't want this)
            ENABLE_PROCESSED_INPUT = 0x0001
            kernel32.SetConsoleMode(self._handle, ENABLE_PROCESSED_INPUT)
            
            self._use_readconsole = True
        except Exception:
            self._use_readconsole = False
        return self
    
    def __exit__(self, *args):
        # Restore old console mode
        if self._use_readconsole and self._handle and self._old_mode:
            try:
                import ctypes
                kernel32 = ctypes.windll.kernel32
                kernel32.SetConsoleMode(self._handle, self._old_mode)
            except Exception:
                pass
    
    def _read_console_char(self, timeout: Optional[float] = None) -> str:
        """
        Read a character using ReadConsoleW (supports IME).
        
        Args:
            timeout: Optional timeout in seconds. None means wait indefinitely.
            
        Returns:
            The character read, or empty string on timeout/error.
            
        Raises:
            No exceptions are raised; errors return empty string and
            may trigger fallback to msvcrt in the caller.
        """
        try:
            import ctypes
            from ctypes import wintypes
        except ImportError:
            # ctypes not available, signal caller to use fallback
            return ''
        
        try:
            kernel32 = ctypes.windll.kernel32
        except (AttributeError, OSError):
            # Not on Windows or kernel32 not accessible
            return ''
        
        # Control key state flags
        LEFT_CTRL_PRESSED = 0x0008
        RIGHT_CTRL_PRESSED = 0x0004
        SHIFT_PRESSED = 0x0010
        
        # Validate handle
        if self._handle is None or self._handle == -1:
            return ''
        
        # Define structures inside try block to catch any ctypes errors
        try:
            # KEY_EVENT_RECORD structure - matches Windows API exactly
            class KEY_EVENT_RECORD(ctypes.Structure):
                _fields_ = [
                    ("bKeyDown", wintypes.BOOL),
                    ("wRepeatCount", wintypes.WORD),
                    ("wVirtualKeyCode", wintypes.WORD),
                    ("wVirtualScanCode", wintypes.WORD),
                    ("uChar", wintypes.WCHAR),
                    ("dwControlKeyState", wintypes.DWORD),
                ]
            
            # INPUT_RECORD uses a union for Event, but we only care about KEY_EVENT
            # The union is 16 bytes, KEY_EVENT_RECORD is the largest member
            class INPUT_RECORD(ctypes.Structure):
                _fields_ = [
                    ("EventType", wintypes.WORD),
                    ("Event", KEY_EVENT_RECORD),
                ]
        except (TypeError, AttributeError) as e:
            # Structure definition failed
            return ''
        
        # Wait for input with timeout
        start_time = time.time()
        max_iterations = 100000  # Safety limit to prevent infinite loop
        iterations = 0
        
        while iterations < max_iterations:
            iterations += 1
            
            try:
                # Check if input is available
                num_events = wintypes.DWORD()
                result = kernel32.GetNumberOfConsoleInputEvents(
                    self._handle, ctypes.byref(num_events)
                )
                
                if not result:
                    # API call failed, wait briefly and retry
                    time.sleep(0.01)
                    continue
                
                if num_events.value > 0:
                    record = INPUT_RECORD()
                    num_read = wintypes.DWORD()
                    
                    read_result = kernel32.ReadConsoleInputW(
                        self._handle, 
                        ctypes.byref(record), 
                        1, 
                        ctypes.byref(num_read)
                    )
                    
                    if not read_result:
                        # Read failed, continue waiting
                        time.sleep(0.01)
                        continue
                    
                    if num_read.value > 0:
                        # KEY_EVENT = 0x0001
                        if record.EventType == 0x0001 and record.Event.bKeyDown:
                            vk = record.Event.wVirtualKeyCode
                            char = record.Event.uChar
                            ctrl_state = record.Event.dwControlKeyState
                            
                            # Check modifier keys
                            ctrl_pressed = bool(ctrl_state & (LEFT_CTRL_PRESSED | RIGHT_CTRL_PRESSED))
                            shift_pressed = bool(ctrl_state & SHIFT_PRESSED)
                            
                            # Handle Enter key with modifiers
                            if vk == 0x0D:  # VK_RETURN
                                if ctrl_pressed and shift_pressed:
                                    return Keys.CTRL_SHIFT_ENTER
                                elif ctrl_pressed:
                                    return Keys.CTRL_ENTER
                                elif shift_pressed:
                                    return Keys.SHIFT_ENTER
                                else:
                                    return '\r'
                            
                            # Handle other keys with Ctrl
                            # Note: For special keys, char is '\x00' (not empty string)
                            if ctrl_pressed and (not char or char == '\x00'):
                                # Ctrl+Arrow keys
                                if vk == 0x26:  # VK_UP
                                    return Keys.CTRL_UP
                                elif vk == 0x28:  # VK_DOWN
                                    return Keys.CTRL_DOWN
                                elif vk == 0x25:  # VK_LEFT
                                    return Keys.CTRL_LEFT
                                elif vk == 0x27:  # VK_RIGHT
                                    return Keys.CTRL_RIGHT
                            
                            # Regular character (not null/empty)
                            # Note: For special keys like arrows, char is '\x00'
                            if char and char != '\x00':
                                return char
                            
                            # Handle special keys via virtual key code
                            if vk == 0x26:  # VK_UP
                                return Keys.UP
                            elif vk == 0x28:  # VK_DOWN
                                return Keys.DOWN
                            elif vk == 0x25:  # VK_LEFT
                                return Keys.LEFT
                            elif vk == 0x27:  # VK_RIGHT
                                return Keys.RIGHT
                            elif vk == 0x24:  # VK_HOME
                                return Keys.HOME
                            elif vk == 0x23:  # VK_END
                                return Keys.END
                            elif vk == 0x2E:  # VK_DELETE
                                return Keys.DELETE
                            elif vk == 0x2D:  # VK_INSERT
                                return Keys.INSERT
                            elif vk == 0x21:  # VK_PAGE_UP
                                return Keys.PAGE_UP
                            elif vk == 0x22:  # VK_PAGE_DOWN
                                return Keys.PAGE_DOWN
                
                # Check timeout
                if timeout is not None and (time.time() - start_time) >= timeout:
                    return ''
                
                # Brief sleep to avoid busy-waiting
                time.sleep(0.01)
                
            except (OSError, ctypes.ArgumentError, ValueError) as e:
                # Handle specific ctypes/OS errors gracefully
                # Return empty to trigger fallback
                return ''
            except Exception:
                # Catch-all for unexpected errors
                # Return empty to trigger fallback to msvcrt
                return ''
        
        # Safety: max iterations reached
        return ''
    
    def getch(self, timeout: Optional[float] = None) -> str:
        """
        Read a single key or key sequence.
        Returns the key as a string (may be multi-char for special keys).
        Supports Unicode characters including CJK from IME.
        """
        # Try ReadConsoleW first for IME support
        if self._use_readconsole:
            try:
                char = self._read_console_char(timeout)
                if char:
                    current_time = time.time()
                    time_since_last = current_time - self._last_key_time
                    self._is_pasting = time_since_last < self._paste_threshold
                    self._last_key_time = current_time
                    
                    # Special keys are already handled by _read_console_char
                    # (CTRL_ENTER, SHIFT_ENTER, CTRL_SHIFT_ENTER, arrow keys, etc.)
                    # Just pass them through
                    if char == '\x03':  # Ctrl+C
                        return Keys.CTRL_C
                    
                    return char
            except Exception:
                pass
        
        # Fallback to msvcrt
        start_time = time.time()
        
        # Wait for input with optional timeout
        while True:
            if msvcrt.kbhit():
                break
            if timeout is not None and (time.time() - start_time) >= timeout:
                return ''
            time.sleep(0.01)
        
        # Read the first character (getwch supports Unicode)
        char = msvcrt.getwch()
        current_time = time.time()
        
        # Check for paste (rapid input)
        time_since_last = current_time - self._last_key_time
        self._is_pasting = time_since_last < self._paste_threshold
        self._last_key_time = current_time
        
        # Handle special prefix characters
        if char in ('\x00', '\xe0'):
            # Extended key - read second character
            if msvcrt.kbhit():
                char2 = msvcrt.getwch()
                combined = char + char2
                
                # Check for Ctrl+Shift+Enter (some terminals: \xe0 + special)
                # This varies by terminal, so we also check timing
                return combined
            return char
        
        # Handle Enter variants
        if char == '\r':
            # Check if there's a following \n (Ctrl+Enter sends \r\n quickly)
            time.sleep(0.001)  # Brief wait
            if msvcrt.kbhit():
                peek_time = time.time()
                next_char = msvcrt.getwch()
                if next_char == '\n':
                    # Very fast \r\n = Ctrl+Enter
                    if (peek_time - current_time) < 0.005:
                        return Keys.CTRL_ENTER
                # Can't put back, but \n alone will be handled next
                elif next_char == '\x0a':
                    # \r followed quickly by \n with Shift = Ctrl+Shift+Enter
                    return Keys.CTRL_SHIFT_ENTER
            return '\r'
        
        # Handle Ctrl+J (Soft newline - use as Shift+Enter)
        if char == '\n' or char == '\x0a':
            return Keys.SHIFT_ENTER
        
        # Handle Ctrl+Shift+J (format paste trigger)
        # Note: This is hard to detect, we use Ctrl+Shift+V instead
        if char == '\x16':  # Ctrl+V
            # Check if Shift is held (we can't directly, but check timing)
            return char
        
        # For CJK and other Unicode characters from IME, return as-is
        # getwch() already handles Unicode correctly
        return char
    
    def getch_nowait(self) -> str:
        """Non-blocking read. Returns empty string if no input."""
        if msvcrt.kbhit():
            return self.getch(timeout=0)
        return ''
    
    def read_paste(self, first_char: str = '') -> str:
        """
        Read rapid input as a paste operation.
        Returns all characters received within paste threshold.
        """
        chars = [first_char] if first_char else []
        
        while True:
            time.sleep(0.001)
            if not msvcrt.kbhit():
                # No more input within threshold
                time.sleep(self._paste_threshold)
                if not msvcrt.kbhit():
                    break
            
            char = msvcrt.getwch()
            if char in ('\x00', '\xe0'):
                # Skip special keys during paste
                if msvcrt.kbhit():
                    msvcrt.getwch()
                continue
            chars.append(char)
        
        return ''.join(chars)
    
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
        return key in (Keys.BACKSPACE, Keys.BACKSPACE_WIN, Keys.CTRL_H)
    
    def is_delete(self, key: str) -> bool:
        """Check if key is Delete."""
        return key == Keys.WIN_DELETE or key == Keys.DELETE
    
    def is_printable(self, key: str) -> bool:
        """Check if key is a printable character (including CJK from IME)."""
        if not key:
            return False
        # Multi-char sequences are special keys, not printable
        if len(key) > 1:
            return False
        # Check using global is_printable
        return is_printable(key)
    
    def flush(self) -> None:
        """Flush any pending input."""
        while msvcrt.kbhit():
            msvcrt.getwch()


# =============================================================================
# UNIX/POSIX KEYBOARD HANDLER
# =============================================================================

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
        try:
            self._fd = sys.stdin.fileno()
            self._old_settings = termios.tcgetattr(self._fd)
            tty.setraw(self._fd)
        except (termios.error, ValueError, OSError):
            # Not a TTY or other error - fallback mode
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
        if self._fd is None:
            # Fallback for non-TTY
            return sys.stdin.read(1) if sys.stdin.readable() else ''
        
        if timeout is not None:
            ready, _, _ = select.select([sys.stdin], [], [], timeout)
            if not ready:
                return ''
        
        try:
            # Read first byte
            first_byte = os.read(self._fd, 1)
            if not first_byte:
                return ''
            
            # Check if it's a multi-byte UTF-8 character
            byte_val = first_byte[0]
            if byte_val < 0x80:
                # ASCII character
                return first_byte.decode('utf-8', errors='replace')
            elif byte_val < 0xC0:
                # Continuation byte (shouldn't happen as first byte)
                return first_byte.decode('utf-8', errors='replace')
            elif byte_val < 0xE0:
                # 2-byte UTF-8 character
                remaining = os.read(self._fd, 1)
                return (first_byte + remaining).decode('utf-8', errors='replace')
            elif byte_val < 0xF0:
                # 3-byte UTF-8 character (e.g., Chinese, Japanese)
                remaining = os.read(self._fd, 2)
                return (first_byte + remaining).decode('utf-8', errors='replace')
            elif byte_val < 0xF8:
                # 4-byte UTF-8 character (e.g., emoji)
                remaining = os.read(self._fd, 3)
                return (first_byte + remaining).decode('utf-8', errors='replace')
            else:
                return first_byte.decode('utf-8', errors='replace')
        except (IOError, OSError):
            return ''
    
    def _read_escape_sequence(self) -> str:
        """Read and parse an escape sequence."""
        seq = '\x1b'
        
        # Read with short timeout for escape sequences
        char = self._read_char(timeout=0.05)
        if not char:
            return seq  # Just Escape key
        
        seq += char
        
        # CSI sequence: ESC [
        if char == '[':
            while True:
                char = self._read_char(timeout=0.02)
                if not char:
                    break
                seq += char
                # End of CSI sequence
                if char.isalpha() or char == '~':
                    break
                # Modifier sequences like ESC[1;5A (Ctrl+Arrow)
                # or ESC[1;6A (Ctrl+Shift+Arrow)
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
        
        # Alt+key: ESC + char
        elif char.isalpha() or char.isdigit():
            pass  # Already have the sequence
        
        return seq
    
    def getch(self, timeout: Optional[float] = None) -> str:
        """
        Read a single key or key sequence.
        Returns the key as a string.
        """
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
            # Check for Ctrl+Shift+Enter: some terminals send ESC[13;6u
            if seq == '\x1b[13;6u':
                return Keys.CTRL_SHIFT_ENTER
            return seq
        
        # Handle Enter variants
        if char == '\r':
            # Check for \n following (some terminals send \r\n for Ctrl+Enter)
            next_char = self._read_char(timeout=0.005)
            if next_char == '\n':
                return Keys.CTRL_ENTER
            return '\r'
        
        # Ctrl+J (0x0a) = Soft newline, use as Shift+Enter
        if char == '\n' or char == '\x0a':
            return Keys.SHIFT_ENTER
        
        return char
    
    def getch_nowait(self) -> str:
        """Non-blocking read."""
        return self.getch(timeout=0)
    
    def read_paste(self, first_char: str = '') -> str:
        """
        Read rapid input as a paste operation.
        Returns all characters received within paste threshold.
        """
        chars = [first_char] if first_char else []
        
        while True:
            char = self._read_char(timeout=self._paste_threshold)
            if not char:
                break
            if char == '\x1b':
                # Skip escape sequences during paste
                self._read_escape_sequence()
                continue
            chars.append(char)
        
        return ''.join(chars)
    
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
        # Multi-char sequences are special keys, not printable
        if len(key) > 1:
            return False
        # Check using global is_printable
        return is_printable(key)
    
    def flush(self) -> None:
        """Flush any pending input."""
        if self._fd is not None:
            termios.tcflush(self._fd, termios.TCIFLUSH)


# =============================================================================
# UNIFIED KEYBUFFER CLASS
# =============================================================================

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
    
    Key Mappings (since terminals can't detect all modifiers):
        - Enter (\r)           -> Insert newline (default multi-line mode)
        - Ctrl+J (\n)          -> Insert newline (alternative)
        - Ctrl+Enter (\r\n)    -> Force submit
        - Alt+Enter (ESC+\r)   -> Alt+Enter
        - Ctrl+Shift+Enter     -> Format paste (if terminal supports)
    """
    
    def __init__(self):
        if IS_WINDOWS:
            self._impl = WindowsKeyBuffer()
        else:
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
    
    def read_paste(self, first_char: str = '') -> str:
        """Read rapid input as paste. Returns accumulated text."""
        return self._impl.read_paste(first_char)
    
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
            Keys.F7, Keys.F8, Keys.F9, Keys.F10, Keys.F11, Keys.F12,
            Keys.WIN_F1, Keys.WIN_F2, Keys.WIN_F3, Keys.WIN_F4,
            Keys.WIN_F5, Keys.WIN_F6, Keys.WIN_F7, Keys.WIN_F8,
            Keys.WIN_F9, Keys.WIN_F10, Keys.WIN_F11, Keys.WIN_F12
        )
    
    def flush(self) -> None:
        """Flush any pending input."""
        self._impl.flush()


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def read_key(timeout: Optional[float] = None) -> str:
    """
    Simple function to read a single key.
    Note: For multiple reads, use KeyBuffer context manager instead.
    """
    with KeyBuffer() as kb:
        return kb.getch(timeout)


def wait_for_key(keys: Union[str, list, tuple], timeout: Optional[float] = None) -> str:
    """
    Wait for one of the specified keys to be pressed.
    Returns the key that was pressed, or empty string on timeout.
    """
    if isinstance(keys, str):
        keys = [keys]
    
    with KeyBuffer() as kb:
        start = time.time()
        while True:
            remaining = None
            if timeout is not None:
                remaining = timeout - (time.time() - start)
                if remaining <= 0:
                    return ''
            
            key = kb.getch(remaining)
            if key in keys:
                return key


def confirm(prompt: str = "Continue? [y/n]: ") -> bool:
    """
    Simple yes/no confirmation prompt.
    Returns True for 'y'/'Y', False for 'n'/'N'.
    """
    sys.stderr.write(prompt)
    sys.stderr.flush()
    
    with KeyBuffer() as kb:
        while True:
            key = kb.getch()
            if key.lower() == 'y':
                sys.stderr.write('y\n')
                return True
            if key.lower() == 'n':
                sys.stderr.write('n\n')
                return False
            if key == Keys.CTRL_C:
                sys.stderr.write('\n')
                raise KeyboardInterrupt


# =============================================================================
# TEST / DEMO
# =============================================================================

def _demo():
    """Interactive demo of keyboard input."""
    print("Ouroboros KeyBuffer Demo")
    print("=" * 40)
    print("Press keys to see their codes.")
    print("Press Ctrl+C to exit.")
    print("=" * 40)
    print()
    
    with KeyBuffer() as kb:
        while True:
            try:
                key = kb.getch()
                
                if key == Keys.CTRL_C:
                    print("\n[Ctrl+C] Exiting...")
                    break
                
                # Display key info
                if kb.is_enter(key):
                    if key == Keys.SHIFT_ENTER:
                        print("[Shift+Enter]")
                    elif key == Keys.CTRL_ENTER:
                        print("[Ctrl+Enter]")
                    else:
                        print("[Enter]")
                elif kb.is_backspace(key):
                    print("[Backspace]")
                elif kb.is_arrow(key):
                    arrow_names = {
                        Keys.UP: "Up", Keys.DOWN: "Down",
                        Keys.LEFT: "Left", Keys.RIGHT: "Right"
                    }
                    print(f"[Arrow: {arrow_names.get(key, key)}]")
                elif key == Keys.HOME or key == Keys.HOME_ALT:
                    print("[Home]")
                elif key == Keys.END or key == Keys.END_ALT:
                    print("[End]")
                elif key == Keys.DELETE:
                    print("[Delete]")
                elif key == Keys.ESCAPE:
                    print("[Escape]")
                elif key == Keys.TAB:
                    print("[Tab]")
                elif kb.is_function_key(key):
                    print(f"[Function Key: {repr(key)}]")
                elif kb.is_printable(key):
                    print(f"Char: '{key}' (ord={ord(key)})")
                else:
                    print(f"Special: {repr(key)}")
                    
            except KeyboardInterrupt:
                print("\n[Interrupted]")
                break


if __name__ == '__main__':
    _demo()
