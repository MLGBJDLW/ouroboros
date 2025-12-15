"""
ScreenManager module.

This module manages curses screen initialization, cleanup,
and resize handling.

Requirements: 1.1-1.5, 24.1-24.5
"""

import sys
import os
import atexit
import signal
from typing import Optional, Tuple, TYPE_CHECKING

if TYPE_CHECKING:
    from .window import Window

# Platform detection
IS_WINDOWS = sys.platform == 'win32'

# Try to import curses
_curses_available = False
try:
    if IS_WINDOWS:
        import curses
        _curses_available = True
    else:
        import curses
        _curses_available = True
except ImportError:
    _curses_available = False


class ScreenManager:
    """
    Manages curses screen initialization, cleanup, and resize handling.
    
    Provides a unified interface for screen operations with automatic
    fallback to ANSI rendering when curses is unavailable.
    
    Usage:
        with ScreenManager() as screen:
            win = screen.create_window(10, 40, 0, 0)
            # ... use window ...
    """
    
    # ANSI escape codes for alternate screen buffer
    ENTER_ALT_SCREEN = '\x1b[?1049h'
    EXIT_ALT_SCREEN = '\x1b[?1049l'
    HIDE_CURSOR = '\x1b[?25l'
    SHOW_CURSOR = '\x1b[?25h'
    
    def __init__(self, use_alt_screen: bool = True):
        """
        Initialize ScreenManager.
        
        Args:
            use_alt_screen: Whether to use alternate screen buffer
        """
        self.stdscr = None
        self.use_curses = _curses_available
        self.use_alt_screen = use_alt_screen
        self.colors_enabled = False
        self._cleanup_registered = False
        self._original_sigwinch = None
        self._resize_pending = False
        self._last_size: Tuple[int, int] = (80, 24)
        self._windows = []
        
    def __enter__(self) -> 'ScreenManager':
        """Initialize curses and enter alternate screen buffer."""
        self._init_screen()
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Cleanup curses and restore terminal state."""
        self._cleanup()
        return False
        
    def _init_screen(self) -> None:
        """Initialize the screen (curses or fallback)."""
        # Register cleanup handler
        if not self._cleanup_registered:
            atexit.register(self._cleanup)
            self._cleanup_registered = True
        
        if self.use_curses:
            try:
                self._init_curses()
            except Exception as e:
                # Fall back to ANSI mode
                self.use_curses = False
                self._init_ansi()
        else:
            self._init_ansi()
    
    def _init_curses(self) -> None:
        """Initialize curses mode."""
        # Initialize curses
        self.stdscr = curses.initscr()
        
        # Enable keypad mode for special keys
        self.stdscr.keypad(True)
        
        # Don't echo input
        curses.noecho()
        
        # React to keys immediately
        curses.cbreak()
        
        # Try to enable colors
        if curses.has_colors():
            curses.start_color()
            curses.use_default_colors()
            self.colors_enabled = True
        
        # Hide cursor initially
        try:
            curses.curs_set(0)
        except curses.error:
            pass  # Some terminals don't support cursor visibility
        
        # Set up resize handling
        if not IS_WINDOWS:
            # Unix: use SIGWINCH
            self._original_sigwinch = signal.signal(
                signal.SIGWINCH, 
                self._handle_sigwinch
            )
        
        # Get initial size
        self._last_size = self.get_size()
    
    def _init_ansi(self) -> None:
        """Initialize ANSI fallback mode."""
        if self.use_alt_screen:
            sys.stderr.write(self.ENTER_ALT_SCREEN)
            sys.stderr.flush()
        
        # Get terminal size
        self._last_size = self._get_terminal_size()
    
    def _cleanup(self) -> None:
        """Restore terminal state."""
        if self.use_curses and self.stdscr is not None:
            try:
                # Restore cursor
                try:
                    curses.curs_set(1)
                except curses.error:
                    pass
                
                # Restore terminal settings
                self.stdscr.keypad(False)
                curses.echo()
                curses.nocbreak()
                curses.endwin()
            except Exception:
                pass  # Best effort cleanup
            finally:
                self.stdscr = None
        else:
            # ANSI cleanup
            if self.use_alt_screen:
                sys.stderr.write(self.EXIT_ALT_SCREEN)
                sys.stderr.write(self.SHOW_CURSOR)
                sys.stderr.flush()
        
        # Restore SIGWINCH handler
        if not IS_WINDOWS and self._original_sigwinch is not None:
            try:
                signal.signal(signal.SIGWINCH, self._original_sigwinch)
            except Exception:
                pass
    
    def _handle_sigwinch(self, signum, frame) -> None:
        """Handle SIGWINCH (window resize) signal on Unix."""
        self._resize_pending = True
        if self.use_curses and self.stdscr is not None:
            curses.ungetch(curses.KEY_RESIZE)
    
    def _get_terminal_size(self) -> Tuple[int, int]:
        """Get terminal size (cols, rows)."""
        try:
            size = os.get_terminal_size()
            return (size.columns, size.lines)
        except OSError:
            return (80, 24)  # Default fallback
    
    def refresh(self) -> None:
        """Refresh the screen (flush buffer to terminal)."""
        if self.use_curses and self.stdscr is not None:
            self.stdscr.refresh()
        else:
            sys.stderr.flush()
    
    def resize(self) -> Tuple[int, int]:
        """
        Handle resize event, return new (cols, rows).
        
        Should be called when resize is detected (KEY_RESIZE in curses,
        or polling on Windows).
        """
        self._resize_pending = False
        
        if self.use_curses and self.stdscr is not None:
            # Update curses internal state
            curses.update_lines_cols()
            self._last_size = (curses.COLS, curses.LINES)
        else:
            self._last_size = self._get_terminal_size()
        
        return self._last_size
    
    def get_size(self) -> Tuple[int, int]:
        """Get current terminal size (cols, rows)."""
        if self.use_curses and self.stdscr is not None:
            return (curses.COLS, curses.LINES)
        return self._get_terminal_size()
    
    def check_resize(self) -> bool:
        """
        Check if resize occurred (for polling on Windows).
        
        Returns:
            True if resize detected, False otherwise
        """
        if self._resize_pending:
            return True
        
        current_size = self._get_terminal_size()
        if current_size != self._last_size:
            self._resize_pending = True
            return True
        
        return False
    
    def create_window(self, height: int, width: int, 
                      y: int, x: int) -> 'Window':
        """
        Create a new window at specified position.
        
        Args:
            height: Window height in rows
            width: Window width in columns
            y: Top-left row position
            x: Top-left column position
            
        Returns:
            Window wrapper object
        """
        from .window import Window
        
        if self.use_curses and self.stdscr is not None:
            try:
                curses_win = curses.newwin(height, width, y, x)
                win = Window(curses_win, self)
            except curses.error:
                # Fall back to pad if window doesn't fit
                win = Window(None, self, height=height, width=width, y=y, x=x)
        else:
            win = Window(None, self, height=height, width=width, y=y, x=x)
        
        self._windows.append(win)
        return win
    
    def clear(self) -> None:
        """Clear the entire screen."""
        if self.use_curses and self.stdscr is not None:
            self.stdscr.clear()
        else:
            # ANSI clear screen
            sys.stderr.write('\x1b[2J\x1b[H')
            sys.stderr.flush()
    
    def show_cursor(self) -> None:
        """Show the cursor."""
        if self.use_curses:
            try:
                curses.curs_set(1)
            except curses.error:
                pass
        else:
            sys.stderr.write(self.SHOW_CURSOR)
            sys.stderr.flush()
    
    def hide_cursor(self) -> None:
        """Hide the cursor."""
        if self.use_curses:
            try:
                curses.curs_set(0)
            except curses.error:
                pass
        else:
            sys.stderr.write(self.HIDE_CURSOR)
            sys.stderr.flush()
    
    def move_cursor(self, y: int, x: int) -> None:
        """Move cursor to specified position."""
        if self.use_curses and self.stdscr is not None:
            try:
                self.stdscr.move(y, x)
            except curses.error:
                pass
        else:
            # ANSI move cursor (1-based)
            sys.stderr.write(f'\x1b[{y + 1};{x + 1}H')
            sys.stderr.flush()
    
    def getch(self, timeout: Optional[int] = None) -> int:
        """
        Read a single character/key.
        
        Args:
            timeout: Timeout in milliseconds (None for blocking)
            
        Returns:
            Key code or -1 on timeout
        """
        if self.use_curses and self.stdscr is not None:
            if timeout is not None:
                self.stdscr.timeout(timeout)
            else:
                self.stdscr.timeout(-1)  # Blocking
            
            try:
                return self.stdscr.getch()
            except curses.error:
                return -1
        else:
            # Fallback - this should use KeyBuffer instead
            return -1
    
    @property
    def is_curses(self) -> bool:
        """Check if using curses mode."""
        return self.use_curses and self.stdscr is not None


# Module-level function for checking curses availability
def curses_available() -> bool:
    """Check if curses is available on this platform."""
    return _curses_available
