"""
Property Test: Character Width Calculation

**Feature: curses-tui-frontend, Property 1: Character Width Calculation**
**Validates: Requirements 2.7**

Property 1: Character Width Calculation
*For any* string containing CJK characters, the calculated display width SHALL equal
the sum of individual character widths where ASCII characters count as 1 and CJK
characters count as 2.
"""

import sys
import os
import unittest

# Add scripts directory to path
sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

from tests.pbt_framework import property_test, CJKStringGenerator, StringGenerator
from utils.text import char_width, visible_len


class TestCharWidthProperty(unittest.TestCase):
    """
    Property 1: Character Width Calculation

    **Feature: curses-tui-frontend, Property 1: Character Width Calculation**
    **Validates: Requirements 2.7**
    """

    @property_test(CJKStringGenerator(min_len=1, max_len=100), iterations=100)
    def test_visible_len_equals_sum_of_char_widths(self, text: str):
        """
        **Feature: curses-tui-frontend, Property 1: Character Width Calculation**
        **Validates: Requirements 2.7**

        For any string, visible_len(text) should equal sum(char_width(c) for c in text)
        """
        expected_width = sum(char_width(c) for c in text)
        actual_width = visible_len(text)

        self.assertEqual(
            expected_width,
            actual_width,
            f"Width mismatch for '{text}': expected {expected_width}, got {actual_width}",
        )

    @property_test(
        CJKStringGenerator(min_len=0, max_len=50, cjk_ratio=1.0), iterations=100
    )
    def test_cjk_chars_have_width_2(self, text: str):
        """
        **Feature: curses-tui-frontend, Property 1: Character Width Calculation**
        **Validates: Requirements 2.7**

        For any CJK-only string, visible_len should equal 2 * len(text)
        """
        if not text:
            return  # Skip empty strings

        expected_width = 2 * len(text)
        actual_width = visible_len(text)

        self.assertEqual(
            expected_width,
            actual_width,
            f"CJK width mismatch for '{text}': expected {expected_width}, got {actual_width}",
        )

    @property_test(StringGenerator(min_len=0, max_len=50), iterations=100)
    def test_ascii_chars_have_width_1(self, text: str):
        """
        **Feature: curses-tui-frontend, Property 1: Character Width Calculation**
        **Validates: Requirements 2.7**

        For any ASCII-only string, visible_len should equal len(text)
        """
        expected_width = len(text)
        actual_width = visible_len(text)

        self.assertEqual(
            expected_width,
            actual_width,
            f"ASCII width mismatch for '{text}': expected {expected_width}, got {actual_width}",
        )


if __name__ == "__main__":
    unittest.main()
