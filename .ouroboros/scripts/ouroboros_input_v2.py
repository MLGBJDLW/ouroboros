#!/usr/bin/env python3
"""
Ouroboros Enhanced Input Handler v2.0
Real-time input with dynamic UI updates.
"""

import sys
import os
import argparse
import time

# Add script directory to path for imports
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)

from ouroboros_keybuffer import KeyBuffer, Keys, is_pipe_input
from ouroboros_ui import (
    ANSI, THEME, WelcomeBox, InputBox, OutputBox,
    write, writeln, get_terminal_size, visible_len
)

VERSION = "2.0.0"

# =============================================================================
# TEXT BUFFER
# =============================================================================

class TextBuffer:
    """
    Multi-line text buffer with cursor management.
    """
    
    def __init__(self):
        self.lines = ['']
        self.cursor_row = 0
        self.cursor_col = 0
    
    @property
    def text(self) -> str:
        """Get full text content."""
        return '\n'.join(self.lines)
    
    def insert_char(self, char: str) -> None:
        """Insert a character at cursor position."""
        line = self.lines[self.cursor_row]
        self.lines[self.cursor_row] = line[:self.cursor_col] + char + line[self.cursor_col:]
        self.cursor_col += 1
    
    def insert_text(self, text: str) -> None:
        """Insert text (may contain newlines)."""
        for char in text:
            if char == '\n':
                self.newline()
            elif char != '\r':
                self.insert_char(char)
    
    def newline(self) -> None:
        """Insert a newline at cursor position."""
        line = self.lines[self.cursor_row]
        # Split current line
        self.lines[self.cursor_row] = line[:self.cursor_col]
        self.lines.insert(self.cursor_row + 1, line[self.cursor_col:])
        self.cursor_row += 1
        self.cursor_col = 0
    
    def backspace(self) -> bool:
        """Delete character before cursor. Returns True if successful."""
        if self.cursor_col > 0:
            line = self.lines[self.cursor_row]
            self.lines[self.cursor_row] = line[:self.cursor_col-1] + line[self.cursor_col:]
            self.cursor_col -= 1
            return True
        elif self.cursor_row > 0:
            # Join with previous line
            prev_line = self.lines[self.cursor_row - 1]
            curr_line = self.lines[self.cursor_row]
            self.lines[self.cursor_row - 1] = prev_line + curr_line
            del self.lines[self.cursor_row]
            self.cursor_row -= 1
            self.cursor_col = len(prev_line)
            return True
        return False
    
    def delete(self) -> bool:
        """Delete character at cursor. Returns True if successful."""
        line = self.lines[self.cursor_row]
        if self.cursor_col < len(line):
            self.lines[self.cursor_row] = line[:self.cursor_col] + line[self.cursor_col+1:]
            return True
        elif self.cursor_row < len(self.lines) - 1:
            # Join with next line
            next_line = self.lines[self.cursor_row + 1]
            self.lines[self.cursor_row] = line + next_line
            del self.lines[self.cursor_row + 1]
            return True
        return False
    
    def move_left(self) -> bool:
        """Move cursor left."""
        if self.cursor_col > 0:
            self.cursor_col -= 1
            return True
        elif self.cursor_row > 0:
            self.cursor_row -= 1
            self.cursor_col = len(self.lines[self.cursor_row])
            return True
        return False
    
    def move_right(self) -> bool:
        """Move cursor right."""
        line = self.lines[self.cursor_row]
        if self.cursor_col < len(line):
            self.cursor_col += 1
            return True
        elif self.cursor_row < len(self.lines) - 1:
            self.cursor_row += 1
            self.cursor_col = 0
            return True
        return False
    
    def move_up(self) -> bool:
        """Move cursor up."""
        if self.cursor_row > 0:
            self.cursor_row -= 1
            self.cursor_col = min(self.cursor_col, len(self.lines[self.cursor_row]))
            return True
        return False
    
    def move_down(self) -> bool:
        """Move cursor down."""
        if self.cursor_row < len(self.lines) - 1:
            self.cursor_row += 1
            self.cursor_col = min(self.cursor_col, len(self.lines[self.cursor_row]))
            return True
        return False
    
    def home(self) -> None:
        """Move cursor to start of line."""
        self.cursor_col = 0
    
    def end(self) -> None:
        """Move cursor to end of line."""
        self.cursor_col = len(self.lines[self.cursor_row])
    
    def clear(self) -> None:
        """Clear all text."""
        self.lines = ['']
        self.cursor_row = 0
        self.cursor_col = 0


# =============================================================================
# INTERACTIVE INPUT
# =============================================================================

def get_interactive_input(show_ui: bool = True) -> str:
    """
    Get input using real-time character-by-character reading.
    """
    if show_ui:
        WelcomeBox.render()
    
    buffer = TextBuffer()
    box = InputBox(height=5, show_line_numbers=True)
    
    if show_ui:
        box.render_initial()
    
    multiline_mode = False
    
    with KeyBuffer() as kb:
        while True:
            try:
                key = kb.getch()
                
                # Handle Ctrl+C
                if key == Keys.CTRL_C:
                    writeln(f"\n{THEME['error']}✗ Cancelled{THEME['reset']}")
                    sys.exit(130)
                
                # Handle Enter
                if kb.is_enter(key):
                    text = buffer.text.strip()
                    
                    # Check for multiline start trigger
                    if text == '<<<':
                        multiline_mode = True
                        buffer.clear()
                        box.update_line(0, f"{THEME['info']}Multi-line mode. Type >>> to submit.{THEME['reset']}")
                        continue
                    
                    # Check for multiline end trigger
                    if multiline_mode and text.endswith('>>>'):
                        # Remove the >>> and submit
                        final_text = text[:-3].rstrip()
                        if show_ui:
                            box.finish()
                        return final_text
                    
                    # Single line submit
                    if not multiline_mode and text:
                        if show_ui:
                            box.finish()
                        return text
                    
                    # In multiline mode, Enter adds a newline
                    if multiline_mode:
                        buffer.newline()
                        if buffer.cursor_row < box.height:
                            box.update_line(buffer.cursor_row, '')
                        box.set_cursor(buffer.cursor_row, 0)
                        continue
                
                # Handle backspace
                if kb.is_backspace(key):
                    old_row = buffer.cursor_row
                    if buffer.backspace():
                        # Redraw affected lines
                        if buffer.cursor_row != old_row:
                            # Line join happened
                            for i in range(buffer.cursor_row, min(len(buffer.lines) + 1, box.height)):
                                line_text = buffer.lines[i] if i < len(buffer.lines) else ''
                                box.update_line(i, line_text)
                        else:
                            box.update_line(buffer.cursor_row, buffer.lines[buffer.cursor_row])
                        box.set_cursor(buffer.cursor_row, buffer.cursor_col)
                    continue
                
                # Handle arrow keys
                if key == Keys.UP:
                    if buffer.move_up():
                        box.set_cursor(buffer.cursor_row, buffer.cursor_col)
                    continue
                if key == Keys.DOWN:
                    if buffer.move_down():
                        box.set_cursor(buffer.cursor_row, buffer.cursor_col)
                    continue
                if key == Keys.LEFT:
                    if buffer.move_left():
                        box.set_cursor(buffer.cursor_row, buffer.cursor_col)
                    continue
                if key == Keys.RIGHT:
                    if buffer.move_right():
                        box.set_cursor(buffer.cursor_row, buffer.cursor_col)
                    continue
                
                # Handle Home/End
                if key in (Keys.HOME, Keys.HOME_ALT, Keys.CTRL_A):
                    buffer.home()
                    box.set_cursor(buffer.cursor_row, buffer.cursor_col)
                    continue
                if key in (Keys.END, Keys.END_ALT, Keys.CTRL_E):
                    buffer.end()
                    box.set_cursor(buffer.cursor_row, buffer.cursor_col)
                    continue
                
                # Handle Ctrl+U (clear line)
                if key == Keys.CTRL_U:
                    buffer.lines[buffer.cursor_row] = ''
                    buffer.cursor_col = 0
                    box.update_line(buffer.cursor_row, '')
                    box.set_cursor(buffer.cursor_row, 0)
                    continue
                
                # Handle printable characters
                if kb.is_printable(key):
                    buffer.insert_char(key)
                    if buffer.cursor_row < box.height:
                        box.update_line(buffer.cursor_row, buffer.lines[buffer.cursor_row])
                        box.set_cursor(buffer.cursor_row, buffer.cursor_col)
                
            except KeyboardInterrupt:
                writeln(f"\n{THEME['error']}✗ Cancelled{THEME['reset']}")
                sys.exit(130)
    
    return buffer.text


def get_pipe_input() -> str:
    """Read input from pipe/stdin."""
    return sys.stdin.read().strip()


# =============================================================================
# MAIN
# =============================================================================

def parse_args():
    parser = argparse.ArgumentParser(description='Ouroboros Enhanced Input v2')
    parser.add_argument('--var', default='task', help='Variable name for output')
    parser.add_argument('--no-ui', action='store_true', help='Disable UI elements')
    parser.add_argument('--version', action='version', version=f'%(prog)s {VERSION}')
    return parser.parse_args()


def main():
    args = parse_args()
    
    # Check if input is from pipe
    if is_pipe_input():
        content = get_pipe_input()
    else:
        content = get_interactive_input(show_ui=not args.no_ui)
    
    # Output for Copilot
    if content:
        OutputBox.render(args.var, content)


if __name__ == '__main__':
    main()
