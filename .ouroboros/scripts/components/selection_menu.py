"""
SelectionMenu component module.

This module provides an interactive selection menu with
arrow key navigation, page scrolling, and number key selection.


"""

import re
from typing import Optional, List, Tuple, TYPE_CHECKING

from utils.text import char_width, visible_len, pad_text

if TYPE_CHECKING:
    from ..tui.screen import ScreenManager
    from ..tui.theme import ThemeManager
    from ..tui.window import Window


class SelectionMenu:
    """
    Arrow-key navigable selection menu.
    
    Features:
    - Arrow key navigation (Up/Down)
    - Page Up/Down, Home/End support
    - Number key quick selection (1-9)
    - Scroll indicators (↑ N more above / ↓ N more below)
    - Custom input option ([Custom input...])
    - Yes/No detection from [y/n] pattern in prompt
    - Numbered options parsing from header text
    

    """
    
    # Layout constants
    MIN_WIDTH = 30
    MAX_VISIBLE = 10  # Maximum visible options before scrolling
    CUSTOM_INPUT_TEXT = '[Custom input...]'
    PREFERRED_WIDTH_RATIO = 0.7  # Target width relative to terminal (when possible)
    
    def __init__(self, screen: Optional['ScreenManager'] = None,
                 theme: Optional['ThemeManager'] = None,
                 options: List[str] = None,
                 title: str = '',
                 allow_custom: bool = True):
        """
        Initialize SelectionMenu.
        
        Args:
            screen: Parent ScreenManager
            theme: ThemeManager for styling
            options: List of option strings
            title: Menu title/prompt
            allow_custom: Whether to include custom input option
        """
        self.screen = screen
        self.theme = theme
        self.title = title
        self.allow_custom = allow_custom
        
        # Options list
        self._options: List[str] = []
        self._has_custom = False
        
        if options:
            self.set_options(options)
        
        # Selection state
        self._selected_index = 0
        self._scroll_offset = 0
        
        # Window
        self._window: Optional['Window'] = None
        self._width = 60
        self._visible_count = self.MAX_VISIBLE
    
    @property
    def options(self) -> List[str]:
        """Get list of options."""
        return self._options
    
    @property
    def option_count(self) -> int:
        """Get total number of options."""
        return len(self._options)
    
    @property
    def selected_index(self) -> int:
        """Get currently selected index."""
        return self._selected_index
    
    def set_options(self, options: List[str]) -> None:
        """
        Set the options list.
        
        Args:
            options: List of option strings
        """
        self._options = list(options)
        
        # Add custom input option if allowed
        if self.allow_custom and self.CUSTOM_INPUT_TEXT not in self._options:
            self._options.append(self.CUSTOM_INPUT_TEXT)
            self._has_custom = True
        
        # Reset selection
        self._selected_index = 0
        self._scroll_offset = 0
    
    @staticmethod
    def detect_yes_no(prompt: str) -> bool:
        """
        Detect if prompt is a yes/no question.
        
        Args:
            prompt: Prompt text to check
            
        Returns:
            True if prompt contains [y/n] pattern
        """
        return bool(re.search(r'\[y/n\]', prompt, re.IGNORECASE))
    
    @staticmethod
    def parse_numbered_options(text: str) -> List[str]:
        """
        Parse numbered options from text.
        
        Looks for patterns like:
        1. Option one
        2. Option two
        
        Args:
            text: Text containing numbered options
            
        Returns:
            List of parsed options
        """
        options = []
        pattern = r'^\s*(\d+)[.)\]]\s*(.+)$'
        
        for line in text.split('\n'):
            match = re.match(pattern, line.strip())
            if match:
                options.append(match.group(2).strip())
        
        return options
    
    @classmethod
    def create_yes_no_menu(cls, screen=None, theme=None, 
                           prompt: str = '') -> 'SelectionMenu':
        """
        Create a Yes/No selection menu.
        
        Args:
            screen: Parent ScreenManager
            theme: ThemeManager
            prompt: Prompt text
            
        Returns:
            SelectionMenu configured for Yes/No
        """
        menu = cls(screen=screen, theme=theme, 
                   options=['Yes', 'No'], 
                   title=prompt, 
                   allow_custom=False)
        return menu

    def move_up(self) -> bool:
        """
        Move selection up one item.
        
        Returns:
            True if selection changed
        """
        if self._selected_index > 0:
            self._selected_index -= 1
            self._ensure_visible()
            return True
        return False
    
    def move_down(self) -> bool:
        """
        Move selection down one item.
        
        Returns:
            True if selection changed
        """
        if self._selected_index < len(self._options) - 1:
            self._selected_index += 1
            self._ensure_visible()
            return True
        return False
    
    def page_up(self) -> bool:
        """
        Move selection up by one page.
        
        Returns:
            True if selection changed
        """
        if self._selected_index > 0:
            self._selected_index = max(0, self._selected_index - self._visible_count)
            self._ensure_visible()
            return True
        return False
    
    def page_down(self) -> bool:
        """
        Move selection down by one page.
        
        Returns:
            True if selection changed
        """
        max_index = len(self._options) - 1
        if self._selected_index < max_index:
            self._selected_index = min(max_index, self._selected_index + self._visible_count)
            self._ensure_visible()
            return True
        return False
    
    def home(self) -> bool:
        """
        Move selection to first item.
        
        Returns:
            True if selection changed
        """
        if self._selected_index > 0:
            self._selected_index = 0
            self._scroll_offset = 0
            return True
        return False
    
    def end(self) -> bool:
        """
        Move selection to last item.
        
        Returns:
            True if selection changed
        """
        max_index = len(self._options) - 1
        if self._selected_index < max_index:
            self._selected_index = max_index
            self._ensure_visible()
            return True
        return False
    
    def select_by_number(self, num: int) -> bool:
        """
        Quick-select option by number (1-9).
        
        Args:
            num: Number key pressed (1-9)
            
        Returns:
            True if valid selection
        """
        index = num - 1  # Convert to 0-based
        if 0 <= index < len(self._options):
            self._selected_index = index
            self._ensure_visible()
            return True
        return False
    
    def _ensure_visible(self) -> None:
        """Ensure selected item is visible in viewport."""
        if self._selected_index < self._scroll_offset:
            self._scroll_offset = self._selected_index
        elif self._selected_index >= self._scroll_offset + self._visible_count:
            self._scroll_offset = self._selected_index - self._visible_count + 1
    
    def get_selected(self) -> Tuple[int, str, bool]:
        """
        Get the selected option.
        
        Returns:
            Tuple of (index, value, is_custom)
        """
        if not self._options:
            return (-1, '', False)
        
        value = self._options[self._selected_index]
        is_custom = self._has_custom and value == self.CUSTOM_INPUT_TEXT
        
        return (self._selected_index, value, is_custom)
    
    def get_yes_no_result(self) -> str:
        """
        Get result for Yes/No menu.
        
        Returns:
            'y' for Yes, 'n' for No
        """
        _, value, _ = self.get_selected()
        if value.lower().startswith('y'):
            return 'y'
        return 'n'
    
    def _get_scroll_indicators(self) -> Tuple[str, str]:
        """
        Get scroll indicator strings.
        
        Returns:
            Tuple of (above_indicator, below_indicator)
        """
        above = ''
        below = ''
        
        if self._scroll_offset > 0:
            count = self._scroll_offset
            above = f'↑ {count} more above'
        
        remaining = len(self._options) - (self._scroll_offset + self._visible_count)
        if remaining > 0:
            below = f'↓ {remaining} more below'
        
        return (above, below)

    def _calculate_width(self, max_width: int) -> int:
        """Calculate a reasonable width for the menu in terminal columns."""
        if max_width <= 0:
            return self.MIN_WIDTH

        max_option_w = max((visible_len(opt) for opt in self._options), default=10)
        title_w = visible_len(self.title) if self.title else 0

        # Space for borders + indicator/prefix + inner padding
        natural = max(max_option_w + 6, title_w + 4, self.MIN_WIDTH)

        preferred = max(self.MIN_WIDTH, int(max_width * self.PREFERRED_WIDTH_RATIO))
        return min(max_width, max(natural, preferred))

    @staticmethod
    def _normalize_text(text: str) -> str:
        """Normalize menu text for single-line wrapping logic."""
        if not text:
            return ""
        return text.replace("\r\n", "\n").replace("\r", "\n").replace("\n", " ")

    @staticmethod
    def _wrap_text(text: str, width: int) -> List[str]:
        """
        Wrap text to a target display width (CJK-aware).

        This wraps by display columns (not codepoints) so wide characters
        do not break alignment in ANSI fallback mode.
        """
        text = SelectionMenu._normalize_text(text)
        if width <= 0:
            return [""]
        if not text:
            return [""]

        lines: List[str] = []
        current: List[str] = []
        current_w = 0

        for ch in text:
            w = char_width(ch)
            if w <= 0:
                continue

            if current_w + w > width:
                if current:
                    lines.append("".join(current).rstrip())
                current = [ch]
                current_w = w
                continue

            current.append(ch)
            current_w += w

        if current or not lines:
            lines.append("".join(current).rstrip())

        return lines

    def _compute_visible_layout(
        self,
        wrapped_options: List[List[str]],
        start_index: int,
        max_option_lines: int,
    ) -> List[Tuple[int, List[str], bool]]:
        """Compute which options (and which wrapped lines) are visible."""
        if not self._options:
            return []

        max_option_lines = max(1, max_option_lines)
        layout: List[Tuple[int, List[str], bool]] = []
        remaining = max_option_lines

        for idx in range(start_index, len(self._options)):
            if len(layout) >= self.MAX_VISIBLE:
                break

            lines = wrapped_options[idx] if idx < len(wrapped_options) else [""]
            lines = lines if lines else [""]

            if len(layout) == 0 and len(lines) > remaining:
                # Ensure at least one option is visible, even if truncated.
                layout.append((idx, lines[:remaining], True))
                remaining = 0
                break

            if len(lines) > remaining:
                break

            layout.append((idx, lines, False))
            remaining -= len(lines)
            if remaining <= 0:
                break

        if not layout:
            # Always show something if options exist.
            idx = min(max(0, start_index), len(self._options) - 1)
            layout.append((idx, wrapped_options[idx][:1] if wrapped_options else [""], True))

        return layout

    def render(self, y: int = 0, width: int = None) -> int:
        """
        Render the selection menu.
        
        Args:
            y: Starting row position
            width: Available width (auto-calculated if not specified)
            
        Returns:
            Total height used
        """
        if self.screen is None or not self._options:
            return 0
        
        # Calculate dimensions
        if width is None:
            cols, _ = self.screen.get_size()
            width = cols

        cols, rows = self.screen.get_size()
        width = min(width, cols)

        # Leave a small margin so the border doesn't touch the terminal edge.
        max_menu_width = max(10, width - 4)
        max_menu_width = min(max_menu_width, width)
        self._width = self._calculate_width(max_menu_width)
        inner_width = max(1, self._width - 2)  # inside borders

        # Option layout: "▸ " + "1. " then text
        prefix_width = visible_len("▸ 1. ")
        text_width = max(1, inner_width - prefix_width)
        wrapped_options = [self._wrap_text(opt, text_width) for opt in self._options]

        # Compute max available height on screen for this menu.
        max_total_height = max(0, rows - y)

        def build_layout_for_scroll(scroll_offset: int) -> Tuple[List[Tuple[int, List[str], bool]], bool]:
            has_title = bool(self.title)
            reserved = 2  # borders
            reserved += 1 if has_title else 0
            reserved += 1 if scroll_offset > 0 else 0  # above indicator

            # First pass: decide visible options without reserving below indicator.
            option_lines_budget = max_total_height - reserved
            layout = self._compute_visible_layout(wrapped_options, scroll_offset, option_lines_budget)
            below_needed = (scroll_offset + len(layout)) < len(self._options)

            # Second pass: if below indicator is needed, reserve one line and recompute.
            if below_needed:
                option_lines_budget = max_total_height - reserved - 1
                layout = self._compute_visible_layout(wrapped_options, scroll_offset, option_lines_budget)
                below_needed = (scroll_offset + len(layout)) < len(self._options)

            return layout, below_needed

        # Initial layout based on current scroll offset
        layout, _ = build_layout_for_scroll(self._scroll_offset)
        self._visible_count = max(1, len(layout))

        # Ensure selection stays within visible option range, then recompute layout if needed.
        prev_offset = self._scroll_offset
        self._ensure_visible()
        if self._scroll_offset != prev_offset:
            layout, _ = build_layout_for_scroll(self._scroll_offset)
            self._visible_count = max(1, len(layout))
        
        # Calculate total height
        has_title = bool(self.title)
        above_indicator, below_indicator = self._get_scroll_indicators()

        option_line_count = sum(len(lines) for _, lines, _ in layout)
        content_height = option_line_count
        if has_title:
            content_height += 1
        if above_indicator:
            content_height += 1
        if below_indicator:
            content_height += 1

        total_height = min(max_total_height, content_height + 2)  # Add borders, cap to screen
        
        # Center horizontally
        x = (width - self._width) // 2

        # Clear previous window if the new menu is smaller (prevents border ghosting)
        if self._window is not None:
            try:
                if self._window.height > total_height or self._window.width > self._width:
                    self._window.clear()
                    self._window.refresh()
            except Exception:
                pass

        # Create window
        self._window = self.screen.create_window(total_height, self._width, y, x)
        
        # Get attributes
        border_attr = 0
        accent_attr = 0
        dim_attr = 0
        reverse_attr = 0
        if self.theme:
            border_attr = self.theme.get_attr('border')
            accent_attr = self.theme.get_attr('accent')
            dim_attr = self.theme.get_attr('dim')
            reverse_attr = self.theme.get_attr('reverse')
        
        # Draw box
        self._window.draw_box('rounded', border_attr)
        
        # Current row for content
        row = 1
        
        # Draw title if present
        if has_title:
            title_line = pad_text(self.title, inner_width, align='center', fill_char=' ', truncate=True)
            self._window.write(row, 1, title_line, accent_attr)
            row += 1
        
        # Draw above scroll indicator
        if above_indicator:
            self._window.write(row, 1, pad_text(above_indicator, inner_width, align='left', truncate=True), dim_attr)
            row += 1
        
        # Draw visible options
        for actual_index, wrapped_lines, is_truncated in layout:
            is_selected = actual_index == self._selected_index
            
            # Format option with number prefix (1-9)
            if actual_index < 9:
                prefix = f'{actual_index + 1}. '
            else:
                prefix = '   '
            
            # Selection indicator
            if is_selected:
                indicator = '▸ '
                attr = reverse_attr if reverse_attr else accent_attr
            else:
                indicator = '  '
                attr = 0

            first_prefix = f'{indicator}{prefix}'
            cont_prefix = ' ' * visible_len(first_prefix)

            for line_idx, text_line in enumerate(wrapped_lines):
                if row >= total_height - 1:
                    break

                render_prefix = first_prefix if line_idx == 0 else cont_prefix
                render_line = f'{render_prefix}{text_line}'

                if is_truncated and line_idx == len(wrapped_lines) - 1 and visible_len(text_line) >= 1:
                    # Indicate truncation if we had to cut off wrapped lines.
                    render_line = f'{render_prefix}{text_line[:-1]}…'

                self._window.write(row, 1, pad_text(render_line, inner_width, align='left', fill_char=' ', truncate=True), attr)
                row += 1
        
        # Draw below scroll indicator
        if below_indicator:
            if row < total_height - 1:
                self._window.write(row, 1, pad_text(below_indicator, inner_width, align='left', truncate=True), dim_attr)
            row += 1
        
        self._window.refresh()
        return total_height
    
    def render_to_window(self, window: 'Window', y: int = 0) -> int:
        """
        Render selection menu into an existing window.
        
        Args:
            window: Window to render into
            y: Starting row within window
            
        Returns:
            Number of rows used
        """
        if not self._options:
            return 0
        
        width = window.width
        inner_width = max(1, width - 2)

        prefix_width = visible_len("▸ 1. ")
        text_width = max(1, inner_width - prefix_width)
        wrapped_options = [self._wrap_text(opt, text_width) for opt in self._options]

        max_total_height = max(0, window.height - y)
        
        # Get attributes
        border_attr = 0
        accent_attr = 0
        dim_attr = 0
        reverse_attr = 0
        if self.theme:
            border_attr = self.theme.get_attr('border')
            accent_attr = self.theme.get_attr('accent')
            dim_attr = self.theme.get_attr('dim')
            reverse_attr = self.theme.get_attr('reverse')
        
        row = y
        
        # Compute a layout first (so indicators are based on the correct visible_count).
        reserved = 0
        reserved += 1 if self.title else 0
        reserved += 1 if self._scroll_offset > 0 else 0  # above indicator

        option_budget = max_total_height - reserved
        layout = self._compute_visible_layout(wrapped_options, self._scroll_offset, option_budget)
        self._visible_count = max(1, len(layout))

        # If there are more options below, reserve one line and recompute.
        if (self._scroll_offset + self._visible_count) < len(self._options):
            option_budget = max_total_height - reserved - 1
            layout = self._compute_visible_layout(wrapped_options, self._scroll_offset, option_budget)
            self._visible_count = max(1, len(layout))

        above_indicator, below_indicator = self._get_scroll_indicators()

        # Draw title if present
        if self.title and row < y + max_total_height:
            window.write(row, 1, pad_text(self.title, inner_width, align='center', fill_char=' ', truncate=True), accent_attr)
            row += 1
        
        # Draw above scroll indicator
        if above_indicator and row < y + max_total_height:
            window.write(row, 1, pad_text(above_indicator, inner_width, align='left', truncate=True), dim_attr)
            row += 1

        for actual_index, wrapped_lines, is_truncated in layout:
            is_selected = actual_index == self._selected_index
            
            # Format option
            if actual_index < 9:
                prefix = f'{actual_index + 1}. '
            else:
                prefix = '   '
            
            if is_selected:
                indicator = '▸ '
                attr = reverse_attr if reverse_attr else accent_attr
            else:
                indicator = '  '
                attr = 0

            first_prefix = f'{indicator}{prefix}'
            cont_prefix = ' ' * visible_len(first_prefix)

            for line_idx, text_line in enumerate(wrapped_lines):
                if row >= y + max_total_height:
                    break

                render_prefix = first_prefix if line_idx == 0 else cont_prefix
                render_line = f'{render_prefix}{text_line}'

                if is_truncated and line_idx == len(wrapped_lines) - 1 and visible_len(text_line) >= 1:
                    render_line = f'{render_prefix}{text_line[:-1]}…'

                window.write(row, 1, pad_text(render_line, inner_width, align='left', fill_char=' ', truncate=True), attr)
                row += 1
        
        # Draw below scroll indicator
        if below_indicator:
            if row < y + max_total_height:
                window.write(row, 1, pad_text(below_indicator, inner_width, align='left', truncate=True), dim_attr)
            row += 1
        
        return row - y
    
    def clear(self) -> None:
        """Clear the menu."""
        if self._window:
            self._window.clear()
            self._window.refresh()
