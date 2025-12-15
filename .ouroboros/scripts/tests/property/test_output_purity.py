"""
Property Test: Output Content Purity

**Feature: curses-tui-frontend, Property 5: Output Content Purity**
**Validates: Requirements 10.1-10.4, 16.6**

Property 5: Output Content Purity
*For any* submitted input text, the final stdout output SHALL NOT contain
any ANSI escape sequences (matching pattern `\\x1b\\[[0-9;]*[a-zA-Z]`).
"""

import sys
import os
import unittest
import random
from typing import List

# Add scripts directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from tests.pbt_framework import property_test, Generator, StringGenerator, MultilineGenerator


class TextWithANSIGenerator(Generator[str]):
    """Generate text that may contain ANSI escape sequences."""
    
    # Common ANSI escape sequences
    ANSI_CODES = [
        '\x1b[0m',      # Reset
        '\x1b[1m',      # Bold
        '\x1b[31m',     # Red
        '\x1b[32m',     # Green
        '\x1b[33m',     # Yellow
        '\x1b[34m',     # Blue
        '\x1b[35m',     # Magenta
        '\x1b[36m',     # Cyan
        '\x1b[91m',     # Bright red
        '\x1b[92m',     # Bright green
        '\x1b[93m',     # Bright yellow
        '\x1b[94m',     # Bright blue
        '\x1b[95m',     # Bright magenta
        '\x1b[96m',     # Bright cyan
        '\x1b[1;31m',   # Bold red
        '\x1b[1;32m',   # Bold green
        '\x1b[38;5;200m',  # 256-color
        '\x1b[48;5;100m',  # 256-color background
        '\x1b[?25l',    # Hide cursor
        '\x1b[?25h',    # Show cursor
        '\x1b[H',       # Home
        '\x1b[2J',      # Clear screen
        '\x1b[K',       # Clear line
    ]
    
    def __init__(self, min_len: int = 1, max_len: int = 100, ansi_probability: float = 0.3):
        self.min_len = min_len
        self.max_len = max_len
        self.ansi_probability = ansi_probability
    
    def generate(self, rng: random.Random) -> str:
        length = rng.randint(self.min_len, self.max_len)
        result = []
        
        for _ in range(length):
            if rng.random() < self.ansi_probability:
                # Insert ANSI code
                result.append(rng.choice(self.ANSI_CODES))
            else:
                # Insert regular character
                result.append(rng.choice('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?\n'))
        
        return ''.join(result)
    
    def shrink(self, value: str) -> List[str]:
        if not value:
            return []
        # Try to isolate ANSI codes
        results = []
        if len(value) > 1:
            results.append(value[:len(value)//2])
        # Try to find just the ANSI part
        for code in self.ANSI_CODES:
            if code in value:
                results.append(code)
                break
        return results


class TextWithMarkersGenerator(Generator[str]):
    """Generate text that may contain file markers and paste markers."""
    
    def __init__(self, min_len: int = 1, max_len: int = 100):
        self.min_len = min_len
        self.max_len = max_len
    
    def generate(self, rng: random.Random) -> str:
        parts = []
        num_parts = rng.randint(1, 5)
        
        for _ in range(num_parts):
            part_type = rng.choice(['text', 'file_marker', 'paste_marker', 'ansi'])
            
            if part_type == 'text':
                length = rng.randint(1, 30)
                text = ''.join(rng.choices('abcdefghijklmnopqrstuvwxyz0123456789 .,', k=length))
                parts.append(text)
            
            elif part_type == 'file_marker':
                # Generate a file marker
                path = self._generate_path(rng)
                parts.append(f'«{path}»')
            
            elif part_type == 'paste_marker':
                # Generate a paste marker
                lines = rng.randint(1, 10)
                content = '⏎'.join(['line' + str(i) for i in range(lines)])
                parts.append(f'‹PASTE:{lines}›{content}‹/PASTE›')
            
            elif part_type == 'ansi':
                # Insert ANSI code
                codes = ['\x1b[0m', '\x1b[1m', '\x1b[31m', '\x1b[32m', '\x1b[95m']
                parts.append(rng.choice(codes))
        
        return ''.join(parts)
    
    def _generate_path(self, rng: random.Random) -> str:
        if rng.random() < 0.5:
            # Windows path
            drive = rng.choice('CDEF')
            parts = [''.join(rng.choices('abcdefghijklmnopqrstuvwxyz', k=rng.randint(3, 8))) for _ in range(rng.randint(1, 3))]
            return f"{drive}:\\" + "\\".join(parts) + ".py"
        else:
            # Unix path
            parts = [''.join(rng.choices('abcdefghijklmnopqrstuvwxyz', k=rng.randint(3, 8))) for _ in range(rng.randint(1, 3))]
            return "/" + "/".join(parts) + ".py"
    
    def shrink(self, value: str) -> List[str]:
        if not value:
            return []
        return [value[:len(value)//2]]


class SlashCommandGenerator(Generator[str]):
    """Generate text starting with slash commands."""
    
    COMMANDS = [
        '/ouroboros',
        '/ouroboros-init',
        '/ouroboros-spec',
        '/ouroboros-implement',
        '/ouroboros-archive',
    ]
    
    def generate(self, rng: random.Random) -> str:
        cmd = rng.choice(self.COMMANDS)
        # Add some text after the command
        text_len = rng.randint(0, 50)
        text = ''.join(rng.choices('abcdefghijklmnopqrstuvwxyz0123456789 ', k=text_len))
        
        # Maybe add some ANSI codes
        if rng.random() < 0.3:
            text = '\x1b[32m' + text + '\x1b[0m'
        
        return cmd + ' ' + text
    
    def shrink(self, value: str) -> List[str]:
        for cmd in self.COMMANDS:
            if value.startswith(cmd):
                return [cmd]
        return []


# Import directly from the module to avoid circular import issues
# The tui package __init__ imports app which has complex dependencies
import re

# ANSI escape sequence patterns
# Standard: \x1b[...m or \x1b[...H etc
# Private: \x1b[?...h or \x1b[?...l (cursor visibility, etc)
ANSI_PATTERN = re.compile(r'\x1b\[\??[0-9;]*[a-zA-Z]')

def strip_ansi(text: str) -> str:
    """Remove all ANSI escape sequences from text."""
    return ANSI_PATTERN.sub('', text)

def has_ansi_codes(text: str) -> bool:
    """Check if text contains any ANSI escape codes."""
    return bool(ANSI_PATTERN.search(text))

def validate_output_purity(text: str) -> bool:
    """Validate that output text is pure (no ANSI codes)."""
    return not has_ansi_codes(text)

from utils.badge import expand_markers
from input.commands import prepend_instruction

def format_output(text: str) -> str:
    """
    Format text for output to AI.
    
    This function:
    1. Expands all markers (file paths and paste content)
    2. Prepends agent instruction for slash commands
    3. Strips any ANSI escape codes
    """
    # Expand markers (file paths and paste content)
    expanded = expand_markers(text)
    
    # Prepend agent instruction if slash command
    result = prepend_instruction(expanded)
    
    # Strip any ANSI codes that might have leaked through
    result = strip_ansi(result)
    
    return result


class TestOutputContentPurity(unittest.TestCase):
    """
    Property 5: Output Content Purity
    
    **Feature: curses-tui-frontend, Property 5: Output Content Purity**
    **Validates: Requirements 10.1-10.4, 16.6**
    """
    
    @property_test(TextWithANSIGenerator(ansi_probability=0.5), iterations=100)
    def test_format_output_strips_ansi(self, text: str):
        """
        **Feature: curses-tui-frontend, Property 5: Output Content Purity**
        **Validates: Requirements 10.1-10.4, 16.6**
        
        For any text containing ANSI codes, format_output should produce
        output with no ANSI escape sequences.
        """
        result = format_output(text)
        
        self.assertFalse(
            has_ansi_codes(result),
            f"Output contains ANSI codes: {repr(result)}"
        )
    
    @property_test(TextWithMarkersGenerator(), iterations=100)
    def test_format_output_with_markers_is_pure(self, text: str):
        """
        **Feature: curses-tui-frontend, Property 5: Output Content Purity**
        **Validates: Requirements 10.1-10.4, 16.6**
        
        For any text with markers and potential ANSI codes,
        format_output should produce pure output.
        """
        result = format_output(text)
        
        self.assertTrue(
            validate_output_purity(result),
            f"Output is not pure: {repr(result)}"
        )
    
    @property_test(SlashCommandGenerator(), iterations=100)
    def test_slash_command_output_is_pure(self, text: str):
        """
        **Feature: curses-tui-frontend, Property 5: Output Content Purity**
        **Validates: Requirements 10.1-10.4, 16.6**
        
        For any slash command input, the formatted output
        (including prepended instruction) should be pure.
        """
        result = format_output(text)
        
        self.assertFalse(
            has_ansi_codes(result),
            f"Slash command output contains ANSI codes: {repr(result)}"
        )
    
    @property_test(StringGenerator(min_len=0, max_len=100), iterations=100)
    def test_plain_text_remains_unchanged(self, text: str):
        """
        **Feature: curses-tui-frontend, Property 5: Output Content Purity**
        **Validates: Requirements 10.1, 16.1**
        
        For plain text without markers or ANSI codes,
        format_output should preserve the content.
        """
        # Skip if text happens to start with slash command
        if text.strip().startswith('/ouroboros'):
            return
        
        result = format_output(text)
        
        # Plain text should be preserved
        self.assertEqual(
            text,
            result,
            f"Plain text was modified: '{text}' -> '{result}'"
        )
    
    @property_test(MultilineGenerator(min_lines=1, max_lines=10), iterations=100)
    def test_multiline_output_is_pure(self, text: str):
        """
        **Feature: curses-tui-frontend, Property 5: Output Content Purity**
        **Validates: Requirements 10.1-10.4, 16.5**
        
        For any multiline text, format_output should produce
        pure output with newlines preserved.
        """
        result = format_output(text)
        
        # Should be pure
        self.assertTrue(
            validate_output_purity(result),
            f"Multiline output is not pure"
        )
        
        # Newlines should be preserved
        original_newlines = text.count('\n')
        result_newlines = result.count('\n')
        self.assertEqual(
            original_newlines,
            result_newlines,
            f"Newline count changed: {original_newlines} -> {result_newlines}"
        )
    
    def test_strip_ansi_removes_all_codes(self):
        """
        **Feature: curses-tui-frontend, Property 5: Output Content Purity**
        **Validates: Requirements 10.2, 16.6**
        
        strip_ansi should remove all known ANSI escape sequences.
        """
        test_cases = [
            ('\x1b[0mhello\x1b[0m', 'hello'),
            ('\x1b[31mred\x1b[0m', 'red'),
            ('\x1b[1;32mbold green\x1b[0m', 'bold green'),
            ('\x1b[38;5;200mcolor\x1b[0m', 'color'),
            ('no codes here', 'no codes here'),
            ('\x1b[H\x1b[2Jcleared', 'cleared'),
            ('\x1b[?25lhidden\x1b[?25h', 'hidden'),
        ]
        
        for input_text, expected in test_cases:
            result = strip_ansi(input_text)
            self.assertEqual(
                expected,
                result,
                f"strip_ansi failed for {repr(input_text)}"
            )
    
    def test_has_ansi_codes_detection(self):
        """
        **Feature: curses-tui-frontend, Property 5: Output Content Purity**
        **Validates: Requirements 10.2, 16.6**
        
        has_ansi_codes should correctly detect ANSI sequences.
        """
        # Should detect ANSI codes
        self.assertTrue(has_ansi_codes('\x1b[0m'))
        self.assertTrue(has_ansi_codes('\x1b[31mred'))
        self.assertTrue(has_ansi_codes('text\x1b[1mbold'))
        self.assertTrue(has_ansi_codes('\x1b[38;5;200m'))
        
        # Should not detect in clean text
        self.assertFalse(has_ansi_codes('hello world'))
        self.assertFalse(has_ansi_codes(''))
        self.assertFalse(has_ansi_codes('line1\nline2'))
        self.assertFalse(has_ansi_codes('special chars: !@#$%^&*()'))


if __name__ == '__main__':
    unittest.main()
