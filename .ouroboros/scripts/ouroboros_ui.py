#!/usr/bin/env python3
"""
ouroboros_ui.py - Terminal UI Components for Ouroboros CCL System

Provides beautiful terminal UI using only Python standard library:
- ANSI escape codes for colors and cursor control
- Unicode box drawing characters
- Mystic Purple theme
- ASCII art logo
- Double-buffered rendering via ScreenBuffer (optional)

Dependencies: Python 3.6+ standard library only
"""

import sys
import shutil
import unicodedata
import re

# Try to import ScreenBuffer for double-buffered rendering
try:
    from ouroboros_screen import ScreenBuffer
    SCREEN_BUFFER_AVAILABLE = True
except ImportError:
    SCREEN_BUFFER_AVAILABLE = False

# =============================================================================
# ANSI ESCAPE CODES
# =============================================================================

class ANSI:
    """ANSI escape code utilities."""
    
    # Cursor movement
    @staticmethod
    def move_up(n: int = 1) -> str:
        return f'\x1b[{n}A' if n > 0 else ''
    
    @staticmethod
    def move_down(n: int = 1) -> str:
        return f'\x1b[{n}B' if n > 0 else ''
    
    @staticmethod
    def move_right(n: int = 1) -> str:
        return f'\x1b[{n}C' if n > 0 else ''
    
    @staticmethod
    def move_left(n: int = 1) -> str:
        return f'\x1b[{n}D' if n > 0 else ''
    
    @staticmethod
    def move_to_column(col: int) -> str:
        return f'\x1b[{col}G'
    
    @staticmethod
    def move_to(row: int, col: int) -> str:
        return f'\x1b[{row};{col}H'
    
    # Line operations
    CLEAR_LINE = '\x1b[2K'
    CLEAR_LINE_RIGHT = '\x1b[0K'
    CLEAR_LINE_LEFT = '\x1b[1K'
    CLEAR_SCREEN = '\x1b[2J'
    
    # Cursor visibility
    HIDE_CURSOR = '\x1b[?25l'
    SHOW_CURSOR = '\x1b[?25h'
    
    # Save/restore cursor
    SAVE_CURSOR = '\x1b[s'
    RESTORE_CURSOR = '\x1b[u'
    
    # Colors
    RESET = '\x1b[0m'
    BOLD = '\x1b[1m'
    DIM = '\x1b[2m'
    ITALIC = '\x1b[3m'
    UNDERLINE = '\x1b[4m'
    
    # Foreground colors (bright)
    FG_BLACK = '\x1b[30m'
    FG_RED = '\x1b[91m'
    FG_GREEN = '\x1b[92m'
    FG_YELLOW = '\x1b[93m'
    FG_BLUE = '\x1b[94m'
    FG_MAGENTA = '\x1b[95m'
    FG_CYAN = '\x1b[96m'
    FG_WHITE = '\x1b[97m'
    
    # Background colors
    BG_BLACK = '\x1b[40m'
    BG_RED = '\x1b[41m'
    BG_GREEN = '\x1b[42m'
    BG_YELLOW = '\x1b[43m'
    BG_BLUE = '\x1b[44m'
    BG_MAGENTA = '\x1b[45m'
    BG_CYAN = '\x1b[46m'
    BG_WHITE = '\x1b[47m'


# =============================================================================
# THEME & STYLING
# =============================================================================

# Mystic Purple Theme
THEME = {
    'border': ANSI.FG_MAGENTA,
    'border_dim': ANSI.DIM + ANSI.FG_MAGENTA,
    'prompt': ANSI.FG_CYAN,
    'success': ANSI.FG_GREEN,
    'warning': ANSI.FG_YELLOW,
    'error': ANSI.FG_RED,
    'info': ANSI.FG_BLUE,
    'accent': ANSI.FG_MAGENTA + ANSI.BOLD,
    'dim': ANSI.DIM,
    'bold': ANSI.BOLD,
    'reset': ANSI.RESET,
}

# Box drawing characters (rounded corners)
BOX = {
    'tl': '╭',  # Top left
    'tr': '╮',  # Top right
    'bl': '╰',  # Bottom left
    'br': '╯',  # Bottom right
    'h': '─',   # Horizontal
    'v': '│',   # Vertical
    'lj': '├',  # Left junction
    'rj': '┤',  # Right junction
    'tj': '┬',  # Top junction
    'bj': '┴',  # Bottom junction
    'x': '┼',   # Cross
    'hd': '═',  # Horizontal double
    'vd': '║',  # Vertical double
}

# ASCII fallback box characters
BOX_ASCII = {
    'tl': '+', 'tr': '+', 'bl': '+', 'br': '+',
    'h': '-', 'v': '|', 'lj': '+', 'rj': '+',
    'tj': '+', 'bj': '+', 'x': '+', 'hd': '=', 'vd': '|',
}

# =============================================================================
# LOGO - Ouroboros Snake ASCII Art
# =============================================================================

# Small inline logo (for headers)
LOGO_SMALL = "◎"  # Circle with dot - represents the ouroboros

# Medium logo - stylized snake eating its tail
LOGO_MEDIUM = [
    "  ╭──◯──╮  ",
    " ◜      ◝ ",
    " │  ♾️   │ ",
    " ◟      ◞ ",
    "  ╰──◯──╯  ",
]

# Compact text logo
LOGO_TEXT = "⟲ OUROBOROS ⟳"

# Minimal snake icon for prompts
SNAKE_ICON = "◎"
INFINITY_ICON = "∞"

# =============================================================================
# TEXT UTILITIES
# =============================================================================

_ANSI_ESCAPE = re.compile(r'\x1b\[[0-9;]*m')

def strip_ansi(text: str) -> str:
    """Remove ANSI escape codes from text."""
    return _ANSI_ESCAPE.sub('', text)

def char_width(char: str) -> int:
    """Get display width of a single character."""
    ea = unicodedata.east_asian_width(char)
    if ea in ('W', 'F'):
        return 2
    code = ord(char)
    if code >= 0x1F300:  # Most emoji
        return 2
    return 1

def visible_len(text: str) -> int:
    """Get visible length of text (ignoring ANSI codes)."""
    clean = strip_ansi(text)
    return sum(char_width(c) for c in clean)

def pad_text(text: str, width: int, fill: str = ' ') -> str:
    """Pad text to width accounting for ANSI codes."""
    visible = visible_len(text)
    if visible >= width:
        return text
    return text + fill * (width - visible)

def get_terminal_size() -> tuple:
    """Get terminal (columns, rows)."""
    try:
        size = shutil.get_terminal_size()
        return (size.columns, size.lines)
    except (ValueError, OSError):
        return (80, 24)

# =============================================================================
# UI COMPONENTS
# =============================================================================

def write(text: str) -> None:
    """Write to stderr (UI output, not captured by Copilot)."""
    sys.stderr.write(text)
    sys.stderr.flush()

def writeln(text: str = '') -> None:
    """Write line to stderr."""
    write(text + '\n')


def format_display_text(text: str) -> str:
    """
    Convert internal file path markers to display format.
    
    Internal format: «/full/path/file.ext»
    Display format:  [ file.ext ]
    
    This allows the buffer to store full paths for AI, while
    displaying only filenames for better readability.
    """
    import re
    import os
    
    def replace_path(match):
        path = match.group(1)
        filename = os.path.basename(path)
        if not filename:
            # Directory or empty, use last component
            parts = path.replace('\\', '/').rstrip('/').split('/')
            filename = parts[-1] if parts else path
        return f"[ {filename} ]"
    
    # Pattern to find «content» markers
    # Use regex to find «...» and extract the path
    pattern = r'«([^»]+)»'
    return re.sub(pattern, replace_path, text)


class InputBox:
    """
    A pre-reserved input box that updates in place.
    Uses ANSI escape codes to move cursor and redraw.
    
    Features:
    - Auto-stretch to terminal width
    - Optional line numbers
    - Scroll indicator when content exceeds viewport
    - Status bar showing mode and position
    - Dynamic height (starts at 1, can expand)
    """
    
    def __init__(self, height: int = 1, show_line_numbers: bool = False, 
                 show_status: bool = True, full_width: bool = True):
        self.show_line_numbers = show_line_numbers
        self.show_status = show_status
        self.full_width = full_width
        
        # Get terminal size
        self.cols, self.rows = get_terminal_size()
        
        # Width: stretch to terminal width
        if full_width:
            self.width = self.cols  # Full width
        else:
            self.width = min(self.cols - 4, 80)
        
        # Height: use provided (default 1 for single line)
        self.height = max(1, height)
        
        self.lines = ['']  # Current input lines
        self.cursor_row = 0
        self.cursor_col = 0
        self.total_lines = 1
        self.scroll_offset = 0
        self._rendered = False
        self._mode = "INPUT"  # INPUT, PASTE, HISTORY
        
        # Initialize ScreenBuffer for double-buffered rendering
        # Total box height = 1 (top border) + height (input lines) + 1 (bottom border)
        self._use_screen_buffer = SCREEN_BUFFER_AVAILABLE
        self._screen_buffer = None
        self._box_start_row = 1  # Terminal row where box starts (1-based)
    
    def render_initial(self) -> None:
        """Render the initial input box frame."""
        c = THEME
        
        # Calculate content width (inside borders)
        content_width = self.width - 2  # Account for left and right borders
        
        # Top border with prompt indicator
        prompt_indicator = f" {c['prompt']}◎ INPUT{c['reset']} "
        prompt_visible_len = 9  # "◎ INPUT" visible length
        left_border = BOX['h'] * 2
        right_border_len = content_width - prompt_visible_len - 2
        right_border = BOX['h'] * max(0, right_border_len)
        writeln(f"{c['border']}{BOX['tl']}{left_border}{c['reset']}{prompt_indicator}{c['border']}{right_border}{BOX['tr']}{c['reset']}")
        
        # Empty input lines (pre-reserve space)
        for i in range(self.height):
            if self.show_line_numbers:
                line_num = f"{c['dim']}{i+1:3d}{c['reset']} {c['border']}│{c['reset']} "
                line_content_width = content_width - 7  # 3 digits + space + │ + space
            else:
                line_num = f" {c['border']}›{c['reset']} "
                line_content_width = content_width - 3  # space + › + space
            writeln(f"{c['border']}{BOX['v']}{c['reset']}{line_num}{' ' * line_content_width}{c['border']}{BOX['v']}{c['reset']}")
        
        # Bottom border with embedded status (single line)
        if self.show_status:
            # Embed status in bottom border: ╰── MODE: SINGLE ─────── Ln 1, Col 1 ──╯
            mode_text = f" {self._mode} "
            pos_text = f" Ln 1, Col 1 "
            mode_len = len(mode_text)
            pos_len = len(pos_text)
            
            # Calculate border segments
            left_border = BOX['h'] * 2
            right_border_len = content_width - mode_len - pos_len - 4
            mid_border = BOX['h'] * max(1, right_border_len)
            right_border = BOX['h'] * 2
            
            writeln(f"{c['border']}{BOX['bl']}{left_border}{c['reset']}{c['info']}{mode_text}{c['reset']}{c['border']}{mid_border}{c['reset']}{c['dim']}{pos_text}{c['reset']}{c['border']}{right_border}{BOX['br']}{c['reset']}")
        else:
            # Simple bottom border
            writeln(f"{c['border']}{BOX['bl']}{BOX['h'] * content_width}{BOX['br']}{c['reset']}")
        
        # Move cursor back to first input line
        status_lines = 0  # Status is now in bottom border, no extra lines
        write(ANSI.move_up(self.height + status_lines + 1))
        # col_offset: number of chars before text area
        # With line numbers: │ + 3digits + space + │ + space = 1+3+1+1+1 = 7
        # Without line numbers: │ + space + › + space = 1+1+1+1 = 4... wait let me recount
        # Actually: "│" + "  1 │ " = 1 + 7 = 8 chars before text? No:
        # │  1 │ x  <- x is at position 8 (1-based), so col_offset=7 (chars before)
        col_offset = 7 if self.show_line_numbers else 3
        write(ANSI.move_to_column(col_offset + 1))  # col_offset is 0-based, ANSI is 1-based
        
        self._rendered = True
    
    def set_mode(self, mode: str) -> None:
        """Update the mode indicator (INPUT, PASTE)."""
        self._mode = mode
        if self._rendered and self.show_status:
            self._update_status_bar()
    
    def expand_height(self, new_height: int) -> None:
        """Expand the input box to a new height (re-renders the entire box)."""
        if new_height <= self.height:
            return
        
        # Calculate max height based on terminal
        max_height = max(1, self.rows - 12)  # Leave room for welcome box and margins
        new_height = min(new_height, max_height)
        
        if new_height <= self.height:
            return
        
        c = THEME
        content_width = self.width - 2
        old_height = self.height
        self.height = new_height
        
        # Save cursor position
        write(ANSI.SAVE_CURSOR)
        
        # Move to first input line (from current cursor position)
        if self.cursor_row > 0:
            write(ANSI.move_up(self.cursor_row))
        
        # Re-render ALL existing lines (in case show_line_numbers changed)
        for i in range(old_height):
            write(ANSI.move_to_column(1))
            write(ANSI.CLEAR_LINE)
            if self.show_line_numbers:
                line_num = f"{c['dim']}{i+1:3d}{c['reset']} {c['border']}│{c['reset']} "
                line_content_width = content_width - 7
            else:
                line_num = f" {c['border']}›{c['reset']} "
                line_content_width = content_width - 3
            writeln(f"{c['border']}{BOX['v']}{c['reset']}{line_num}{' ' * line_content_width}{c['border']}{BOX['v']}{c['reset']}")
        
        # Clear old bottom border
        write(ANSI.move_to_column(1))
        write(ANSI.CLEAR_LINE)
        
        # Add new input lines
        for i in range(old_height, new_height):
            write(ANSI.move_to_column(1))
            if self.show_line_numbers:
                line_num = f"{c['dim']}{i+1:3d}{c['reset']} {c['border']}│{c['reset']} "
                line_content_width = content_width - 7
            else:
                line_num = f" {c['border']}›{c['reset']} "
                line_content_width = content_width - 3
            writeln(f"{c['border']}{BOX['v']}{c['reset']}{line_num}{' ' * line_content_width}{c['border']}{BOX['v']}{c['reset']}")
        
        # Re-draw bottom border with embedded status
        if self.show_status:
            mode_text = f" {self._mode} "
            pos_text = f" Ln 1, Col 1 "
            mode_len = len(mode_text)
            pos_len = len(pos_text)
            left_border = BOX['h'] * 2
            right_border_len = content_width - mode_len - pos_len - 4
            mid_border = BOX['h'] * max(1, right_border_len)
            right_border = BOX['h'] * 2
            writeln(f"{c['border']}{BOX['bl']}{left_border}{c['reset']}{c['info']}{mode_text}{c['reset']}{c['border']}{mid_border}{c['reset']}{c['dim']}{pos_text}{c['reset']}{c['border']}{right_border}{BOX['br']}{c['reset']}")
        else:
            writeln(f"{c['border']}{BOX['bl']}{BOX['h'] * content_width}{BOX['br']}{c['reset']}")
        
        write(ANSI.RESTORE_CURSOR)
    
    def _update_status_bar(self) -> None:
        """Update the status bar embedded in bottom border with batch rendering."""
        if not self.show_status:
            return
        
        c = THEME
        content_width = self.width - 2
        
        # Build all output in a buffer (batch rendering)
        output = []
        
        # Save cursor, move to bottom border line, update, restore
        output.append(ANSI.SAVE_CURSOR)
        
        # Move to bottom border (status is embedded there now)
        lines_down = self.height - self.cursor_row
        output.append(ANSI.move_down(lines_down))
        output.append(ANSI.move_to_column(1))
        output.append(ANSI.CLEAR_LINE)
        
        # Simple hint text
        hint_text = " Ctrl+D=submit "
        
        # Position indicator
        line_num = self.scroll_offset + self.cursor_row + 1
        col_num = self.cursor_col + 1
        pos_text = f" Ln {line_num}, Col {col_num} "
        
        # Scroll indicator if needed
        scroll_text = ""
        if self.total_lines > self.height:
            scroll_text = f" [{self.scroll_offset + 1}-{min(self.scroll_offset + self.height, self.total_lines)}/{self.total_lines}] "
        
        # Calculate border segments
        hint_len = len(hint_text)
        pos_len = len(pos_text)
        scroll_len = len(scroll_text)
        left_border = BOX['h'] * 2
        right_border_len = content_width - hint_len - pos_len - scroll_len - 4
        mid_border = BOX['h'] * max(1, right_border_len)
        right_border = BOX['h'] * 2
        
        # Render: ╰── hint ─────── [scroll] ─── Ln X, Col Y ──╯
        output.append(f"{c['border']}{BOX['bl']}{left_border}{c['reset']}{c['dim']}{hint_text}{c['reset']}{c['border']}{mid_border}{c['reset']}{c['dim']}{scroll_text}{pos_text}{c['reset']}{c['border']}{right_border}{BOX['br']}{c['reset']}")
        
        output.append(ANSI.RESTORE_CURSOR)
        
        # Flush all output at once (batch rendering)
        write(''.join(output))
    
    def update_line(self, line_index: int, text: str) -> None:
        """Update a specific line in the input box with batch rendering."""
        if not self._rendered or line_index >= self.height:
            return
        
        # Format text for display (convert file path markers to [ filename ] format)
        display_text = format_display_text(text)
        
        c = THEME
        content_width = self.width - 2  # Inside borders
        
        # Build all output in a buffer before writing (batch rendering)
        output = []
        
        # Hide cursor during update to prevent flicker
        output.append(ANSI.HIDE_CURSOR)
        
        # Calculate how far to move from current position
        move_amount = line_index - self.cursor_row
        
        if move_amount > 0:
            output.append(ANSI.move_down(move_amount))
        elif move_amount < 0:
            output.append(ANSI.move_up(-move_amount))
        
        # Move to start of line content
        output.append(ANSI.move_to_column(1))
        output.append(ANSI.CLEAR_LINE)
        
        # Calculate line content width
        if self.show_line_numbers:
            actual_line_num = self.scroll_offset + line_index + 1
            line_num = f"{c['dim']}{actual_line_num:3d}{c['reset']} {c['border']}│{c['reset']} "
            line_content_width = content_width - 7  # 3 digits + space + │ + space
        else:
            line_num = f" {c['border']}›{c['reset']} "
            line_content_width = content_width - 3  # space + › + space
        
        # Truncate if too long, show indicator
        if visible_len(display_text) > line_content_width:
            # Truncate text to fit
            truncated = display_text[:line_content_width - 1]
            content = truncated + f"{c['dim']}…{c['reset']}"
            content = pad_text(content, line_content_width)
        else:
            content = pad_text(display_text, line_content_width)
        
        output.append(f"{c['border']}{BOX['v']}{c['reset']}{line_num}{content}{c['border']}{BOX['v']}{c['reset']}")
        
        # Update tracked row position (cursor is now at end of this line)
        self.cursor_row = line_index
        
        # Show cursor again
        output.append(ANSI.SHOW_CURSOR)
        
        # Flush all output at once (batch rendering reduces flicker)
        write(''.join(output))
    
    def set_cursor(self, row: int, col: int, text_before_cursor: str = '', 
                   update_status: bool = True) -> None:
        """Move cursor to specific position in input area with batch rendering.
        
        Args:
            row: Row index (0-based)
            col: Character index (0-based, not display width)
            text_before_cursor: Text before cursor for calculating display width
            update_status: Whether to update status bar (set False during rapid input)
        """
        # Calculate column offset (number of chars before text area):
        # With line numbers: │ + "  1 │ " = 1 + 6 = 7 chars before text
        # Without line numbers: │ + " › " = 1 + 3 = 4... hmm need to verify
        col_offset = 7 if self.show_line_numbers else 3
        
        # Track if position actually changed
        old_row, old_col = self.cursor_row, self.cursor_col
        
        # Build all output in a buffer (batch rendering)
        output = []
        
        # Move vertically if needed
        if row != self.cursor_row:
            if row > self.cursor_row:
                output.append(ANSI.move_down(row - self.cursor_row))
            else:
                output.append(ANSI.move_up(self.cursor_row - row))
            self.cursor_row = row
        
        # Calculate display width of text before cursor
        # This handles CJK characters that take 2 columns
        if text_before_cursor:
            display_col = visible_len(text_before_cursor)
        else:
            display_col = col  # Fallback to character count
        
        # Move horizontally (ANSI columns are 1-based, col_offset is 0-based count of chars before text)
        output.append(ANSI.move_to_column(col_offset + display_col + 1))
        self.cursor_col = col
        
        # Flush all output at once (batch rendering)
        if output:
            write(''.join(output))
        
        # Only update status bar if position changed and update_status is True
        if update_status and self.show_status and (row != old_row or col != old_col):
            self._update_status_bar()
    
    def set_scroll_info(self, total_lines: int, scroll_offset: int) -> None:
        """Update scroll information for status bar."""
        self.total_lines = total_lines
        self.scroll_offset = scroll_offset
        if self.show_status:
            self._update_status_bar()
    
    def finish(self) -> None:
        """Move cursor below the box after input is complete."""
        # Status is now embedded in bottom border, so no extra lines
        # Just need to move past remaining input lines + bottom border (1 line)
        lines_below = self.height - self.cursor_row + 1
        write(ANSI.move_down(lines_below))
        write(ANSI.move_to_column(1))


class WelcomeBox:
    """The welcome/status box shown above input - compact with all shortcuts."""
    
    @staticmethod
    def render(compact: bool = False) -> None:
        """Render compact welcome box with all shortcuts visible at once."""
        cols, _ = get_terminal_size()
        width = min(cols - 4, 66)
        c = THEME
        
        def box_line(content: str) -> None:
            padded = pad_text(content, width)
            writeln(f"{c['border']}{BOX['v']}{c['reset']}{padded}{c['border']}{BOX['v']}{c['reset']}")
        
        writeln()
        
        # Top border with title
        title = f" {c['accent']}◎ OUROBOROS{c['reset']} "
        title_len = 13  # visible length
        left_border = BOX['h'] * 2
        right_border = BOX['h'] * (width - title_len - 2)
        writeln(f"{c['border']}{BOX['tl']}{left_border}{c['reset']}{title}{c['border']}{right_border}{BOX['tr']}{c['reset']}")
        
        # All shortcuts in aligned two-column layout
        # Column 1: 28 chars | Column 2: rest
        box_line(f"  {c['warning']}Enter{c['reset']}       New line       │ {c['success']}Ctrl+D{c['reset']}      Submit")
        box_line(f"  {c['warning']}↑/↓{c['reset']}         Move cursor    │ {c['warning']}←→{c['reset']}          Navigate")
        box_line(f"  {c['warning']}Home/End{c['reset']}    Line start/end │ {c['warning']}Ctrl+U{c['reset']}      Clear line")
        box_line(f"  {c['error']}Ctrl+C{c['reset']}      Cancel         │ {c['warning']}>>>{c['reset']}         End & submit")
        
        # Bottom border
        writeln(f"{c['border']}{BOX['bl']}{BOX['h'] * width}{BOX['br']}{c['reset']}")
        writeln()


class OutputBox:
    """Box for displaying output/task results - auto-sizes to terminal and content."""
    
    @staticmethod
    def render(marker: str, content: str, full_width: bool = True) -> None:
        """Render output box to stdout (for Copilot).
        
        Args:
            marker: Label for the output (e.g., "TASK")
            content: Content to display
            full_width: If True, stretch to terminal width
        """
        cols, rows = get_terminal_size()
        c = THEME
        
        # Calculate width
        if full_width:
            width = cols - 2  # Full width minus margins
        else:
            width = min(cols - 4, 80)
        
        content_width = width - 2  # Inside borders
        sep = BOX['h'] * content_width
        
        # Split content into lines
        lines = content.split('\n')
        
        # Header
        print(f"{c['border']}{BOX['tl']}{sep}{BOX['tr']}{c['reset']}")
        header = f" {c['prompt']}[>] {marker.upper()}{c['reset']}"
        header_padded = pad_text(header, content_width)
        print(f"{c['border']}{BOX['v']}{c['reset']}{header_padded}{c['border']}{BOX['v']}{c['reset']}")
        print(f"{c['border']}{BOX['lj']}{sep}{BOX['rj']}{c['reset']}")
        
        # Content with side borders (handle CJK width)
        for line in lines:
            line_width = visible_len(line)
            if line_width > content_width:
                # Truncate accounting for display width
                truncated = ''
                current_width = 0
                for ch in line:
                    ch_width = char_width(ch)
                    if current_width + ch_width > content_width - 3:
                        break
                    truncated += ch
                    current_width += ch_width
                line = truncated + f"{c['dim']}...{c['reset']}"
            padded_line = pad_text(line, content_width)
            print(f"{c['border']}{BOX['v']}{c['reset']}{padded_line}{c['border']}{BOX['v']}{c['reset']}")
        
        # Footer
        print(f"{c['border']}{BOX['bl']}{sep}{BOX['br']}{c['reset']}")


class SelectMenu:
    """
    Interactive selection menu with arrow key navigation.
    Allows selecting from options or entering custom input.
    """
    
    def __init__(self, options: list, title: str = "Select an option:", 
                 allow_custom: bool = True, custom_label: str = "[Custom input...]"):
        self.options = list(options)
        self.title = title
        self.allow_custom = allow_custom
        self.custom_label = custom_label
        self.selected_index = 0
        self.cols, _ = get_terminal_size()
        self.width = min(self.cols - 4, 60)
        
        # Add custom option at the end
        if allow_custom:
            self.options.append(custom_label)
    
    def render(self) -> None:
        """Render the selection menu."""
        c = THEME
        sep = BOX['h'] * self.width
        
        writeln()
        # Header
        writeln(f"{c['border']}{BOX['tl']}{sep}{BOX['tr']}{c['reset']}")
        title_padded = pad_text(f" {self.title}", self.width)
        writeln(f"{c['border']}{BOX['v']}{c['reset']}{title_padded}{c['border']}{BOX['v']}{c['reset']}")
        writeln(f"{c['border']}{BOX['lj']}{sep}{BOX['rj']}{c['reset']}")
        
        # Options
        for i, option in enumerate(self.options):
            if i == self.selected_index:
                prefix = f"{c['prompt']} > "
                suffix = c['reset']
            else:
                prefix = "   "
                suffix = ""
            
            # Truncate if too long
            display_option = option if len(option) < self.width - 6 else option[:self.width - 9] + "..."
            option_padded = pad_text(f"{prefix}{display_option}{suffix}", self.width)
            writeln(f"{c['border']}{BOX['v']}{c['reset']}{option_padded}{c['border']}{BOX['v']}{c['reset']}")
        
        # Footer with hint
        writeln(f"{c['border']}{BOX['lj']}{sep}{BOX['rj']}{c['reset']}")
        hint = f" {c['info']}[Up/Down]{c['reset']} Navigate  {c['success']}[Enter]{c['reset']} Select"
        hint_padded = pad_text(hint, self.width)
        writeln(f"{c['border']}{BOX['v']}{c['reset']}{hint_padded}{c['border']}{BOX['v']}{c['reset']}")
        writeln(f"{c['border']}{BOX['bl']}{sep}{BOX['br']}{c['reset']}")
    
    def clear_and_rerender(self) -> None:
        """Clear previous render and redraw."""
        # Move up to clear previous output
        lines_to_clear = len(self.options) + 5  # options + header + separator + hint + borders
        write(ANSI.move_up(lines_to_clear))
        for _ in range(lines_to_clear):
            write(ANSI.CLEAR_LINE)
            write(ANSI.move_down(1))
        write(ANSI.move_up(lines_to_clear))
        self.render()
    
    def move_up(self) -> None:
        """Move selection up."""
        if self.selected_index > 0:
            self.selected_index -= 1
            self.clear_and_rerender()
    
    def move_down(self) -> None:
        """Move selection down."""
        if self.selected_index < len(self.options) - 1:
            self.selected_index += 1
            self.clear_and_rerender()
    
    def get_selected(self) -> tuple:
        """
        Get the selected option.
        Returns (index, value, is_custom)
        """
        is_custom = self.allow_custom and self.selected_index == len(self.options) - 1
        return (self.selected_index, self.options[self.selected_index], is_custom)


# =============================================================================
# TEST
# =============================================================================

if __name__ == '__main__':
    print("Testing UI components...")
    
    WelcomeBox.render()
    
    box = InputBox(height=3)
    box.render_initial()
    
    # Simulate typing
    import time
    test_text = "Hello, World!"
    for i, char in enumerate(test_text):
        box.update_line(0, test_text[:i+1])
        box.set_cursor(0, i+1)
        time.sleep(0.1)
    
    time.sleep(1)
    box.finish()
    
    OutputBox.render("TASK", "This is a test task")
