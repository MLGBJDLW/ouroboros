"""
ANSI fallback renderer module.

This module provides ANSI-based rendering when curses is unavailable.
It implements the same interface as the curses components for seamless
fallback.


"""

import sys
import os
import atexit
from typing import List, Tuple, Optional, Dict


class ANSI:
    """ANSI escape code helpers."""
    
    # Cursor movement
    @staticmethod
    def move_to(row: int, col: int) -> str:
        """Move cursor to absolute position (1-based)."""
        return f"\x1b[{row};{col}H"
    
    @staticmethod
    def move_up(n: int = 1) -> str:
        return f"\x1b[{n}A" if n > 0 else ""
    
    @staticmethod
    def move_down(n: int = 1) -> str:
        return f"\x1b[{n}B" if n > 0 else ""
    
    @staticmethod
    def move_to_column(col: int) -> str:
        """Move cursor to column (1-based)."""
        return f"\x1b[{col}G"
    
    # Line operations
    CLEAR_LINE = "\x1b[2K"
    CLEAR_TO_END = "\x1b[0K"
    INSERT_LINE = "\x1b[L"
    DELETE_LINE = "\x1b[M"
    
    # Screen operations
    CLEAR_SCREEN = "\x1b[2J"
    CLEAR_BELOW = "\x1b[J"
    
    # Cursor visibility
    HIDE_CURSOR = "\x1b[?25l"
    SHOW_CURSOR = "\x1b[?25h"
    
    # Save/restore cursor
    SAVE_CURSOR = "\x1b[s"
    RESTORE_CURSOR = "\x1b[u"
    
    # Alternate screen buffer
    ENTER_ALT_SCREEN = "\x1b[?1049h"
    EXIT_ALT_SCREEN = "\x1b[?1049l"
    
    # Reset
    RESET = "\x1b[0m"


class Cell:
    """A single cell in the screen buffer."""
    
    __slots__ = ('char', 'style')
    
    def __init__(self, char: str = ' ', style: str = ''):
        self.char = char
        self.style = style
    
    def __eq__(self, other):
        if not isinstance(other, Cell):
            return False
        return self.char == other.char and self.style == other.style
    
    def __repr__(self):
        return f"Cell({self.char!r}, {self.style!r})"


class FallbackScreenBuffer:
    """
    Double-buffered screen for flicker-free ANSI rendering.
    
    This class provides the same functionality as curses but using
    ANSI escape codes. It maintains a virtual buffer and only updates
    changed portions of the screen.
    """
    
    def __init__(self, width: int, height: int, 
                 output_stream=None, start_row: int = 1):
        """
        Initialize screen buffer.
        
        Args:
            width: Screen width in columns
            height: Screen height in rows
            output_stream: Output stream (default: stderr)
            start_row: Starting row position in terminal (1-based)
        """
        self.width = width
        self.height = height
        self.output = output_stream or sys.stderr
        self.start_row = start_row
        
        # Double buffer: current and previous frame
        self._current: List[List[Cell]] = self._create_empty_buffer()
        self._previous: List[List[Cell]] = self._create_empty_buffer()
        
        # Dirty tracking
        self._dirty_rows: set = set(range(height))
        self._full_redraw: bool = True
        
        # Cursor position
        self._cursor_row: int = 0
        self._cursor_col: int = 0
        self._cursor_visible: bool = True
    
    def _create_empty_buffer(self) -> List[List[Cell]]:
        """Create an empty buffer filled with spaces."""
        return [[Cell() for _ in range(self.width)] for _ in range(self.height)]
    
    def clear(self) -> None:
        """Clear the buffer (fill with spaces)."""
        for row in range(self.height):
            for col in range(self.width):
                self._current[row][col] = Cell()
            self._dirty_rows.add(row)
    
    def resize(self, new_width: int, new_height: int) -> None:
        """Resize the buffer, preserving content where possible."""
        old_height = self.height
        
        # Create new buffers
        new_current = [[Cell() for _ in range(new_width)] for _ in range(new_height)]
        new_previous = [[Cell() for _ in range(new_width)] for _ in range(new_height)]
        
        # Copy existing content
        for row in range(min(old_height, new_height)):
            for col in range(min(self.width, new_width)):
                new_current[row][col] = self._current[row][col]
        
        self._current = new_current
        self._previous = new_previous
        self.width = new_width
        self.height = new_height
        
        # Mark all rows as dirty after resize
        self._dirty_rows = set(range(new_height))
        self._full_redraw = True
    
    def write(self, row: int, col: int, text: str, style: str = '') -> int:
        """
        Write text to buffer at specified position.
        
        Args:
            row: Row index (0-based)
            col: Column index (0-based)
            text: Text to write
            style: ANSI style prefix
        
        Returns:
            Number of characters written
        """
        if row < 0 or row >= self.height:
            return 0
        
        written = 0
        current_col = col
        
        for char in text:
            if current_col >= self.width:
                break
            if current_col >= 0:
                new_cell = Cell(char, style)
                if self._current[row][current_col] != new_cell:
                    self._current[row][current_col] = new_cell
                    self._dirty_rows.add(row)
                written += 1
            current_col += 1
        
        return written
    
    def write_line(self, row: int, text: str, style: str = '', 
                   fill: bool = True) -> None:
        """Write a full line, optionally filling to width."""
        self.write(row, 0, text, style)
        
        if fill:
            text_len = len(text)
            if text_len < self.width:
                for col in range(text_len, self.width):
                    new_cell = Cell(' ', '')
                    if self._current[row][col] != new_cell:
                        self._current[row][col] = new_cell
                        self._dirty_rows.add(row)
    
    def render(self) -> None:
        """Render the buffer to the terminal."""
        if not self._dirty_rows and not self._full_redraw:
            return
        
        output_parts = []
        
        # Hide cursor during render
        output_parts.append(ANSI.HIDE_CURSOR)
        
        # Determine which rows to render
        rows_to_render = sorted(self._dirty_rows) if not self._full_redraw else range(self.height)
        
        for row in rows_to_render:
            # Move to row position
            terminal_row = self.start_row + row
            output_parts.append(ANSI.move_to(terminal_row, 1))
            
            # Build line content
            line_parts = []
            current_style = ''
            
            for col in range(self.width):
                cell = self._current[row][col]
                
                # Handle style change
                if cell.style != current_style:
                    if current_style:
                        line_parts.append(ANSI.RESET)
                    if cell.style:
                        line_parts.append(cell.style)
                    current_style = cell.style
                
                line_parts.append(cell.char)
            
            # Reset style at end of line
            if current_style:
                line_parts.append(ANSI.RESET)
            
            output_parts.append(''.join(line_parts))
            
            # Copy current to previous
            for col in range(self.width):
                self._previous[row][col] = Cell(
                    self._current[row][col].char,
                    self._current[row][col].style
                )
        
        # Move cursor to correct position and show it
        cursor_terminal_row = self.start_row + self._cursor_row
        cursor_terminal_col = self._cursor_col + 1  # 1-based
        output_parts.append(ANSI.move_to(cursor_terminal_row, cursor_terminal_col))
        
        if self._cursor_visible:
            output_parts.append(ANSI.SHOW_CURSOR)
        
        # Flush all output at once
        self.output.write(''.join(output_parts))
        self.output.flush()
        
        # Clear dirty tracking
        self._dirty_rows.clear()
        self._full_redraw = False
    
    def set_cursor(self, row: int, col: int) -> None:
        """Set cursor position (0-based)."""
        self._cursor_row = max(0, min(row, self.height - 1))
        self._cursor_col = max(0, min(col, self.width - 1))
    
    def show_cursor(self) -> None:
        """Show the cursor."""
        self._cursor_visible = True
        self.output.write(ANSI.SHOW_CURSOR)
        self.output.flush()
    
    def hide_cursor(self) -> None:
        """Hide the cursor."""
        self._cursor_visible = False
        self.output.write(ANSI.HIDE_CURSOR)
        self.output.flush()
    
    def force_full_redraw(self) -> None:
        """Force a complete redraw on next render."""
        self._full_redraw = True
        self._dirty_rows = set(range(self.height))


class FallbackScreen:
    """
    ANSI-based screen manager that mimics curses interface.
    
    This class provides the same interface as ScreenManager but uses
    ANSI escape codes instead of curses.
    """
    
    def __init__(self, use_alt_screen: bool = True):
        """
        Initialize fallback screen.
        
        Args:
            use_alt_screen: Whether to use alternate screen buffer
        """
        self.use_alt_screen = use_alt_screen
        self.colors_enabled = True  # ANSI colors always available
        self._cleanup_registered = False
        self._last_size: Tuple[int, int] = (80, 24)
        self._buffer: Optional[FallbackScreenBuffer] = None
    
    def __enter__(self) -> 'FallbackScreen':
        """Enter context and initialize screen."""
        self._init_screen()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Exit context and cleanup."""
        self._cleanup()
        return False
    
    def _init_screen(self) -> None:
        """Initialize the screen."""
        # Register cleanup handler
        if not self._cleanup_registered:
            atexit.register(self._cleanup)
            self._cleanup_registered = True
        
        # Enter alternate screen if requested
        if self.use_alt_screen:
            sys.stderr.write(ANSI.ENTER_ALT_SCREEN)
            sys.stderr.flush()
        
        # Get terminal size
        self._last_size = self._get_terminal_size()
        
        # Create screen buffer
        cols, rows = self._last_size
        self._buffer = FallbackScreenBuffer(cols, rows)
    
    def _cleanup(self) -> None:
        """Restore terminal state."""
        try:
            # Show cursor
            sys.stderr.write(ANSI.SHOW_CURSOR)
            
            # Exit alternate screen
            if self.use_alt_screen:
                sys.stderr.write(ANSI.EXIT_ALT_SCREEN)
            
            # Reset colors
            sys.stderr.write(ANSI.RESET)
            sys.stderr.flush()
        except Exception:
            pass  # Best effort cleanup
    
    def _get_terminal_size(self) -> Tuple[int, int]:
        """Get terminal size (cols, rows)."""
        try:
            size = os.get_terminal_size()
            return (size.columns, size.lines)
        except OSError:
            return (80, 24)
    
    def refresh(self) -> None:
        """Refresh the screen."""
        if self._buffer:
            self._buffer.render()
    
    def resize(self) -> Tuple[int, int]:
        """Handle resize event."""
        self._last_size = self._get_terminal_size()
        if self._buffer:
            cols, rows = self._last_size
            self._buffer.resize(cols, rows)
        return self._last_size
    
    def get_size(self) -> Tuple[int, int]:
        """Get current terminal size (cols, rows)."""
        return self._get_terminal_size()
    
    def check_resize(self) -> bool:
        """Check if resize occurred."""
        current_size = self._get_terminal_size()
        if current_size != self._last_size:
            return True
        return False
    
    def clear(self) -> None:
        """Clear the screen."""
        sys.stderr.write(ANSI.CLEAR_SCREEN + ANSI.move_to(1, 1))
        sys.stderr.flush()
        if self._buffer:
            self._buffer.clear()
    
    def show_cursor(self) -> None:
        """Show the cursor."""
        sys.stderr.write(ANSI.SHOW_CURSOR)
        sys.stderr.flush()
    
    def hide_cursor(self) -> None:
        """Hide the cursor."""
        sys.stderr.write(ANSI.HIDE_CURSOR)
        sys.stderr.flush()
    
    def move_cursor(self, y: int, x: int) -> None:
        """Move cursor to specified position."""
        sys.stderr.write(ANSI.move_to(y + 1, x + 1))
        sys.stderr.flush()
    
    @property
    def is_curses(self) -> bool:
        """Check if using curses mode (always False for fallback)."""
        return False


class FallbackWindow:
    """
    ANSI-based window that mimics curses window interface.
    
    This class provides the same interface as Window but uses
    ANSI escape codes instead of curses.
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
    
    def __init__(self, height: int, width: int, y: int, x: int,
                 parent: Optional['FallbackScreen'] = None):
        """
        Initialize fallback window.
        
        Args:
            height: Window height
            width: Window width
            y: Top-left row position
            x: Top-left column position
            parent: Parent screen
        """
        self._height = height
        self._width = width
        self._y = y
        self._x = x
        self.parent = parent
        
        # Buffer for window content
        self._buffer = [[' ' for _ in range(width)] for _ in range(height)]
        self._styles = [['' for _ in range(width)] for _ in range(height)]
        self._dirty = True
    
    @property
    def height(self) -> int:
        return self._height
    
    @property
    def width(self) -> int:
        return self._width
    
    @property
    def y(self) -> int:
        return self._y
    
    @property
    def x(self) -> int:
        return self._x
    
    def draw_box(self, style: str = 'rounded', attr: str = '') -> None:
        """Draw border with specified style."""
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
    
    def write(self, y: int, x: int, text: str, attr: str = '') -> int:
        """Write text at position."""
        if y < 0 or y >= self._height:
            return 0
        
        written = 0
        for i, char in enumerate(text):
            col = x + i
            if col >= self._width:
                break
            if col >= 0:
                self._buffer[y][col] = char
                self._styles[y][col] = attr
                written += 1
        
        self._dirty = True
        return written
    
    def write_line(self, y: int, text: str, attr: str = '', 
                   pad: bool = True) -> None:
        """Write a full line."""
        self.write(y, 0, text, attr)
        
        if pad and len(text) < self._width:
            padding = ' ' * (self._width - len(text))
            self.write(y, len(text), padding, '')
    
    def clear(self) -> None:
        """Clear window contents."""
        for row in range(self._height):
            for col in range(self._width):
                self._buffer[row][col] = ' '
                self._styles[row][col] = ''
        self._dirty = True
    
    def refresh(self) -> None:
        """Refresh this window."""
        if not self._dirty:
            return
        
        output = []
        output.append(ANSI.HIDE_CURSOR)
        
        for row in range(self._height):
            terminal_row = self._y + row + 1
            terminal_col = self._x + 1
            output.append(ANSI.move_to(terminal_row, terminal_col))
            
            current_style = ''
            for col in range(self._width):
                style = self._styles[row][col]
                char = self._buffer[row][col]
                
                if style != current_style:
                    if current_style:
                        output.append(ANSI.RESET)
                    if style:
                        output.append(style)
                    current_style = style
                
                output.append(char)
            
            if current_style:
                output.append(ANSI.RESET)
        
        output.append(ANSI.SHOW_CURSOR)
        
        sys.stderr.write(''.join(output))
        sys.stderr.flush()
        self._dirty = False
    
    def resize(self, height: int, width: int) -> None:
        """Resize the window."""
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
        self._y = y
        self._x = x
        self._dirty = True
    
    def set_cursor(self, y: int, x: int) -> None:
        """Position cursor within window."""
        terminal_row = self._y + y + 1
        terminal_col = self._x + x + 1
        sys.stderr.write(ANSI.move_to(terminal_row, terminal_col))
        sys.stderr.flush()


# Export all classes
__all__ = [
    'ANSI',
    'Cell',
    'FallbackScreenBuffer',
    'FallbackScreen',
    'FallbackWindow',
]
