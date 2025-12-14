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
import re

# Add script directory to path for imports
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

# Import modular components
try:
    from ouroboros_keybuffer import KeyBuffer, Keys, is_pipe_input
    from ouroboros_ui import (
        ANSI, THEME, BOX, WelcomeBox, InputBox, OutputBox, SelectMenu,
        write, writeln, get_terminal_size, visible_len, pad_text, strip_ansi
    )
    from ouroboros_paste import PasteCollector
    from ouroboros_screen import StateMachine, InputState, InputEvent
    from ouroboros_config import ConfigManager, HistoryManager, get_config, get_history
    from ouroboros_filepath import (
        is_file_path, format_file_display, format_file_badge, process_pasted_content,
        convert_unmarked_file_paths, detect_file_path, get_file_extension,
        format_file_reference, format_paste_summary, detect_and_format_input,
        FILE_EXTENSIONS, ALL_EXTENSIONS, IMAGE_EXTENSIONS, DOC_EXTENSIONS, CODE_EXTENSIONS
    )
    from ouroboros_commands import (
        SlashCommandHandler, SLASH_COMMANDS, prepend_slash_command_instruction
    )
    from ouroboros_buffer import TextBuffer
    MODULES_AVAILABLE = True
    PASTE_AVAILABLE = True
    SCREEN_AVAILABLE = True
except ImportError as e:
    # Fallback - some modules may not be available
    MODULES_AVAILABLE = False
    PASTE_AVAILABLE = False
    SCREEN_AVAILABLE = False

VERSION = "2.0.0"

# =============================================================================
# FALLBACK IMPLEMENTATIONS (if modules not available)
# =============================================================================

if not MODULES_AVAILABLE:
    # Minimal fallback - use standard input()
    def is_pipe_input():
        return not sys.stdin.isatty()

    THEME = {
        'border': '\033[95m',
        'prompt': '\033[96m',
        'success': '\033[92m',
        'warning': '\033[93m',
        'error': '\033[91m',
        'info': '\033[94m',
        'accent': '\033[95m\033[1m',
        'dim': '\033[2m',
        'reset': '\033[0m',
    }

    def write(text):
        sys.stderr.write(text)
        sys.stderr.flush()

    def writeln(text=''):
        write(text + '\n')

    # Minimal fallback classes
    class ConfigManager:
        def __init__(self):
            self.config = {"history_max_entries": 1000}
        def get(self, key, default=None):
            return self.config.get(key, default)

    class HistoryManager:
        def __init__(self):
            self.entries = []
            self.position = 0
        def add(self, entry): pass
        def go_back(self, current=''): return current
        def go_forward(self): return ''
        def reset_position(self): pass
        @property
        def at_end(self): return True

    class SlashCommandHandler:
        def __init__(self):
            self.active = False
            self.matches = []
            self.selected_index = 0
        def start(self, char): return False
        def update(self, prefix): return []
        def move_up(self): return 0
        def move_down(self): return 0
        def cancel(self): pass

    class TextBuffer:
        def __init__(self):
            self.lines = ['']
            self.cursor_row = 0
            self.cursor_col = 0
            self.scroll_offset = 0
        @property
        def text(self): return '\n'.join(self.lines)
        @property
        def line_count(self): return len(self.lines)
        def insert_char(self, c): pass
        def insert_text(self, t): pass
        def newline(self): pass
        def backspace(self): return False
        def delete(self): return False
        def move_left(self): return False
        def move_right(self): return False
        def move_up(self): return False
        def move_down(self): return False
        def home(self): pass
        def end(self): pass
        def clear(self): self.lines = ['']
        def clear_line(self): pass
        def get_visible_lines(self, h): return self.lines[:h]
        def get_visible_cursor_row(self): return 0

    SLASH_COMMANDS = {}

    def get_config(): return ConfigManager()
    def get_history(): return HistoryManager()
    def is_file_path(t): return False
    def format_file_display(p): return f"[ {os.path.basename(p)} ]"
    def process_pasted_content(c): return (c, c, False)
    def convert_unmarked_file_paths(t): return t
    def prepend_slash_command_instruction(c): return c


# =============================================================================
# INPUT FUNCTIONS
# =============================================================================

def get_interactive_input_advanced(show_ui: bool = True, prompt_header: str = "", skip_welcome: bool = False) -> str:
    """
    Get input using real-time character-by-character reading.
    
    Args:
        show_ui: Whether to show the UI decorations
        prompt_header: Custom header text to show in input box (e.g., question)
        skip_welcome: Skip the WelcomeBox (use when caller already displayed it)
    
    Key bindings:
        Enter           - Insert new line (default multi-line mode)
        Ctrl+D          - Force submit (always works)
        Ctrl+Enter      - Force submit (may not work in some terminals)
        Ctrl+Shift+Enter- Format paste mode
        >>>             - Submit and exit
        <<<             - Legacy multi-line start (still works)
        Ctrl+C          - Cancel
        Ctrl+U          - Clear current line
        Ctrl+K          - Delete to end of line
        ↑/↓             - History navigation (first line) / Cursor move
        ←/→             - Cursor navigation
        Home/End        - Line start/end
        Backspace       - Delete before cursor
        Delete          - Delete at cursor
    """
    # Check if fallback mode is enabled (for IME support)
    if not MODULES_AVAILABLE or get_config().get('use_fallback_input', False):
        return get_fallback_input(show_ui)
    
    if show_ui and not skip_welcome:
        WelcomeBox.render()
    
    buffer = TextBuffer()
    history = get_history()
    # InputBox: Start with 1 line, dynamically expand up to 10 lines max
    # Beyond 10 lines, use internal scrolling to prevent terminal scrolling
    box = InputBox(height=1, show_line_numbers=True, show_status=True, 
                   full_width=True, prompt_header=prompt_header)
    box.set_mode("INPUT")  # Simple mode name
    
    if show_ui:
        box.render_initial()
    
    # Initialize state machine for clean state management
    state_machine = None
    if SCREEN_AVAILABLE:
        state_machine = StateMachine(InputState.IDLE)
        # Update UI mode based on state changes
        def on_paste_enter():
            box.set_mode("PASTE")
        def on_paste_exit():
            box.set_mode("INPUT")
        def on_history_enter():
            box.set_mode("HISTORY")
        def on_history_exit():
            box.set_mode("INPUT")
        state_machine.on_enter(InputState.PASTE_MODE, on_paste_enter)
        state_machine.on_exit(InputState.PASTE_MODE, on_paste_exit)
        state_machine.on_enter(InputState.HISTORY_BROWSE, on_history_enter)
        state_machine.on_exit(InputState.HISTORY_BROWSE, on_history_exit)
    
    history_browsing = False  # Track if we're browsing history (fallback)
    
    # Slash command handler for autocomplete
    slash_handler = SlashCommandHandler()
    dropdown_lines = 0  # Track dropdown lines for cleanup
    
    # Sync cursor position after render_initial
    if show_ui:
        box.set_cursor(0, 0, '')
    
    def update_slash_dropdown():
        """Update the slash command dropdown display."""
        nonlocal dropdown_lines
        if slash_handler.active and slash_handler.matches:
            # Build items with descriptions
            items = []
            for cmd in slash_handler.matches:
                info = SLASH_COMMANDS.get(cmd, {})
                desc = info.get("desc", "")
                items.append((cmd, desc))
            dropdown_lines = box.render_dropdown(items, slash_handler.selected_index, max_items=5)
        elif dropdown_lines > 0:
            box.clear_dropdown(dropdown_lines)
            dropdown_lines = 0
    
    def render_line_with_badges(line: str) -> str:
        """Convert «path» markers to [ filename ] badges for display."""
        import re
        # Find all «path» patterns and replace with badges
        def replace_badge(match):
            path = match.group(1)
            return f"{THEME['accent']}[ {os.path.basename(path)} ]{THEME['reset']}"
        return re.sub(r'«([^»]+)»', replace_badge, line)
    
    def calculate_display_cursor_col(line: str, cursor_col: int) -> tuple:
        """
        Calculate the display column position accounting for badge rendering.
        
        The buffer stores «/full/path/file.ext» but displays [ file.ext ].
        We need to calculate where the cursor should be in the displayed text.
        
        Returns:
            (display_col, display_text_before_cursor)
        """
        import re
        
        # Find all badge markers and their positions
        badge_pattern = re.compile(r'«([^»]+)»')
        
        # Build the display text and track cursor position
        display_parts = []
        last_end = 0
        cursor_display_col = 0
        found_cursor = False
        
        for match in badge_pattern.finditer(line):
            start, end = match.span()
            path = match.group(1)
            badge_text = f"[ {os.path.basename(path)} ]"
            
            # Add text before this badge
            if start > last_end:
                segment = line[last_end:start]
                display_parts.append(segment)
                if not found_cursor and cursor_col <= start:
                    # Cursor is in this segment
                    cursor_display_col = len(''.join(display_parts[:-1])) + (cursor_col - last_end)
                    found_cursor = True
            
            # Check if cursor is inside the badge marker
            if not found_cursor and cursor_col <= end:
                # Cursor is at or inside badge - put it at end of badge
                cursor_display_col = len(''.join(display_parts)) + len(badge_text)
                found_cursor = True
            
            display_parts.append(badge_text)
            last_end = end
        
        # Add remaining text after last badge
        if last_end < len(line):
            segment = line[last_end:]
            display_parts.append(segment)
            if not found_cursor:
                cursor_display_col = len(''.join(display_parts[:-1])) + (cursor_col - last_end)
                found_cursor = True
        
        if not found_cursor:
            cursor_display_col = len(''.join(display_parts))
        
        display_text = ''.join(display_parts)
        text_before = display_text[:cursor_display_col]
        
        return cursor_display_col, text_before
    
    def refresh_display():
        """Refresh the entire input box display."""
        visible_lines = buffer.get_visible_lines(box.height)
        for i in range(box.height):
            line_text = visible_lines[i] if i < len(visible_lines) else ''
            # Render file badges for display
            display_text = render_line_with_badges(line_text)
            box.update_line(i, display_text)
        visible_row = buffer.get_visible_cursor_row()
        box.set_scroll_info(buffer.line_count, buffer.scroll_offset)
        
        # Calculate cursor position accounting for badge rendering
        current_line = buffer.lines[buffer.cursor_row]
        display_col, text_before = calculate_display_cursor_col(current_line, buffer.cursor_col)
        box.set_cursor(visible_row, display_col, text_before)
    
    def show_status(msg: str):
        """Show a status message in the first line."""
        box.update_line(0, f"{THEME['info']}{msg}{THEME['reset']}")
    
    with KeyBuffer() as kb:
        # Initialize Bracketed Paste Mode for reliable paste detection
        paste_collector = None
        if PASTE_AVAILABLE:
            paste_collector = PasteCollector()
            paste_collector.enable()
        
        # Path detection for drag-drop (fallback when Bracketed Paste not supported)
        # Uses pattern-based detection instead of timing
        import time as _time
        
        # Path collection state
        path_buffer = []           # Characters collected for potential path
        path_collecting = False    # Are we collecting a potential path?
        path_wait_timeout = 0.100  # 100ms - wait for path input to complete
        last_char_time = 0
        
        # Debug mode - set to True to see what's happening
        DEBUG_PATH_DETECT = False
        
        def debug_log(msg: str):
            """Log debug message if debug mode is enabled."""
            if DEBUG_PATH_DETECT:
                write(f"\n{THEME['dim']}[DEBUG] {msg}{THEME['reset']}\n")
        
        def is_path_start(char: str, prev_char: str) -> bool:
            r"""
            Check if this character could be the start of a file path.
            
            Detects:
            - Windows: C:\ D:\ etc (letter + colon, next char should be \)
            - Unix: / at start of input or after space
            - Home: ~ at start of input or after space
            """
            # Check for drive letter pattern: previous was letter, current is ':'
            if char == ':' and prev_char and prev_char.isalpha():
                return True
            return False
        
        def is_path_trigger(char: str, buffer_text: str) -> bool:
            """
            Check if current char triggers path collection mode.
            
            Called when we see ':' after a letter (potential Windows path).
            """
            # Windows path: X: where X is a letter
            if char == ':':
                # Check if previous char in buffer is a drive letter
                if buffer_text and buffer_text[-1:].isalpha():
                    # Could be start of Windows path like C: or D:
                    return True
            return False
        
        def looks_like_path_start_at_cursor() -> bool:
            """
            Check if the text at cursor position looks like start of a path.
            Checks the current line content.
            """
            if buffer.cursor_col < 1:
                return False
            line = buffer.lines[buffer.cursor_row]
            # Get the last few characters before cursor
            start = max(0, buffer.cursor_col - 2)
            recent = line[start:buffer.cursor_col]
            # Check for X: pattern (Windows drive)
            if len(recent) >= 2 and recent[-1] == ':' and recent[-2].isalpha():
                return True
            return False
        
        def process_path_buffer(include_prefix: str = ""):
            """
            Process accumulated path buffer as potential file path.
            
            Args:
                include_prefix: Characters already in the main buffer that are part of the path
                               (e.g., "C" when we detected ":" and started collecting)
            """
            nonlocal path_buffer, path_collecting
            
            if not path_buffer and not include_prefix:
                path_collecting = False
                return False
            
            # Combine prefix (already in buffer) with collected chars
            collected = ''.join(path_buffer)
            full_content = include_prefix + collected
            path_buffer = []
            path_collecting = False
            
            debug_log(f"Processing path buffer: '{full_content[:50]}' (len={len(full_content)})")
            
            # Check if it's actually a file path
            if is_file_path(full_content.strip()):
                debug_log(f"Confirmed as file path!")
                
                # Remove the prefix from main buffer (it was already inserted)
                if include_prefix:
                    # Backspace to remove the prefix we already typed
                    for _ in include_prefix:
                        buffer.backspace()
                
                # Format as file path marker
                formatted = f"«{full_content.strip()}»"
                buffer.insert_text(formatted)
                refresh_display()
                return True
            else:
                debug_log(f"Not a file path, inserting as text")
                # Not a file path - just insert the collected characters normally
                # (prefix is already in buffer, just add the rest)
                buffer.insert_text(collected)
                refresh_display()
                return True
        
        try:
            while True:
                # Determine read timeout based on state
                # When collecting a path, use short timeout to detect end of input
                read_timeout = path_wait_timeout if path_collecting else None
                
                # Read input with paste detection if available
                if paste_collector:
                    key, is_paste = paste_collector.read(kb.getch, timeout=read_timeout)
                    if is_paste:
                        # Transition to paste mode
                        if state_machine:
                            state_machine.transition(InputEvent.PASTE_START)
                        
                        # Process pasted content - detect file paths
                        display_text, actual_text, is_file = process_pasted_content(key)
                        
                        if is_file:
                            # For file paths: store with special format
                            # Format: «/full/path/file.ext» 
                            # UI will render this as [ filename.ext ]
                            # AI receives the full path when text is extracted
                            formatted = f"«{actual_text.strip()}»"
                            buffer.insert_text(formatted)
                        else:
                            # Regular paste - insert as-is
                            buffer.insert_text(display_text)
                        
                        # Expand box up to 10 lines, then use internal scrolling
                        if buffer.line_count > box.height and box.height < 10:
                            box.expand_height(min(buffer.line_count, 10))
                        
                        # Transition out of paste mode
                        if state_machine:
                            state_machine.transition(InputEvent.PASTE_END)
                        
                        refresh_display()
                        continue
                else:
                    key = kb.getch(timeout=read_timeout)
                
                # Track time for path collection
                current_time = _time.time()
                
                # If we're collecting a path and got a non-printable key, process the buffer
                if path_collecting and path_buffer and not kb.is_printable(key):
                    # Get the prefix (drive letter) that's already in the main buffer
                    line = buffer.lines[buffer.cursor_row]
                    prefix = ""
                    if buffer.cursor_col >= 1 and line[buffer.cursor_col-1:buffer.cursor_col] == ':':
                        if buffer.cursor_col >= 2:
                            prefix = line[buffer.cursor_col-2:buffer.cursor_col]  # e.g., "C:"
                    process_path_buffer(prefix)
                
                if not key:
                    # Check for path collection timeout
                    if path_collecting and path_buffer:
                        time_since_last = current_time - last_char_time
                        if time_since_last > path_wait_timeout:
                            line = buffer.lines[buffer.cursor_row]
                            prefix = ""
                            if buffer.cursor_col >= 2:
                                # Check if we have "X:" pattern before cursor
                                potential_prefix = line[max(0, buffer.cursor_col-2):buffer.cursor_col]
                                if len(potential_prefix) == 2 and potential_prefix[1] == ':' and potential_prefix[0].isalpha():
                                    prefix = potential_prefix
                            process_path_buffer(prefix)
                    continue
                
                # Ctrl+C - Cancel
                if key == Keys.CTRL_C:
                    if show_ui:
                        box.finish()
                    # Fancy goodbye animation
                    import time as _time
                    goodbye_frames = [
                        f"{THEME['dim']}♾️  Goodbye...{THEME['reset']}",
                        f"{THEME['accent']}♾️  See you soon~{THEME['reset']}",
                        f"{THEME['border']}🐍 The serpent rests...{THEME['reset']}",
                    ]
                    for frame in goodbye_frames:
                        write(f"\r{' ' * 40}\r{frame}")
                        sys.stderr.flush()
                        _time.sleep(0.15)
                    writeln("")
                    sys.exit(130)
                
                # Handle Enter variants
                if kb.is_enter(key):
                    text = buffer.text.strip()
                    
                    # Ctrl+Enter - Force submit
                    if key == Keys.CTRL_ENTER:
                        if text:
                            # Convert any unmarked file paths before submitting
                            text = convert_unmarked_file_paths(text)
                            history.add(text)
                            if dropdown_lines > 0:
                                box.clear_dropdown(dropdown_lines)
                            if show_ui:
                                box.finish()
                            return text
                        continue
                    
                    # Check for >>> end marker
                    if text.rstrip().endswith('>>>'):
                        final_text = text.rsplit('>>>', 1)[0].rstrip()
                        if final_text:
                            # Convert any unmarked file paths before submitting
                            final_text = convert_unmarked_file_paths(final_text)
                            history.add(final_text)
                        if dropdown_lines > 0:
                            box.clear_dropdown(dropdown_lines)
                        if show_ui:
                            box.finish()
                        return final_text
                    
                    # Regular Enter - Add newline (default multi-line mode)
                    buffer.newline()
                    # Expand box up to 10 lines, then use internal scrolling
                    if buffer.line_count > box.height and box.height < 10:
                        box.expand_height(min(buffer.line_count, 10))
                    refresh_display()
                    continue
                
                # Ctrl+D - Force submit (reliable alternative to Ctrl+Enter)
                if key == Keys.CTRL_D:
                    text = buffer.text.strip()
                    if text:
                        # Convert any unmarked file paths before submitting
                        text = convert_unmarked_file_paths(text)
                        history.add(text)
                        if dropdown_lines > 0:
                            box.clear_dropdown(dropdown_lines)
                        if show_ui:
                            box.finish()
                        return text
                    continue
                
                # Backspace
                if kb.is_backspace(key):
                    old_line_count = buffer.line_count
                    if buffer.backspace():
                        # Shrink box if line count decreased (but keep minimum 1 line)
                        if buffer.line_count < old_line_count and buffer.line_count < box.height:
                            box.shrink_height(max(1, buffer.line_count))
                        # Update slash command state
                        current_line = buffer.lines[buffer.cursor_row]
                        line_stripped = current_line.strip()
                        # Check if still in command context
                        is_command_context = (
                            buffer.line_count == 1 and
                            buffer.cursor_row == 0 and
                            line_stripped.startswith('/') and
                            ' ' not in line_stripped
                        )
                        if is_command_context:
                            slash_handler.update(line_stripped)
                            if slash_handler.matches:
                                box.set_mode(f"Tab: complete | {len(slash_handler.matches)} matches")
                            else:
                                box.set_mode("No matching commands")
                            update_slash_dropdown()
                        elif slash_handler.active:
                            slash_handler.cancel()
                            box.set_mode("INPUT")
                            update_slash_dropdown()  # This will clear the dropdown
                        refresh_display()
                    continue
                
                # Delete
                if kb.is_delete(key):
                    old_line_count = buffer.line_count
                    if buffer.delete():
                        # Shrink box if line count decreased (but keep minimum 1 line)
                        if buffer.line_count < old_line_count and buffer.line_count < box.height:
                            box.shrink_height(max(1, buffer.line_count))
                        refresh_display()
                    continue
                
                # Arrow keys - Up/Down for slash command selection or history
                if key in (Keys.UP, Keys.UP_ALT, Keys.WIN_UP):
                    # If slash command mode is active, navigate suggestions
                    if slash_handler.active and slash_handler.matches:
                        slash_handler.move_up()
                        # Show selected command in status and update dropdown
                        selected = slash_handler.matches[slash_handler.selected_index]
                        hint = f"↑↓: select | Tab: {selected}"
                        box.set_mode(hint)
                        update_slash_dropdown()
                        continue
                    # On first line (row 0): browse history
                    if buffer.cursor_row == 0 and not buffer.move_up():
                        # Can't move up - we're at top, browse history
                        if state_machine and state_machine.state != InputState.HISTORY_BROWSE:
                            state_machine.transition(InputEvent.HISTORY_UP)
                        hist_entry = history.go_back(buffer.text)
                        if hist_entry != buffer.text:
                            buffer.clear()
                            buffer.insert_text(hist_entry)
                            history_browsing = True
                            refresh_display()
                    else:
                        refresh_display()
                    continue
                if key in (Keys.DOWN, Keys.DOWN_ALT, Keys.WIN_DOWN):
                    # If slash command mode is active, navigate suggestions
                    if slash_handler.active and slash_handler.matches:
                        slash_handler.move_down()
                        # Show selected command in status and update dropdown
                        selected = slash_handler.matches[slash_handler.selected_index]
                        hint = f"↑↓: select | Tab: {selected}"
                        box.set_mode(hint)
                        update_slash_dropdown()
                        continue
                    # On last line: browse history forward (if browsing)
                    if buffer.cursor_row == buffer.line_count - 1 and not buffer.move_down():
                        # Can't move down - we're at bottom
                        if history_browsing:
                            if state_machine:
                                state_machine.transition(InputEvent.HISTORY_DOWN)
                            hist_entry = history.go_forward()
                            buffer.clear()
                            buffer.insert_text(hist_entry)
                            if history.at_end:
                                history_browsing = False
                                # Exit history browsing mode
                                if state_machine:
                                    state_machine.transition(InputEvent.CHAR_INPUT)
                            refresh_display()
                    else:
                        refresh_display()
                    continue
                if key in (Keys.LEFT, Keys.LEFT_ALT, Keys.WIN_LEFT):
                    if buffer.move_left():
                        visible_row = buffer.get_visible_cursor_row()
                        text_before = buffer.lines[buffer.cursor_row][:buffer.cursor_col]
                        box.set_cursor(visible_row, buffer.cursor_col, text_before)
                    continue
                if key in (Keys.RIGHT, Keys.RIGHT_ALT, Keys.WIN_RIGHT):
                    if buffer.move_right():
                        visible_row = buffer.get_visible_cursor_row()
                        text_before = buffer.lines[buffer.cursor_row][:buffer.cursor_col]
                        box.set_cursor(visible_row, buffer.cursor_col, text_before)
                    continue
                
                # Ctrl+Left - Jump to previous word
                if key in (Keys.CTRL_LEFT, Keys.WIN_CTRL_LEFT):
                    line = buffer.lines[buffer.cursor_row]
                    col = buffer.cursor_col
                    # Skip spaces going left
                    while col > 0 and (col > len(line) or line[col-1] in ' \t'):
                        col -= 1
                    # Skip word characters going left
                    while col > 0 and col <= len(line) and line[col-1] not in ' \t':
                        col -= 1
                    buffer.cursor_col = col
                    visible_row = buffer.get_visible_cursor_row()
                    text_before = line[:col]
                    box.set_cursor(visible_row, col, text_before)
                    continue
                
                # Ctrl+Right - Jump to next word
                if key in (Keys.CTRL_RIGHT, Keys.WIN_CTRL_RIGHT):
                    line = buffer.lines[buffer.cursor_row]
                    col = buffer.cursor_col
                    line_len = len(line)
                    # Skip word characters going right
                    while col < line_len and line[col] not in ' \t':
                        col += 1
                    # Skip spaces going right
                    while col < line_len and line[col] in ' \t':
                        col += 1
                    buffer.cursor_col = col
                    visible_row = buffer.get_visible_cursor_row()
                    text_before = line[:col]
                    box.set_cursor(visible_row, col, text_before)
                    continue
                
                # Home/End (support ANSI, alternate, Windows, and Ctrl shortcuts)
                if key in (Keys.HOME, Keys.HOME_ALT, Keys.WIN_HOME, Keys.CTRL_A):
                    buffer.home()
                    visible_row = buffer.get_visible_cursor_row()
                    box.set_cursor(visible_row, buffer.cursor_col, '')  # At start, no text before
                    continue
                if key in (Keys.END, Keys.END_ALT, Keys.WIN_END, Keys.CTRL_E):
                    buffer.end()
                    visible_row = buffer.get_visible_cursor_row()
                    text_before = buffer.lines[buffer.cursor_row][:buffer.cursor_col]
                    box.set_cursor(visible_row, buffer.cursor_col, text_before)
                    continue
                
                # Ctrl+U - Clear current line
                if key == Keys.CTRL_U:
                    buffer.clear_line()
                    refresh_display()
                    continue
                
                # Ctrl+K - Delete to end of line
                if key == Keys.CTRL_K:
                    line = buffer.lines[buffer.cursor_row]
                    buffer.lines[buffer.cursor_row] = line[:buffer.cursor_col]
                    refresh_display()
                    continue
                
                # Tab - Slash command completion
                if key == '\t':
                    if slash_handler.active and slash_handler.matches:
                        # Complete with selected command
                        selected_cmd = slash_handler.matches[slash_handler.selected_index]
                        # Clear current line and insert completed command
                        buffer.clear_line()
                        buffer.insert_text(selected_cmd + " ")  # Add space after command
                        slash_handler.cancel()
                        box.set_mode("INPUT")
                        update_slash_dropdown()  # Clear dropdown
                        refresh_display()
                    continue
                
                # Escape - Cancel slash command mode
                if key == Keys.ESCAPE:
                    if slash_handler.active:
                        slash_handler.cancel()
                        box.set_mode("INPUT")
                        update_slash_dropdown()  # Clear dropdown
                    continue
                
                # Printable characters (including CJK from IME)
                if kb.is_printable(key):
                    time_since_last = current_time - last_char_time
                    
                    debug_log(f"Char '{key}' collecting={path_collecting} buffer={path_buffer}")
                    
                    # === Path Collection Mode ===
                    if path_collecting:
                        # We're collecting characters for a potential path
                        # Check if this char ends the path (space, newline, etc.)
                        if key in (' ', '\t'):
                            # Path ended - process it
                            line = buffer.lines[buffer.cursor_row]
                            prefix = ""
                            if buffer.cursor_col >= 2:
                                potential_prefix = line[max(0, buffer.cursor_col-2):buffer.cursor_col]
                                if len(potential_prefix) == 2 and potential_prefix[1] == ':' and potential_prefix[0].isalpha():
                                    prefix = potential_prefix
                            process_path_buffer(prefix)
                            # Insert the space/tab normally
                            buffer.insert_char(key)
                            last_char_time = current_time
                            refresh_display()
                            continue
                        else:
                            # Continue collecting path characters
                            path_buffer.append(key)
                            last_char_time = current_time
                            # Don't render yet - wait for path to complete
                            continue
                    
                    # === Check for Path Start Pattern ===
                    # Detect Windows path: when we see '\' after "X:" pattern
                    if key == '\\':
                        # Check if we just typed "X:" (drive letter + colon)
                        line = buffer.lines[buffer.cursor_row]
                        if buffer.cursor_col >= 2:
                            recent = line[buffer.cursor_col-2:buffer.cursor_col]
                            if len(recent) == 2 and recent[1] == ':' and recent[0].isalpha():
                                # This is "C:\" pattern - start collecting!
                                debug_log(f"Detected Windows path start: {recent}\\")
                                path_collecting = True
                                path_buffer = [key]  # Start with the backslash
                                last_char_time = current_time
                                continue  # Don't render yet
                    
                    # Update last char time
                    last_char_time = current_time
                    
                    # Transition to typing state if needed
                    if state_machine and state_machine.state != InputState.TYPING:
                        state_machine.transition(InputEvent.CHAR_INPUT)
                    
                    # Insert character one by one
                    buffer.insert_char(key)
                    
                    # Slash command detection: only when input is single line starting with /
                    # and no space (command not yet completed)
                    current_line = buffer.lines[buffer.cursor_row]
                    line_stripped = current_line.strip()
                    is_command_context = (
                        buffer.line_count == 1 and  # Only one line
                        buffer.cursor_row == 0 and  # On first line
                        line_stripped.startswith('/') and  # Starts with /
                        ' ' not in line_stripped  # No space (still typing command)
                    )
                    
                    if is_command_context:
                        # Activate or update slash handler
                        if not slash_handler.active:
                            slash_handler.start('/')
                        slash_handler.update(line_stripped)
                        # Update status bar with match count
                        match_count = len(slash_handler.matches)
                        if match_count > 0:
                            hint = f"Tab: complete | {match_count} matches"
                        else:
                            hint = "No matching commands"
                        box.set_mode(hint)
                        update_slash_dropdown()
                    elif slash_handler.active:
                        # No longer in command context, cancel
                        slash_handler.cancel()
                        box.set_mode("INPUT")
                        update_slash_dropdown()  # Clear dropdown
                    
                    visible_row = buffer.get_visible_cursor_row()
                    if visible_row < box.height:
                        # Render with badge formatting
                        display_text = render_line_with_badges(buffer.lines[buffer.cursor_row])
                        box.update_line(visible_row, display_text)
                        # Calculate cursor position accounting for badges
                        display_col, text_before = calculate_display_cursor_col(
                            buffer.lines[buffer.cursor_row], buffer.cursor_col
                        )
                        box.set_cursor(visible_row, display_col, text_before, update_status=False)
        except KeyboardInterrupt:
            if show_ui:
                box.finish()
            # Fancy goodbye animation
            import time as _time
            goodbye_frames = [
                f"{THEME['dim']}♾️  Goodbye...{THEME['reset']}",
                f"{THEME['accent']}♾️  See you soon~{THEME['reset']}",
                f"{THEME['border']}🐍 The serpent rests...{THEME['reset']}",
            ]
            for frame in goodbye_frames:
                write(f"\r{' ' * 40}\r{frame}")
                sys.stderr.flush()
                _time.sleep(0.15)
            writeln("")
            sys.exit(130)
        finally:
            # Clean up dropdown if visible
            if dropdown_lines > 0:
                box.clear_dropdown(dropdown_lines)
            # Disable Bracketed Paste Mode on exit
            if paste_collector:
                paste_collector.disable()
    
    return buffer.text


def get_fallback_input(show_ui: bool = True) -> str:
    """Fallback input using standard input() when modules not available."""
    c = THEME
    
    if show_ui:
        writeln()
        writeln(f"{c['border']}╔{'═' * 50}╗{c['reset']}")
        writeln(f"{c['border']}║{c['reset']}  [*]  Ouroboros - Awaiting Command{' ' * 15}{c['border']}║{c['reset']}")
        writeln(f"{c['border']}╚{'═' * 50}╝{c['reset']}")
        writeln()
    
    write(f"{c['prompt']}>{c['reset']} ")
    
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
        writeln(f"\n{c['error']}[x] Cancelled{c['reset']}")
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
        writeln(f"\n{THEME['error']}[x] Cancelled{THEME['reset']}")
        sys.exit(130)


def get_selection_input(options: list, title: str = "Select an option:", 
                        allow_custom: bool = True) -> str:
    """
    Interactive selection menu with arrow key navigation.
    Returns the selected option or custom input.
    
    Controls:
        Up/Down     - Navigate options
        Enter       - Select current option
        1-9         - Quick select by number
        /           - Start typing to filter (if many options)
        Ctrl+C      - Cancel
    """
    if not MODULES_AVAILABLE:
        # Fallback to numbered selection
        writeln(title)
        for i, opt in enumerate(options):
            writeln(f"  {i+1}. {opt}")
        if allow_custom:
            writeln(f"  {len(options)+1}. [Custom input...]")
        choice = get_simple_input("Enter number: ")
        try:
            idx = int(choice) - 1
            if 0 <= idx < len(options):
                return options[idx]
            elif allow_custom and idx == len(options):
                return get_simple_input("Enter custom input: ")
        except ValueError:
            pass
        return choice  # Return as-is if invalid
    
    menu = SelectMenu(options, title=title, allow_custom=allow_custom)
    menu.render()
    
    with KeyBuffer() as kb:
        while True:
            try:
                key = kb.getch()
                
                # Cancel: Ctrl+C or Escape
                if key == Keys.CTRL_C or key == Keys.ESCAPE:
                    writeln(f"\n{THEME['error']}[x] Cancelled{THEME['reset']}")
                    sys.exit(130)
                
                # Arrow navigation (support both ANSI and Windows key codes)
                if key in (Keys.UP, Keys.UP_ALT, Keys.WIN_UP):
                    menu.move_up()
                    continue
                
                if key in (Keys.DOWN, Keys.DOWN_ALT, Keys.WIN_DOWN):
                    menu.move_down()
                    continue
                
                # Page Up/Down for long menus
                if key in (Keys.PAGE_UP, Keys.WIN_PAGE_UP):
                    menu.page_up()
                    continue
                
                if key in (Keys.PAGE_DOWN, Keys.WIN_PAGE_DOWN):
                    menu.page_down()
                    continue
                
                # Quick number selection (1-9)
                if key.isdigit() and key != '0':
                    num = int(key)
                    if menu.select_by_number(num):
                        continue
                
                # Home/End for quick navigation (support ANSI, alternate, Windows)
                if key in (Keys.HOME, Keys.HOME_ALT, Keys.WIN_HOME):
                    menu.go_to_first()
                    continue
                if key in (Keys.END, Keys.END_ALT, Keys.WIN_END):
                    menu.go_to_last()
                    continue
                
                # Enter to select
                if kb.is_enter(key):
                    idx, value, is_custom = menu.get_selected()
                    writeln()  # Clear line
                    
                    if is_custom:
                        # Show enhanced custom input box with header
                        return get_interactive_input_advanced(show_ui=True, prompt_header="Custom input")
                    else:
                        return value
                
            except KeyboardInterrupt:
                writeln(f"\n{THEME['error']}[x] Cancelled{THEME['reset']}")
                sys.exit(130)


# =============================================================================
# OUTPUT FUNCTIONS
# =============================================================================

def format_output(marker: str, content: str) -> None:
    """Output formatted content to stdout for Copilot."""
    # Auto-prepend slash command instruction if applicable
    content = prepend_slash_command_instruction(content)
    
    if MODULES_AVAILABLE:
        OutputBox.render(marker, content)
    else:
        # Fallback output
        print(f"┌{'─' * 40}┐")
        print(f"│ [>] {marker.upper()}")
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


def parse_menu_options(header: str, prompt: str = "") -> tuple:
    """Parse numbered options from header text for interactive selection.
    
    Returns:
        Tuple of (title, options_list) if menu detected, (None, None) otherwise.
    
    Example:
        "Select action:\n1. Create feature\n2. Fix bug" 
        -> ("Select action:", ["Create feature", "Fix bug"])
        
        header="Continue?", prompt="[y/n]:"
        -> ("Continue?", ["Yes", "No"])
    """
    import re
    
    # Check for [y/n] confirmation pattern in prompt
    if prompt and re.search(r'\[y/n\]', prompt, re.IGNORECASE):
        # This is a yes/no confirmation
        title = header.replace('\\n', ' ').strip() if header else "Confirm"
        return (title, ["Yes", "No"])
    
    # Support both actual newlines and escaped \n from command line
    if '\\n' in header:
        lines = header.split('\\n')
    else:
        lines = header.split('\n')
    
    if len(lines) < 2:
        return (None, None)
    
    title = None
    options = []
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # Try to match numbered option patterns:
        # "1. Option", "1) Option", "[1] Option", "1: Option"
        match = re.match(r'^\s*[\[\(]?(\d+)[\.\)\]:\s]\s*(.+)$', line)
        
        if match:
            options.append(match.group(2).strip())
        elif not options:
            # First non-option line before options = title
            title = line
    
    # Only return if we found at least 2 options
    if len(options) >= 2:
        return (title or "Select an option:", options)
    
    return (None, None)


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
    parser.add_argument('--options', nargs='+', help='Options for selection menu (space-separated)')
    parser.add_argument('--no-custom', action='store_true', help='Disable custom input in selection menu')
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
    
    # Type B: Header/Menu - try to detect numbered options for arrow-key selection
    if args.header:
        # Try to parse menu options from header (also pass prompt for [y/n] detection)
        title, parsed_options = parse_menu_options(args.header, args.prompt)
        
        if parsed_options and MODULES_AVAILABLE:
            # Menu detected - use arrow-key selection
            content = get_selection_input(
                options=parsed_options,
                title=title,
                allow_custom=False if '[y/n]' in args.prompt.lower() else True
            )
            # Map Yes/No back to y/n for compatibility
            if '[y/n]' in args.prompt.lower():
                if content.lower().startswith('yes'):
                    content = 'y'
                elif content.lower().startswith('no'):
                    content = 'n'
        else:
            # Not a menu - show header as welcome message, then use InputBox UI
            if MODULES_AVAILABLE:
                # Display header as info box, then show interactive input (skip internal welcome)
                WelcomeBox.render(args.header)
                content = get_interactive_input_advanced(
                    show_ui=True, 
                    prompt_header=args.prompt if args.prompt else "[Ouroboros] > ",
                    skip_welcome=True  # Already displayed header above
                )
            else:
                # Fallback: show header box and get simple input
                print_header_box(args.header)
                if args.prompt:
                    content = get_simple_input(args.prompt)
                else:
                    content = get_simple_input()
        
        format_output(args.var, content)
        return
    
    # Selection menu mode (explicit --options)
    if args.options and MODULES_AVAILABLE:
        content = get_selection_input(
            options=args.options,
            title=args.prompt or "Select an option:",
            allow_custom=not args.no_custom
        )
        format_output(args.var, content)
        return
    
    # Type C/D/E: Prompt with enhanced UI (unless --no-ui)
    if args.prompt:
        if args.no_ui:
            content = get_simple_input(args.prompt)
        else:
            # Show prompt in input box header (integrated UI)
            content = get_interactive_input_advanced(show_ui=True, prompt_header=args.prompt)
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
