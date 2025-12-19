"""
Property Test: Enter Key Newline Insertion

**Feature: curses-tui-frontend, Property 6: Enter Key Newline Insertion**
**Validates: Requirements 15.1-15.6**

Property 6: Enter Key Newline Insertion
*For any* TextBuffer state with cursor at position (row, col), pressing Enter SHALL
result in: (1) line at row split at col, (2) cursor moved to (row+1, 0),
(3) line_count increased by 1.
"""

import sys
import os
import unittest
import random

# Add scripts directory to path
sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

from tests.pbt_framework import Generator, property_test
from data.buffer import TextBuffer


class BufferStateGenerator(Generator):
    """
    Generate TextBuffer states with random content and cursor positions.

    Generates buffers with:
    - 1-10 lines of text
    - Each line 0-50 characters
    - Cursor at valid position within the buffer
    """

    def __init__(self, min_lines: int = 1, max_lines: int = 10, max_line_len: int = 50):
        self.min_lines = min_lines
        self.max_lines = max_lines
        self.max_line_len = max_line_len

    def generate(self, rng: random.Random) -> TextBuffer:
        buffer = TextBuffer()
        buffer.lines = []

        # Generate random lines
        num_lines = rng.randint(self.min_lines, self.max_lines)
        for _ in range(num_lines):
            line_len = rng.randint(0, self.max_line_len)
            line = "".join(
                rng.choices("abcdefghijklmnopqrstuvwxyz0123456789 ", k=line_len)
            )
            buffer.lines.append(line)

        # Set cursor to valid random position
        buffer.cursor_row = rng.randint(0, len(buffer.lines) - 1)
        buffer.cursor_col = rng.randint(0, len(buffer.lines[buffer.cursor_row]))

        return buffer

    def shrink(self, buffer: TextBuffer) -> list:
        """Try to shrink to simpler buffer states."""
        results = []

        # Try single line buffer
        if len(buffer.lines) > 1:
            simple = TextBuffer()
            simple.lines = [buffer.lines[buffer.cursor_row]]
            simple.cursor_row = 0
            simple.cursor_col = min(buffer.cursor_col, len(simple.lines[0]))
            results.append(simple)

        # Try shorter line
        if buffer.lines[buffer.cursor_row]:
            shorter = TextBuffer()
            shorter.lines = list(buffer.lines)
            shorter.lines[buffer.cursor_row] = buffer.lines[buffer.cursor_row][
                : buffer.cursor_col
            ]
            shorter.cursor_row = buffer.cursor_row
            shorter.cursor_col = len(shorter.lines[shorter.cursor_row])
            results.append(shorter)

        return results


class TestEnterNewlineProperty(unittest.TestCase):
    """
    Property 6: Enter Key Newline Insertion

    **Feature: curses-tui-frontend, Property 6: Enter Key Newline Insertion**
    **Validates: Requirements 15.1-15.6**
    """

    @property_test(BufferStateGenerator(), iterations=100)
    def test_newline_splits_line_at_cursor(self, buffer: TextBuffer):
        """
        **Feature: curses-tui-frontend, Property 6: Enter Key Newline Insertion**
        **Validates: Requirements 15.1-15.6**

        For any buffer state, pressing Enter should split the line at cursor position.
        """
        # Capture state before newline
        original_line = buffer.lines[buffer.cursor_row]
        original_row = buffer.cursor_row
        original_col = buffer.cursor_col
        original_line_count = buffer.line_count

        # Expected split
        expected_before = original_line[:original_col]
        expected_after = original_line[original_col:]

        # Press Enter
        buffer.newline()

        # Verify line was split correctly
        self.assertEqual(
            buffer.lines[original_row],
            expected_before,
            f"Line before cursor should be '{expected_before}', got '{buffer.lines[original_row]}'",
        )

        self.assertEqual(
            buffer.lines[original_row + 1],
            expected_after,
            f"Line after cursor should be '{expected_after}', got '{buffer.lines[original_row + 1]}'",
        )

    @property_test(BufferStateGenerator(), iterations=100)
    def test_newline_moves_cursor_to_new_line_start(self, buffer: TextBuffer):
        """
        **Feature: curses-tui-frontend, Property 6: Enter Key Newline Insertion**
        **Validates: Requirements 15.1-15.6**

        For any buffer state, pressing Enter should move cursor to (row+1, 0).
        """
        original_row = buffer.cursor_row

        # Press Enter
        buffer.newline()

        # Verify cursor position
        self.assertEqual(
            buffer.cursor_row,
            original_row + 1,
            f"Cursor row should be {original_row + 1}, got {buffer.cursor_row}",
        )

        self.assertEqual(
            buffer.cursor_col, 0, f"Cursor col should be 0, got {buffer.cursor_col}"
        )

    @property_test(BufferStateGenerator(), iterations=100)
    def test_newline_increases_line_count_by_one(self, buffer: TextBuffer):
        """
        **Feature: curses-tui-frontend, Property 6: Enter Key Newline Insertion**
        **Validates: Requirements 15.1-15.6**

        For any buffer state, pressing Enter should increase line_count by 1.
        """
        original_line_count = buffer.line_count

        # Press Enter
        buffer.newline()

        # Verify line count increased
        self.assertEqual(
            buffer.line_count,
            original_line_count + 1,
            f"Line count should be {original_line_count + 1}, got {buffer.line_count}",
        )


if __name__ == "__main__":
    unittest.main()
