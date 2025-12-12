#!/usr/bin/env python3
"""
ouroboros_input.py - Enhanced CCL Input Handler v2.0

Part of the Ouroboros system. Provides enhanced terminal input with:
- Real-time character input with dynamic UI
- Pre-reserved input box with visible borders
- Mystic Purple theme
- Multi-line support (<<< to start, >>> to end)
- Auto paste detection
- File path detection

Output separation:
- stderr: UI decorations (user sees)
- stdout: Clean formatted output (Copilot reads)

Usage:
    python ouroboros_input.py                                    # Type A: CCL
    python ouroboros_input.py --header "MENU" --prompt "Choice:" # Type B: Menu
    python ouroboros_input.py --prompt "Name:" --var feature     # Type C: Free-form

Dependencies: Python 3.6+ standard library only (msvcrt/tty/termios)
"""

import sys
import os
import argparse

# Add script directory to path for imports
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

try:
    from ouroboros_keybuffer import KeyBuffer, Keys, is_pipe_input
    from ouroboros_ui import (
        ANSI, THEME, BOX, WelcomeBox, InputBox, OutputBox,
        write, writeln, get_terminal_size, visible_len, pad_text, strip_ansi
    )
    MODULES_AVAILABLE = True
except ImportError:
    MODULES_AVAILABLE = False

VERSION = "2.0.0"

# =============================================================================
# FALLBACK IMPLEMENTATIONS (if modules not available)
# =============================================================================

if not MODULES_AVAILABLE:
    # Minimal fallback - use standard input()
    def is_pipe_input():
        return not sys.stdin.isatty()
    
    class THEME:
        pass
    THEME = {
        'border': '\033[95m',
        'prompt': '\033[96m',
        'success': '\033[92m',
        'warning': '\033[93m',
        'error': '\033[91m',
        'info': '\033[94m',
        'reset': '\033[0m',
    }
    
    def write(text):
        sys.stderr.write(text)
        sys.stderr.flush()
    
    def writeln(text=''):
        write(text + '\n')

# =============================================================================
# TEXT BUFFER
# =============================================================================

class TextBuffer:
    """Multi-line text buffer with cursor management."""
    
    def __init__(self):
        self.lines = ['']
        self.cursor_row = 0
        self.cursor_col = 0
    
    @property
    def text(self) -> str:
        return '\n'.join(self.lines)
    
    def insert_char(self, char: str) -> None:
        line = self.lines[self.cursor_row]
        self.lines[self.cursor_row] = line[:self.cursor_col] + char + line[self.cursor_col:]
        self.cursor_col += 1
    
    def insert_text(self, text: str) -> None:
        for char in text:
            if char == '\n':
                self.newline()
            elif char != '\r':
                self.insert_char(char)
    
    def newline(self) -> None:
        line = self.lines[self.cursor_row]
        self.lines[self.cursor_row] = line[:self.cursor_col]
        self.lines.insert(self.cursor_row + 1, line[self.cursor_col:])
        self.cursor_row += 1
        self.cursor_col = 0
    
    def backspace(self) -> bool:
        if self.cursor_col > 0:
            line = self.lines[self.cursor_row]
            self.lines[self.cursor_row] = line[:self.cursor_col-1] + line[self.cursor_col:]
            self.cursor_col -= 1
            return True
        elif self.cursor_row > 0:
            prev_line = self.lines[self.cursor_row - 1]
            curr_line = self.lines[self.cursor_row]
            self.lines[self.cursor_row - 1] = prev_line + curr_line
            del self.lines[self.cursor_row]
            self.cursor_row -= 1
            self.cursor_col = len(prev_line)
            return True
        return False
    
    def move_left(self) -> bool:
        if self.cursor_col > 0:
            self.cursor_col -= 1
            return True
        elif self.cursor_row > 0:
            self.cursor_row -= 1
            self.cursor_col = len(self.lines[self.cursor_row])
            return True
        return False
    
    def move_right(self) -> bool:
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
        if self.cursor_row > 0:
            self.cursor_row -= 1
            self.cursor_col = min(self.cursor_col, len(self.lines[self.cursor_row]))
            return True
        return False
    
    def move_down(self) -> bool:
        if self.cursor_row < len(self.lines) - 1:
            self.cursor_row += 1
            self.cursor_col = min(self.cursor_col, len(self.lines[self.cursor_row]))
            return True
        return False
    
    def home(self) -> None:
        self.cursor_col = 0
    
    def end(self) -> None:
        self.cursor_col = len(self.lines[self.cursor_row])
    
    def clear(self) -> None:
        self.lines = ['']
        self.cursor_row = 0
        self.cursor_col = 0

# =============================================================================
# INPUT FUNCTIONS
# =============================================================================

def get_interactive_input_advanced(show_ui: bool = True) -> str:
    """Get input using real-time character-by-character reading."""
    if not MODULES_AVAILABLE:
        return get_fallback_input(show_ui)
    
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
                
                # Ctrl+C
                if key == Keys.CTRL_C:
                    writeln(f"\n{THEME['error']}✗ Cancelled{THEME['reset']}")
                    sys.exit(130)
                
                # Enter
                if kb.is_enter(key):
                    text = buffer.text.strip()
                    
                    # Multiline start
                    if text == '<<<':
                        multiline_mode = True
                        buffer.clear()
                        if show_ui:
                            box.update_line(0, f"{THEME['info']}Multi-line mode. Type >>> to submit.{THEME['reset']}")
                        continue
                    
                    # Multiline end
                    if multiline_mode and text.rstrip().endswith('>>>'):
                        final_text = text.rsplit('>>>', 1)[0].rstrip()
                        if show_ui:
                            box.finish()
                        return final_text
                    
                    # Single line submit
                    if not multiline_mode and text:
                        if show_ui:
                            box.finish()
                        return text
                    
                    # Add newline in multiline mode
                    if multiline_mode:
                        buffer.newline()
                        if buffer.cursor_row < box.height:
                            box.update_line(buffer.cursor_row, '')
                        box.set_cursor(buffer.cursor_row, 0)
                        continue
                
                # Backspace
                if kb.is_backspace(key):
                    old_row = buffer.cursor_row
                    if buffer.backspace():
                        if buffer.cursor_row != old_row:
                            for i in range(buffer.cursor_row, min(len(buffer.lines) + 1, box.height)):
                                line_text = buffer.lines[i] if i < len(buffer.lines) else ''
                                box.update_line(i, line_text)
                        else:
                            box.update_line(buffer.cursor_row, buffer.lines[buffer.cursor_row])
                        box.set_cursor(buffer.cursor_row, buffer.cursor_col)
                    continue
                
                # Arrow keys
                if key == Keys.UP and buffer.move_up():
                    box.set_cursor(buffer.cursor_row, buffer.cursor_col)
                    continue
                if key == Keys.DOWN and buffer.move_down():
                    box.set_cursor(buffer.cursor_row, buffer.cursor_col)
                    continue
                if key == Keys.LEFT and buffer.move_left():
                    box.set_cursor(buffer.cursor_row, buffer.cursor_col)
                    continue
                if key == Keys.RIGHT and buffer.move_right():
                    box.set_cursor(buffer.cursor_row, buffer.cursor_col)
                    continue
                
                # Home/End
                if key in (Keys.HOME, Keys.HOME_ALT, Keys.CTRL_A):
                    buffer.home()
                    box.set_cursor(buffer.cursor_row, buffer.cursor_col)
                    continue
                if key in (Keys.END, Keys.END_ALT, Keys.CTRL_E):
                    buffer.end()
                    box.set_cursor(buffer.cursor_row, buffer.cursor_col)
                    continue
                
                # Ctrl+U (clear line)
                if key == Keys.CTRL_U:
                    buffer.lines[buffer.cursor_row] = ''
                    buffer.cursor_col = 0
                    box.update_line(buffer.cursor_row, '')
                    box.set_cursor(buffer.cursor_row, 0)
                    continue
                
                # Printable characters
                if kb.is_printable(key):
                    buffer.insert_char(key)
                    if buffer.cursor_row < box.height:
                        box.update_line(buffer.cursor_row, buffer.lines[buffer.cursor_row])
                        box.set_cursor(buffer.cursor_row, buffer.cursor_col)
                
            except KeyboardInterrupt:
                writeln(f"\n{THEME['error']}✗ Cancelled{THEME['reset']}")
                sys.exit(130)
    
    return buffer.text


def get_fallback_input(show_ui: bool = True) -> str:
    """Fallback input using standard input() when modules not available."""
    c = THEME
    
    if show_ui:
        writeln()
        writeln(f"{c['border']}╔{'═' * 50}╗{c['reset']}")
        writeln(f"{c['border']}║{c['reset']}  ♾️  Ouroboros - Awaiting Command{' ' * 15}{c['border']}║{c['reset']}")
        writeln(f"{c['border']}╚{'═' * 50}╝{c['reset']}")
        writeln()
    
    write(f"{c['prompt']}❯{c['reset']} ")
    
    try:
        line = input()
        if line.strip() == '<<<':
            # Multiline mode
            writeln(f"  {c['info']}Multi-line mode. Type >>> to submit:{c['reset']}")
            lines = []
            while True:
                try:
                    next_line = input("  │ ")
                    if next_line.strip() == '>>>':
                        break
                    lines.append(next_line)
                except EOFError:
                    break
            return '\n'.join(lines)
        return line
    except EOFError:
        return ""
    except KeyboardInterrupt:
        writeln(f"\n{c['error']}✗ Cancelled{c['reset']}")
        sys.exit(130)


def get_pipe_input() -> str:
    """Read input from pipe/stdin."""
    return sys.stdin.read().strip()


def get_simple_input(prompt: str = "") -> str:
    """Simple input for Type B/C/D/E prompts."""
    if prompt:
        write(prompt + " ")
    try:
        return input()
    except EOFError:
        return ""
    except KeyboardInterrupt:
        writeln(f"\n{THEME['error']}✗ Cancelled{THEME['reset']}")
        sys.exit(130)


# =============================================================================
# OUTPUT FUNCTIONS
# =============================================================================

def format_output(marker: str, content: str) -> None:
    """Output formatted content to stdout for Copilot."""
    if MODULES_AVAILABLE:
        OutputBox.render(marker, content)
    else:
        # Fallback output
        print(f"┌{'─' * 40}┐")
        print(f"│ 📝 {marker.upper()}")
        print(f"├{'─' * 40}┤")
        print(content)
        print(f"└{'─' * 40}┘")


def print_header_box(header: str) -> None:
    """Print a header/menu box (Type B)."""
    c = THEME
    writeln()
    writeln(f"{c['border']}╔{'═' * 50}╗{c['reset']}")
    for line in header.split('\\n'):
        padded = line[:48].ljust(48)
        writeln(f"{c['border']}║{c['reset']} {padded} {c['border']}║{c['reset']}")
    writeln(f"{c['border']}╚{'═' * 50}╝{c['reset']}")
    writeln()


# =============================================================================
# MAIN
# =============================================================================

def parse_args():
    parser = argparse.ArgumentParser(
        description='Ouroboros Enhanced Input Handler v2',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument('--var', default='task', help='Variable name for output marker')
    parser.add_argument('--prompt', default='', help='Custom prompt text')
    parser.add_argument('--header', default='', help='Header/menu text (Type B)')
    parser.add_argument('--no-ui', action='store_true', help='Disable UI decorations')
    parser.add_argument('--ascii', action='store_true', help='Use ASCII characters')
    parser.add_argument('--no-color', action='store_true', help='Disable colors')
    parser.add_argument('--reset-config', action='store_true', help='Reset configuration')
    parser.add_argument('--version', action='version', version=f'%(prog)s {VERSION}')
    return parser.parse_args()


def main():
    args = parse_args()
    
    # Update theme if colors disabled
    if args.no_color:
        for key in THEME:
            THEME[key] = ''
    
    # Type B: Header/Menu
    if args.header:
        print_header_box(args.header)
        if args.prompt:
            content = get_simple_input(args.prompt)
        else:
            content = get_simple_input()
        format_output(args.var, content)
        return
    
    # Type C/D/E: Simple prompt
    if args.prompt:
        content = get_simple_input(args.prompt)
        format_output(args.var, content)
        return
    
    # Type A: CCL (main mode)
    if is_pipe_input():
        content = get_pipe_input()
    else:
        content = get_interactive_input_advanced(show_ui=not args.no_ui)
    
    if content:
        format_output(args.var, content)


if __name__ == '__main__':
    main()
