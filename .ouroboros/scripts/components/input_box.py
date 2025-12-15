"""
InputBox component module.

This module provides the main input area component with multi-line
support, scrolling, badge rendering, and status bar.


"""

from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from ..tui.screen import ScreenManager
    from ..tui.theme import ThemeManager
    from ..tui.window import Window

from data.buffer import TextBuffer
from utils.badge import (
    render_for_display, find_markers, get_marker_at_position,
    FILE_MARKER_START, FILE_MARKER_END
)
from utils.text import visible_len, char_width
from components.status_bar import StatusBar


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
        
        # Track if initial render has been done
        self._rendered = False
    
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
        
        The buffer stores markers like:
        - «/full/path/file.ext» -> displays as [ file.ext ]
        - ‹PASTE:N›content‹/PASTE› -> displays as [ Pasted N Lines ]
        
        We need to calculate where the cursor should be in the displayed text,
        accounting for the difference in length between markers and badges.
        
        Args:
            line: Raw line content
            cursor_col: Cursor column in raw text
            
        Returns:
            Display column position
        """
        import re
        import os
        
        # Find all markers (both file path and paste markers)
        markers = find_markers(line)
        
        if not markers:
            # No markers - simple case, just calculate visible width
            text_before = line[:cursor_col]
            return visible_len(text_before)
        
        # Build the display text and track cursor position
        display_col = 0
        last_end = 0
        
        for start, end, marker_type in markers:
            # Add text before this marker
            if start > last_end:
                segment = line[last_end:min(start, cursor_col)]
                if cursor_col <= start:
                    # Cursor is before this marker
                    display_col += visible_len(segment)
                    return display_col
                else:
                    # Cursor is at or after this marker
                    display_col += visible_len(line[last_end:start])
            
            # Check if cursor is inside the marker
            if cursor_col <= end:
                # Cursor is at or inside marker - calculate badge width
                marker_text = line[start:end]
                if marker_type == 'file':
                    # File marker: «path» -> [ filename ]
                    path = marker_text[1:-1]  # Remove « and »
                    filename = os.path.basename(path) or path.split('/')[-1] or path
                    badge_text = f"[ {filename} ]"
                elif marker_type == 'paste':
                    # Paste marker: ‹PASTE:N›content‹/PASTE› -> [ Pasted N Lines ]
                    match = re.match(r'‹PASTE:(\d+)›', marker_text)
                    if match:
                        line_count = int(match.group(1))
                        if line_count == 1:
                            badge_text = "[ Pasted 1 Line ]"
                        else:
                            badge_text = f"[ Pasted {line_count} Lines ]"
                    else:
                        badge_text = "[ Pasted ]"
                else:
                    badge_text = marker_text
                
                # Cursor at or inside badge - put it at end of badge
                display_col += visible_len(badge_text)
                return display_col
            
            # Cursor is after this marker - add badge width
            marker_text = line[start:end]
            if marker_type == 'file':
                path = marker_text[1:-1]
                filename = os.path.basename(path) or path.split('/')[-1] or path
                badge_text = f"[ {filename} ]"
            elif marker_type == 'paste':
                match = re.match(r'‹PASTE:(\d+)›', marker_text)
                if match:
                    line_count = int(match.group(1))
                    if line_count == 1:
                        badge_text = "[ Pasted 1 Line ]"
                    else:
                        badge_text = f"[ Pasted {line_count} Lines ]"
                else:
                    badge_text = "[ Pasted ]"
            else:
                badge_text = marker_text
            
            display_col += visible_len(badge_text)
            last_end = end
        
        # Add remaining text after last marker
        if last_end < len(line):
            if cursor_col > last_end:
                segment = line[last_end:cursor_col]
                display_col += visible_len(segment)
            # else cursor is before last_end, already handled
        
        return display_col
    
    def _find_badge_at_cursor(self) -> Optional[tuple]:
        """
        Find badge at current cursor position.
        
        Detects both file markers («path») and paste markers (‹PASTE:N›...‹/PASTE›).
        
        Returns:
            Tuple of (start, end, marker_type) or None
            marker_type: 'file' or 'paste'
        """
        line = self.buffer.lines[self.buffer.cursor_row]
        return get_marker_at_position(line, self.buffer.cursor_col)
    
    def _find_badge_at_position(self, line: str, col: int) -> Optional[tuple]:
        """
        Find badge at a specific position in a line.
        
        This is a helper for cursor navigation that checks if a position
        is inside any badge (file or paste marker).
        
        Args:
            line: The line text to check
            col: Column position to check
            
        Returns:
            Tuple of (start, end, marker_type) or None
        """
        return get_marker_at_position(line, col)
    
    def skip_badge_left(self) -> bool:
        """
        Skip to badge start if cursor is inside a badge.
        
        Handles both file markers («path») and paste markers (‹PASTE:N›...‹/PASTE›).
        When cursor moves into a badge, it jumps to the badge's start position.
        
        Returns:
            True if cursor was moved
        """
        line = self.buffer.lines[self.buffer.cursor_row]
        marker = get_marker_at_position(line, self.buffer.cursor_col)
        
        if marker:
            start, end, marker_type = marker
            if self.buffer.cursor_col > start:
                self.buffer.cursor_col = start
                return True
        
        return False
    
    def skip_badge_right(self) -> bool:
        """
        Skip to badge end if cursor is inside a badge.
        
        Handles both file markers («path») and paste markers (‹PASTE:N›...‹/PASTE›).
        When cursor moves into a badge, it jumps to the badge's end position.
        
        Returns:
            True if cursor was moved
        """
        line = self.buffer.lines[self.buffer.cursor_row]
        marker = get_marker_at_position(line, self.buffer.cursor_col)
        
        if marker:
            start, end, marker_type = marker
            if self.buffer.cursor_col < end:
                self.buffer.cursor_col = end
                return True
        
        return False
    
    def delete_badge_at_cursor(self) -> bool:
        """
        Delete entire badge if cursor is at or inside a badge.
        
        Handles both file markers («path») and paste markers (‹PASTE:N›...‹/PASTE›).
        
        Returns:
            True if badge was deleted
        """
        line = self.buffer.lines[self.buffer.cursor_row]
        marker = get_marker_at_position(line, self.buffer.cursor_col)
        
        if marker:
            start, end, marker_type = marker
            # Delete the entire marker (both file and paste)
            self.buffer.lines[self.buffer.cursor_row] = line[:start] + line[end:]
            self.buffer.cursor_col = start
            return True
        
        return False
    
    def move_left(self) -> bool:
        """
        Move cursor left, skipping badges as atomic units.
        
        Handles both file markers («path») and paste markers (‹PASTE:N›...‹/PASTE›).
        When moving left into a badge, cursor jumps to badge start.
        """
        line = self.buffer.lines[self.buffer.cursor_row]
        
        if self.buffer.cursor_col > 0:
            # Move one position left
            new_col = self.buffer.cursor_col - 1
            
            # Check if we landed inside a badge
            marker = get_marker_at_position(line, new_col)
            if marker:
                start, end, marker_type = marker
                # If we're inside the badge (not at start), skip to start
                if new_col > start:
                    self.buffer.cursor_col = start
                else:
                    self.buffer.cursor_col = new_col
            else:
                self.buffer.cursor_col = new_col
            return True
        elif self.buffer.cursor_row > 0:
            # Move to end of previous line
            self.buffer.cursor_row -= 1
            self.buffer.cursor_col = len(self.buffer.lines[self.buffer.cursor_row])
            return True
        
        return False
    
    def move_right(self) -> bool:
        """
        Move cursor right, skipping badges as atomic units.
        
        Handles both file markers («path») and paste markers (‹PASTE:N›...‹/PASTE›).
        When at badge start, cursor jumps to badge end.
        """
        line = self.buffer.lines[self.buffer.cursor_row]
        
        # Check if we're at the start of a badge - skip entire badge
        marker = get_marker_at_position(line, self.buffer.cursor_col)
        if marker:
            start, end, marker_type = marker
            if self.buffer.cursor_col == start:
                # Skip entire badge (both file and paste markers)
                self.buffer.cursor_col = end
                return True
        
        # Normal move
        if self.buffer.cursor_col < len(line):
            new_col = self.buffer.cursor_col + 1
            
            # Check if we landed inside a badge
            marker = get_marker_at_position(line, new_col)
            if marker:
                start, end, marker_type = marker
                # If we're inside the badge, skip to end
                if new_col > start and new_col < end:
                    self.buffer.cursor_col = end
                else:
                    self.buffer.cursor_col = new_col
            else:
                self.buffer.cursor_col = new_col
            return True
        elif self.buffer.cursor_row < self.buffer.line_count - 1:
            self.buffer.cursor_row += 1
            self.buffer.cursor_col = 0
            return True
        
        return False
    
    def backspace(self) -> bool:
        """
        Handle backspace, deleting entire badge if cursor is right after a badge.
        
        Handles both file markers («path») and paste markers (‹PASTE:N›...‹/PASTE›).
        When cursor is at the end of a badge, the entire badge is deleted.
        
        Returns:
            True if deletion occurred
        """
        line = self.buffer.lines[self.buffer.cursor_row]
        
        # Check if cursor is right after a badge (at badge end position)
        if self.buffer.cursor_col > 0:
            # Check position just before cursor
            marker = get_marker_at_position(line, self.buffer.cursor_col - 1)
            if marker:
                start, end, marker_type = marker
                # If cursor is at the end of the badge, delete entire badge
                if self.buffer.cursor_col == end:
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
        
        # Calculate height based on content.
        # In ANSI fallback mode, shrinking without deleting the now-unused rows
        # leaves stale borders/status lines on screen (ghosting). Use DL to pull
        # the bottom border up before drawing the new, smaller box.
        old_height = self._height
        new_height = self._calculate_height()
        if new_height < old_height:
            lines_to_remove = old_height - new_height
            self._height = new_height
            if (
                self.screen is not None
                and not self.screen.is_curses
                and self._rendered
                and self._window is not None
            ):
                self._shrink_with_delete_lines(lines_to_remove)
        else:
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
        
        # Draw prompt header in top border
        # Format: ╭──◎ INPUT──────────────────╮ or ╭──◇ Custom Header──────╮
        prompt_attr = self.theme.get_attr('prompt') if self.theme else 0
        if self.prompt_header:
            # Custom header with ◇ symbol
            header_text = f' ◇ {self.prompt_header} '
        else:
            # Default header with ◎ symbol
            header_text = ' ◎ INPUT '
        
        header_x = 3  # After ╭──
        self._window.write(0, header_x, header_text, prompt_attr)
        
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
        
        # Refresh window first (renders content)
        self._window.refresh()
        
        # Mark as rendered
        self._rendered = True
        
        # Then position cursor (must be after refresh in ANSI mode)
        self._position_cursor()
        
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
    
    def update_current_line(self) -> None:
        """
        Update only the current line (incremental update).
        
        This is more efficient than full render for single character input.
        Uses batch rendering pattern from original ouroboros_ui.py.
        """
        if self._window is None or not self._rendered:
            return
        
        import sys
        
        # Calculate visible row
        visible_row = self.buffer.cursor_row - self.buffer.scroll_offset
        if visible_row < 0 or visible_row >= self._height:
            return
        
        # Get attributes
        dim_attr = self.theme.get_attr('dim') if self.theme else ''
        
        # Build output batch
        output = []
        output.append('\x1b[?25l')  # Hide cursor
        output.append('\x1b[s')     # Save cursor
        
        # Calculate window position
        win_row = visible_row + 1  # +1 for top border
        terminal_row = self._y + win_row + 1
        terminal_col = self._x + 2  # +1 for border, +1 for 1-based
        
        # Move to line start
        output.append(f'\x1b[{terminal_row};{terminal_col}H')
        
        # Get line content
        line = self.buffer.lines[self.buffer.cursor_row]
        content_width = self._get_content_width()
        
        # Line number
        x = 0
        if self.show_line_numbers:
            line_num = self.buffer.scroll_offset + visible_row + 1
            line_num_str = self._render_line_number(line_num)
            if dim_attr:
                output.append(dim_attr)
            output.append(line_num_str)
            if dim_attr:
                output.append('\x1b[0m')
            x += self.LINE_NUMBER_WIDTH
        
        # Line content with badge rendering
        display_content = self._render_line_content(line, content_width)
        output.append(display_content)
        
        # Pad remaining space
        remaining = content_width - visible_len(display_content)
        if remaining > 0:
            output.append(' ' * remaining)
        
        # Restore cursor and show
        output.append('\x1b[u')     # Restore cursor
        output.append('\x1b[?25h')  # Show cursor
        
        # Flush all at once
        sys.stderr.write(''.join(output))
        sys.stderr.flush()
        
        # Position cursor at correct location
        self._position_cursor()
    
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
        
        Uses ANSI Delete Line (DL) to remove lines without leaving gaps.
        This pulls the bottom border up cleanly, preventing ghosting.
        
        Based on original ouroboros_ui.py shrink_height() implementation.
        
        Returns:
            True if height changed
        """
        new_height = self._calculate_height()
        if new_height < self._height:
            lines_to_remove = self._height - new_height
            self._height = new_height
            
            # Use ANSI delete_lines to properly remove lines (prevents ghosting)
            if self._window is not None:
                self._shrink_with_delete_lines(lines_to_remove)
            
            return True
        return False
    
    def _shrink_with_delete_lines(self, lines_to_remove: int) -> None:
        """
        Shrink the input box by deleting lines using ANSI escape codes.
        
        Uses ANSI Delete Line (DL) to remove lines without leaving gaps.
        This pulls the bottom border up cleanly.
        
        Based on original ouroboros_ui.py shrink_height() implementation.
        
        Strategy:
        1. Save cursor position
        2. Move to the first line that needs to be deleted (new_height position in box)
        3. Delete the extra lines (this pulls content below up)
        4. Restore cursor position
        """
        import sys
        
        # Build output batch
        output = []
        output.append('\x1b[?25l')  # Hide cursor
        output.append('\x1b[s')     # Save cursor
        
        # Calculate where to delete lines from
        # We need to move from current cursor position to the first line to delete
        # The cursor is at visible_row (0-based within the input area)
        # We need to go to self._height (the new height, which is where old lines start)
        visible_row = self.buffer.cursor_row - self.buffer.scroll_offset
        
        # Move to the first line that will be deleted
        # new_height is already set, so we need to go to position new_height
        # (which is 0-based index of first line to delete)
        lines_to_move = self._height - visible_row
        
        if lines_to_move > 0:
            output.append(f'\x1b[{lines_to_move}B')  # Move down
        elif lines_to_move < 0:
            output.append(f'\x1b[{-lines_to_move}A')  # Move up
        
        # Delete the extra lines (pulls bottom border up)
        # ANSI Delete Line: \x1b[{n}M
        output.append(f'\x1b[{lines_to_remove}M')
        
        # Restore cursor
        output.append('\x1b[u')     # Restore cursor
        output.append('\x1b[?25h')  # Show cursor
        
        # Flush all at once
        sys.stderr.write(''.join(output))
        sys.stderr.flush()
    
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
