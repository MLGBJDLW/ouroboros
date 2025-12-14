"""
InputBox component module.

This module provides the main input area component with multi-line
support, scrolling, badge rendering, and status bar.

Requirements: 2.1-2.7, 14.1-14.4, 25.1-25.5
"""

from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from ..tui.screen import ScreenManager
    from ..tui.theme import ThemeManager
    from ..tui.window import Window

from ..data.buffer import TextBuffer
from ..utils.badge import (
    render_for_display, find_markers, get_marker_at_position,
    FILE_MARKER_START, FILE_MARKER_END
)
from ..utils.text import visible_len, char_width
from .status_bar import StatusBar


class InputBox:
    """
    Multi-line input box with borders, line numbers, and status bar.
    
    Features:
    - Unicode box-drawing characters (╭╮╰╯─│)
    - 3-digit line numbers with separator
    - Badge rendering for file paths and pastes
    - Badge navigation (skip badges as atomic units)
    - Dynamic height expansion (up to 5 lines)
    - Virtual scrolling for content > 5 lines
    - CJK character support (2-column width)
    
    Requirements: 2.1-2.7, 14.1-14.4, 25.1-25.5
    """
    
    # Layout constants
    MIN_HEIGHT = 1
    MAX_HEIGHT = 5
    LINE_NUMBER_WIDTH = 4  # "001│" = 4 chars
    MIN_WIDTH = 20
    
    def __init__(self, screen: Optional['ScreenManager'] = None,
                 theme: Optional['ThemeManager'] = None,
                 show_line_numbers: bool = True,
                 prompt_header: str = ''):
        """
        Initialize InputBox.
        
        Args:
            screen: Parent ScreenManager
            theme: ThemeManager for styling
            show_line_numbers: Whether to show line numbers
            prompt_header: Optional header text to display
        """
        self.screen = screen
        self.theme = theme
        self.show_line_numbers = show_line_numbers
        self.prompt_header = prompt_header
        
        # Text buffer
        self.buffer = TextBuffer()
        
        # Status bar
        self.status_bar = StatusBar(theme)
        
        # Display state
        self._height = self.MIN_HEIGHT
        self._width = 80
        self._y = 0
        self._x = 0
        self._window: Optional['Window'] = None
        
        # Mode
        self._mode = 'INPUT'
    
    @property
    def height(self) -> int:
        """Get current box height (content lines, not including borders)."""
        return self._height
    
    @property
    def mode(self) -> str:
        """Get current mode."""
        return self._mode
    
    @mode.setter
    def mode(self, value: str) -> None:
        """Set current mode."""
        self._mode = value
        self.status_bar.mode = value
    
    def _calculate_height(self) -> int:
        """
        Calculate required height based on content.
        
        Returns height bounded by MIN_HEIGHT and MAX_HEIGHT.
        """
        line_count = self.buffer.line_count
        return max(self.MIN_HEIGHT, min(self.MAX_HEIGHT, line_count))
    
    def _get_content_width(self) -> int:
        """Get width available for text content."""
        width = self._width - 2  # Subtract borders
        if self.show_line_numbers:
            width -= self.LINE_NUMBER_WIDTH
        return max(1, width)

    def _render_line_number(self, line_num: int) -> str:
        """Format line number for display."""
        return f'{line_num:3d}│'
    
    def _render_line_content(self, line: str, width: int) -> str:
        """
        Render a line with badge conversion for display.
        
        Args:
            line: Raw line content (may contain markers)
            width: Available width
            
        Returns:
            Rendered line for display
        """
        # Convert markers to display badges
        display_line = render_for_display(line)
        
        # Truncate to width if needed
        if visible_len(display_line) > width:
            result = []
            current_width = 0
            for char in display_line:
                cw = char_width(char)
                if current_width + cw > width:
                    break
                result.append(char)
                current_width += cw
            return ''.join(result)
        
        return display_line
    
    def _get_cursor_display_col(self, line: str, cursor_col: int) -> int:
        """
        Calculate display column accounting for CJK characters and badges.
        
        Args:
            line: Raw line content
            cursor_col: Cursor column in raw text
            
        Returns:
            Display column position
        """
        # Get the text before cursor
        text_before = line[:cursor_col]
        
        # Convert to display format
        display_before = render_for_display(text_before)
        
        # Calculate visible width
        return visible_len(display_before)
    
    def _find_badge_at_cursor(self) -> Optional[tuple]:
        """
        Find badge at current cursor position.
        
        Returns:
            Tuple of (start, end, marker_type) or None
        """
        line = self.buffer.lines[self.buffer.cursor_row]
        return get_marker_at_position(line, self.buffer.cursor_col)
    
    def skip_badge_left(self) -> bool:
        """
        Skip to badge start if cursor is inside a badge.
        
        Returns:
            True if cursor was moved
        """
        line = self.buffer.lines[self.buffer.cursor_row]
        marker = get_marker_at_position(line, self.buffer.cursor_col)
        
        if marker:
            start, end, _ = marker
            if self.buffer.cursor_col > start:
                self.buffer.cursor_col = start
                return True
        
        return False
    
    def skip_badge_right(self) -> bool:
        """
        Skip to badge end if cursor is inside a badge.
        
        Returns:
            True if cursor was moved
        """
        line = self.buffer.lines[self.buffer.cursor_row]
        marker = get_marker_at_position(line, self.buffer.cursor_col)
        
        if marker:
            start, end, _ = marker
            if self.buffer.cursor_col < end:
                self.buffer.cursor_col = end
                return True
        
        return False
    
    def delete_badge_at_cursor(self) -> bool:
        """
        Delete entire badge if cursor is at badge start.
        
        Returns:
            True if badge was deleted
        """
        line = self.buffer.lines[self.buffer.cursor_row]
        marker = get_marker_at_position(line, self.buffer.cursor_col)
        
        if marker:
            start, end, _ = marker
            # Delete the entire marker
            self.buffer.lines[self.buffer.cursor_row] = line[:start] + line[end:]
            self.buffer.cursor_col = start
            return True
        
        return False
    
    def move_left(self) -> bool:
        """Move cursor left, skipping badges as atomic units."""
        # Check if we're at the start of a badge
        line = self.buffer.lines[self.buffer.cursor_row]
        
        # First try normal move
        if self.buffer.cursor_col > 0:
            self.buffer.cursor_col -= 1
            # If we landed inside a badge, skip to its start
            self.skip_badge_left()
            return True
        elif self.buffer.cursor_row > 0:
            self.buffer.cursor_row -= 1
            self.buffer.cursor_col = len(self.buffer.lines[self.buffer.cursor_row])
            return True
        
        return False
    
    def move_right(self) -> bool:
        """Move cursor right, skipping badges as atomic units."""
        line = self.buffer.lines[self.buffer.cursor_row]
        
        # Check if we're at the start of a badge
        marker = get_marker_at_position(line, self.buffer.cursor_col)
        if marker:
            start, end, _ = marker
            if self.buffer.cursor_col == start:
                # Skip entire badge
                self.buffer.cursor_col = end
                return True
        
        # Normal move
        if self.buffer.cursor_col < len(line):
            self.buffer.cursor_col += 1
            return True
        elif self.buffer.cursor_row < self.buffer.line_count - 1:
            self.buffer.cursor_row += 1
            self.buffer.cursor_col = 0
            return True
        
        return False
    
    def backspace(self) -> bool:
        """
        Handle backspace, deleting entire badge if at badge start.
        
        Returns:
            True if deletion occurred
        """
        line = self.buffer.lines[self.buffer.cursor_row]
        
        # Check if cursor is right after a badge
        if self.buffer.cursor_col > 0:
            marker = get_marker_at_position(line, self.buffer.cursor_col - 1)
            if marker:
                start, end, _ = marker
                if self.buffer.cursor_col == end:
                    # Delete entire badge
                    self.buffer.lines[self.buffer.cursor_row] = line[:start] + line[end:]
                    self.buffer.cursor_col = start
                    return True
        
        # Normal backspace
        return self.buffer.backspace()
    
    def update_scroll(self) -> None:
        """Update scroll offset to keep cursor visible."""
        viewport_height = self._height
        
        if self.buffer.cursor_row < self.buffer.scroll_offset:
            self.buffer.scroll_offset = self.buffer.cursor_row
        elif self.buffer.cursor_row >= self.buffer.scroll_offset + viewport_height:
            self.buffer.scroll_offset = self.buffer.cursor_row - viewport_height + 1
    
    def _update_status_bar(self) -> None:
        """Update status bar with current state."""
        self.status_bar.set_cursor_position(
            self.buffer.cursor_row + 1,
            self.buffer.cursor_col + 1
        )
        
        # Calculate scroll info
        viewport_height = self._height
        start = self.buffer.scroll_offset + 1
        end = min(self.buffer.scroll_offset + viewport_height, self.buffer.line_count)
        self.status_bar.set_scroll_info(start, end, self.buffer.line_count)

    def render(self, y: int, width: int = None) -> int:
        """
        Render the input box at specified row.
        
        Args:
            y: Starting row position
            width: Available width (uses screen width if not specified)
            
        Returns:
            Total height used (including borders)
        """
        if self.screen is None:
            return 0
        
        # Get dimensions
        if width is None:
            cols, _ = self.screen.get_size()
            width = cols
        
        self._width = max(self.MIN_WIDTH, width)
        self._y = y
        
        # Calculate height based on content
        new_height = self._calculate_height()
        self._height = new_height
        
        # Total height includes top border, content lines, bottom border
        total_height = self._height + 2
        
        # Create or resize window
        self._window = self.screen.create_window(total_height, self._width, y, 0)
        
        # Get attributes
        border_attr = 0
        accent_attr = 0
        dim_attr = 0
        if self.theme:
            border_attr = self.theme.get_attr('border')
            accent_attr = self.theme.get_attr('accent')
            dim_attr = self.theme.get_attr('dim')
        
        # Draw box
        self._window.draw_box('rounded', border_attr)
        
        # Draw prompt header in top border if provided
        if self.prompt_header:
            header_x = 2
            self._window.write(0, header_x, f' {self.prompt_header} ', accent_attr)
        
        # Update scroll
        self.update_scroll()
        
        # Get visible lines
        visible_lines = self.buffer.get_visible_lines(self._height)
        content_width = self._get_content_width()
        
        # Render each visible line
        for i, line in enumerate(visible_lines):
            row = i + 1  # Skip top border
            x = 1  # Skip left border
            
            # Line number
            if self.show_line_numbers:
                line_num = self.buffer.scroll_offset + i + 1
                line_num_str = self._render_line_number(line_num)
                self._window.write(row, x, line_num_str, dim_attr)
                x += self.LINE_NUMBER_WIDTH
            
            # Line content with badge rendering
            display_content = self._render_line_content(line, content_width)
            self._window.write(row, x, display_content, 0)
            
            # Pad remaining space
            remaining = content_width - visible_len(display_content)
            if remaining > 0:
                self._window.write(row, x + visible_len(display_content), ' ' * remaining, 0)
        
        # Fill empty lines if viewport is larger than content
        for i in range(len(visible_lines), self._height):
            row = i + 1
            x = 1
            
            if self.show_line_numbers:
                self._window.write(row, x, '   │', dim_attr)
                x += self.LINE_NUMBER_WIDTH
            
            self._window.write(row, x, ' ' * content_width, 0)
        
        # Update and render status bar in bottom border
        self._update_status_bar()
        self.status_bar.render_to_window(self._window, total_height - 1, 2, self._width - 2)
        
        # Position cursor
        self._position_cursor()
        
        self._window.refresh()
        return total_height
    
    def _position_cursor(self) -> None:
        """Position the terminal cursor at the correct location."""
        if self._window is None:
            return
        
        # Calculate cursor position in window
        visible_row = self.buffer.cursor_row - self.buffer.scroll_offset
        
        if visible_row < 0 or visible_row >= self._height:
            return
        
        # Window row (add 1 for top border)
        win_row = visible_row + 1
        
        # Calculate column
        line = self.buffer.lines[self.buffer.cursor_row]
        display_col = self._get_cursor_display_col(line, self.buffer.cursor_col)
        
        # Window column (add 1 for left border, add line number width if shown)
        win_col = 1 + display_col
        if self.show_line_numbers:
            win_col += self.LINE_NUMBER_WIDTH
        
        # Clamp to content area
        max_col = self._width - 2
        win_col = min(win_col, max_col)
        
        self._window.set_cursor(win_row, win_col)
    
    def expand(self) -> bool:
        """
        Expand box height if content requires it.
        
        Returns:
            True if height changed
        """
        new_height = self._calculate_height()
        if new_height > self._height:
            self._height = new_height
            return True
        return False
    
    def shrink(self) -> bool:
        """
        Shrink box height if content allows it.
        
        Returns:
            True if height changed
        """
        new_height = self._calculate_height()
        if new_height < self._height:
            self._height = new_height
            return True
        return False
    
    def handle_resize(self, new_width: int, new_height: int = None) -> None:
        """
        Handle terminal resize.
        
        Args:
            new_width: New terminal width
            new_height: New terminal height (unused, for interface compatibility)
        """
        self._width = max(self.MIN_WIDTH, new_width)
    
    def get_text(self) -> str:
        """Get the full text content."""
        return self.buffer.text
    
    def set_text(self, text: str) -> None:
        """Set the text content."""
        self.buffer.clear()
        self.buffer.insert_text(text)
    
    def clear(self) -> None:
        """Clear all content."""
        self.buffer.clear()
        self._height = self.MIN_HEIGHT
    
    def is_scrolling(self) -> bool:
        """Check if virtual scrolling is active."""
        return self.buffer.line_count > self.MAX_HEIGHT
    
    def get_scroll_indicator(self) -> str:
        """Get scroll indicator string."""
        return self.status_bar.format_scroll()
