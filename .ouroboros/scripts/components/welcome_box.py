"""
WelcomeBox component module.

This module provides the header component showing branding
and keyboard shortcuts.

Requirements: 3.1-3.3
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
    - ◎ OUROBOROS title
    - Keyboard shortcuts in a formatted layout
    - Compact mode for narrow terminals
    
    The component scales to fit terminal width (max 66 columns).
    """
    
    # Branding
    TITLE = '◎ OUROBOROS'
    
    # Keyboard shortcuts to display
    SHORTCUTS = [
        ('Enter', 'new line'),
        ('Ctrl+D', 'submit'),
        ('↑/↓', 'cursor'),
        ('←/→', 'navigate'),
        ('Home/End', 'line start/end'),
        ('Ctrl+U', 'clear line'),
        ('Ctrl+C', 'cancel'),
        ('>>>', 'end & submit'),
    ]
    
    # Compact shortcuts (for narrow terminals)
    SHORTCUTS_COMPACT = [
        ('Enter', 'newline'),
        ('Ctrl+D', 'submit'),
        ('Ctrl+C', 'cancel'),
    ]
    
    # Layout constants
    MAX_WIDTH = 66
    MIN_WIDTH = 30
    COMPACT_THRESHOLD = 50
    
    def __init__(self, screen: Optional['ScreenManager'] = None,
                 theme: Optional['ThemeManager'] = None,
                 custom_header: str = ''):
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
        self._window: Optional['Window'] = None
    
    def _get_width(self, available_width: int) -> int:
        """Calculate actual width to use."""
        return min(self.MAX_WIDTH, max(self.MIN_WIDTH, available_width))
    
    def _is_compact(self, width: int) -> bool:
        """Check if compact mode should be used."""
        return width < self.COMPACT_THRESHOLD
    
    def _format_shortcuts(self, width: int) -> list:
        """
        Format shortcuts to fit within width.
        
        Args:
            width: Available width
            
        Returns:
            List of formatted shortcut lines
        """
        shortcuts = self.SHORTCUTS_COMPACT if self._is_compact(width) else self.SHORTCUTS
        
        # Calculate how many shortcuts per line
        inner_width = width - 4  # Account for borders and padding
        
        lines = []
        current_line = []
        current_len = 0
        
        for key, desc in shortcuts:
            item = f'{key}: {desc}'
            item_len = len(item) + 3  # Add separator space
            
            if current_len + item_len > inner_width and current_line:
                lines.append('  '.join(current_line))
                current_line = [item]
                current_len = len(item)
            else:
                current_line.append(item)
                current_len += item_len
        
        if current_line:
            lines.append('  '.join(current_line))
        
        return lines
    
    def get_height(self, width: int) -> int:
        """
        Calculate required height for the welcome box.
        
        Args:
            width: Available width
            
        Returns:
            Required height in rows
        """
        if self.custom_header:
            # Title + custom header + borders
            return 4
        
        shortcut_lines = self._format_shortcuts(width)
        # Title line + shortcut lines + top/bottom borders
        return 2 + len(shortcut_lines)
    
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
        
        # Get border attribute
        border_attr = 0
        accent_attr = 0
        if self.theme:
            border_attr = self.theme.get_attr('border')
            accent_attr = self.theme.get_attr('accent')
        
        # Draw box
        self._window.draw_box('rounded', border_attr)
        
        # Draw title centered
        title_x = (box_width - len(self.TITLE)) // 2
        self._window.write(0, title_x, self.TITLE, accent_attr)
        
        # Draw content
        if self.custom_header:
            # Custom header text
            header_x = (box_width - len(self.custom_header) - 2) // 2
            self._window.write(1, max(1, header_x), self.custom_header, 0)
        else:
            # Keyboard shortcuts
            shortcut_lines = self._format_shortcuts(box_width)
            for i, line in enumerate(shortcut_lines):
                # Center each line
                line_x = (box_width - len(line)) // 2
                self._window.write(1 + i, max(1, line_x), line, 0)
        
        self._window.refresh()
        return box_height
    
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
            # Just title, no box
            x = (width - len(self.TITLE)) // 2
            self._window = self.screen.create_window(1, len(self.TITLE) + 2, y, max(0, x))
            
            accent_attr = 0
            if self.theme:
                accent_attr = self.theme.get_attr('accent')
            
            self._window.write(0, 1, self.TITLE, accent_attr)
            self._window.refresh()
            return 1
        
        # Compact box with minimal shortcuts
        return self.render(y, box_width)
    
    def render_to_window(self, window: 'Window', y: int = 0) -> int:
        """
        Render welcome box into an existing window.
        
        Args:
            window: Window to render into
            y: Starting row within window
            
        Returns:
            Number of rows used
        """
        width = window.width
        box_width = self._get_width(width)
        
        # Get attributes
        border_attr = 0
        accent_attr = 0
        if self.theme:
            border_attr = self.theme.get_attr('border')
            accent_attr = self.theme.get_attr('accent')
        
        # Calculate centering offset
        x_offset = (width - box_width) // 2
        
        # Draw top border
        chars = window.BOX_CHARS['rounded']
        top_line = chars['tl'] + chars['h'] * (box_width - 2) + chars['tr']
        window.write(y, x_offset, top_line, border_attr)
        
        # Draw title in top border
        title_x = x_offset + (box_width - len(self.TITLE)) // 2
        window.write(y, title_x, self.TITLE, accent_attr)
        
        # Draw content lines
        if self.custom_header:
            content_lines = [self.custom_header]
        else:
            content_lines = self._format_shortcuts(box_width)
        
        for i, line in enumerate(content_lines):
            row = y + 1 + i
            # Draw side borders
            window.write(row, x_offset, chars['v'], border_attr)
            window.write(row, x_offset + box_width - 1, chars['v'], border_attr)
            # Draw content centered
            line_x = x_offset + (box_width - len(line)) // 2
            window.write(row, line_x, line, 0)
        
        # Draw bottom border
        bottom_row = y + 1 + len(content_lines)
        bottom_line = chars['bl'] + chars['h'] * (box_width - 2) + chars['br']
        window.write(bottom_row, x_offset, bottom_line, border_attr)
        
        return 2 + len(content_lines)
    
    def clear(self) -> None:
        """Clear the welcome box."""
        if self._window:
            self._window.clear()
            self._window.refresh()
