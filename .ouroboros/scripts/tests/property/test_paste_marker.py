"""
Property Test: Paste Marker Round-Trip

**Feature: curses-tui-frontend, Property 3: Paste Marker Round-Trip**
**Validates: Requirements 7.1-7.6, 16.3**

Property 3: Paste Marker Round-Trip
*For any* multi-line string content, creating a paste marker with `create_paste_marker(content)`
and then expanding it with `expand_markers(marker)` SHALL return the original content with
newlines preserved.
"""

import sys
import os
import unittest

# Add scripts directory to path
sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

from tests.pbt_framework import (
    property_test,
    MultilineGenerator,
    StringGenerator,
    Generator,
)
import random
from typing import List


class MultilineContentGenerator(Generator[str]):
    """Generate multi-line content with various characteristics."""

    def __init__(self, min_lines: int = 1, max_lines: int = 20, max_line_len: int = 80):
        self.min_lines = min_lines
        self.max_lines = max_lines
        self.max_line_len = max_line_len

    def generate(self, rng: random.Random) -> str:
        num_lines = rng.randint(self.min_lines, self.max_lines)
        lines = []
        for _ in range(num_lines):
            line_len = rng.randint(0, self.max_line_len)
            # Use safe characters that won't interfere with markers
            line = "".join(
                rng.choices(
                    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?;:()-_=+[]{}",
                    k=line_len,
                )
            )
            lines.append(line)
        return "\n".join(lines)

    def shrink(self, value: str) -> List[str]:
        lines = value.split("\n")
        if len(lines) <= 1:
            return []
        # Try fewer lines
        return ["\n".join(lines[: len(lines) // 2]), "\n".join(lines[:-1]), lines[0]]


class CodeLikeContentGenerator(Generator[str]):
    """Generate content that looks like code."""

    CODE_PATTERNS = [
        "def {name}({args}):",
        "    return {value}",
        "class {name}:",
        "    def __init__(self):",
        "        self.{attr} = {value}",
        "import {module}",
        "from {module} import {name}",
        "if {cond}:",
        "    {action}",
        "for {var} in {iterable}:",
        "# {comment}",
    ]

    def generate(self, rng: random.Random) -> str:
        num_lines = rng.randint(5, 15)
        lines = []
        for _ in range(num_lines):
            pattern = rng.choice(self.CODE_PATTERNS)
            # Fill in placeholders with random identifiers
            line = pattern.format(
                name="".join(
                    rng.choices("abcdefghijklmnopqrstuvwxyz", k=rng.randint(3, 8))
                ),
                args="".join(
                    rng.choices("abcdefghijklmnopqrstuvwxyz, ", k=rng.randint(0, 15))
                ),
                value="".join(
                    rng.choices(
                        "abcdefghijklmnopqrstuvwxyz0123456789", k=rng.randint(1, 10)
                    )
                ),
                attr="".join(
                    rng.choices("abcdefghijklmnopqrstuvwxyz_", k=rng.randint(3, 10))
                ),
                module="".join(
                    rng.choices("abcdefghijklmnopqrstuvwxyz_", k=rng.randint(3, 10))
                ),
                cond="".join(
                    rng.choices("abcdefghijklmnopqrstuvwxyz ", k=rng.randint(3, 15))
                ),
                action="".join(
                    rng.choices("abcdefghijklmnopqrstuvwxyz()", k=rng.randint(5, 20))
                ),
                var="".join(
                    rng.choices("abcdefghijklmnopqrstuvwxyz", k=rng.randint(1, 5))
                ),
                iterable="".join(
                    rng.choices("abcdefghijklmnopqrstuvwxyz[]", k=rng.randint(3, 10))
                ),
                comment="".join(
                    rng.choices(
                        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ ",
                        k=rng.randint(5, 30),
                    )
                ),
            )
            lines.append(line)
        return "\n".join(lines)

    def shrink(self, value: str) -> List[str]:
        lines = value.split("\n")
        if len(lines) <= 1:
            return []
        return ["\n".join(lines[:3]), lines[0]]


class LongSingleLineGenerator(Generator[str]):
    """Generate long single-line content (100+ chars)."""

    def __init__(self, min_len: int = 100, max_len: int = 500):
        self.min_len = min_len
        self.max_len = max_len

    def generate(self, rng: random.Random) -> str:
        length = rng.randint(self.min_len, self.max_len)
        return "".join(
            rng.choices(
                "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?",
                k=length,
            )
        )

    def shrink(self, value: str) -> List[str]:
        if len(value) <= 100:
            return []
        return [value[:100], value[: len(value) // 2]]


from utils.badge import (
    create_paste_marker,
    expand_markers,
    is_paste_marker,
    parse_paste_marker,
    extract_paste_content,
)


class TestPasteMarkerRoundTrip(unittest.TestCase):
    """
    Property 3: Paste Marker Round-Trip

    **Feature: curses-tui-frontend, Property 3: Paste Marker Round-Trip**
    **Validates: Requirements 7.1-7.6, 16.3**
    """

    @property_test(MultilineContentGenerator(min_lines=5, max_lines=20), iterations=100)
    def test_paste_marker_round_trip_multiline(self, content: str):
        """
        **Feature: curses-tui-frontend, Property 3: Paste Marker Round-Trip**
        **Validates: Requirements 7.1, 7.5-7.6, 16.3**

        For any multi-line content (5+ lines), create_paste_marker then expand_markers
        should return the original content with newlines preserved.
        """
        # Create marker
        marker = create_paste_marker(content)

        # Verify it's a valid marker
        self.assertTrue(
            is_paste_marker(marker),
            f"create_paste_marker did not produce a valid marker",
        )

        # Expand marker
        expanded = expand_markers(marker)

        # Should match original
        self.assertEqual(
            content,
            expanded,
            f"Round-trip failed: content has {len(content.split(chr(10)))} lines, "
            f"expanded has {len(expanded.split(chr(10)))} lines",
        )

    @property_test(LongSingleLineGenerator(min_len=100, max_len=300), iterations=100)
    def test_paste_marker_round_trip_long_single_line(self, content: str):
        """
        **Feature: curses-tui-frontend, Property 3: Paste Marker Round-Trip**
        **Validates: Requirements 7.2, 7.5-7.6, 16.3**

        For any long single-line content (100+ chars), round-trip should preserve content.
        """
        # Create marker
        marker = create_paste_marker(content)

        # Verify it's a valid marker
        self.assertTrue(
            is_paste_marker(marker),
            f"create_paste_marker did not produce a valid marker",
        )

        # Expand marker
        expanded = expand_markers(marker)

        # Should match original
        self.assertEqual(
            content,
            expanded,
            f"Round-trip failed for long single line of {len(content)} chars",
        )

    @property_test(CodeLikeContentGenerator(), iterations=100)
    def test_paste_marker_round_trip_code_content(self, content: str):
        """
        **Feature: curses-tui-frontend, Property 3: Paste Marker Round-Trip**
        **Validates: Requirements 7.1, 7.5-7.6, 16.3**

        For any code-like content, round-trip should preserve indentation and structure.
        """
        # Create marker
        marker = create_paste_marker(content)

        # Expand marker
        expanded = expand_markers(marker)

        # Should match original exactly (including indentation)
        self.assertEqual(content, expanded, f"Round-trip failed for code content")

    @property_test(MultilineContentGenerator(min_lines=1, max_lines=10), iterations=100)
    def test_parse_paste_marker_line_count(self, content: str):
        """
        **Feature: curses-tui-frontend, Property 3: Paste Marker Round-Trip**
        **Validates: Requirements 7.1-7.2, 7.5**

        parse_paste_marker should return correct line count.
        """
        marker = create_paste_marker(content)
        line_count, parsed_content = parse_paste_marker(marker)

        expected_lines = len(content.split("\n"))

        self.assertEqual(
            expected_lines,
            line_count,
            f"Line count mismatch: expected {expected_lines}, got {line_count}",
        )

        self.assertEqual(
            content, parsed_content, f"Parsed content differs from original"
        )

    def test_extract_paste_content_consistency(self):
        """
        **Feature: curses-tui-frontend, Property 3: Paste Marker Round-Trip**
        **Validates: Requirements 7.5-7.6, 16.3**

        extract_paste_content and expand_markers should produce same result.
        """
        test_contents = [
            "Line 1\nLine 2\nLine 3",
            "def foo():\n    return 42",
            "Single line with no newlines",
            "Line with\ttabs\tand  spaces",
            "Empty lines\n\n\nbetween",
        ]

        for content in test_contents:
            marker = create_paste_marker(content)

            # Both methods should extract the same content
            via_extract = extract_paste_content(marker)
            via_expand = expand_markers(marker)

            self.assertEqual(
                via_extract, via_expand, f"Extraction methods differ for content"
            )
            self.assertEqual(
                content, via_extract, f"Extracted content differs from original"
            )

    def test_newline_preservation(self):
        """
        **Feature: curses-tui-frontend, Property 3: Paste Marker Round-Trip**
        **Validates: Requirements 7.5-7.6, 16.3**

        Various newline patterns should be preserved exactly.
        """
        test_cases = [
            "a\nb\nc",  # Simple newlines
            "a\n\nb",  # Empty line in middle
            "\na\nb",  # Leading newline
            "a\nb\n",  # Trailing newline
            "\n\n\n",  # Only newlines
            "no newlines at all",  # No newlines
        ]

        for content in test_cases:
            marker = create_paste_marker(content)
            expanded = expand_markers(marker)

            self.assertEqual(
                content, expanded, f"Newline pattern not preserved for: {repr(content)}"
            )


if __name__ == "__main__":
    unittest.main()
