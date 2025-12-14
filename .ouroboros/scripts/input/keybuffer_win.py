"""
Windows-specific keyboard input handler.

This module provides Windows keyboard handling using ReadConsoleW
for IME support and VK code handling for arrow keys.

Requirements: 5.1-5.7, 27.1-27.2
"""

import sys
import time
from typing import Optional

# Platform check
IS_WINDOWS = sys.platform == 'win32'

if IS_WINDOWS:
    import msvcrt


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
    
    # Ctrl+Arrow (Windows)
    WIN_CTRL_UP = '\xe0\x8d'
    WIN_CTRL_DOWN = '\xe0\x91'
    WIN_CTRL_LEFT = '\xe0s'
    WIN_CTRL_RIGHT = '\xe0t'


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


class WindowsKeyBuffer:
    """Windows-specific keyboard input handler with IME support."""
    
    def __init__(self):
        self._last_key_time = 0
        self._paste_threshold = 0.02
        self._paste_buffer = []
        self._is_pasting = False
        self._use_readconsole = False
        self._handle = None
        self._old_mode = None
        self._vt_input_mode = False
    
    def __enter__(self):
        """Initialize console for raw input with IME support."""
        if not IS_WINDOWS:
            return self
        
        try:
            import ctypes
            from ctypes import wintypes
            
            kernel32 = ctypes.windll.kernel32
            
            STD_INPUT_HANDLE = -10
            self._handle = kernel32.GetStdHandle(STD_INPUT_HANDLE)
            
            self._old_mode = wintypes.DWORD()
            kernel32.GetConsoleMode(self._handle, ctypes.byref(self._old_mode))
            
            ENABLE_PROCESSED_INPUT = 0x0001
            ENABLE_VIRTUAL_TERMINAL_INPUT = 0x0200
            
            self._vt_input_mode = bool(self._old_mode.value & ENABLE_VIRTUAL_TERMINAL_INPUT)
            
            new_mode = ENABLE_PROCESSED_INPUT
            if self._vt_input_mode:
                new_mode |= ENABLE_VIRTUAL_TERMINAL_INPUT
            
            kernel32.SetConsoleMode(self._handle, new_mode)
            self._use_readconsole = True
        except Exception:
            self._use_readconsole = False
            self._vt_input_mode = False
        
        return self
    
    def __exit__(self, *args):
        """Restore console mode."""
        if self._use_readconsole and self._handle and self._old_mode:
            try:
                import ctypes
                kernel32 = ctypes.windll.kernel32
                kernel32.SetConsoleMode(self._handle, self._old_mode)
            except Exception:
                pass

    def get_pending_event_count(self) -> int:
        """Get the number of events waiting in the console input buffer."""
        if not self._use_readconsole or self._handle is None:
            return 0
        try:
            import ctypes
            from ctypes import wintypes
            kernel32 = ctypes.windll.kernel32
            num_events = wintypes.DWORD()
            if kernel32.GetNumberOfConsoleInputEvents(self._handle, ctypes.byref(num_events)):
                return num_events.value
        except Exception:
            pass
        return 0
    
    def _read_ansi_sequence_from_console_vt(self, kernel32, INPUT_RECORD, KEY_EVENT_RECORD,
                                            timeout: Optional[float], start_time: float) -> str:
        """Read an ANSI escape sequence from console input in VT Input mode."""
        import ctypes
        from ctypes import wintypes
        
        seq = '\x1b'
        
        def read_next_char(max_wait: float = 0.1) -> str:
            wait_start = time.time()
            while (time.time() - wait_start) < max_wait:
                num_events = wintypes.DWORD()
                if kernel32.GetNumberOfConsoleInputEvents(self._handle, ctypes.byref(num_events)):
                    if num_events.value > 0:
                        record = INPUT_RECORD()
                        num_read = wintypes.DWORD()
                        if kernel32.ReadConsoleInputW(self._handle, ctypes.byref(record), 1, ctypes.byref(num_read)):
                            if num_read.value > 0 and record.EventType == 0x0001 and record.Event.bKeyDown:
                                char = record.Event.uChar
                                if char and char != '\x00':
                                    return char
                time.sleep(0.001)
            return ''
        
        char2 = read_next_char()
        if not char2:
            return seq
        
        seq += char2
        
        if char2 == '[':
            char3 = read_next_char()
            if not char3:
                return seq
            seq += char3
            
            if char3 == 'A':
                return Keys.UP
            elif char3 == 'B':
                return Keys.DOWN
            elif char3 == 'C':
                return Keys.RIGHT
            elif char3 == 'D':
                return Keys.LEFT
            elif char3 == 'H':
                return Keys.HOME
            elif char3 == 'F':
                return Keys.END
            elif char3.isdigit():
                while True:
                    next_c = read_next_char()
                    if not next_c:
                        break
                    seq += next_c
                    if next_c.isalpha() or next_c == '~':
                        break
                
                params = seq[2:]
                if params == '3~':
                    return Keys.DELETE
                elif params == '1~':
                    return Keys.HOME
                elif params == '4~':
                    return Keys.END
                elif params == '5~':
                    return Keys.PAGE_UP
                elif params == '6~':
                    return Keys.PAGE_DOWN
                elif params.startswith('1;5'):
                    if params.endswith('A'):
                        return Keys.CTRL_UP
                    elif params.endswith('B'):
                        return Keys.CTRL_DOWN
                    elif params.endswith('C'):
                        return Keys.CTRL_RIGHT
                    elif params.endswith('D'):
                        return Keys.CTRL_LEFT
        
        elif char2 == 'O':
            char3 = read_next_char()
            if char3:
                seq += char3
                if char3 == 'A':
                    return Keys.UP
                elif char3 == 'B':
                    return Keys.DOWN
                elif char3 == 'C':
                    return Keys.RIGHT
                elif char3 == 'D':
                    return Keys.LEFT
        
        return seq

    def _read_console_char(self, timeout: Optional[float] = None) -> str:
        """Read a character using ReadConsoleW (supports IME)."""
        try:
            import ctypes
            from ctypes import wintypes
        except ImportError:
            return ''
        
        try:
            kernel32 = ctypes.windll.kernel32
        except (AttributeError, OSError):
            return ''
        
        LEFT_CTRL_PRESSED = 0x0008
        RIGHT_CTRL_PRESSED = 0x0004
        SHIFT_PRESSED = 0x0010
        
        if self._handle is None or self._handle == -1:
            return ''
        
        try:
            class KEY_EVENT_RECORD(ctypes.Structure):
                _fields_ = [
                    ("bKeyDown", wintypes.BOOL),
                    ("wRepeatCount", wintypes.WORD),
                    ("wVirtualKeyCode", wintypes.WORD),
                    ("wVirtualScanCode", wintypes.WORD),
                    ("uChar", wintypes.WCHAR),
                    ("dwControlKeyState", wintypes.DWORD),
                ]
            
            class INPUT_RECORD(ctypes.Structure):
                _fields_ = [
                    ("EventType", wintypes.WORD),
                    ("Event", KEY_EVENT_RECORD),
                ]
        except (TypeError, AttributeError):
            return ''
        
        start_time = time.time()
        max_iterations = 100000
        iterations = 0
        
        while iterations < max_iterations:
            iterations += 1
            
            try:
                num_events = wintypes.DWORD()
                result = kernel32.GetNumberOfConsoleInputEvents(
                    self._handle, ctypes.byref(num_events)
                )
                
                if not result:
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
                        time.sleep(0.01)
                        continue
                    
                    if num_read.value > 0:
                        if record.EventType == 0x0001 and record.Event.bKeyDown:
                            vk = record.Event.wVirtualKeyCode
                            char = record.Event.uChar
                            ctrl_state = record.Event.dwControlKeyState
                            
                            ctrl_pressed = bool(ctrl_state & (LEFT_CTRL_PRESSED | RIGHT_CTRL_PRESSED))
                            shift_pressed = bool(ctrl_state & SHIFT_PRESSED)
                            
                            # Handle Enter key with modifiers
                            if vk == 0x0D:
                                if ctrl_pressed and shift_pressed:
                                    return Keys.CTRL_SHIFT_ENTER
                                elif ctrl_pressed:
                                    return Keys.CTRL_ENTER
                                elif shift_pressed:
                                    return Keys.SHIFT_ENTER
                                else:
                                    return '\r'
                            
                            # Handle special keys via VK codes
                            if vk == 0x26:
                                return Keys.CTRL_UP if ctrl_pressed else Keys.UP
                            elif vk == 0x28:
                                return Keys.CTRL_DOWN if ctrl_pressed else Keys.DOWN
                            elif vk == 0x25:
                                return Keys.CTRL_LEFT if ctrl_pressed else Keys.LEFT
                            elif vk == 0x27:
                                return Keys.CTRL_RIGHT if ctrl_pressed else Keys.RIGHT
                            elif vk == 0x24:
                                return Keys.HOME
                            elif vk == 0x23:
                                return Keys.END
                            elif vk == 0x2E:
                                return Keys.DELETE
                            elif vk == 0x2D:
                                return Keys.INSERT
                            elif vk == 0x21:
                                return Keys.PAGE_UP
                            elif vk == 0x22:
                                return Keys.PAGE_DOWN
                            
                            # Ctrl+Letter handler via VK codes
                            elif ctrl_pressed and 0x41 <= vk <= 0x5A:
                                ctrl_char = chr(vk - 0x40)
                                return ctrl_char
                            
                            # Regular character
                            if char and char != '\x00':
                                if char == '\x1b':
                                    return self._read_ansi_sequence_from_console_vt(
                                        kernel32, INPUT_RECORD, KEY_EVENT_RECORD,
                                        timeout, start_time
                                    )
                                return char
                
                if timeout is not None and (time.time() - start_time) >= timeout:
                    return ''
                
                time.sleep(0.01)
                
            except (OSError, ctypes.ArgumentError, ValueError):
                return ''
            except Exception:
                return ''
        
        return ''

    def getch(self, timeout: Optional[float] = None) -> str:
        """
        Read a single key or key sequence.
        Returns the key as a string (may be multi-char for special keys).
        Supports Unicode characters including CJK from IME.
        """
        if not IS_WINDOWS:
            return ''
        
        # Try ReadConsoleW first for IME support
        if self._use_readconsole:
            try:
                char = self._read_console_char(timeout)
                if char:
                    current_time = time.time()
                    time_since_last = current_time - self._last_key_time
                    self._is_pasting = time_since_last < self._paste_threshold
                    self._last_key_time = current_time
                    
                    if char == '\x03':
                        return Keys.CTRL_C
                    
                    return char
                if timeout is not None:
                    return ''
            except Exception:
                pass
        
        # Fallback to msvcrt
        start_time = time.time()
        
        while True:
            if msvcrt.kbhit():
                break
            if timeout is not None and (time.time() - start_time) >= timeout:
                return ''
            time.sleep(0.01)
        
        char = msvcrt.getwch()
        current_time = time.time()
        
        time_since_last = current_time - self._last_key_time
        self._is_pasting = time_since_last < self._paste_threshold
        self._last_key_time = current_time
        
        # Handle special prefix characters
        if char in ('\x00', '\xe0'):
            if msvcrt.kbhit():
                char2 = msvcrt.getwch()
                combined = char + char2
                return combined
            return char
        
        # Handle Enter variants
        if char == '\r':
            time.sleep(0.001)
            if msvcrt.kbhit():
                peek_time = time.time()
                next_char = msvcrt.getwch()
                if next_char == '\n':
                    if (peek_time - current_time) < 0.005:
                        return Keys.CTRL_ENTER
                elif next_char == '\x0a':
                    return Keys.CTRL_SHIFT_ENTER
            return '\r'
        
        # Handle Ctrl+J (Soft newline)
        if char == '\n' or char == '\x0a':
            return Keys.SHIFT_ENTER
        
        # Handle ANSI escape sequences
        if char == '\x1b':
            time.sleep(0.01)
            if msvcrt.kbhit():
                char2 = msvcrt.getwch()
                if char2 == '[':
                    time.sleep(0.01)
                    if msvcrt.kbhit():
                        char3 = msvcrt.getwch()
                        if char3 == 'A':
                            return Keys.UP
                        elif char3 == 'B':
                            return Keys.DOWN
                        elif char3 == 'C':
                            return Keys.RIGHT
                        elif char3 == 'D':
                            return Keys.LEFT
                        elif char3 == 'H':
                            return Keys.HOME
                        elif char3 == 'F':
                            return Keys.END
                        elif char3.isdigit():
                            seq = char3
                            while msvcrt.kbhit():
                                next_c = msvcrt.getwch()
                                seq += next_c
                                if next_c.isalpha() or next_c == '~':
                                    break
                            if seq == '3~':
                                return Keys.DELETE
                            elif seq == '1~':
                                return Keys.HOME
                            elif seq == '4~':
                                return Keys.END
                            elif seq == '5~':
                                return Keys.PAGE_UP
                            elif seq == '6~':
                                return Keys.PAGE_DOWN
                            elif seq.startswith('1;5'):
                                if seq.endswith('A'):
                                    return Keys.CTRL_UP
                                elif seq.endswith('B'):
                                    return Keys.CTRL_DOWN
                                elif seq.endswith('C'):
                                    return Keys.CTRL_RIGHT
                                elif seq.endswith('D'):
                                    return Keys.CTRL_LEFT
                            return '\x1b[' + seq
                        return '\x1b[' + char3
                    return '\x1b['
                elif char2 == 'O':
                    time.sleep(0.01)
                    if msvcrt.kbhit():
                        char3 = msvcrt.getwch()
                        if char3 == 'A':
                            return Keys.UP
                        elif char3 == 'B':
                            return Keys.DOWN
                        elif char3 == 'C':
                            return Keys.RIGHT
                        elif char3 == 'D':
                            return Keys.LEFT
                        return '\x1bO' + char3
                    return '\x1bO'
                return '\x1b' + char2
            return '\x1b'
        
        return char
    
    def getch_nowait(self) -> str:
        """Non-blocking read. Returns empty string if no input."""
        if IS_WINDOWS and msvcrt.kbhit():
            return self.getch(timeout=0)
        return ''
    
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
        if len(key) > 1:
            return False
        return is_printable(key)
    
    def flush(self) -> None:
        """Flush any pending input."""
        if IS_WINDOWS:
            while msvcrt.kbhit():
                msvcrt.getwch()
