#!/usr/bin/env python3
"""
ouroboros_screen.py - Double-Buffered Screen Rendering

Provides a virtual screen buffer that minimizes terminal flicker by:
1. Maintaining an off-screen buffer of the UI state
2. Computing diffs between frames
3. Only updating changed portions of the screen

This approach is used by professional CLI tools (similar to how React+Ink
works, but implemented in pure Python).

Dependencies: Python 3.6+ standard library only
"""

import sys
import os
from typing import Optional, List, Tuple
from enum import Enum, auto

# =============================================================================
# ANSI ESCAPE CODES
# =============================================================================

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
    
    # Cursor visibility
    HIDE_CURSOR = "\x1b[?25l"
    SHOW_CURSOR = "\x1b[?25h"
    
    # Save/restore cursor
    SAVE_CURSOR = "\x1b[s"
    RESTORE_CURSOR = "\x1b[u"
    
    # Reset
    RESET = "\x1b[0m"


# =============================================================================
# SCREEN CELL
# =============================================================================

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


# =============================================================================
# SCREEN BUFFER
# =============================================================================

class ScreenBuffer:
    """
    Double-buffered screen for flicker-free rendering.
    
    Usage:
        screen = ScreenBuffer(width=80, height=10)
        
        # Write to buffer (doesn't output yet)
        screen.write(0, 0, "Hello World", style="\x1b[32m")
        screen.write(1, 0, "Line 2")
        
        # Render only changed parts
        screen.render()
        
        # Move cursor to specific position
        screen.set_cursor(0, 5)
    
    The buffer only outputs what has changed since the last render,
    significantly reducing flicker and terminal overhead.
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
            style: ANSI style prefix (e.g., "\x1b[32m" for green)
        
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
        """
        Write a full line, optionally filling to width.
        
        Args:
            row: Row index (0-based)
            text: Text to write
            style: ANSI style prefix
            fill: If True, pad with spaces to fill the width
        """
        self.write(row, 0, text, style)
        
        if fill:
            # Fill remaining space
            text_len = len(text)
            if text_len < self.width:
                for col in range(text_len, self.width):
                    new_cell = Cell(' ', '')
                    if self._current[row][col] != new_cell:
                        self._current[row][col] = new_cell
                        self._dirty_rows.add(row)
    
    def render(self) -> None:
        """
        Render the buffer to the terminal.
        Only outputs changed rows to minimize flicker.
        """
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


# =============================================================================
# INPUT STATE MACHINE
# =============================================================================

class InputState(Enum):
    """States for the input state machine."""
    IDLE = auto()           # Ready for input
    TYPING = auto()         # User is typing
    PASTE_MODE = auto()     # Receiving pasted content
    HISTORY_BROWSE = auto() # Browsing command history
    SUBMITTING = auto()     # Processing submission
    CANCELLED = auto()      # User cancelled


class InputEvent(Enum):
    """Events that can trigger state transitions."""
    CHAR_INPUT = auto()     # Regular character typed
    PASTE_START = auto()    # Bracketed paste started
    PASTE_END = auto()      # Bracketed paste ended
    HISTORY_UP = auto()     # Up arrow for history
    HISTORY_DOWN = auto()   # Down arrow for history
    SUBMIT = auto()         # Submit input (Ctrl+D, >>>, etc.)
    CANCEL = auto()         # Cancel (Ctrl+C)
    ESCAPE = auto()         # Escape key


class StateMachine:
    """
    State machine for managing input modes.
    
    Provides clear state transitions and prevents invalid state combinations.
    
    Usage:
        sm = StateMachine()
        
        # Handle events
        sm.transition(InputEvent.CHAR_INPUT)
        
        # Check current state
        if sm.state == InputState.PASTE_MODE:
            # Handle paste...
            
        # Register callbacks
        sm.on_enter(InputState.PASTE_MODE, lambda: print("Paste started"))
        sm.on_exit(InputState.PASTE_MODE, lambda: print("Paste ended"))
    """
    
    # State transition table: (current_state, event) -> new_state
    TRANSITIONS = {
        # From IDLE
        (InputState.IDLE, InputEvent.CHAR_INPUT): InputState.TYPING,
        (InputState.IDLE, InputEvent.PASTE_START): InputState.PASTE_MODE,
        (InputState.IDLE, InputEvent.HISTORY_UP): InputState.HISTORY_BROWSE,
        (InputState.IDLE, InputEvent.SUBMIT): InputState.SUBMITTING,
        (InputState.IDLE, InputEvent.CANCEL): InputState.CANCELLED,
        
        # From TYPING
        (InputState.TYPING, InputEvent.CHAR_INPUT): InputState.TYPING,
        (InputState.TYPING, InputEvent.PASTE_START): InputState.PASTE_MODE,
        (InputState.TYPING, InputEvent.HISTORY_UP): InputState.HISTORY_BROWSE,
        (InputState.TYPING, InputEvent.SUBMIT): InputState.SUBMITTING,
        (InputState.TYPING, InputEvent.CANCEL): InputState.CANCELLED,
        (InputState.TYPING, InputEvent.ESCAPE): InputState.IDLE,
        
        # From PASTE_MODE
        (InputState.PASTE_MODE, InputEvent.PASTE_END): InputState.TYPING,
        (InputState.PASTE_MODE, InputEvent.CANCEL): InputState.CANCELLED,
        
        # From HISTORY_BROWSE
        (InputState.HISTORY_BROWSE, InputEvent.HISTORY_UP): InputState.HISTORY_BROWSE,
        (InputState.HISTORY_BROWSE, InputEvent.HISTORY_DOWN): InputState.HISTORY_BROWSE,
        (InputState.HISTORY_BROWSE, InputEvent.CHAR_INPUT): InputState.TYPING,
        (InputState.HISTORY_BROWSE, InputEvent.SUBMIT): InputState.SUBMITTING,
        (InputState.HISTORY_BROWSE, InputEvent.CANCEL): InputState.CANCELLED,
        (InputState.HISTORY_BROWSE, InputEvent.ESCAPE): InputState.IDLE,
        
        # From SUBMITTING - terminal state, needs explicit reset
        
        # From CANCELLED - terminal state, needs explicit reset
    }
    
    def __init__(self, initial_state: InputState = InputState.IDLE):
        self._state = initial_state
        self._enter_callbacks: dict = {}
        self._exit_callbacks: dict = {}
        self._transition_log: List[Tuple[InputState, InputEvent, InputState]] = []
    
    @property
    def state(self) -> InputState:
        """Get current state."""
        return self._state
    
    def transition(self, event: InputEvent) -> bool:
        """
        Attempt to transition to a new state based on the event.
        
        Args:
            event: The input event that occurred
            
        Returns:
            True if transition occurred, False if no valid transition
        """
        key = (self._state, event)
        
        if key not in self.TRANSITIONS:
            return False
        
        old_state = self._state
        new_state = self.TRANSITIONS[key]
        
        # Exit callback
        if old_state in self._exit_callbacks:
            for callback in self._exit_callbacks[old_state]:
                callback()
        
        # Update state
        self._state = new_state
        
        # Log transition
        self._transition_log.append((old_state, event, new_state))
        
        # Enter callback
        if new_state in self._enter_callbacks:
            for callback in self._enter_callbacks[new_state]:
                callback()
        
        return True
    
    def reset(self, to_state: InputState = InputState.IDLE) -> None:
        """Reset to a specific state (useful after terminal states)."""
        old_state = self._state
        
        if old_state in self._exit_callbacks:
            for callback in self._exit_callbacks[old_state]:
                callback()
        
        self._state = to_state
        
        if to_state in self._enter_callbacks:
            for callback in self._enter_callbacks[to_state]:
                callback()
    
    def on_enter(self, state: InputState, callback) -> None:
        """Register callback for when entering a state."""
        if state not in self._enter_callbacks:
            self._enter_callbacks[state] = []
        self._enter_callbacks[state].append(callback)
    
    def on_exit(self, state: InputState, callback) -> None:
        """Register callback for when exiting a state."""
        if state not in self._exit_callbacks:
            self._exit_callbacks[state] = []
        self._exit_callbacks[state].append(callback)
    
    def is_terminal_state(self) -> bool:
        """Check if current state is a terminal state (needs reset)."""
        return self._state in (InputState.SUBMITTING, InputState.CANCELLED)
    
    def get_transition_history(self) -> List[Tuple[InputState, InputEvent, InputState]]:
        """Get history of state transitions (for debugging)."""
        return self._transition_log.copy()
    
    def clear_history(self) -> None:
        """Clear transition history."""
        self._transition_log.clear()


# =============================================================================
# EXPORTS
# =============================================================================

__all__ = [
    'ANSI',
    'Cell',
    'ScreenBuffer',
    'InputState',
    'InputEvent',
    'StateMachine',
]
