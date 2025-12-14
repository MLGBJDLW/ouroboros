#!/usr/bin/env python3
"""
ouroboros_buffer.py - Text Buffer Management

Provides multi-line text buffer with cursor management for the Ouroboros CCL system.

Dependencies: Python 3.6+ standard library only
"""


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
            self.lines[self.cursor_row] = line[:self.cursor_col - 1] + line[self.cursor_col:]
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
            self.lines[self.cursor_row] = line[:self.cursor_col] + line[self.cursor_col + 1:]
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

    def word_left(self) -> None:
        """Move cursor to the start of the previous word."""
        line = self.lines[self.cursor_row]
        col = self.cursor_col
        # Skip spaces going left
        while col > 0 and (col > len(line) or line[col - 1] in ' \t'):
            col -= 1
        # Skip word characters going left
        while col > 0 and col <= len(line) and line[col - 1] not in ' \t':
            col -= 1
        self.cursor_col = col

    def word_right(self) -> None:
        """Move cursor to the start of the next word."""
        line = self.lines[self.cursor_row]
        col = self.cursor_col
        line_len = len(line)
        # Skip word characters going right
        while col < line_len and line[col] not in ' \t':
            col += 1
        # Skip spaces going right
        while col < line_len and line[col] in ' \t':
            col += 1
        self.cursor_col = col
