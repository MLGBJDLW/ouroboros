"""
Badge processing module for Ouroboros TUI.

This module provides functions for creating and processing badges
for file paths and pasted content. Badges are visual indicators
that display compactly in the UI while preserving full content
for submission to AI.

Marker formats:
- File path: «/full/path/file.ext» displays as [ file.ext ]
- Paste: ‹PASTE:N›content‹/PASTE› displays as [ Pasted N Lines ]


"""

import re
from typing import Tuple, Optional

from .filepath import get_filename


# =============================================================================
# MARKER CONSTANTS
# =============================================================================

# File path marker delimiters
FILE_MARKER_START = "«"
FILE_MARKER_END = "»"

# Paste marker delimiters
PASTE_MARKER_START = "‹PASTE:"
PASTE_MARKER_END = "‹/PASTE›"

# Newline encoding in paste markers
NEWLINE_ENCODED = "⏎"


# =============================================================================
# FILE PATH MARKERS
# =============================================================================


def create_file_marker(path: str) -> str:
    """
    Create a file path marker for internal storage.

    Format: «/full/path/file.ext»

    The marker preserves the full path for AI consumption while
    allowing the UI to display a compact badge.

    Args:
        path: Full file path to mark

    Returns:
        Marked path string




    """
    # Clean the path
    path = path.strip().strip('"').strip("'")
    return f"{FILE_MARKER_START}{path}{FILE_MARKER_END}"


def is_file_marker(text: str) -> bool:
    """
    Check if text is a file path marker.

    Args:
        text: Text to check

    Returns:
        True if text is a file marker
    """
    return text.startswith(FILE_MARKER_START) and text.endswith(FILE_MARKER_END)


def extract_file_path(marker: str) -> str:
    """
    Extract the file path from a marker.

    Args:
        marker: File marker string

    Returns:
        Original file path or the input if not a marker
    """
    if is_file_marker(marker):
        return marker[1:-1]  # Remove « and »
    return marker


# =============================================================================
# PASTE MARKERS
# =============================================================================


def create_paste_marker(content: str) -> str:
    """
    Create a paste marker for internal storage.

    Format: ‹PASTE:line_count›encoded_content‹/PASTE›

    Newlines are encoded as ⏎ so the marker stays on a single buffer line.
    This allows the UI to display a badge while preserving the full content
    for submission to AI.

    Args:
        content: Multi-line content to mark

    Returns:
        Marked content string




    """
    lines = content.split("\n")
    line_count = len(lines)

    # Encode newlines so marker stays on one line
    encoded = content.replace("\n", NEWLINE_ENCODED)

    return f"{PASTE_MARKER_START}{line_count}›{encoded}{PASTE_MARKER_END}"


def is_paste_marker(text: str) -> bool:
    """
    Check if text is a paste marker.

    Args:
        text: Text to check

    Returns:
        True if text is a paste marker
    """
    return text.startswith(PASTE_MARKER_START) and text.endswith(PASTE_MARKER_END)


def parse_paste_marker(text: str) -> Tuple[int, str]:
    """
    Parse a paste marker to extract line count and content.

    Args:
        text: Paste marker string

    Returns:
        Tuple of (line_count, decoded_content) or (0, text) if not a marker
    """
    match = re.match(r"‹PASTE:(\d+)›(.*)‹/PASTE›", text, re.DOTALL)
    if match:
        line_count = int(match.group(1))
        # Decode newlines (⏎ back to \n)
        content = match.group(2).replace(NEWLINE_ENCODED, "\n")
        return (line_count, content)
    return (0, text)


def extract_paste_content(marker: str) -> str:
    """
    Extract the original content from a paste marker.

    Args:
        marker: Paste marker string

    Returns:
        Original content with newlines restored
    """
    _, content = parse_paste_marker(marker)
    return content


# =============================================================================
# MARKER EXPANSION
# =============================================================================


def expand_markers(text: str) -> str:
    """
    Expand all markers in text to their original content.

    This handles:
    1. File path markers: «/path/to/file» -> /path/to/file
    2. Paste markers: ‹PASTE:N›encoded_content‹/PASTE› -> decoded content

    The result is clean text suitable for AI consumption.

    Args:
        text: Text potentially containing markers

    Returns:
        Text with all markers expanded to original content




    """
    result = text

    # Expand file path markers: «path» -> path
    result = re.sub(
        rf"{re.escape(FILE_MARKER_START)}([^{re.escape(FILE_MARKER_END)}]+){re.escape(FILE_MARKER_END)}",
        r"\1",
        result,
    )

    # Expand paste markers: ‹PASTE:N›content‹/PASTE› -> content (with decoded newlines)
    def decode_paste(match: re.Match) -> str:
        return match.group(1).replace(NEWLINE_ENCODED, "\n")

    result = re.sub(r"‹PASTE:\d+›(.*?)‹/PASTE›", decode_paste, result, flags=re.DOTALL)

    return result


# =============================================================================
# DISPLAY RENDERING
# =============================================================================


def render_for_display(text: str) -> str:
    """
    Convert markers to display badges for UI rendering.

    Converts:
    - «/path/to/file.ext» -> [ file.ext ]
    - ‹PASTE:N›content‹/PASTE› -> [ Pasted N Lines ]

    Args:
        text: Text potentially containing markers

    Returns:
        Text with markers converted to display badges


    """
    result = text

    # Convert file markers to badges
    def file_to_badge(match: re.Match) -> str:
        path = match.group(1)
        filename = get_filename(path)
        return f"[ {filename} ]"

    result = re.sub(
        rf"{re.escape(FILE_MARKER_START)}([^{re.escape(FILE_MARKER_END)}]+){re.escape(FILE_MARKER_END)}",
        file_to_badge,
        result,
    )

    # Convert paste markers to badges
    def paste_to_badge(match: re.Match) -> str:
        line_count = int(match.group(1))
        content = match.group(2)

        if line_count == 1:
            # For single line, show character count
            char_count = len(content.replace(NEWLINE_ENCODED, ""))
            if char_count > 50:
                return f"[ Pasted 1 Line ({char_count} chars) ]"
            return "[ Pasted 1 Line ]"

        return f"[ Pasted {line_count} Lines ]"

    result = re.sub(r"‹PASTE:(\d+)›(.*?)‹/PASTE›", paste_to_badge, result, flags=re.DOTALL)

    return result


def format_file_badge(path: str) -> str:
    """
    Format a file path as a display badge.

    Args:
        path: File path (may or may not be marked)

    Returns:
        Badge string like [ filename.ext ]
    """
    # Remove markers if present
    path = path.strip().strip(FILE_MARKER_START).strip(FILE_MARKER_END)
    filename = get_filename(path)
    return f"[ {filename} ]"


def format_paste_badge(line_count: int, char_count: int = 0) -> str:
    """
    Format a paste badge for display.

    Args:
        line_count: Number of lines in the paste
        char_count: Optional character count for single-line pastes

    Returns:
        Badge string like [ Pasted 5 Lines ] or [ Pasted 1 Line (150 chars) ]


    """
    if line_count == 1:
        if char_count > 50:
            return f"[ Pasted 1 Line ({char_count} chars) ]"
        return "[ Pasted 1 Line ]"
    return f"[ Pasted {line_count} Lines ]"


# =============================================================================
# BADGE DETECTION
# =============================================================================


def find_markers(text: str) -> list[Tuple[int, int, str]]:
    """
    Find all markers in text and return their positions.

    Args:
        text: Text to search

    Returns:
        List of (start, end, marker_type) tuples where marker_type is 'file' or 'paste'
    """
    markers = []

    # Find file markers
    for match in re.finditer(
        rf"{re.escape(FILE_MARKER_START)}[^{re.escape(FILE_MARKER_END)}]+{re.escape(FILE_MARKER_END)}",
        text,
    ):
        markers.append((match.start(), match.end(), "file"))

    # Find paste markers
    for match in re.finditer(r"‹PASTE:\d+›.*?‹/PASTE›", text, re.DOTALL):
        markers.append((match.start(), match.end(), "paste"))

    # Sort by position
    markers.sort(key=lambda x: x[0])

    return markers


def get_marker_at_position(text: str, pos: int) -> Optional[Tuple[int, int, str]]:
    """
    Get the marker at a specific position in text.

    Args:
        text: Text to search
        pos: Position to check

    Returns:
        Tuple of (start, end, marker_type) or None if no marker at position
    """
    for start, end, marker_type in find_markers(text):
        if start <= pos < end:
            return (start, end, marker_type)
    return None
