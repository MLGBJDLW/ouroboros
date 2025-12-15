"""
StatusBar component module.

This module provides the status bar showing mode, scroll position,
and cursor position embedded in the bottom border of the InputBox.

Requirements: 12.1-12.3
"""

from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from ..tui.screen import ScreenManager
    from ..tui.theme import ThemeManager
    from ..tui.window import Window


class StatusBar:
    """
    Status bar component embedded in the bottom border.
    
    Displays:
    - Mode indicator (INPUT, PASTE, HISTORY, SEARCH)
    - Scroll indicator [start-end/total]
    - Cursor position Ln X, Col Y
    
    The status bar is rendered as part of the InputBox bottom border,
    not as a separate window.
    """
    
    # Valid modes
    MODES = ('INPUT', 'PASTE', 'HISTORY', 'SEARCH')
    
    def __init__(self, theme: Optional['ThemeManager'] = None):
        """
        Initialize StatusBar.
        
        Args:
            theme: ThemeManager for styling (optional)
        """
        self.theme = theme
        self._mode = 'INPUT'
        self._cursor_row = 1
        self._cursor_col = 1
        self._scroll_start = 1
        self._scroll_end = 1
        self._total_lines = 1
        self._hint_text = ''
    
    @property
    def mode(self) -> str:
        """Get current mode."""
        return self._mode
    
    @mode.setter
    def mode(self, value: str) -> None:
        """Set current mode."""
        if value in self.MODES:
            self._mode = value
        else:
            self._mode = 'INPUT'
    
    def set_cursor_position(self, row: int, col: int) -> None:
        """
        Set cursor position for display.
        
        Args:
            row: Cursor row (1-based for display)
            col: Cursor column (1-based for display)
        """
        self._cursor_row = max(1, row)
        self._cursor_col = max(1, col)
    
    def set_scroll_info(self, start: int, end: int, total: int) -> None:
        """
        Set scroll information for display.
        
        Args:
            start: First visible line (1-based)
            end: Last visible line (1-based)
            total: Total number of lines
        """
        self._scroll_start = max(1, start)
        self._scroll_end = max(1, end)
        self._total_lines = max(1, total)
    
    def set_hint(self, text: str) -> None:
        """
        Set hint text to display.
        
        Args:
            text: Hint text (e.g., "Ctrl+D to submit")
        """
        self._hint_text = text
    
    def format_mode(self) -> str:
        """
        Format mode indicator.
        
        Returns:
            Formatted mode string like "[ INPUT ]"
        """
        return f'[ {self._mode} ]'
    
    def format_scroll(self) -> str:
        """
        Format scroll indicator.
        
        Returns:
            Formatted scroll string like "[1-5/10]" or empty if not scrolling
        """
        if self._total_lines <= 1:
            return ''
        
        if self._scroll_start == 1 and self._scroll_end >= self._total_lines:
            return ''
        
        return f'[{self._scroll_start}-{self._scroll_end}/{self._total_lines}]'
    
    def format_cursor(self) -> str:
        """
        Format cursor position.
        
        Returns:
            Formatted cursor string like "Ln 1, Col 5"
        """
        return f'Ln {self._cursor_row}, Col {self._cursor_col}'
    
    def render_text(self, width: int) -> str:
        """
        Render status bar text to fit within specified width.
        
        The layout is:
        - Left: Mode indicator
        - Center: Hint text (if space allows)
        - Right: Scroll indicator + Cursor position
        
        Args:
            width: Available width in characters
            
        Returns:
            Formatted status bar text
        """
        mode_str = self.format_mode()
        scroll_str = self.format_scroll()
        cursor_str = self.format_cursor()
        
        # Build right side
        right_parts = []
        if scroll_str:
            right_parts.append(scroll_str)
        right_parts.append(cursor_str)
        right_str = ' '.join(right_parts)
        
        # Calculate available space for hint
        left_len = len(mode_str)
        right_len = len(right_str)
        min_spacing = 2  # Minimum space between sections
        
        available_for_hint = width - left_len - right_len - (min_spacing * 2)
        
        # Build center (hint) if space allows
        center_str = ''
        if self._hint_text and available_for_hint >= len(self._hint_text):
            center_str = self._hint_text
        elif self._hint_text and available_for_hint >= 10:
            # Truncate hint if needed
            center_str = self._hint_text[:available_for_hint - 3] + '...'
        
        # Calculate spacing
        if center_str:
            # Three-part layout
            total_content = left_len + len(center_str) + right_len
            remaining = width - total_content
            left_space = remaining // 2
            right_space = remaining - left_space
            
            return f'{mode_str}{" " * left_space}{center_str}{" " * right_space}{right_str}'
        else:
            # Two-part layout (mode left, cursor right)
            spacing = width - left_len - right_len
            if spacing < 1:
                # Not enough space, prioritize cursor position
                if width >= right_len:
                    return right_str.rjust(width)
                return cursor_str[:width]
            
            return f'{mode_str}{" " * spacing}{right_str}'
    
    def render_to_window(self, window: 'Window', y: int, 
                         x_start: int = 1, x_end: int = None) -> None:
        """
        Render status bar embedded in bottom border.
        
        Format: ╰── Ctrl+D: submit ─────────────────── Ln X, Col Y ──╯
        
        Args:
            window: Window to render into
            y: Row position (bottom border row)
            x_start: Starting column (after ╰)
            x_end: Ending column (before ╯)
        """
        if x_end is None:
            x_end = window.width - 1
        
        content_width = x_end - x_start
        if content_width <= 0:
            return
        
        # Get attributes
        border_attr = self.theme.get_attr('border') if self.theme else 0
        success_attr = self.theme.get_attr('success') if self.theme else 0
        dim_attr = self.theme.get_attr('dim') if self.theme else 0
        
        # Build status bar embedded in border
        # Format: ── Hint ─────────────────── Ln X, Col Y ──
        
        # Hint text (or mode if no hint)
        hint_text = f' {self._hint_text} ' if self._hint_text else f' {self._mode} '
        
        # Position text
        pos_text = f' Ln {self._cursor_row}, Col {self._cursor_col} '
        
        # Calculate border segments
        left_border = '──'
        right_border = '──'
        
        # Middle border fills remaining space
        hint_len = len(hint_text)
        pos_len = len(pos_text)
        mid_len = content_width - len(left_border) - hint_len - pos_len - len(right_border)
        mid_border = '─' * max(1, mid_len)
        
        # Write each segment with appropriate attributes
        x = x_start
        
        # Left border segment
        window.write(y, x, left_border, border_attr)
        x += len(left_border)
        
        # Hint text (success color - green for submit hint)
        window.write(y, x, hint_text, success_attr)
        x += hint_len
        
        # Middle border
        window.write(y, x, mid_border, border_attr)
        x += len(mid_border)
        
        # Position text (dim)
        window.write(y, x, pos_text, dim_attr)
        x += pos_len
        
        # Right border segment
        window.write(y, x, right_border, border_attr)
    
    def get_ansi_text(self, width: int) -> str:
        """
        Get status bar text with ANSI styling.
        
        Args:
            width: Available width
            
        Returns:
            ANSI-styled status bar text
        """
        text = self.render_text(width)
        
        if self.theme:
            return self.theme.styled_text(text, 'dim')
        
        return text
