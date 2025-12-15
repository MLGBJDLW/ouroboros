"""
Text utilities module for Ouroboros TUI.

This module provides text processing utilities including:
- Character width calculation for CJK characters
- Display width calculation
- ANSI escape code stripping
- Text padding to width


"""

import re
import unicodedata
from typing import Optional


# ANSI escape sequence pattern
# Matches sequences like \x1b[0m, \x1b[31;1m, \x1b[?25h, etc.
ANSI_PATTERN = re.compile(r"\x1b\[[0-9;?]*[a-zA-Z]")


def char_width(char: str) -> int:
    """
    Calculate the display width of a single character.

    CJK (Chinese, Japanese, Korean) characters and other wide characters
    take 2 columns in terminal display, while ASCII and most other
    characters take 1 column.

    Args:
        char: A single character string

    Returns:
        Display width: 2 for wide characters, 1 for normal, 0 for control chars


    """
    if not char:
        return 0

    # Get the first character if string is longer
    c = char[0]

    # Control characters have zero width
    if ord(c) < 32 or c == "\x7f":
        return 0

    # Use unicodedata to get East Asian Width property
    ea_width = unicodedata.east_asian_width(c)

    # Wide (W) and Fullwidth (F) characters take 2 columns
    # Ambiguous (A) characters are treated as 1 in most terminals
    # Narrow (Na), Halfwidth (H), and Neutral (N) take 1 column
    if ea_width in ("W", "F"):
        return 2

    return 1


def visible_len(text: str) -> int:
    """
    Calculate the visible display width of a string.

    This accounts for:
    - CJK characters (2 columns each)
    - ANSI escape sequences (0 columns)
    - Control characters (0 columns)
    - Normal ASCII characters (1 column each)

    Args:
        text: The string to measure

    Returns:
        Total display width in terminal columns
    """
    if not text:
        return 0

    # First strip ANSI codes
    clean_text = strip_ansi(text)

    # Sum up character widths
    return sum(char_width(c) for c in clean_text)


def strip_ansi(text: str) -> str:
    """
    Remove all ANSI escape sequences from text.

    This removes color codes, cursor movement, and other terminal
    control sequences.

    Args:
        text: Text potentially containing ANSI escape sequences

    Returns:
        Text with all ANSI sequences removed
    """
    if not text:
        return ""

    return ANSI_PATTERN.sub("", text)


def pad_text(
    text: str,
    width: int,
    align: str = "left",
    fill_char: str = " ",
    truncate: bool = True,
) -> str:
    """
    Pad text to a specified display width.

    This correctly handles CJK characters which take 2 columns,
    ensuring the result has exactly the specified display width.

    Args:
        text: The text to pad
        width: Target display width in columns
        align: Alignment - 'left', 'right', or 'center'
        fill_char: Character to use for padding (must be width 1)
        truncate: If True, truncate text that exceeds width

    Returns:
        Padded text with exact display width
    """
    if not text:
        return fill_char * width

    # Strip ANSI for width calculation but preserve in output
    clean_text = strip_ansi(text)
    current_width = visible_len(clean_text)

    # Handle truncation if needed
    if truncate and current_width > width:
        return _truncate_to_width(text, width)

    # Calculate padding needed
    padding_needed = width - current_width
    if padding_needed <= 0:
        return text

    # Apply padding based on alignment
    if align == "left":
        return text + (fill_char * padding_needed)
    elif align == "right":
        return (fill_char * padding_needed) + text
    elif align == "center":
        left_pad = padding_needed // 2
        right_pad = padding_needed - left_pad
        return (fill_char * left_pad) + text + (fill_char * right_pad)
    else:
        # Default to left alignment
        return text + (fill_char * padding_needed)


def _truncate_to_width(text: str, width: int) -> str:
    """
    Truncate text to fit within a specified display width.

    Handles CJK characters correctly - if truncating would split
    a wide character, it's excluded entirely.

    Args:
        text: Text to truncate
        width: Maximum display width

    Returns:
        Truncated text that fits within width
    """
    if width <= 0:
        return ""

    result = []
    current_width = 0

    for char in text:
        char_w = char_width(char)

        # Check if adding this character would exceed width
        if current_width + char_w > width:
            break

        result.append(char)
        current_width += char_w

    return "".join(result)
