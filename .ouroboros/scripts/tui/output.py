"""
Output formatting module for Ouroboros TUI.

This module provides functions for formatting and outputting
the final content to stdout while keeping UI elements on stderr.

Requirements: 10.1-10.4, 16.1-16.7
"""

import sys
import re
from typing import Optional

# Use try/except for import compatibility
try:
    from utils.badge import expand_markers
    from input.commands import prepend_instruction
except ImportError:
    from ..utils.badge import expand_markers
    from ..input.commands import prepend_instruction


# ANSI escape sequence patterns
# Standard: \x1b[...m or \x1b[...H etc
# Private: \x1b[?...h or \x1b[?...l (cursor visibility, etc)
ANSI_PATTERN = re.compile(r'\x1b\[\??[0-9;]*[a-zA-Z]')


def strip_ansi(text: str) -> str:
    """
    Remove all ANSI escape sequences from text.
    
    Args:
        text: Text potentially containing ANSI codes
        
    Returns:
        Clean text without ANSI codes
        
    Requirements: 10.2, 16.6
    
    Property 5: Output Content Purity
    Validates: Requirements 10.1-10.4, 16.6
    """
    return ANSI_PATTERN.sub('', text)


def format_output(text: str) -> str:
    """
    Format text for output to AI.
    
    This function:
    1. Expands all markers (file paths and paste content)
    2. Prepends agent instruction for slash commands
    3. Strips any ANSI escape codes
    
    Args:
        text: Raw input text with potential markers
        
    Returns:
        Clean text ready for AI consumption
        
    Requirements: 10.1-10.4, 16.1-16.7
    
    Property 5: Output Content Purity
    Validates: Requirements 10.1-10.4, 16.6
    """
    # Expand markers (file paths and paste content)
    expanded = expand_markers(text)
    
    # Prepend agent instruction if slash command
    result = prepend_instruction(expanded)
    
    # Strip any ANSI codes that might have leaked through
    result = strip_ansi(result)
    
    return result


def write_output(text: str, stream=None) -> None:
    """
    Write formatted output to stdout.
    
    This ensures the output goes to stdout (for AI consumption)
    while all UI elements go to stderr.
    
    Args:
        text: Text to output
        stream: Output stream (default: sys.stdout)
        
    Requirements: 10.1-10.2
    """
    if stream is None:
        stream = sys.stdout
    
    # Format the output
    formatted = format_output(text)
    
    # Write to stdout
    stream.write(formatted)
    stream.write('\n')
    stream.flush()


def write_ui(text: str) -> None:
    """
    Write UI elements to stderr.
    
    All UI decorations, prompts, and visual elements should
    use this function to keep stdout clean for AI consumption.
    
    Args:
        text: UI text to write
        
    Requirements: 10.2
    """
    sys.stderr.write(text)
    sys.stderr.flush()


def write_ui_line(text: str) -> None:
    """
    Write a line of UI text to stderr with newline.
    
    Args:
        text: UI text to write
    """
    sys.stderr.write(text)
    sys.stderr.write('\n')
    sys.stderr.flush()


def has_ansi_codes(text: str) -> bool:
    """
    Check if text contains any ANSI escape codes.
    
    Args:
        text: Text to check
        
    Returns:
        True if text contains ANSI codes
        
    Property 5: Output Content Purity
    Validates: Requirements 10.1-10.4, 16.6
    """
    return bool(ANSI_PATTERN.search(text))


def validate_output_purity(text: str) -> bool:
    """
    Validate that output text is pure (no ANSI codes).
    
    This is used for testing Property 5.
    
    Args:
        text: Text to validate
        
    Returns:
        True if text is pure (no ANSI codes)
        
    Property 5: Output Content Purity
    Validates: Requirements 10.1-10.4, 16.6
    """
    return not has_ansi_codes(text)


class OutputFormatter:
    """
    Output formatter with configurable options.
    
    Provides a class-based interface for output formatting
    with options for customization.
    """
    
    def __init__(self, 
                 expand_file_markers: bool = True,
                 expand_paste_markers: bool = True,
                 prepend_agent_instruction: bool = True,
                 strip_ansi_codes: bool = True):
        """
        Initialize OutputFormatter.
        
        Args:
            expand_file_markers: Expand «path» markers
            expand_paste_markers: Expand ‹PASTE:N›...‹/PASTE› markers
            prepend_agent_instruction: Prepend agent instruction for slash commands
            strip_ansi_codes: Remove ANSI escape codes
        """
        self.expand_file_markers = expand_file_markers
        self.expand_paste_markers = expand_paste_markers
        self.prepend_agent_instruction = prepend_agent_instruction
        self.strip_ansi_codes = strip_ansi_codes
    
    def format(self, text: str) -> str:
        """
        Format text according to configured options.
        
        Args:
            text: Raw input text
            
        Returns:
            Formatted text
        """
        result = text
        
        # Expand markers
        if self.expand_file_markers or self.expand_paste_markers:
            result = expand_markers(result)
        
        # Prepend agent instruction
        if self.prepend_agent_instruction:
            result = prepend_instruction(result)
        
        # Strip ANSI codes
        if self.strip_ansi_codes:
            result = strip_ansi(result)
        
        return result
    
    def write(self, text: str, stream=None) -> None:
        """
        Format and write text to stream.
        
        Args:
            text: Text to format and write
            stream: Output stream (default: sys.stdout)
        """
        if stream is None:
            stream = sys.stdout
        
        formatted = self.format(text)
        stream.write(formatted)
        stream.write('\n')
        stream.flush()


# Default formatter instance
_default_formatter: Optional[OutputFormatter] = None


def get_formatter() -> OutputFormatter:
    """Get the default OutputFormatter instance."""
    global _default_formatter
    if _default_formatter is None:
        _default_formatter = OutputFormatter()
    return _default_formatter
