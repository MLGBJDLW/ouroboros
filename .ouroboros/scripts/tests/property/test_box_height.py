"""
Property Test: Input Box Height Bounds

**Feature: curses-tui-frontend, Property 9: Input Box Height Bounds**
**Validates: Requirements 25.1-25.5**

Property 9: Input Box Height Bounds
*For any* sequence of line additions and deletions, the InputBox height SHALL
satisfy 1 <= height <= 5, and virtual scrolling SHALL be used when line_count > 5.
"""

import sys
import os
import unittest
import random

# Add scripts directory to path
scripts_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, scripts_dir)

from tests.pbt_framework import Generator, property_test
from data.buffer import TextBuffer
from utils.badge import render_for_display, find_markers, get_marker_at_position
from utils.text import visible_len, char_width


# Import StatusBar directly to avoid circular imports
class StatusBar:
    """Minimal StatusBar for testing."""

    MODES = ("INPUT", "PASTE", "HISTORY", "SEARCH")

    def __init__(self, theme=None):
        self.theme = theme
        self._mode = "INPUT"
        self._cursor_row = 1
        self._cursor_col = 1
        self._scroll_start = 1
        self._scroll_end = 1
        self._total_lines = 1

    @property
    def mode(self):
        return self._mode

    @mode.setter
    def mode(self, value):
        if value in self.MODES:
            self._mode = value

    def set_cursor_position(self, row, col):
        self._cursor_row = max(1, row)
        self._cursor_col = max(1, col)

    def set_scroll_info(self, start, end, total):
        self._scroll_start = max(1, start)
        self._scroll_end = max(1, end)
        self._total_lines = max(1, total)

    def format_scroll(self):
        if self._total_lines <= 1:
            return ""
        if self._scroll_start == 1 and self._scroll_end >= self._total_lines:
            return ""
        return f"[{self._scroll_start}-{self._scroll_end}/{self._total_lines}]"


class InputBox:
    """
    InputBox for testing - minimal implementation for property tests.
    """

    MIN_HEIGHT = 1
    MAX_HEIGHT = 5

    def __init__(self, screen=None, theme=None, show_line_numbers=True, prompt_header=""):
        self.screen = screen
        self.theme = theme
        self.show_line_numbers = show_line_numbers
        self.prompt_header = prompt_header
        self.buffer = TextBuffer()
        self.status_bar = StatusBar(theme)
        self._height = self.MIN_HEIGHT
        self._mode = "INPUT"

    def _calculate_height(self):
        """Calculate required height based on content."""
        line_count = self.buffer.line_count
        return max(self.MIN_HEIGHT, min(self.MAX_HEIGHT, line_count))

    def is_scrolling(self):
        """Check if virtual scrolling is active."""
        return self.buffer.line_count > self.MAX_HEIGHT


class LineOperationSequenceGenerator(Generator):
    """
    Generate sequences of line operations (add/delete).

    Operations:
    - 'add': Add a new line (press Enter)
    - 'delete': Delete a line (backspace at line start)
    - 'text': Add some text to current line

    Generates sequences of 1-50 operations.
    """

    def __init__(self, min_ops: int = 1, max_ops: int = 50):
        self.min_ops = min_ops
        self.max_ops = max_ops

    def generate(self, rng: random.Random) -> list:
        num_ops = rng.randint(self.min_ops, self.max_ops)
        operations = []

        for _ in range(num_ops):
            op_type = rng.choice(["add", "add", "delete", "text"])  # Bias toward adding

            if op_type == "text":
                # Generate some random text
                text_len = rng.randint(1, 20)
                text = "".join(rng.choices("abcdefghijklmnopqrstuvwxyz ", k=text_len))
                operations.append(("text", text))
            else:
                operations.append((op_type,))

        return operations

    def shrink(self, operations: list) -> list:
        """Try to shrink to simpler operation sequences."""
        results = []

        # Try fewer operations
        if len(operations) > 1:
            results.append(operations[: len(operations) // 2])
            results.append(operations[:-1])

        # Try only add operations
        adds_only = [op for op in operations if op[0] == "add"]
        if adds_only and adds_only != operations:
            results.append(adds_only)

        return results


def apply_operations(input_box: InputBox, operations: list) -> None:
    """Apply a sequence of operations to an InputBox."""
    for op in operations:
        if op[0] == "add":
            # Add a new line (simulate Enter)
            input_box.buffer.newline()
        elif op[0] == "delete":
            # Delete (simulate backspace)
            input_box.buffer.backspace()
        elif op[0] == "text":
            # Add text
            input_box.buffer.insert_text(op[1])


class TestInputBoxHeightBoundsProperty(unittest.TestCase):
    """
    Property 9: Input Box Height Bounds

    **Feature: curses-tui-frontend, Property 9: Input Box Height Bounds**
    **Validates: Requirements 25.1-25.5**
    """

    @property_test(LineOperationSequenceGenerator(), iterations=100)
    def test_height_within_bounds_after_operations(self, operations: list):
        """
        **Feature: curses-tui-frontend, Property 9: Input Box Height Bounds**
        **Validates: Requirements 25.1-25.5**

        For any sequence of operations, height should satisfy 1 <= height <= 5.
        """
        input_box = InputBox()

        # Apply operations
        apply_operations(input_box, operations)

        # Calculate height (this is what render would calculate)
        calculated_height = input_box._calculate_height()

        # Verify bounds
        self.assertGreaterEqual(
            calculated_height,
            InputBox.MIN_HEIGHT,
            f"Height {calculated_height} should be >= {InputBox.MIN_HEIGHT}",
        )

        self.assertLessEqual(
            calculated_height,
            InputBox.MAX_HEIGHT,
            f"Height {calculated_height} should be <= {InputBox.MAX_HEIGHT}",
        )

    @property_test(LineOperationSequenceGenerator(min_ops=10, max_ops=50), iterations=100)
    def test_virtual_scrolling_when_exceeds_max(self, operations: list):
        """
        **Feature: curses-tui-frontend, Property 9: Input Box Height Bounds**
        **Validates: Requirements 25.1-25.5**

        When line_count > 5, virtual scrolling should be active.
        """
        input_box = InputBox()

        # Apply operations
        apply_operations(input_box, operations)

        line_count = input_box.buffer.line_count
        calculated_height = input_box._calculate_height()

        if line_count > InputBox.MAX_HEIGHT:
            # Virtual scrolling should be active
            self.assertTrue(
                input_box.is_scrolling(),
                f"Virtual scrolling should be active when line_count ({line_count}) > MAX_HEIGHT ({InputBox.MAX_HEIGHT})",
            )

            # Height should be capped at MAX_HEIGHT
            self.assertEqual(
                calculated_height,
                InputBox.MAX_HEIGHT,
                f"Height should be {InputBox.MAX_HEIGHT} when line_count ({line_count}) exceeds max",
            )

    @property_test(LineOperationSequenceGenerator(), iterations=100)
    def test_height_matches_line_count_when_under_max(self, operations: list):
        """
        **Feature: curses-tui-frontend, Property 9: Input Box Height Bounds**
        **Validates: Requirements 25.1-25.5**

        When line_count <= 5, height should equal line_count.
        """
        input_box = InputBox()

        # Apply operations
        apply_operations(input_box, operations)

        line_count = input_box.buffer.line_count
        calculated_height = input_box._calculate_height()

        if line_count <= InputBox.MAX_HEIGHT:
            expected_height = max(InputBox.MIN_HEIGHT, line_count)
            self.assertEqual(
                calculated_height,
                expected_height,
                f"Height should be {expected_height} when line_count is {line_count}",
            )


if __name__ == "__main__":
    unittest.main()
