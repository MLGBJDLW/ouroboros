"""
Main TUI application loop module.

This module provides the main application loop with component
orchestration, input handling, and mode switching.

Requirements: 1.1-1.5, 4.1-4.10, 19.1-19.5, 21.1-21.5, 31.1-31.5, 20.7-20.8, 30.1-30.3
"""

import sys
import time
import atexit
from typing import Optional, Tuple

# Use absolute imports for compatibility when scripts dir is in sys.path
# Requirements: 17.1-17.4 (lazy loading for fast startup)
from tui.screen import ScreenManager
from tui.theme import ThemeManager
from data.config import get_config


# Keys constants - defined here to avoid import overhead
# These match the values in input/keybuffer.py
class Keys:
    """Key constants for keyboard handling."""
    CTRL_C = '\x03'
    CTRL_D = '\x04'
    CTRL_J = '\x0a'
    CTRL_K = '\x0b'
    CTRL_R = '\x12'
    CTRL_U = '\x15'
    CTRL_V = '\x16'
    ENTER = '\r'
    NEWLINE = '\n'
    TAB = '\t'
    ESCAPE = '\x1b'
    UP = '\x1b[A'
    DOWN = '\x1b[B'
    LEFT = '\x1b[C'
    RIGHT = '\x1b[D'
    HOME = '\x1b[H'
    HOME_ALT = '\x1b[1~'
    END = '\x1b[F'
    END_ALT = '\x1b[4~'
    PAGE_UP = '\x1b[5~'
    PAGE_DOWN = '\x1b[6~'
    CTRL_LEFT = '\x1b[1;5D'
    CTRL_RIGHT = '\x1b[1;5C'

# Lazy imports for non-critical components
_InputBox = None
_WelcomeBox = None
_KeyBuffer = None
_Keys = None
_PasteDetector = None
_read_clipboard = None
_SlashCommandHandler = None
_prepend_instruction = None
_HistoryManager = None
_create_file_marker = None
_create_paste_marker = None
_is_file_path = None
_is_windows_path_pattern = None


def _lazy_import_components():
    """Lazy import components for fast startup."""
    global _InputBox, _WelcomeBox
    if _InputBox is None:
        from components.input_box import InputBox as IB
        from components.welcome_box import WelcomeBox as WB
        _InputBox = IB
        _WelcomeBox = WB
    return _InputBox, _WelcomeBox


def _lazy_import_input():
    """Lazy import input handlers for fast startup."""
    global _KeyBuffer, _Keys, _PasteDetector, _read_clipboard, _SlashCommandHandler, _prepend_instruction
    if _KeyBuffer is None:
        try:
            from input.keybuffer import KeyBuffer as KB, Keys as K
            from input.paste import PasteDetector as PD
            from input.clipboard import read_clipboard as rc
            from input.commands import SlashCommandHandler as SCH, prepend_instruction as pi
        except ImportError:
            from ..input.keybuffer import KeyBuffer as KB, Keys as K
            from ..input.paste import PasteDetector as PD
            from ..input.clipboard import read_clipboard as rc
            from ..input.commands import SlashCommandHandler as SCH, prepend_instruction as pi
        _KeyBuffer = KB
        _Keys = K
        _PasteDetector = PD
        _read_clipboard = rc
        _SlashCommandHandler = SCH
        _prepend_instruction = pi
    return _KeyBuffer, _Keys, _PasteDetector, _read_clipboard, _SlashCommandHandler, _prepend_instruction


def _lazy_import_data():
    """Lazy import data handlers for fast startup."""
    global _HistoryManager
    if _HistoryManager is None:
        try:
            from data.history import HistoryManager as HM
        except ImportError:
            from ..data.history import HistoryManager as HM
        _HistoryManager = HM
    return _HistoryManager


def _lazy_import_utils():
    """Lazy import utilities for fast startup."""
    global _create_file_marker, _create_paste_marker, _is_file_path, _is_windows_path_pattern
    if _create_file_marker is None:
        try:
            from utils.badge import create_file_marker as cfm, create_paste_marker as cpm
            from utils.filepath import is_file_path as ifp, is_windows_path_pattern as iwpp
        except ImportError:
            from ..utils.badge import create_file_marker as cfm, create_paste_marker as cpm
            from ..utils.filepath import is_file_path as ifp, is_windows_path_pattern as iwpp
        _create_file_marker = cfm
        _create_paste_marker = cpm
        _is_file_path = ifp
        _is_windows_path_pattern = iwpp
    return _create_file_marker, _create_paste_marker, _is_file_path, _is_windows_path_pattern


# Mode constants
MODE_INPUT = 'INPUT'
MODE_PASTE = 'PASTE'

# Minimum terminal size (Requirements: 20.1)
MIN_TERMINAL_COLS = 20
MIN_TERMINAL_ROWS = 5
MODE_HISTORY = 'HISTORY'
MODE_SEARCH = 'SEARCH'

# Paste detection thresholds
PASTE_LINE_THRESHOLD = 5
PASTE_CHAR_THRESHOLD = 100

# Resize debounce time (ms)
RESIZE_DEBOUNCE_MS = 100

# Exit code for Ctrl+C
EXIT_CODE_CANCELLED = 130

# Theme colors for animation
THEME = {
    'border': '\033[95m',
    'accent': '\033[95m\033[1m',
    'dim': '\033[2m',
    'reset': '\033[0m',
}


def show_goodbye_animation() -> None:
    """
    Display goodbye animation on Ctrl+C.
    
    Requirements: 30.1-30.3
    """
    goodbye_frames = [
        f"{THEME['dim']}♾️  Goodbye...{THEME['reset']}",
        f"{THEME['accent']}♾️  See you soon~{THEME['reset']}",
        f"{THEME['border']}🐍 The serpent rests...{THEME['reset']}",
    ]
    for frame in goodbye_frames:
        sys.stderr.write(f"\r{' ' * 40}\r{frame}")
        sys.stderr.flush()
        time.sleep(0.15)
    sys.stderr.write("\n")
    sys.stderr.flush()


class TUIApp:
    """
    Main TUI application with component orchestration.
    
    Features:
    - Main input loop with KeyBuffer
    - Component orchestration (WelcomeBox, InputBox)
    - Resize handling with debounce
    - Mode switching (INPUT, PASTE, HISTORY, SEARCH)
    - Slash command dropdown integration
    - History navigation (Up/Down on first line)
    - Ctrl+R reverse history search mode
    - Badge processing on paste
    - Path collection mode for Windows drag-drop
    
    Requirements: 1.1-1.5, 4.1-4.10, 19.1-19.5, 21.1-21.5, 31.1-31.5
    """
    
    def __init__(self, 
                 header: str = '',
                 prompt: str = '',
                 skip_welcome: bool = False,
                 show_line_numbers: bool = True):
        """
        Initialize TUI application.
        
        Args:
            header: Custom header text for WelcomeBox
            prompt: Custom prompt text for InputBox
            skip_welcome: Skip WelcomeBox display
            show_line_numbers: Show line numbers in InputBox
        """
        self.header = header
        self.prompt = prompt
        self.skip_welcome = skip_welcome
        self.show_line_numbers = show_line_numbers
        
        # Components (initialized in run())
        self.screen: Optional[ScreenManager] = None
        self.theme: Optional[ThemeManager] = None
        self.welcome_box: Optional[WelcomeBox] = None
        self.input_box: Optional[InputBox] = None
        self.keybuffer: Optional[KeyBuffer] = None
        self.paste_detector: Optional[PasteDetector] = None
        self.slash_handler: Optional[SlashCommandHandler] = None
        self.history: Optional[HistoryManager] = None
        
        # State
        self._mode = MODE_INPUT
        self._running = False
        self._result: Optional[str] = None
        self._last_resize_time = 0
        self._search_query = ''
        self._search_results = []
        self._search_index = 0
        
        # Windows path collection state
        self._collecting_path = False
        self._path_buffer = ''
        self._path_collect_start = 0
    
    @property
    def mode(self) -> str:
        """Get current mode."""
        return self._mode
    
    @mode.setter
    def mode(self, value: str) -> None:
        """Set current mode and update UI."""
        self._mode = value
        if self.input_box:
            self.input_box.mode = value
    
    def run(self) -> Optional[str]:
        """
        Run the TUI application.
        
        Returns:
            The submitted text content, or None if cancelled
            
        Requirements: 20.7-20.8, 30.1-30.3
        """
        try:
            with ScreenManager(use_alt_screen=not self.skip_welcome) as screen:
                self.screen = screen
                self._init_components()
                self._running = True
                
                # Initial render with full redraw
                self._render(full_redraw=True)
                
                # Main input loop
                self._main_loop()
                
        except KeyboardInterrupt:
            self._result = None
            self._handle_ctrl_c()
        finally:
            self._cleanup_components()
            self._running = False
        
        return self._result
    
    def _handle_ctrl_c(self) -> None:
        """
        Handle Ctrl+C with graceful exit animation.
        
        Requirements: 20.7-20.8, 30.1-30.3
        """
        show_goodbye_animation()
        sys.exit(EXIT_CODE_CANCELLED)
    
    def _init_components(self) -> None:
        """Initialize all UI components using lazy imports."""
        global _read_clipboard
        
        # Load configuration from ouroboros.config.json
        self.config = get_config()
        
        # Lazy import components
        InputBox, WelcomeBox = _lazy_import_components()
        KeyBuffer, _, PasteDetector, read_clipboard, SlashCommandHandler, _ = _lazy_import_input()
        HistoryManager = _lazy_import_data()
        
        # Store read_clipboard reference for use in handlers
        _read_clipboard = read_clipboard
        
        # Theme - respects config.ansi_colors setting
        self.theme = ThemeManager(self.screen)
        if self.screen.is_curses and self.config.ansi_colors:
            self.theme.init_colors()
        
        # Welcome box
        if not self.skip_welcome:
            self.welcome_box = WelcomeBox(
                self.screen, 
                self.theme,
                custom_header=self.header
            )
        
        # Input box
        self.input_box = InputBox(
            self.screen,
            self.theme,
            show_line_numbers=self.show_line_numbers,
            prompt_header=self.prompt
        )
        
        # Set default status bar hint
        self.input_box.status_bar.set_hint('Ctrl+D: submit')
        
        # Input handlers
        self.keybuffer = KeyBuffer()
        self.keybuffer.__enter__()
        
        self.paste_detector = PasteDetector()
        self.paste_detector.enable()
        
        # Slash command handler
        self.slash_handler = SlashCommandHandler()
        
        # History
        self.history = HistoryManager()
    
    def _cleanup_components(self) -> None:
        """Cleanup components on exit."""
        if self.keybuffer:
            self.keybuffer.__exit__(None, None, None)
        if self.paste_detector:
            self.paste_detector.disable()
    
    def _render(self, full_redraw: bool = False) -> None:
        """
        Render all components.
        
        Args:
            full_redraw: If True, clear screen before rendering (only on init/resize)
        
        Requirements: 20.1 - Terminal too small handling
        """
        if not self.screen:
            return
        
        cols, rows = self.screen.get_size()
        
        # Check minimum size (Requirements: 20.1)
        # Minimum: 20 columns x 5 rows for basic functionality
        if cols < MIN_TERMINAL_COLS or rows < MIN_TERMINAL_ROWS:
            self._render_too_small_message(cols, rows)
            return
        
        # Hide cursor at start of render to prevent flickering
        self.screen.hide_cursor()
        
        # Only clear screen on initial render or resize to prevent flickering
        if full_redraw:
            self.screen.clear()
        
        y = 0
        
        # Render welcome box
        if self.welcome_box and not self.skip_welcome:
            y += self.welcome_box.render(y, cols)
            y += 1  # Gap
        
        # Store input box start position
        self._input_box_y = y
        
        # Render input box (this also positions cursor)
        if self.input_box:
            self.input_box.render(y, cols)
        
        # Render slash command dropdown if active
        if self.slash_handler and self.slash_handler.active:
            self._render_slash_dropdown(y)
            # Re-position cursor after dropdown render
            if self.input_box:
                self.input_box._position_cursor()
    
    def _render_too_small_message(self, cols: int, rows: int) -> None:
        """
        Render "terminal too small" message.
        
        Requirements: 20.1 - Display minimal "resize needed" message
        when terminal is resized to very small dimensions (less than 20x5).
        """
        self.screen.clear()
        
        # Center the message as best we can
        message = "Resize"
        if cols >= len(message):
            x = max(0, (cols - len(message)) // 2)
            y = max(0, rows // 2)
            self.screen.move_cursor(y, x)
            sys.stderr.write(message)
        else:
            # Terminal is extremely small, just write what we can
            self.screen.move_cursor(0, 0)
            sys.stderr.write(message[:cols])
        
        sys.stderr.flush()
    
    def _render_slash_dropdown(self, input_y: int) -> None:
        """Render slash command dropdown below input box."""
        if not self.slash_handler or not self.slash_handler.matches:
            return
        
        cols, rows = self.screen.get_size()
        
        # Calculate dropdown position
        dropdown_y = input_y + (self.input_box.height if self.input_box else 1) + 2
        dropdown_width = min(60, cols - 4)
        dropdown_x = 2
        
        # Get dropdown items
        items = self.slash_handler.get_dropdown_items()
        max_visible = min(len(items), rows - dropdown_y - 1)
        
        if max_visible <= 0:
            return
        
        # Create dropdown window
        dropdown_win = self.screen.create_window(
            max_visible + 2, dropdown_width, dropdown_y, dropdown_x
        )
        
        # Draw border
        border_attr = self.theme.get_attr('border') if self.theme else 0
        dropdown_win.draw_box('rounded', border_attr)
        
        # Draw items
        for i, (cmd, desc) in enumerate(items[:max_visible]):
            if i == self.slash_handler.selected_index:
                attr = self.theme.get_attr('accent') if self.theme else 0
                marker = '>'
            else:
                attr = 0
                marker = ' '
            
            line = f"{marker} {cmd:<20} — {desc}"
            dropdown_win.write(i + 1, 1, line[:dropdown_width - 2], attr)
        
        dropdown_win.refresh()
    
    def _main_loop(self) -> None:
        """Main input processing loop."""
        while self._running:
            # Check for resize
            if self.screen and self.screen.check_resize():
                self._handle_resize()
            
            # Read input
            key, is_paste = self.paste_detector.read(
                self.keybuffer.getch,
                timeout=0.1
            )
            
            if not key:
                continue
            
            # Handle paste content
            if is_paste:
                self._handle_paste(key)
                continue
            
            # Handle key based on current mode
            if self._mode == MODE_SEARCH:
                if self._handle_search_key(key):
                    continue
            
            # Handle special keys
            if self._handle_special_key(key):
                continue
            
            # Handle navigation keys
            if self._handle_navigation_key(key):
                continue
            
            # Handle printable characters
            if self.keybuffer.is_printable(key):
                self._handle_printable(key)
    
    def _handle_special_key(self, key: str) -> bool:
        """
        Handle special keys (Ctrl combinations, etc.).
        
        Returns True if key was handled.
        
        Requirements: 20.7-20.8, 30.1-30.3
        """
        # Ctrl+C - Cancel with graceful exit
        if key == Keys.CTRL_C:
            self._result = None
            self._running = False
            self._handle_ctrl_c()
            return True
        
        # Ctrl+D - Submit
        if key == Keys.CTRL_D:
            self._submit()
            return True
        
        # Ctrl+U - Clear line
        if key == Keys.CTRL_U:
            if self.input_box:
                self.input_box.buffer.clear_line()
                self._render()
            return True
        
        # Ctrl+K - Delete to end of line
        if key == Keys.CTRL_K:
            if self.input_box:
                line = self.input_box.buffer.lines[self.input_box.buffer.cursor_row]
                col = self.input_box.buffer.cursor_col
                self.input_box.buffer.lines[self.input_box.buffer.cursor_row] = line[:col]
                self._render()
            return True
        
        # Ctrl+R - Reverse search
        if key == Keys.CTRL_R:
            self._start_search()
            return True
        
        # Ctrl+V - Paste from clipboard
        if key == Keys.CTRL_V:
            content = _read_clipboard() if _read_clipboard else None
            if content:
                self._handle_paste(content)
            return True
        
        # Enter - New line or submit
        if key in (Keys.ENTER, Keys.NEWLINE, '\r', '\n'):
            self._handle_enter()
            return True
        
        # Tab - Slash command completion
        if key == Keys.TAB:
            if self.slash_handler and self.slash_handler.active:
                completed = self.slash_handler.tab_complete()
                if self.input_box:
                    self.input_box.buffer.clear()
                    self.input_box.buffer.insert_text(completed)
                    self._render()
            return True
        
        # Escape - Cancel slash command or search
        if key == Keys.ESCAPE:
            if self.slash_handler and self.slash_handler.active:
                self.slash_handler.cancel()
                self._render()
                return True
            if self._mode == MODE_SEARCH:
                self._cancel_search()
                return True
        
        # Backspace
        if self.keybuffer.is_backspace(key):
            self._handle_backspace()
            return True
        
        # Delete
        if self.keybuffer.is_delete(key):
            if self.input_box:
                self.input_box.buffer.delete()
                self._render()
            return True
        
        return False
    
    def _handle_navigation_key(self, key: str) -> bool:
        """
        Handle navigation keys (arrows, home, end).
        
        Returns True if key was handled.
        """
        if not self.input_box:
            return False
        
        # Up arrow
        if key == Keys.UP:
            # In slash command mode, navigate dropdown
            if self.slash_handler and self.slash_handler.active:
                self.slash_handler.move_up()
                self._render()
                return True
            
            # On first line, navigate history
            if self.input_box.buffer.cursor_row == 0:
                self._history_back()
                return True
            
            # Otherwise, move cursor up
            self.input_box.buffer.move_up()
            self._render()
            return True
        
        # Down arrow
        if key == Keys.DOWN:
            # In slash command mode, navigate dropdown
            if self.slash_handler and self.slash_handler.active:
                self.slash_handler.move_down()
                self._render()
                return True
            
            # At last line and in history mode, navigate forward
            if (self.input_box.buffer.cursor_row == self.input_box.buffer.line_count - 1 
                and self._mode == MODE_HISTORY):
                self._history_forward()
                return True
            
            # Otherwise, move cursor down
            self.input_box.buffer.move_down()
            self._render()
            return True
        
        # Left arrow
        if key == Keys.LEFT:
            self.input_box.move_left()
            self._render()
            return True
        
        # Right arrow
        if key == Keys.RIGHT:
            self.input_box.move_right()
            self._render()
            return True
        
        # Ctrl+Left - Word left
        if key == Keys.CTRL_LEFT:
            self.input_box.buffer.word_left()
            self._render()
            return True
        
        # Ctrl+Right - Word right
        if key == Keys.CTRL_RIGHT:
            self.input_box.buffer.word_right()
            self._render()
            return True
        
        # Home
        if key in (Keys.HOME, Keys.HOME_ALT):
            self.input_box.buffer.home()
            self._render()
            return True
        
        # End
        if key in (Keys.END, Keys.END_ALT):
            self.input_box.buffer.end()
            self._render()
            return True
        
        return False
    
    def _handle_printable(self, key: str) -> None:
        """Handle printable character input."""
        if not self.input_box:
            return
        
        # Check for >>> submit marker
        text = self.input_box.buffer.text
        if text.endswith('>>') and key == '>':
            # Remove >>> and submit
            self.input_box.buffer.backspace()
            self.input_box.buffer.backspace()
            self._submit()
            return
        
        # Check for slash command start
        if key == '/' and self.input_box.buffer.cursor_col == 0:
            if self.slash_handler:
                self.slash_handler.start('/')
        
        # Insert character
        self.input_box.buffer.insert_char(key)
        
        # Update slash command matches
        if self.slash_handler and self.slash_handler.active:
            current_line = self.input_box.buffer.lines[self.input_box.buffer.cursor_row]
            self.slash_handler.update(current_line)
            # Update status bar with match count
            match_count = len(self.slash_handler.matches) if self.slash_handler.matches else 0
            if match_count > 0:
                self.input_box.status_bar.set_hint(f'{match_count} matches | Tab: complete')
            else:
                self.input_box.status_bar.set_hint('No matches')
        else:
            # Default hint
            self.input_box.status_bar.set_hint('Ctrl+D: submit')
        
        self._render()
    
    def _handle_enter(self) -> None:
        """Handle Enter key press."""
        if not self.input_box:
            return
        
        # In slash command mode, complete selection
        if self.slash_handler and self.slash_handler.active:
            completed = self.slash_handler.complete()
            self.input_box.buffer.clear()
            self.input_box.buffer.insert_text(completed + ' ')
            self._render()
            return
        
        # Insert newline (multi-line mode default)
        self.input_box.buffer.newline()
        self._render()
    
    def _handle_backspace(self) -> None:
        """Handle Backspace key press."""
        if not self.input_box:
            return
        
        # Check if we should delete a badge
        if not self.input_box.backspace():
            # Normal backspace
            self.input_box.buffer.backspace()
        
        # Update slash command if active
        if self.slash_handler and self.slash_handler.active:
            current_line = self.input_box.buffer.lines[self.input_box.buffer.cursor_row]
            if not current_line.startswith('/'):
                self.slash_handler.cancel()
                self.input_box.status_bar.set_hint('Ctrl+D: submit')
            else:
                self.slash_handler.update(current_line)
                match_count = len(self.slash_handler.matches) if self.slash_handler.matches else 0
                if match_count > 0:
                    self.input_box.status_bar.set_hint(f'{match_count} matches | Tab: complete')
                else:
                    self.input_box.status_bar.set_hint('No matches')
        
        self._render()
    
    def _handle_paste(self, content: str) -> None:
        """Handle pasted content."""
        if not self.input_box:
            return
        
        # Lazy import utils
        create_file_marker, create_paste_marker, is_file_path, _ = _lazy_import_utils()
        
        # Update mode
        self.mode = MODE_PASTE
        
        # Check if content is a file path
        if is_file_path(content.strip()):
            marker = create_file_marker(content.strip())
            self.input_box.buffer.insert_text(marker)
        else:
            # Check if content should be compressed to badge
            lines = content.split('\n')
            line_count = len(lines)
            char_count = len(content)
            
            if line_count >= PASTE_LINE_THRESHOLD or char_count >= PASTE_CHAR_THRESHOLD:
                marker = create_paste_marker(content)
                self.input_box.buffer.insert_text(marker)
            else:
                # Insert as regular text
                self.input_box.buffer.insert_text(content)
        
        # Reset mode
        self.mode = MODE_INPUT
        self._render()
    
    def _handle_resize(self) -> None:
        """Handle terminal resize with debounce."""
        current_time = time.time() * 1000
        if current_time - self._last_resize_time < RESIZE_DEBOUNCE_MS:
            return
        
        self._last_resize_time = current_time
        
        if self.screen:
            cols, rows = self.screen.resize()
            if self.input_box:
                self.input_box.handle_resize(cols, rows)
            # Full redraw on resize
            self._render(full_redraw=True)
    
    def _history_back(self) -> None:
        """Navigate to previous history entry."""
        if not self.history or not self.input_box:
            return
        
        current_text = self.input_box.buffer.text
        entry = self.history.go_back(current_text)
        
        self.input_box.buffer.clear()
        self.input_box.buffer.insert_text(entry)
        self.mode = MODE_HISTORY
        self._render()
    
    def _history_forward(self) -> None:
        """Navigate to next history entry."""
        if not self.history or not self.input_box:
            return
        
        entry = self.history.go_forward()
        
        self.input_box.buffer.clear()
        self.input_box.buffer.insert_text(entry)
        
        if self.history.at_end:
            self.mode = MODE_INPUT
        
        self._render()
    
    def _start_search(self) -> None:
        """Start reverse history search mode."""
        self.mode = MODE_SEARCH
        self._search_query = ''
        self._search_results = []
        self._search_index = 0
        
        if self.input_box:
            self.input_box.status_bar.set_hint('(reverse-i-search): ')
        
        self._render()
    
    def _cancel_search(self) -> None:
        """Cancel search mode."""
        self.mode = MODE_INPUT
        self._search_query = ''
        
        if self.input_box:
            self.input_box.status_bar.set_hint('')
        
        self._render()
    
    def _handle_search_key(self, key: str) -> bool:
        """
        Handle key in search mode.
        
        Returns True if key was handled.
        """
        # Enter - Accept search result
        if key in (Keys.ENTER, '\r', '\n'):
            self.mode = MODE_INPUT
            if self.input_box:
                self.input_box.status_bar.set_hint('')
            self._render()
            return True
        
        # Escape - Cancel search
        if key == Keys.ESCAPE:
            self._cancel_search()
            return True
        
        # Ctrl+R - Next search result
        if key == Keys.CTRL_R:
            if self._search_results and self._search_index < len(self._search_results) - 1:
                self._search_index += 1
                self._apply_search_result()
            return True
        
        # Backspace - Remove last search char
        if self.keybuffer.is_backspace(key):
            if self._search_query:
                self._search_query = self._search_query[:-1]
                self._update_search()
            return True
        
        # Printable - Add to search query
        if self.keybuffer.is_printable(key):
            self._search_query += key
            self._update_search()
            return True
        
        return False
    
    def _update_search(self) -> None:
        """Update search results based on current query."""
        if not self.history or not self.input_box:
            return
        
        self._search_results = self.history.search(self._search_query)
        self._search_index = 0
        
        self.input_box.status_bar.set_hint(f'(reverse-i-search)`{self._search_query}\': ')
        
        self._apply_search_result()
    
    def _apply_search_result(self) -> None:
        """Apply current search result to input."""
        if not self.input_box:
            return
        
        if self._search_results and self._search_index < len(self._search_results):
            result = self._search_results[self._search_index]
            self.input_box.buffer.clear()
            self.input_box.buffer.insert_text(result)
        
        self._render()
    
    def _submit(self) -> None:
        """Submit the current input."""
        if not self.input_box:
            self._running = False
            return
        
        text = self.input_box.buffer.text.strip()
        
        # Don't submit empty input
        if not text:
            return
        
        # Add to history
        if self.history:
            self.history.add(text)
        
        # Expand markers and prepare result
        self._result = format_output(text)
        self._running = False


# Import format_output from output module
from .output import format_output


def run_tui(header: str = '',
            prompt: str = '',
            skip_welcome: bool = False,
            show_line_numbers: bool = True) -> Optional[str]:
    """
    Convenience function to run the TUI application.
    
    Args:
        header: Custom header text
        prompt: Custom prompt text
        skip_welcome: Skip welcome box
        show_line_numbers: Show line numbers
        
    Returns:
        Submitted text or None if cancelled
    """
    app = TUIApp(
        header=header,
        prompt=prompt,
        skip_welcome=skip_welcome,
        show_line_numbers=show_line_numbers
    )
    return app.run()
