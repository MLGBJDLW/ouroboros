#!/usr/bin/env python3
"""
ouroboros_paste.py - Bracketed Paste Mode Support

Implements the terminal's Bracketed Paste Mode protocol for reliable paste
detection. This protocol is supported by most modern terminals and allows
distinguishing between typed input and pasted content.

Protocol:
- Enable:  Send \x1b[?2004h to terminal
- Disable: Send \x1b[?2004l to terminal
- When user pastes, terminal sends:
  - \x1b[200~ (paste start marker)
  - <pasted content>
  - \x1b[201~ (paste end marker)

This avoids timing-based paste detection which conflicts with IME input.

Dependencies: Python 3.6+ standard library only
"""

import sys
import atexit
from typing import Optional

# ANSI escape sequences for Bracketed Paste Mode
ENABLE_BRACKETED_PASTE = '\x1b[?2004h'
DISABLE_BRACKETED_PASTE = '\x1b[?2004l'
PASTE_START = '\x1b[200~'
PASTE_END = '\x1b[201~'

# Partial sequences for detection
PASTE_START_PARTIAL = '[200~'  # After ESC
PASTE_END_PARTIAL = '[201~'    # After ESC


class BracketedPasteHandler:
    """
    Manages Bracketed Paste Mode for the terminal.
    
    Usage:
        handler = BracketedPasteHandler()
        handler.enable()  # Enable at start of input session
        
        # In input loop:
        if handler.is_paste_start(sequence):
            # Collect characters until paste end
            paste_content = handler.collect_paste(read_char_func)
            # Handle paste_content
            
        handler.disable()  # Disable when done
    
    The handler automatically disables paste mode on process exit to
    restore terminal to normal state.
    """
    
    def __init__(self):
        self._enabled = False
        self._collecting = False
        self._buffer = []
        
    def enable(self) -> None:
        """Enable Bracketed Paste Mode in the terminal."""
        if not self._enabled:
            sys.stdout.write(ENABLE_BRACKETED_PASTE)
            sys.stdout.flush()
            self._enabled = True
            # Register cleanup for abnormal exits
            atexit.register(self._cleanup)
    
    def disable(self) -> None:
        """Disable Bracketed Paste Mode in the terminal."""
        if self._enabled:
            sys.stdout.write(DISABLE_BRACKETED_PASTE)
            sys.stdout.flush()
            self._enabled = False
            try:
                atexit.unregister(self._cleanup)
            except Exception:
                pass
    
    def _cleanup(self) -> None:
        """Cleanup handler for atexit."""
        if self._enabled:
            try:
                sys.stdout.write(DISABLE_BRACKETED_PASTE)
                sys.stdout.flush()
            except Exception:
                pass
    
    @property
    def is_enabled(self) -> bool:
        """Check if Bracketed Paste Mode is enabled."""
        return self._enabled
    
    @property
    def is_collecting(self) -> bool:
        """Check if currently collecting paste content."""
        return self._collecting
    
    def is_paste_start_sequence(self, sequence: str) -> bool:
        """
        Check if the given sequence is the paste start marker.
        
        The sequence can be:
        - Full sequence: '\x1b[200~'
        - After ESC: '[200~'
        """
        return sequence == PASTE_START or sequence == PASTE_START_PARTIAL
    
    def is_paste_end_sequence(self, sequence: str) -> bool:
        """
        Check if the given sequence is the paste end marker.
        
        The sequence can be:
        - Full sequence: '\x1b[201~'
        - After ESC: '[201~'
        """
        return sequence == PASTE_END or sequence == PASTE_END_PARTIAL
    
    def start_collecting(self) -> None:
        """Start collecting paste content."""
        self._collecting = True
        self._buffer = []
    
    def add_char(self, char: str) -> None:
        """Add a character to the paste buffer."""
        if self._collecting:
            self._buffer.append(char)
    
    def finish_collecting(self) -> str:
        """
        Finish collecting and return the paste content.
        Removes the paste end marker if accidentally included.
        """
        self._collecting = False
        content = ''.join(self._buffer)
        self._buffer = []
        return content
    
    def cancel_collecting(self) -> None:
        """Cancel paste collection (on timeout or error)."""
        self._collecting = False
        self._buffer = []


class PasteSequenceParser:
    """
    Parser for detecting paste sequences within a stream of characters.
    
    This class implements a state machine to detect:
    - ESC [ 2 0 0 ~ (paste start)
    - ESC [ 2 0 1 ~ (paste end)
    
    Usage:
        parser = PasteSequenceParser()
        
        for char in input_stream:
            result = parser.feed(char)
            if result == 'paste-start':
                # Start collecting paste content
            elif result == 'paste-end':
                # End of paste content
            elif result == 'char':
                # Regular character, available as parser.pending_chars
            elif result == 'buffering':
                # Waiting for more characters
    """
    
    # States
    STATE_NORMAL = 0
    STATE_ESC = 1
    STATE_BRACKET = 2
    STATE_TWO = 3
    STATE_ZERO = 4
    STATE_DIGIT = 5  # After '0' or '1'
    
    # Paste start: ESC [ 2 0 0 ~
    # Paste end:   ESC [ 2 0 1 ~
    
    def __init__(self):
        self._state = self.STATE_NORMAL
        self._buffer = []
        self._pending = []
        self._sequence_type = None  # '0' for start, '1' for end
    
    @property
    def pending_chars(self) -> str:
        """Get any pending characters that should be processed as regular input."""
        result = ''.join(self._pending)
        self._pending = []
        return result
    
    def reset(self) -> None:
        """Reset the parser state."""
        self._flush_buffer_to_pending()
        self._state = self.STATE_NORMAL
        self._sequence_type = None
    
    def _flush_buffer_to_pending(self) -> None:
        """Move buffer contents to pending (not part of a valid sequence)."""
        self._pending.extend(self._buffer)
        self._buffer = []
    
    def feed(self, char: str) -> str:
        """
        Feed a character to the parser.
        
        Returns:
            'paste-start': Paste start sequence detected
            'paste-end': Paste end sequence detected
            'char': Character(s) available in pending_chars
            'buffering': Waiting for more characters
        """
        if self._state == self.STATE_NORMAL:
            if char == '\x1b':  # ESC
                self._buffer = [char]
                self._state = self.STATE_ESC
                return 'buffering'
            else:
                self._pending = [char]
                return 'char'
        
        elif self._state == self.STATE_ESC:
            if char == '[':
                self._buffer.append(char)
                self._state = self.STATE_BRACKET
                return 'buffering'
            else:
                # Not a CSI sequence, flush and process char
                self._flush_buffer_to_pending()
                self._pending.append(char)
                self._state = self.STATE_NORMAL
                return 'char'
        
        elif self._state == self.STATE_BRACKET:
            if char == '2':
                self._buffer.append(char)
                self._state = self.STATE_TWO
                return 'buffering'
            else:
                # Not paste sequence, flush buffer
                self._flush_buffer_to_pending()
                self._pending.append(char)
                self._state = self.STATE_NORMAL
                return 'char'
        
        elif self._state == self.STATE_TWO:
            if char == '0':
                self._buffer.append(char)
                self._state = self.STATE_ZERO
                return 'buffering'
            else:
                self._flush_buffer_to_pending()
                self._pending.append(char)
                self._state = self.STATE_NORMAL
                return 'char'
        
        elif self._state == self.STATE_ZERO:
            if char == '0':
                # Paste start: ESC [ 2 0 0 ~
                self._buffer.append(char)
                self._sequence_type = '0'
                self._state = self.STATE_DIGIT
                return 'buffering'
            elif char == '1':
                # Paste end: ESC [ 2 0 1 ~
                self._buffer.append(char)
                self._sequence_type = '1'
                self._state = self.STATE_DIGIT
                return 'buffering'
            else:
                self._flush_buffer_to_pending()
                self._pending.append(char)
                self._state = self.STATE_NORMAL
                return 'char'
        
        elif self._state == self.STATE_DIGIT:
            if char == '~':
                # Complete sequence!
                self._buffer = []
                self._state = self.STATE_NORMAL
                if self._sequence_type == '0':
                    self._sequence_type = None
                    return 'paste-start'
                else:
                    self._sequence_type = None
                    return 'paste-end'
            else:
                self._flush_buffer_to_pending()
                self._pending.append(char)
                self._state = self.STATE_NORMAL
                self._sequence_type = None
                return 'char'
        
        # Default - should not reach here
        self._pending = [char]
        self._state = self.STATE_NORMAL
        return 'char'
    
    def timeout(self) -> str:
        """
        Called when there's a timeout waiting for more characters.
        Flushes any buffered characters as regular input.
        
        Returns:
            'char' if there are pending characters, 'none' otherwise
        """
        if self._buffer:
            self._flush_buffer_to_pending()
            self._state = self.STATE_NORMAL
            self._sequence_type = None
            return 'char'
        return 'none'


# Global singleton for convenience
_paste_handler: Optional[BracketedPasteHandler] = None


def get_paste_handler() -> BracketedPasteHandler:
    """Get the global BracketedPasteHandler instance."""
    global _paste_handler
    if _paste_handler is None:
        _paste_handler = BracketedPasteHandler()
    return _paste_handler


def enable_bracketed_paste() -> None:
    """Enable Bracketed Paste Mode using the global handler."""
    get_paste_handler().enable()


def disable_bracketed_paste() -> None:
    """Disable Bracketed Paste Mode using the global handler."""
    get_paste_handler().disable()


# =============================================================================
# INTEGRATED PASTE COLLECTOR
# =============================================================================

class PasteCollector:
    """
    High-level paste collector that integrates with a key reading function.
    
    Usage:
        collector = PasteCollector()
        collector.enable()
        
        # In input loop, instead of: key = kb.getch()
        key, is_paste = collector.read(kb.getch)
        if is_paste:
            # key contains all pasted content
            buffer.insert_text(key)
        else:
            # key is a single keypress
            handle_key(key)
    """
    
    def __init__(self, timeout: float = 30.0):
        """
        Initialize the paste collector.
        
        Args:
            timeout: Maximum time (seconds) to wait for paste end marker
        """
        self._handler = BracketedPasteHandler()
        self._parser = PasteSequenceParser()
        self._timeout = timeout
        self._pending_keys = []
    
    def enable(self) -> None:
        """Enable Bracketed Paste Mode."""
        self._handler.enable()
    
    def disable(self) -> None:
        """Disable Bracketed Paste Mode."""
        self._handler.disable()
    
    @property
    def is_enabled(self) -> bool:
        """Check if paste mode is enabled."""
        return self._handler.is_enabled
    
    def read(self, getch_func, timeout: Optional[float] = None) -> tuple:
        """
        Read input, handling paste sequences transparently.
        
        Args:
            getch_func: Function to read a single character, like kb.getch()
            timeout: Optional read timeout
        
        Returns:
            Tuple of (content, is_paste):
            - For regular input: (key, False)
            - For paste: (pasted_text, True)
        """
        # If we have pending keys from previous parsing, return those first
        if self._pending_keys:
            key = self._pending_keys.pop(0)
            return (key, False)
        
        # Read a character
        if timeout is not None:
            char = getch_func(timeout=timeout)
        else:
            char = getch_func()
        
        if not char:
            return ('', False)
        
        # Feed to parser
        result = self._parser.feed(char)
        
        if result == 'paste-start':
            # Start collecting paste content
            return self._collect_paste(getch_func)
        
        elif result == 'char':
            # Regular character(s)
            pending = self._parser.pending_chars
            if len(pending) > 1:
                # Multiple chars from buffer flush, queue the rest
                self._pending_keys.extend(list(pending[1:]))
                return (pending[0], False)
            elif len(pending) == 1:
                return (pending, False)
            else:
                # Empty - shouldn't happen, but handle gracefully
                return ('', False)
        
        elif result == 'buffering':
            # Parser is waiting for more characters to complete sequence
            # We need to read more to know if it's a paste sequence
            return self._continue_parsing(getch_func)
        
        elif result == 'paste-end':
            # Unexpected paste end without start - ignore
            return self.read(getch_func, timeout)
        
        return ('', False)
    
    def _continue_parsing(self, getch_func) -> tuple:
        """Continue parsing when buffering for escape sequence."""
        import time
        start_time = time.time()
        esc_timeout = 0.05  # 50ms timeout for escape sequences
        
        while True:
            # Check timeout
            if time.time() - start_time > esc_timeout:
                result = self._parser.timeout()
                if result == 'char':
                    pending = self._parser.pending_chars
                    if len(pending) > 1:
                        self._pending_keys.extend(list(pending[1:]))
                        return (pending[0], False)
                    elif len(pending) == 1:
                        return (pending, False)
                return ('', False)
            
            # Try to read with short timeout
            char = getch_func(timeout=0.01)
            if not char:
                continue
            
            result = self._parser.feed(char)
            
            if result == 'paste-start':
                return self._collect_paste(getch_func)
            elif result == 'char':
                pending = self._parser.pending_chars
                if len(pending) > 1:
                    self._pending_keys.extend(list(pending[1:]))
                    return (pending[0], False)
                elif len(pending) == 1:
                    return (pending, False)
            elif result == 'buffering':
                # Continue waiting
                continue
            elif result == 'paste-end':
                # Unexpected, ignore and continue
                return self.read(getch_func)
    
    def _collect_paste(self, getch_func) -> tuple:
        """Collect paste content until paste end marker."""
        import time
        content = []
        start_time = time.time()
        
        # Create a new parser just for detecting paste end
        end_parser = PasteSequenceParser()
        
        while True:
            # Check timeout
            if time.time() - start_time > self._timeout:
                # Timeout - return what we collected as paste
                break
            
            # Read character (short timeout to stay responsive)
            char = getch_func(timeout=0.1)
            if not char:
                continue
            
            # Check if this could be start of paste-end sequence
            result = end_parser.feed(char)
            
            if result == 'paste-end':
                # Found paste end marker
                break
            elif result == 'paste-start':
                # Nested paste-start? Shouldn't happen, but add literally
                content.append('\x1b[200~')
            elif result == 'char':
                # Regular character(s)
                pending = end_parser.pending_chars
                content.append(pending)
            elif result == 'buffering':
                # Wait for more to determine if this is paste-end or content
                continue
        
        return (''.join(content), True)


# Convenience function for creating a configured collector
def create_paste_collector(timeout: float = 30.0) -> PasteCollector:
    """Create a new PasteCollector with the specified timeout."""
    return PasteCollector(timeout=timeout)
