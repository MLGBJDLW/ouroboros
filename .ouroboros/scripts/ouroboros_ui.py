#!/usr/bin/env python3
"""
Terminal UI utilities for Ouroboros input system.
Handles ANSI escape codes, box drawing, and cursor control.
"""

import sys
import shutil
import unicodedata
import re

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
    
    # Foreground colors
    FG_BLACK = '\x1b[30m'
    FG_RED = '\x1b[91m'
    FG_GREEN = '\x1b[92m'
    FG_YELLOW = '\x1b[93m'
    FG_BLUE = '\x1b[94m'
    FG_MAGENTA = '\x1b[95m'
    FG_CYAN = '\x1b[96m'
    FG_WHITE = '\x1b[97m'


# Mystic Purple Theme
THEME = {
    'border': ANSI.FG_MAGENTA,
    'prompt': ANSI.FG_CYAN,
    'success': ANSI.FG_GREEN,
    'warning': ANSI.FG_YELLOW,
    'error': ANSI.FG_RED,
    'info': ANSI.FG_BLUE,
    'dim': ANSI.DIM,
    'reset': ANSI.RESET,
}

# Box drawing characters
BOX = {
    'tl': '╭',  # Top left
    'tr': '╮',  # Top right
    'bl': '╰',  # Bottom left
    'br': '╯',  # Bottom right
    'h': '─',   # Horizontal
    'v': '│',   # Vertical
    'lj': '├',  # Left junction
    'rj': '┤',  # Right junction
}

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


class InputBox:
    """
    A pre-reserved input box that updates in place.
    Uses ANSI escape codes to move cursor and redraw.
    """
    
    def __init__(self, height: int = 3, show_line_numbers: bool = True):
        self.height = height  # Fixed height for input area
        self.show_line_numbers = show_line_numbers
        self.cols, self.rows = get_terminal_size()
        self.width = self.cols - 4  # Leave margin
        self.lines = ['']  # Current input lines
        self.cursor_row = 0
        self.cursor_col = 0
        self._rendered = False
    
    def render_initial(self) -> None:
        """Render the initial input box frame."""
        c = THEME
        
        # Top border
        writeln(f"{c['border']}{BOX['tl']}{BOX['h'] * self.width}{BOX['tr']}{c['reset']}")
        
        # Empty input lines (pre-reserve space)
        for i in range(self.height):
            line_num = f"{c['warning']}{i+1:2d}{c['reset']} " if self.show_line_numbers else ""
            writeln(f"{c['border']}{BOX['v']}{c['reset']} {line_num}{' ' * (self.width - 5)}{c['border']}{BOX['v']}{c['reset']}")
        
        # Bottom border
        writeln(f"{c['border']}{BOX['bl']}{BOX['h'] * self.width}{BOX['br']}{c['reset']}")
        
        # Move cursor back to first input line
        write(ANSI.move_up(self.height + 1))
        write(ANSI.move_to_column(6 if self.show_line_numbers else 4))
        
        self._rendered = True
    
    def update_line(self, line_index: int, text: str) -> None:
        """Update a specific line in the input box."""
        if not self._rendered or line_index >= self.height:
            return
        
        c = THEME
        
        # Calculate how far to move
        current_line = self.cursor_row
        move_amount = line_index - current_line
        
        if move_amount > 0:
            write(ANSI.move_down(move_amount))
        elif move_amount < 0:
            write(ANSI.move_up(-move_amount))
        
        # Move to start of line content
        write(ANSI.move_to_column(1))
        write(ANSI.CLEAR_LINE)
        
        # Rewrite the line
        line_num = f"{c['warning']}{line_index+1:2d}{c['reset']} " if self.show_line_numbers else ""
        content = text[:self.width - 6]  # Truncate if too long
        padded = pad_text(content, self.width - 6)
        
        write(f"{c['border']}{BOX['v']}{c['reset']} {line_num}{padded} {c['border']}{BOX['v']}{c['reset']}")
        
        # Update tracked position
        self.cursor_row = line_index
    
    def set_cursor(self, row: int, col: int) -> None:
        """Move cursor to specific position in input area."""
        # Adjust for line numbers
        col_offset = 6 if self.show_line_numbers else 4
        
        # Move vertically if needed
        if row != self.cursor_row:
            if row > self.cursor_row:
                write(ANSI.move_down(row - self.cursor_row))
            else:
                write(ANSI.move_up(self.cursor_row - row))
            self.cursor_row = row
        
        # Move horizontally
        write(ANSI.move_to_column(col_offset + col))
        self.cursor_col = col
    
    def finish(self) -> None:
        """Move cursor below the box after input is complete."""
        lines_below = self.height - self.cursor_row
        write(ANSI.move_down(lines_below + 1))
        write(ANSI.move_to_column(1))


class WelcomeBox:
    """The welcome/status box shown above input."""
    
    @staticmethod
    def render() -> None:
        """Render the welcome box."""
        cols, _ = get_terminal_size()
        width = cols - 4
        c = THEME
        
        def box_line(content: str) -> None:
            padded = pad_text(content, width)
            writeln(f"{c['border']}{BOX['v']}{c['reset']}{padded}{c['border']}{BOX['v']}{c['reset']}")
        
        writeln()
        writeln(f"{c['border']}{BOX['tl']}{BOX['h'] * width}{BOX['tr']}{c['reset']}")
        box_line(f"  ♾️  Ouroboros - Awaiting Command")
        writeln(f"{c['border']}{BOX['lj']}{BOX['h'] * width}{BOX['rj']}{c['reset']}")
        box_line(f"  {c['info']}⌨️  Shortcuts:{c['reset']}")
        box_line(f"    • Paste: auto-detected as multi-line")
        box_line(f"    • Multi-line: {c['warning']}<<<{c['reset']} to start, {c['warning']}>>>{c['reset']} to end")
        box_line(f"    • Submit: {c['success']}Enter{c['reset']} | Cancel: {c['error']}Ctrl+C{c['reset']}")
        writeln(f"{c['border']}{BOX['bl']}{BOX['h'] * width}{BOX['br']}{c['reset']}")
        writeln()


class OutputBox:
    """Box for displaying output to Copilot."""
    
    @staticmethod
    def render(marker: str, content: str) -> None:
        """Render output box to stdout (for Copilot)."""
        cols, _ = get_terminal_size()
        width = min(cols - 4, 60)
        sep = BOX['h'] * width
        
        print(f"{BOX['tl']}{sep}{BOX['tr']}")
        print(f"{BOX['v']} 📝 {marker.upper()}")
        print(f"{BOX['lj']}{sep}{BOX['rj']}")
        print(content)
        print(f"{BOX['bl']}{sep}{BOX['br']}")


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
