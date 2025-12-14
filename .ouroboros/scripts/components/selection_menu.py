"""
SelectionMenu component module.

This module provides an interactive selection menu with
arrow key navigation, page scrolling, and number key selection.

Requirements: 28.1-28.8, 29.1-29.4
"""

import re
from typing import Optional, List, Tuple, TYPE_CHECKING

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
    
    Requirements: 28.1-28.8, 29.1-29.4
    """
    
    # Layout constants
    MIN_WIDTH = 30
    MAX_VISIBLE = 10  # Maximum visible options before scrolling
    CUSTOM_INPUT_TEXT = '[Custom input...]'
    
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
    
    def _calculate_width(self) -> int:
        """Calculate required width based on options."""
        max_option_len = max((len(opt) for opt in self._options), default=10)
        title_len = len(self.title) if self.title else 0
        
        # Add space for selection indicator and padding
        width = max(max_option_len + 6, title_len + 4, self.MIN_WIDTH)
        
        return width

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
        
        self._width = min(self._calculate_width(), width)
        self._visible_count = min(self.MAX_VISIBLE, len(self._options))
        
        # Calculate total height
        # Title (if present) + options + scroll indicators + borders
        has_title = bool(self.title)
        above_indicator, below_indicator = self._get_scroll_indicators()
        
        content_height = self._visible_count
        if has_title:
            content_height += 1
        if above_indicator:
            content_height += 1
        if below_indicator:
            content_height += 1
        
        total_height = content_height + 2  # Add borders
        
        # Center horizontally
        x = (width - self._width) // 2
        
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
            title_x = (self._width - len(self.title)) // 2
            self._window.write(row, max(1, title_x), self.title, accent_attr)
            row += 1
        
        # Draw above scroll indicator
        if above_indicator:
            self._window.write(row, 2, above_indicator, dim_attr)
            row += 1
        
        # Draw visible options
        visible_options = self._options[self._scroll_offset:self._scroll_offset + self._visible_count]
        
        for i, option in enumerate(visible_options):
            actual_index = self._scroll_offset + i
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
            
            # Truncate option if needed
            max_text_len = self._width - 4 - len(prefix) - len(indicator)
            display_text = option[:max_text_len] if len(option) > max_text_len else option
            
            line = f'{indicator}{prefix}{display_text}'
            self._window.write(row, 1, line, attr)
            row += 1
        
        # Draw below scroll indicator
        if below_indicator:
            self._window.write(row, 2, below_indicator, dim_attr)
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
        self._visible_count = min(self.MAX_VISIBLE, len(self._options))
        
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
        
        # Draw title if present
        if self.title:
            title_x = (width - len(self.title)) // 2
            window.write(row, max(1, title_x), self.title, accent_attr)
            row += 1
        
        # Draw above scroll indicator
        above_indicator, below_indicator = self._get_scroll_indicators()
        if above_indicator:
            window.write(row, 2, above_indicator, dim_attr)
            row += 1
        
        # Draw visible options
        visible_options = self._options[self._scroll_offset:self._scroll_offset + self._visible_count]
        
        for i, option in enumerate(visible_options):
            actual_index = self._scroll_offset + i
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
            
            max_text_len = width - 4 - len(prefix) - len(indicator)
            display_text = option[:max_text_len] if len(option) > max_text_len else option
            
            line = f'{indicator}{prefix}{display_text}'
            window.write(row, 1, line, attr)
            row += 1
        
        # Draw below scroll indicator
        if below_indicator:
            window.write(row, 2, below_indicator, dim_attr)
            row += 1
        
        return row - y
    
    def clear(self) -> None:
        """Clear the menu."""
        if self._window:
            self._window.clear()
            self._window.refresh()
