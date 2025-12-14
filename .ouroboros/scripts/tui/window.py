"""
Window wrapper module.

This module provides a wrapper around curses windows with
enhanced functionality for UI components.

Requirements: 2.1, 23.1-23.4
"""

import sys
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from .screen import ScreenManager

# Try to import curses
try:
    import curses
    _curses_available = True
except ImportError:
    _curses_available = False


class Window:
    """
    Wrapper around curses window with enhanced functionality.
    
    Provides a unified interface for window operations that works
    with both curses and ANSI fallback modes.
    
    Features:
    - Box drawing with Unicode characters
    - Text writing with attribute support
    - Double-buffered rendering in ANSI mode
    """
    
    # Unicode box-drawing characters
    BOX_CHARS = {
        'rounded': {
            'tl': '╭', 'tr': '╮', 'bl': '╰', 'br': '╯',
            'h': '─', 'v': '│'
        },
        'square': {
            'tl': '┌', 'tr': '┐', 'bl': '└', 'br': '┘',
            'h': '─', 'v': '│'
        },
        'double': {
            'tl': '╔', 'tr': '╗', 'bl': '╚', 'br': '╝',
            'h': '═', 'v': '║'
        },
        'ascii': {
            'tl': '+', 'tr': '+', 'bl': '+', 'br': '+',
            'h': '-', 'v': '|'
        }
    }
    
    def __init__(self, curses_win, parent: 'ScreenManager',
                 height: int = 0, width: int = 0, 
                 y: int = 0, x: int = 0):
        """
        Initialize Window wrapper.
        
        Args:
            curses_win: Underlying curses window (or None for ANSI mode)
            parent: Parent ScreenManager
            height: Window height (for ANSI mode)
            width: Window width (for ANSI mode)
            y: Top-left row position (for ANSI mode)
            x: Top-left column position (for ANSI mode)
        """
        self.win = curses_win
        self.parent = parent
        
        # Store dimensions for ANSI mode
        if curses_win is not None and _curses_available:
            self._height, self._width = curses_win.getmaxyx()
            self._y, self._x = curses_win.getbegyx()
        else:
            self._height = height
            self._width = width
            self._y = y
            self._x = x
        
        # ANSI mode buffer
        self._buffer = [[' ' for _ in range(self._width)] 
                        for _ in range(self._height)]
        self._styles = [['' for _ in range(self._width)] 
                        for _ in range(self._height)]
        self._dirty = True
    
    @property
    def height(self) -> int:
        """Get window height."""
        return self._height
    
    @property
    def width(self) -> int:
        """Get window width."""
        return self._width
    
    @property
    def y(self) -> int:
        """Get window top-left row."""
        return self._y
    
    @property
    def x(self) -> int:
        """Get window top-left column."""
        return self._x
    
    def draw_box(self, style: str = 'rounded', attr: int = 0) -> None:
        """
        Draw border with specified style.
        
        Args:
            style: Box style ('rounded', 'square', 'double', 'ascii')
            attr: Curses attribute for the border
        """
        chars = self.BOX_CHARS.get(style, self.BOX_CHARS['rounded'])
        
        if self._height < 2 or self._width < 2:
            return
        
        # Top border
        self.write(0, 0, chars['tl'], attr)
        self.write(0, 1, chars['h'] * (self._width - 2), attr)
        self.write(0, self._width - 1, chars['tr'], attr)
        
        # Side borders
        for row in range(1, self._height - 1):
            self.write(row, 0, chars['v'], attr)
            self.write(row, self._width - 1, chars['v'], attr)
        
        # Bottom border
        self.write(self._height - 1, 0, chars['bl'], attr)
        self.write(self._height - 1, 1, chars['h'] * (self._width - 2), attr)
        self.write(self._height - 1, self._width - 1, chars['br'], attr)
    
    def write(self, y: int, x: int, text: str, attr = 0) -> int:
        """
        Write text at position with optional attributes.
        
        Args:
            y: Row position (0-based, relative to window)
            x: Column position (0-based, relative to window)
            text: Text to write
            attr: Curses attribute (int) or ANSI style code (str)
            
        Returns:
            Number of characters written
        """
        if y < 0 or y >= self._height:
            return 0
        
        if self.win is not None and _curses_available:
            try:
                # Curses mode
                # Truncate text to fit window
                max_len = self._width - x
                if max_len <= 0:
                    return 0
                text = text[:max_len]
                
                # Convert string attr to int if needed
                if isinstance(attr, str):
                    attr = 0
                
                self.win.addstr(y, x, text, attr)
                return len(text)
            except curses.error:
                # Ignore errors (e.g., writing to bottom-right corner)
                return 0
        else:
            # ANSI mode - write to buffer
            written = 0
            
            # Handle attr as either ANSI string or curses int
            if isinstance(attr, str):
                style = attr
            else:
                style = self._attr_to_ansi(attr)
            
            for i, char in enumerate(text):
                col = x + i
                if col >= self._width:
                    break
                if col >= 0:
                    self._buffer[y][col] = char
                    self._styles[y][col] = style
                    written += 1
            
            self._dirty = True
            return written
    
    def write_line(self, y: int, text: str, attr: int = 0, 
                   pad: bool = True) -> None:
        """
        Write a full line, optionally padding to width.
        
        Args:
            y: Row position (0-based)
            text: Text to write
            attr: Curses attribute
            pad: If True, pad with spaces to fill the width
        """
        self.write(y, 0, text, attr)
        
        if pad and len(text) < self._width:
            # Fill remaining space
            padding = ' ' * (self._width - len(text))
            self.write(y, len(text), padding, 0)
    
    def clear(self) -> None:
        """Clear window contents."""
        if self.win is not None and _curses_available:
            self.win.clear()
        else:
            # Clear ANSI buffer
            for row in range(self._height):
                for col in range(self._width):
                    self._buffer[row][col] = ' '
                    self._styles[row][col] = ''
            self._dirty = True
    
    def erase(self) -> None:
        """Erase window contents (same as clear but doesn't touch borders)."""
        if self.win is not None and _curses_available:
            self.win.erase()
        else:
            self.clear()
    
    def refresh(self) -> None:
        """Refresh this window."""
        if self.win is not None and _curses_available:
            self.win.refresh()
        else:
            # ANSI mode - render buffer to terminal
            if self._dirty:
                self._render_ansi()
                self._dirty = False
    
    def _render_ansi(self) -> None:
        """Render buffer to terminal using ANSI codes."""
        output = []
        
        # Cursor should already be hidden by screen.hide_cursor()
        # Don't hide again to avoid flicker
        
        for row in range(self._height):
            # Move to row position (1-based)
            terminal_row = self._y + row + 1
            terminal_col = self._x + 1
            output.append(f'\x1b[{terminal_row};{terminal_col}H')
            
            # Build line content (no clear line - we overwrite with spaces)
            current_style = ''
            for col in range(self._width):
                style = self._styles[row][col]
                char = self._buffer[row][col]
                
                # Handle style change
                if style != current_style:
                    if current_style:
                        output.append('\x1b[0m')
                    if style:
                        output.append(style)
                    current_style = style
                
                output.append(char)
            
            # Reset style at end of line
            if current_style:
                output.append('\x1b[0m')
        
        # Keep cursor hidden - set_cursor() will position and show it
        
        # Flush all output at once
        sys.stderr.write(''.join(output))
        sys.stderr.flush()
    
    # Color pair to ANSI color mapping (Mystic Purple Theme)
    # Maps curses color pair IDs to ANSI bright color codes
    PAIR_TO_ANSI = {
        1: '95',   # PAIR_BORDER -> Bright Magenta
        2: '96',   # PAIR_PROMPT -> Bright Cyan
        3: '92',   # PAIR_SUCCESS -> Bright Green
        4: '93',   # PAIR_WARNING -> Bright Yellow
        5: '91',   # PAIR_ERROR -> Bright Red
        6: '95',   # PAIR_ACCENT -> Bright Magenta
        7: '90',   # PAIR_DIM -> Bright Black (Gray)
        8: '0',    # PAIR_TEXT -> Default
        9: '94',   # PAIR_INFO -> Bright Blue
        10: '95',  # PAIR_TITLE -> Bright Magenta
        11: '96',  # PAIR_SYMBOL -> Bright Cyan
    }
    
    def _attr_to_ansi(self, attr: int) -> str:
        """
        Convert curses attribute to ANSI escape code.
        
        Args:
            attr: Curses attribute (or already an ANSI string)
            
        Returns:
            ANSI escape code string
        """
        if isinstance(attr, str):
            return attr
        
        if not _curses_available or attr == 0:
            return ''
        
        # Extract color pair number
        pair = (attr & curses.A_COLOR) >> 8 if hasattr(curses, 'A_COLOR') else 0
        
        # Build ANSI code based on attributes
        codes = []
        
        if attr & curses.A_BOLD:
            codes.append('1')
        if attr & curses.A_DIM:
            codes.append('2')
        if attr & curses.A_UNDERLINE:
            codes.append('4')
        if attr & curses.A_REVERSE:
            codes.append('7')
        
        # Map color pair to ANSI color code
        if pair > 0 and pair in self.PAIR_TO_ANSI:
            codes.append(self.PAIR_TO_ANSI[pair])
        
        if codes:
            return f'\x1b[{";".join(codes)}m'
        return ''
    
    def resize(self, height: int, width: int) -> None:
        """Resize the window."""
        if self.win is not None and _curses_available:
            try:
                self.win.resize(height, width)
                self._height, self._width = self.win.getmaxyx()
            except curses.error:
                pass
        else:
            # Resize ANSI buffer
            old_buffer = self._buffer
            old_styles = self._styles
            
            self._height = height
            self._width = width
            self._buffer = [[' ' for _ in range(width)] for _ in range(height)]
            self._styles = [['' for _ in range(width)] for _ in range(height)]
            
            # Copy old content
            for row in range(min(len(old_buffer), height)):
                for col in range(min(len(old_buffer[row]), width)):
                    self._buffer[row][col] = old_buffer[row][col]
                    self._styles[row][col] = old_styles[row][col]
            
            self._dirty = True
    
    def move(self, y: int, x: int) -> None:
        """Move window to new position."""
        if self.win is not None and _curses_available:
            try:
                self.win.mvwin(y, x)
                self._y, self._x = self.win.getbegyx()
            except curses.error:
                pass
        else:
            self._y = y
            self._x = x
            self._dirty = True
    
    def set_cursor(self, y: int, x: int) -> None:
        """Position cursor within window and show it."""
        if self.win is not None and _curses_available:
            try:
                self.win.move(y, x)
            except curses.error:
                pass
        else:
            # ANSI mode - move cursor and show it
            terminal_row = self._y + y + 1
            terminal_col = self._x + x + 1
            # Move cursor and show it
            sys.stderr.write(f'\x1b[{terminal_row};{terminal_col}H\x1b[?25h')
            sys.stderr.flush()
    
    def get_cursor(self) -> tuple:
        """Get current cursor position within window."""
        if self.win is not None and _curses_available:
            return self.win.getyx()
        return (0, 0)
    
    def noutrefresh(self) -> None:
        """Mark window for refresh without immediate update."""
        if self.win is not None and _curses_available:
            self.win.noutrefresh()
        else:
            self._dirty = True
    
    def touchwin(self) -> None:
        """Mark entire window as changed."""
        if self.win is not None and _curses_available:
            self.win.touchwin()
        else:
            self._dirty = True
