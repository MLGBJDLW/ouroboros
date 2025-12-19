"""
Output formatting module for Ouroboros TUI.

This module provides functions for formatting and outputting
the final content to stdout while keeping UI elements on stderr.


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
ANSI_PATTERN = re.compile(r"\x1b\[\??[0-9;]*[a-zA-Z]")


def strip_ansi(text: str) -> str:
    """
    Remove all ANSI escape sequences from text.

    Args:
        text: Text potentially containing ANSI codes

    Returns:
        Clean text without ANSI codes



    Property 5: Output Content Purity

    """
    return ANSI_PATTERN.sub("", text)


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



    Property 5: Output Content Purity

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


    """
    if stream is None:
        stream = sys.stdout

    # Format the output
    formatted = format_output(text)

    # Write to stdout
    stream.write(formatted)
    stream.write("\n")
    stream.flush()


def write_ui(text: str) -> None:
    """
    Write UI elements to stderr.

    All UI decorations, prompts, and visual elements should
    use this function to keep stdout clean for AI consumption.

    Args:
        text: UI text to write


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
    sys.stderr.write("\n")
    sys.stderr.flush()


def has_ansi_codes(text: str) -> bool:
    """
    Check if text contains any ANSI escape codes.

    Args:
        text: Text to check

    Returns:
        True if text contains ANSI codes

    Property 5: Output Content Purity

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

    """
    return not has_ansi_codes(text)


class OutputFormatter:
    """
    Output formatter with configurable options.

    Provides a class-based interface for output formatting
    with options for customization.
    """

    def __init__(
        self,
        expand_file_markers: bool = True,
        expand_paste_markers: bool = True,
        prepend_agent_instruction: bool = True,
        strip_ansi_codes: bool = True,
    ):
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
        stream.write("\n")
        stream.flush()


# Default formatter instance
_default_formatter: Optional[OutputFormatter] = None


def get_formatter() -> OutputFormatter:
    """Get the default OutputFormatter instance."""
    global _default_formatter
    if _default_formatter is None:
        _default_formatter = OutputFormatter()
    return _default_formatter


# =============================================================================
# OUTPUT BOX - Visual feedback for submission
# =============================================================================

# Box drawing characters
BOX_CHARS = {
    "tl": "╭",
    "tr": "╮",
    "bl": "╰",
    "br": "╯",
    "h": "─",
    "v": "│",
    "lj": "├",
    "rj": "┤",
}

# Theme colors (Mystic Purple)
THEME = {
    "border": "\x1b[95m",  # Bright Magenta
    "prompt": "\x1b[96m",  # Bright Cyan
    "success": "\x1b[92m",  # Bright Green
    "dim": "\x1b[2m",  # Dim
    "reset": "\x1b[0m",  # Reset
}


def _visible_len(text: str) -> int:
    """Get visible length of text (ignoring ANSI codes)."""
    clean = strip_ansi(text)
    # Handle CJK characters (2-column width)
    import unicodedata

    width = 0
    for char in clean:
        ea = unicodedata.east_asian_width(char)
        if ea in ("W", "F"):
            width += 2
        elif ord(char) >= 0x1F300:  # Most emoji
            width += 2
        else:
            width += 1
    return width


def _pad_text(text: str, width: int, fill: str = " ") -> str:
    """Pad text to width accounting for ANSI codes."""
    visible = _visible_len(text)
    if visible >= width:
        return text
    return text + fill * (width - visible)


def _get_terminal_size() -> tuple:
    """Get terminal (columns, rows)."""
    import shutil

    try:
        size = shutil.get_terminal_size()
        return (size.columns, size.lines)
    except (ValueError, OSError):
        return (80, 24)


class OutputBox:
    """
    Box for displaying output/task results - auto-sizes to terminal and content.

    Used to show visual feedback when user submits input, confirming
    that the content has been transmitted to Copilot.

    Based on original ouroboros_ui.py OutputBox implementation.
    """

    @staticmethod
    def render(marker: str, content: str, full_width: bool = True) -> None:
        """Render output box to stderr (for user feedback).

        Args:
            marker: Label for the output (e.g., "TASK", "TRANSMITTED")
            content: Content to display
            full_width: If True, stretch to terminal width
        """
        cols, rows = _get_terminal_size()
        c = THEME
        box = BOX_CHARS

        # Calculate width
        if full_width:
            width = cols - 2  # Full width minus margins
        else:
            width = min(cols - 4, 80)

        content_width = width - 2  # Inside borders
        sep = box["h"] * content_width

        # Split content into lines
        lines = content.split("\n")

        # Header
        write_ui_line(f"{c['border']}{box['tl']}{sep}{box['tr']}{c['reset']}")
        header = f" {c['prompt']}[>] {marker.upper()}{c['reset']}"
        header_padded = _pad_text(header, content_width)
        write_ui_line(
            f"{c['border']}{box['v']}{c['reset']}{header_padded}{c['border']}{box['v']}{c['reset']}"
        )
        write_ui_line(f"{c['border']}{box['lj']}{sep}{box['rj']}{c['reset']}")

        # Content with side borders (handle CJK width)
        for line in lines:
            line_width = _visible_len(line)
            if line_width > content_width:
                # Truncate accounting for display width
                truncated = ""
                current_width = 0
                for ch in line:
                    import unicodedata

                    ea = unicodedata.east_asian_width(ch)
                    ch_width = 2 if ea in ("W", "F") or ord(ch) >= 0x1F300 else 1
                    if current_width + ch_width > content_width - 3:
                        break
                    truncated += ch
                    current_width += ch_width
                line = truncated + f"{c['dim']}...{c['reset']}"
            padded_line = _pad_text(line, content_width)
            write_ui_line(
                f"{c['border']}{box['v']}{c['reset']}{padded_line}{c['border']}{box['v']}{c['reset']}"
            )

        # Footer
        write_ui_line(f"{c['border']}{box['bl']}{sep}{box['br']}{c['reset']}")

    @staticmethod
    def render_success(message: str = "Transmitted to Copilot") -> None:
        """Render a success feedback box.

        Args:
            message: Success message to display
        """
        c = THEME
        OutputBox.render("SUCCESS", f"{c['success']}✓ {message}{c['reset']}", full_width=False)

    @staticmethod
    def render_transmitted(line_count: int = 0, char_count: int = 0) -> None:
        """Render transmission confirmation box.

        Args:
            line_count: Number of lines transmitted
            char_count: Number of characters transmitted
        """
        c = THEME
        if line_count > 0:
            content = f"{c['success']}✓ Transmitted {line_count} lines ({char_count} chars) to Copilot{c['reset']}"
        else:
            content = f"{c['success']}✓ Transmitted to Copilot{c['reset']}"
        OutputBox.render("TRANSMITTED", content, full_width=False)
