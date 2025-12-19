"""
Paste detection module.

This module provides paste detection via Bracketed Paste Mode
and event count detection fallback.


"""

import sys
import atexit
import time
from typing import Optional, Callable, Tuple

# ANSI escape sequences for Bracketed Paste Mode
ENABLE_BRACKETED_PASTE = "\x1b[?2004h"
DISABLE_BRACKETED_PASTE = "\x1b[?2004l"
PASTE_START = "\x1b[200~"
PASTE_END = "\x1b[201~"
PASTE_START_PARTIAL = "[200~"
PASTE_END_PARTIAL = "[201~"


class BracketedPasteHandler:
    """
    Manages Bracketed Paste Mode for the terminal.

    Usage:
        handler = BracketedPasteHandler()
        handler.enable()

        # In input loop:
        if handler.is_paste_start(sequence):
            paste_content = handler.collect_paste(read_char_func)

        handler.disable()
    """

    def __init__(self):
        self._enabled = False
        self._collecting = False
        self._buffer = []

    def enable(self) -> None:
        """Enable Bracketed Paste Mode in the terminal."""
        if not self._enabled:
            # Write terminal control sequences to stderr to keep stdout clean for
            # AI consumption (stdout is reserved for the final submitted text).
            sys.stderr.write(ENABLE_BRACKETED_PASTE)
            sys.stderr.flush()
            self._enabled = True
            atexit.register(self._cleanup)

    def disable(self) -> None:
        """Disable Bracketed Paste Mode in the terminal."""
        if self._enabled:
            sys.stderr.write(DISABLE_BRACKETED_PASTE)
            sys.stderr.flush()
            self._enabled = False
            try:
                atexit.unregister(self._cleanup)
            except Exception:
                pass

    def _cleanup(self) -> None:
        """Cleanup handler for atexit."""
        if self._enabled:
            try:
                sys.stderr.write(DISABLE_BRACKETED_PASTE)
                sys.stderr.flush()
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
        """Check if the given sequence is the paste start marker."""
        return sequence == PASTE_START or sequence == PASTE_START_PARTIAL

    def is_paste_end_sequence(self, sequence: str) -> bool:
        """Check if the given sequence is the paste end marker."""
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
        """Finish collecting and return the paste content."""
        self._collecting = False
        content = "".join(self._buffer)
        self._buffer = []
        return content

    def cancel_collecting(self) -> None:
        """Cancel paste collection."""
        self._collecting = False
        self._buffer = []


class PasteSequenceParser:
    """
    Parser for detecting paste sequences within a stream of characters.

    Detects:
    - ESC [ 2 0 0 ~ (paste start)
    - ESC [ 2 0 1 ~ (paste end)
    """

    STATE_NORMAL = 0
    STATE_ESC = 1
    STATE_BRACKET = 2
    STATE_TWO = 3
    STATE_ZERO = 4
    STATE_DIGIT = 5

    def __init__(self):
        self._state = self.STATE_NORMAL
        self._buffer = []
        self._pending = []
        self._sequence_type = None

    @property
    def pending_chars(self) -> str:
        """Get any pending characters that should be processed as regular input."""
        result = "".join(self._pending)
        self._pending = []
        return result

    def reset(self) -> None:
        """Reset the parser state."""
        self._flush_buffer_to_pending()
        self._state = self.STATE_NORMAL
        self._sequence_type = None

    def _flush_buffer_to_pending(self) -> None:
        """Move buffer contents to pending."""
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
            if char == "\x1b":
                self._buffer = [char]
                self._state = self.STATE_ESC
                return "buffering"
            else:
                self._pending = [char]
                return "char"

        elif self._state == self.STATE_ESC:
            if char == "[":
                self._buffer.append(char)
                self._state = self.STATE_BRACKET
                return "buffering"
            else:
                self._flush_buffer_to_pending()
                self._pending.append(char)
                self._state = self.STATE_NORMAL
                return "char"

        elif self._state == self.STATE_BRACKET:
            if char == "2":
                self._buffer.append(char)
                self._state = self.STATE_TWO
                return "buffering"
            else:
                self._flush_buffer_to_pending()
                self._pending.append(char)
                self._state = self.STATE_NORMAL
                return "char"

        elif self._state == self.STATE_TWO:
            if char == "0":
                self._buffer.append(char)
                self._state = self.STATE_ZERO
                return "buffering"
            else:
                self._flush_buffer_to_pending()
                self._pending.append(char)
                self._state = self.STATE_NORMAL
                return "char"

        elif self._state == self.STATE_ZERO:
            if char == "0":
                self._buffer.append(char)
                self._sequence_type = "0"
                self._state = self.STATE_DIGIT
                return "buffering"
            elif char == "1":
                self._buffer.append(char)
                self._sequence_type = "1"
                self._state = self.STATE_DIGIT
                return "buffering"
            else:
                self._flush_buffer_to_pending()
                self._pending.append(char)
                self._state = self.STATE_NORMAL
                return "char"

        elif self._state == self.STATE_DIGIT:
            if char == "~":
                self._buffer = []
                self._state = self.STATE_NORMAL
                if self._sequence_type == "0":
                    self._sequence_type = None
                    return "paste-start"
                else:
                    self._sequence_type = None
                    return "paste-end"
            else:
                self._flush_buffer_to_pending()
                self._pending.append(char)
                self._state = self.STATE_NORMAL
                self._sequence_type = None
                return "char"

        self._pending = [char]
        self._state = self.STATE_NORMAL
        return "char"

    def timeout(self) -> str:
        """Called when there's a timeout waiting for more characters."""
        if self._buffer:
            self._flush_buffer_to_pending()
            self._state = self.STATE_NORMAL
            self._sequence_type = None
            return "char"
        return "none"


class PasteDetector:
    """
    High-level paste detector that integrates with a key reading function.

    Usage:
        detector = PasteDetector()
        detector.enable()

        # In input loop:
        key, is_paste = detector.read(kb.getch)
        if is_paste:
            buffer.insert_text(key)
        else:
            handle_key(key)
    """

    # Event count threshold for paste detection fallback
    EVENT_COUNT_THRESHOLD = 10

    def __init__(self, timeout: float = 30.0):
        """
        Initialize the paste detector.

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

    def read(self, getch_func: Callable, timeout: Optional[float] = None) -> Tuple[str, bool]:
        """
        Read input, handling paste sequences transparently.

        Args:
            getch_func: Function to read a single character
            timeout: Optional read timeout

        Returns:
            Tuple of (content, is_paste):
            - For regular input: (key, False)
            - For paste: (pasted_text, True)
        """
        if self._pending_keys:
            key = self._pending_keys.pop(0)
            return (key, False)

        if timeout is not None:
            char = getch_func(timeout=timeout)
        else:
            char = getch_func()

        if not char:
            return ("", False)

        # Check if this is ESC - could be start of paste sequence
        if char == "\x1b":
            result = self._parser.feed(char)
            if result == "buffering":
                return self._continue_parsing(getch_func)
            elif result == "paste-start":
                return self._collect_paste(getch_func)
            else:
                pending = self._parser.pending_chars
                return (pending, False) if pending else ("\x1b", False)

        # Check if this is a complete escape sequence
        if len(char) > 1 and char.startswith("\x1b"):
            if char == "\x1b[200~":
                return self._collect_paste(getch_func)
            elif char == "\x1b[201~":
                return self.read(getch_func, timeout)
            else:
                return (char, False)

        return (char, False)

    def _continue_parsing(self, getch_func: Callable) -> Tuple[str, bool]:
        """Continue parsing when buffering for escape sequence."""
        start_time = time.time()
        esc_timeout = 0.05

        while True:
            if time.time() - start_time > esc_timeout:
                result = self._parser.timeout()
                if result == "char":
                    pending = self._parser.pending_chars
                    if len(pending) > 1:
                        self._pending_keys.extend(list(pending[1:]))
                        return (pending[0], False)
                    elif len(pending) == 1:
                        return (pending, False)
                return ("", False)

            char = getch_func(timeout=0.01)
            if not char:
                continue

            result = self._parser.feed(char)

            if result == "paste-start":
                return self._collect_paste(getch_func)
            elif result == "char":
                pending = self._parser.pending_chars
                if len(pending) > 1:
                    self._pending_keys.extend(list(pending[1:]))
                    return (pending[0], False)
                elif len(pending) == 1:
                    return (pending, False)
            elif result == "buffering":
                continue
            elif result == "paste-end":
                return self.read(getch_func)

    def _collect_paste(self, getch_func: Callable) -> Tuple[str, bool]:
        """Collect paste content until paste end marker."""
        content = []
        start_time = time.time()
        end_parser = PasteSequenceParser()

        while True:
            if time.time() - start_time > self._timeout:
                break

            char = getch_func(timeout=0.1)
            if not char:
                continue

            result = end_parser.feed(char)

            if result == "paste-end":
                break
            elif result == "paste-start":
                content.append("\x1b[200~")
            elif result == "char":
                pending = end_parser.pending_chars
                content.append(pending)
            elif result == "buffering":
                continue

        return ("".join(content), True)


# Global singleton
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


def create_paste_detector(timeout: float = 30.0) -> PasteDetector:
    """Create a new PasteDetector with the specified timeout."""
    return PasteDetector(timeout=timeout)
