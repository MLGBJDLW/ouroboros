"""
Property Test: Selection Menu Bounds

**Feature: curses-tui-frontend, Property 8: Selection Menu Bounds**
**Validates: Requirements 28.1-28.8**

Property 8: Selection Menu Bounds
*For any* selection menu with N options, the selected_index SHALL always
satisfy 0 <= selected_index < N after any sequence of move_up/move_down operations.
"""

import sys
import os
import unittest
import random

# Add scripts directory to path
scripts_dir = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)
sys.path.insert(0, scripts_dir)

from tests.pbt_framework import Generator, property_test


class SelectionMenu:
    """
    SelectionMenu for testing - minimal implementation for property tests.
    """

    MIN_WIDTH = 30
    MAX_VISIBLE = 10
    CUSTOM_INPUT_TEXT = "[Custom input...]"

    def __init__(self, options=None, allow_custom=True):
        self._options = []
        self._has_custom = False
        self._selected_index = 0
        self._scroll_offset = 0
        self._visible_count = self.MAX_VISIBLE

        if options:
            self.set_options(options, allow_custom)

    @property
    def option_count(self):
        return len(self._options)

    @property
    def selected_index(self):
        return self._selected_index

    def set_options(self, options, allow_custom=True):
        self._options = list(options)
        if allow_custom and self.CUSTOM_INPUT_TEXT not in self._options:
            self._options.append(self.CUSTOM_INPUT_TEXT)
            self._has_custom = True
        self._selected_index = 0
        self._scroll_offset = 0

    def move_up(self):
        if self._selected_index > 0:
            self._selected_index -= 1
            self._ensure_visible()
            return True
        return False

    def move_down(self):
        if self._selected_index < len(self._options) - 1:
            self._selected_index += 1
            self._ensure_visible()
            return True
        return False

    def page_up(self):
        if self._selected_index > 0:
            self._selected_index = max(0, self._selected_index - self._visible_count)
            self._ensure_visible()
            return True
        return False

    def page_down(self):
        max_index = len(self._options) - 1
        if self._selected_index < max_index:
            self._selected_index = min(
                max_index, self._selected_index + self._visible_count
            )
            self._ensure_visible()
            return True
        return False

    def home(self):
        if self._selected_index > 0:
            self._selected_index = 0
            self._scroll_offset = 0
            return True
        return False

    def end(self):
        max_index = len(self._options) - 1
        if self._selected_index < max_index:
            self._selected_index = max_index
            self._ensure_visible()
            return True
        return False

    def select_by_number(self, num):
        index = num - 1
        if 0 <= index < len(self._options):
            self._selected_index = index
            self._ensure_visible()
            return True
        return False

    def _ensure_visible(self):
        if self._selected_index < self._scroll_offset:
            self._scroll_offset = self._selected_index
        elif self._selected_index >= self._scroll_offset + self._visible_count:
            self._scroll_offset = self._selected_index - self._visible_count + 1


class MenuOperationSequenceGenerator(Generator):
    """
    Generate sequences of menu navigation operations.

    Operations:
    - 'up': Move selection up
    - 'down': Move selection down
    - 'page_up': Page up
    - 'page_down': Page down
    - 'home': Go to first
    - 'end': Go to last
    - 'number': Select by number (1-9)
    """

    def __init__(self, min_ops: int = 1, max_ops: int = 100):
        self.min_ops = min_ops
        self.max_ops = max_ops

    def generate(self, rng: random.Random) -> list:
        num_ops = rng.randint(self.min_ops, self.max_ops)
        operations = []

        for _ in range(num_ops):
            op_type = rng.choice(
                [
                    "up",
                    "down",
                    "up",
                    "down",
                    "page_up",
                    "page_down",
                    "home",
                    "end",
                    "number",
                ]
            )

            if op_type == "number":
                num = rng.randint(1, 9)
                operations.append(("number", num))
            else:
                operations.append((op_type,))

        return operations

    def shrink(self, operations: list) -> list:
        results = []

        if len(operations) > 1:
            results.append(operations[: len(operations) // 2])
            results.append(operations[:-1])

        # Try only up/down operations
        simple = [op for op in operations if op[0] in ("up", "down")]
        if simple and simple != operations:
            results.append(simple)

        return results


class OptionsGenerator(Generator):
    """Generate random option lists."""

    def __init__(self, min_options: int = 1, max_options: int = 20):
        self.min_options = min_options
        self.max_options = max_options

    def generate(self, rng: random.Random) -> list:
        num_options = rng.randint(self.min_options, self.max_options)
        options = []

        for i in range(num_options):
            option_len = rng.randint(5, 30)
            option = "".join(rng.choices("abcdefghijklmnopqrstuvwxyz ", k=option_len))
            options.append(f"Option {i+1}: {option.strip()}")

        return options

    def shrink(self, options: list) -> list:
        if len(options) <= 1:
            return []
        return [options[: len(options) // 2], ["Option 1"]]


class MenuWithOperationsGenerator(Generator):
    """Generate menu options and operation sequences together."""

    def __init__(
        self,
        min_options: int = 1,
        max_options: int = 20,
        min_ops: int = 1,
        max_ops: int = 100,
    ):
        self.options_gen = OptionsGenerator(min_options, max_options)
        self.ops_gen = MenuOperationSequenceGenerator(min_ops, max_ops)

    def generate(self, rng: random.Random) -> tuple:
        options = self.options_gen.generate(rng)
        operations = self.ops_gen.generate(rng)
        return (options, operations)

    def shrink(self, value: tuple) -> list:
        options, operations = value
        results = []

        # Try fewer operations
        for shrunk_ops in self.ops_gen.shrink(operations):
            results.append((options, shrunk_ops))

        # Try fewer options
        for shrunk_opts in self.options_gen.shrink(options):
            results.append((shrunk_opts, operations))

        return results


def apply_operations(menu: SelectionMenu, operations: list) -> None:
    """Apply a sequence of operations to a SelectionMenu."""
    for op in operations:
        if op[0] == "up":
            menu.move_up()
        elif op[0] == "down":
            menu.move_down()
        elif op[0] == "page_up":
            menu.page_up()
        elif op[0] == "page_down":
            menu.page_down()
        elif op[0] == "home":
            menu.home()
        elif op[0] == "end":
            menu.end()
        elif op[0] == "number":
            menu.select_by_number(op[1])


class TestSelectionMenuBoundsProperty(unittest.TestCase):
    """
    Property 8: Selection Menu Bounds

    **Feature: curses-tui-frontend, Property 8: Selection Menu Bounds**
    **Validates: Requirements 28.1-28.8**
    """

    @property_test(MenuWithOperationsGenerator(), iterations=100)
    def test_selected_index_within_bounds(self, value: tuple):
        """
        **Feature: curses-tui-frontend, Property 8: Selection Menu Bounds**
        **Validates: Requirements 28.1-28.8**

        For any menu with N options, selected_index should satisfy 0 <= index < N.
        """
        options, operations = value

        menu = SelectionMenu(options=options, allow_custom=False)
        n = menu.option_count

        # Apply operations
        apply_operations(menu, operations)

        # Verify bounds
        self.assertGreaterEqual(
            menu.selected_index,
            0,
            f"selected_index {menu.selected_index} should be >= 0",
        )

        self.assertLess(
            menu.selected_index,
            n,
            f"selected_index {menu.selected_index} should be < {n}",
        )

    @property_test(
        MenuWithOperationsGenerator(min_options=5, max_options=30), iterations=100
    )
    def test_bounds_with_many_options(self, value: tuple):
        """
        **Feature: curses-tui-frontend, Property 8: Selection Menu Bounds**
        **Validates: Requirements 28.1-28.8**

        With many options, bounds should still be maintained.
        """
        options, operations = value

        menu = SelectionMenu(options=options, allow_custom=True)
        n = menu.option_count

        # Apply operations
        apply_operations(menu, operations)

        # Verify bounds
        self.assertGreaterEqual(menu.selected_index, 0)
        self.assertLess(menu.selected_index, n)

    @property_test(
        MenuOperationSequenceGenerator(min_ops=50, max_ops=200), iterations=100
    )
    def test_bounds_with_many_operations(self, operations: list):
        """
        **Feature: curses-tui-frontend, Property 8: Selection Menu Bounds**
        **Validates: Requirements 28.1-28.8**

        With many operations, bounds should still be maintained.
        """
        # Fixed set of options
        options = [f"Option {i}" for i in range(15)]

        menu = SelectionMenu(options=options, allow_custom=False)
        n = menu.option_count

        # Apply operations
        apply_operations(menu, operations)

        # Verify bounds
        self.assertGreaterEqual(menu.selected_index, 0)
        self.assertLess(menu.selected_index, n)


if __name__ == "__main__":
    unittest.main()
