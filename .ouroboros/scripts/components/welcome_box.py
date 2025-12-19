"""
WelcomeBox component module.

This module provides the header component showing branding
and keyboard shortcuts in a two-column layout with color coding.


"""

from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from ..tui.screen import ScreenManager
    from ..tui.theme import ThemeManager
    from ..tui.window import Window


class WelcomeBox:
    """
    Welcome header component with branding and keyboard shortcuts.

    Displays:
    - ◎ OUROBOROS title (accent color)
    - Keyboard shortcuts in two-column layout with │ separator
    - Color-coded keys: Submit=green, Cancel=red, Others=yellow

    The component scales to fit terminal width (max 66 columns).
    """

    # Branding - The Eternal Serpent
    TITLE = "◎ OUROBOROS"
    SYMBOL = "◎"  # The ouroboros symbol - eternal cycle

    # Layout constants
    MAX_WIDTH = 66
    MIN_WIDTH = 30
    COMPACT_THRESHOLD = 50

    # Two-column shortcut layout (left_key, left_desc, right_key, right_desc)
    # Special keys: 'submit' for green, 'cancel' for red, others yellow
    SHORTCUT_ROWS = [
        ("Enter", "New line", "normal", "Ctrl+D", "Submit", "submit"),
        ("↑/↓", "Move cursor", "normal", "←/→", "Navigate", "normal"),
        ("Home/End", "Line start/end", "normal", "Ctrl+U", "Clear line", "normal"),
        ("Ctrl+C", "Cancel", "cancel", ">>>", "End & submit", "normal"),
    ]

    def __init__(
        self,
        screen: Optional["ScreenManager"] = None,
        theme: Optional["ThemeManager"] = None,
        custom_header: str = "",
    ):
        """
        Initialize WelcomeBox.

        Args:
            screen: Parent ScreenManager (optional)
            theme: ThemeManager for styling (optional)
            custom_header: Custom header text to display instead of shortcuts
        """
        self.screen = screen
        self.theme = theme
        self.custom_header = custom_header
        self._window: Optional["Window"] = None

    def _get_width(self, available_width: int) -> int:
        """Calculate actual width to use."""
        return min(self.MAX_WIDTH, max(self.MIN_WIDTH, available_width))

    def _is_compact(self, width: int) -> bool:
        """Check if compact mode should be used."""
        return width < self.COMPACT_THRESHOLD

    def get_height(self, width: int) -> int:
        """
        Calculate required height for the welcome box.

        Args:
            width: Available width

        Returns:
            Required height in rows
        """
        if self.custom_header:
            # Calculate wrapped lines for custom header + separator line
            inner_width = min(self.MAX_WIDTH, width) - 4  # Account for borders + padding
            wrapped_lines = self._wrap_text(self.custom_header, inner_width)
            return 3 + len(wrapped_lines)  # top border + content + separator + bottom border

        if self._is_compact(width):
            return 4  # Compact: title + 2 shortcut lines + border

        # Full: title + 4 shortcut rows + border
        return 2 + len(self.SHORTCUT_ROWS)

    def _wrap_text(self, text: str, max_width: int) -> list:
        """
        Wrap text to fit within max_width.

        Handles multi-line input (\\n) and long lines.

        Args:
            text: Text to wrap
            max_width: Maximum width per line

        Returns:
            List of wrapped lines
        """
        if max_width <= 0:
            return [text]

        result = []
        # First split by explicit newlines
        paragraphs = text.replace("\\n", "\n").split("\n")

        for para in paragraphs:
            if not para:
                result.append("")
                continue

            # Wrap each paragraph
            words = para.split(" ")
            current_line = ""

            for word in words:
                if not word:
                    continue

                test_line = f"{current_line} {word}".strip() if current_line else word

                if len(test_line) <= max_width:
                    current_line = test_line
                else:
                    if current_line:
                        result.append(current_line)
                    # If word itself is too long, split it
                    if len(word) > max_width:
                        while len(word) > max_width:
                            result.append(word[:max_width])
                            word = word[max_width:]
                        current_line = word
                    else:
                        current_line = word

            if current_line:
                result.append(current_line)

        return result if result else [""]

    def _get_key_attr(self, key_type: str) -> int:
        """Get attribute for key based on type."""
        if not self.theme:
            return 0

        if key_type == "submit":
            return self.theme.get_attr("success")
        elif key_type == "cancel":
            return self.theme.get_attr("error")
        else:
            return self.theme.get_attr("warning")

    def render(self, y: int = 0, width: int = None) -> int:
        """
        Render welcome box at specified row.

        Args:
            y: Starting row position
            width: Available width (uses screen width if not specified)

        Returns:
            Number of rows used
        """
        if self.screen is None:
            return 0

        # Get dimensions
        if width is None:
            cols, _ = self.screen.get_size()
            width = cols

        box_width = self._get_width(width)
        box_height = self.get_height(box_width)

        # Center horizontally
        x = (width - box_width) // 2

        # Create window
        self._window = self.screen.create_window(box_height, box_width, y, x)

        # Get attributes - Mystic Purple Theme
        border_attr = self.theme.get_attr("border") if self.theme else 0
        accent_attr = self.theme.get_attr("accent") if self.theme else 0
        symbol_attr = self.theme.get_attr("symbol") if self.theme else 0

        # Draw box with mystic purple border
        self._window.draw_box("rounded", border_attr)

        # Draw title centered in top border
        # Symbol ◎ in cyan, OUROBOROS in bold magenta
        title_x = (box_width - len(self.TITLE)) // 2
        self._window.write(0, title_x, self.SYMBOL, symbol_attr)
        self._window.write(0, title_x + 2, "OUROBOROS", accent_attr)

        # Draw content
        if self.custom_header:
            # Custom header text with word wrap
            inner_width = box_width - 4  # Borders + padding
            wrapped_lines = self._wrap_text(self.custom_header, inner_width)
            row = 1
            for line in wrapped_lines:
                # Center each line
                line_x = (box_width - len(line)) // 2
                self._window.write(row, max(1, line_x), line, 0)
                row += 1
            # Draw separator line after question
            separator = "─" * (inner_width - 2)
            sep_x = (box_width - len(separator)) // 2
            dim_attr = self.theme.get_attr("dim") if self.theme else 0
            self._window.write(row, max(1, sep_x), separator, dim_attr)
        elif self._is_compact(box_width):
            # Compact mode: simple layout
            self._render_compact_shortcuts(box_width)
        else:
            # Full two-column layout
            self._render_full_shortcuts(box_width)

        self._window.refresh()
        return box_height

    def _render_compact_shortcuts(self, width: int) -> None:
        """Render compact shortcut layout."""
        if not self._window:
            return

        # Simple centered lines
        lines = ["Enter: newline  Ctrl+D: submit", "Ctrl+C: cancel  >>>: end & submit"]

        for i, line in enumerate(lines):
            line_x = (width - len(line)) // 2
            self._window.write(1 + i, max(1, line_x), line, 0)

    def _render_full_shortcuts(self, width: int) -> None:
        """Render full two-column shortcut layout with colors."""
        if not self._window:
            return

        # Column layout: "  Key       Desc       │ Key       Desc"
        # Left column: ~28 chars, separator │, right column: rest
        inner_width = width - 2  # Inside borders
        left_col_width = 28

        for row_idx, (l_key, l_desc, l_type, r_key, r_desc, r_type) in enumerate(
            self.SHORTCUT_ROWS
        ):
            row = 1 + row_idx

            # Get attributes for keys
            l_key_attr = self._get_key_attr(l_type)
            r_key_attr = self._get_key_attr(r_type)

            # Build left column: "  Key       Desc       "
            # Key is colored, desc is normal
            left_key_padded = f"{l_key:<11}"
            left_desc_padded = f"{l_desc:<14}"

            # Build right column: " Key       Desc"
            right_key_padded = f"{r_key:<11}"
            right_desc_padded = r_desc

            # Write left column
            x = 1
            self._window.write(row, x, "  ", 0)
            x += 2
            self._window.write(row, x, left_key_padded, l_key_attr)
            x += len(left_key_padded)
            self._window.write(row, x, left_desc_padded, 0)
            x += len(left_desc_padded)

            # Write separator
            border_attr = self.theme.get_attr("border") if self.theme else 0
            self._window.write(row, x, "│", border_attr)
            x += 1

            # Write right column
            self._window.write(row, x, " ", 0)
            x += 1
            self._window.write(row, x, right_key_padded, r_key_attr)
            x += len(right_key_padded)
            self._window.write(row, x, right_desc_padded, 0)

    def render_compact(self, y: int = 0, width: int = None) -> int:
        """
        Render compact version for narrow terminals.

        Args:
            y: Starting row position
            width: Available width

        Returns:
            Number of rows used
        """
        if self.screen is None:
            return 0

        # Get dimensions
        if width is None:
            cols, _ = self.screen.get_size()
            width = cols

        # Force compact mode
        box_width = min(self.COMPACT_THRESHOLD - 1, width)

        # Single line: title only
        if box_width < self.MIN_WIDTH:
            x = (width - len(self.TITLE)) // 2
            self._window = self.screen.create_window(1, len(self.TITLE) + 2, y, max(0, x))

            accent_attr = self.theme.get_attr("accent") if self.theme else 0
            self._window.write(0, 1, self.TITLE, accent_attr)
            self._window.refresh()
            return 1

        return self.render(y, box_width)

    def clear(self) -> None:
        """Clear the welcome box."""
        if self._window:
            self._window.clear()
            self._window.refresh()
