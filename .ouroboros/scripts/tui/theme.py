"""
ThemeManager module.

This module manages color pairs and styling for the Mystic Purple theme.

Requirements: 9.1-9.7
"""

import sys
from typing import Dict, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from .screen import ScreenManager
    from .window import Window

# Try to import curses
try:
    import curses
    _curses_available = True
except ImportError:
    _curses_available = False


class ThemeManager:
    """
    Manages color pairs and text attributes for the Mystic Purple theme.
    
    Provides a unified interface for styling that works with both
    curses and ANSI fallback modes.
    
    Color Scheme (Mystic Purple):
    - Border: Magenta (95)
    - Prompt: Cyan (96)
    - Success: Green (92)
    - Warning: Yellow (93)
    - Error: Red (91)
    - Accent: Bold Magenta (95;1)
    - Dim: Gray (90)
    """
    
    # Color pair IDs for curses
    PAIR_BORDER = 1
    PAIR_PROMPT = 2
    PAIR_SUCCESS = 3
    PAIR_WARNING = 4
    PAIR_ERROR = 5
    PAIR_ACCENT = 6
    PAIR_DIM = 7
    PAIR_TEXT = 8
    
    # ANSI color codes (256-color mode)
    ANSI_COLORS = {
        'border': '\x1b[95m',       # Bright magenta
        'prompt': '\x1b[96m',       # Bright cyan
        'success': '\x1b[92m',      # Bright green
        'warning': '\x1b[93m',      # Bright yellow
        'error': '\x1b[91m',        # Bright red
        'accent': '\x1b[95m\x1b[1m',  # Bold bright magenta
        'dim': '\x1b[90m',          # Bright black (gray)
        'text': '\x1b[0m',          # Default
        'reset': '\x1b[0m',         # Reset
    }
    
    # Curses color mappings (using standard colors)
    CURSES_COLORS = {
        'border': (curses.COLOR_MAGENTA, -1) if _curses_available else (5, -1),
        'prompt': (curses.COLOR_CYAN, -1) if _curses_available else (6, -1),
        'success': (curses.COLOR_GREEN, -1) if _curses_available else (2, -1),
        'warning': (curses.COLOR_YELLOW, -1) if _curses_available else (3, -1),
        'error': (curses.COLOR_RED, -1) if _curses_available else (1, -1),
        'accent': (curses.COLOR_MAGENTA, -1) if _curses_available else (5, -1),
        'dim': (curses.COLOR_WHITE, -1) if _curses_available else (7, -1),
        'text': (-1, -1),
    }
    
    def __init__(self, screen: Optional['ScreenManager'] = None):
        """
        Initialize ThemeManager.
        
        Args:
            screen: Parent ScreenManager (optional)
        """
        self.screen = screen
        self.colors_available = False
        self._initialized = False
        self._attr_cache: Dict[str, int] = {}
    
    def init_colors(self) -> bool:
        """
        Initialize color pairs for Mystic Purple theme.
        
        Returns:
            True if colors were initialized, False if monochrome
        """
        if self._initialized:
            return self.colors_available
        
        self._initialized = True
        
        if not _curses_available:
            self.colors_available = False
            return False
        
        try:
            if not curses.has_colors():
                self.colors_available = False
                return False
            
            # Initialize color pairs
            curses.init_pair(self.PAIR_BORDER, curses.COLOR_MAGENTA, -1)
            curses.init_pair(self.PAIR_PROMPT, curses.COLOR_CYAN, -1)
            curses.init_pair(self.PAIR_SUCCESS, curses.COLOR_GREEN, -1)
            curses.init_pair(self.PAIR_WARNING, curses.COLOR_YELLOW, -1)
            curses.init_pair(self.PAIR_ERROR, curses.COLOR_RED, -1)
            curses.init_pair(self.PAIR_ACCENT, curses.COLOR_MAGENTA, -1)
            curses.init_pair(self.PAIR_DIM, curses.COLOR_WHITE, -1)
            curses.init_pair(self.PAIR_TEXT, -1, -1)
            
            self.colors_available = True
            return True
            
        except curses.error:
            self.colors_available = False
            return False
    
    def get_attr(self, name: str) -> int:
        """
        Get curses attribute for named style.
        
        Args:
            name: Style name ('border', 'prompt', 'success', etc.)
            
        Returns:
            Curses attribute value (or 0 for monochrome)
        """
        # Check cache
        if name in self._attr_cache:
            return self._attr_cache[name]
        
        if not _curses_available or not self.colors_available:
            return 0
        
        attr = 0
        
        if name == 'border':
            attr = curses.color_pair(self.PAIR_BORDER)
        elif name == 'prompt':
            attr = curses.color_pair(self.PAIR_PROMPT)
        elif name == 'success':
            attr = curses.color_pair(self.PAIR_SUCCESS)
        elif name == 'warning':
            attr = curses.color_pair(self.PAIR_WARNING)
        elif name == 'error':
            attr = curses.color_pair(self.PAIR_ERROR)
        elif name == 'accent':
            attr = curses.color_pair(self.PAIR_ACCENT) | curses.A_BOLD
        elif name == 'dim':
            attr = curses.color_pair(self.PAIR_DIM) | curses.A_DIM
        elif name == 'text':
            attr = curses.color_pair(self.PAIR_TEXT)
        elif name == 'bold':
            attr = curses.A_BOLD
        elif name == 'underline':
            attr = curses.A_UNDERLINE
        elif name == 'reverse':
            attr = curses.A_REVERSE
        
        self._attr_cache[name] = attr
        return attr
    
    def get_ansi(self, name: str) -> str:
        """
        Get ANSI escape code for named style.
        
        Args:
            name: Style name ('border', 'prompt', 'success', etc.)
            
        Returns:
            ANSI escape code string
        """
        return self.ANSI_COLORS.get(name, '')
    
    def apply(self, win: 'Window', name: str) -> None:
        """
        Apply named style to window (sets default attribute).
        
        Args:
            win: Window to apply style to
            name: Style name
        """
        if _curses_available and win.win is not None:
            attr = self.get_attr(name)
            try:
                win.win.attrset(attr)
            except curses.error:
                pass
    
    def reset(self, win: 'Window') -> None:
        """
        Reset window to default style.
        
        Args:
            win: Window to reset
        """
        if _curses_available and win.win is not None:
            try:
                win.win.attrset(0)
            except curses.error:
                pass
    
    def styled_text(self, text: str, name: str) -> str:
        """
        Wrap text with ANSI style codes.
        
        Args:
            text: Text to style
            name: Style name
            
        Returns:
            Text wrapped with ANSI codes
        """
        style = self.get_ansi(name)
        reset = self.ANSI_COLORS['reset']
        
        if style:
            return f'{style}{text}{reset}'
        return text
    
    def combine_attrs(self, *names: str) -> int:
        """
        Combine multiple style attributes.
        
        Args:
            *names: Style names to combine
            
        Returns:
            Combined curses attribute
        """
        result = 0
        for name in names:
            result |= self.get_attr(name)
        return result
    
    @staticmethod
    def supports_colors() -> bool:
        """
        Check if terminal supports colors.
        
        Returns:
            True if colors are supported
        """
        if not _curses_available:
            return False
        
        try:
            return curses.has_colors()
        except Exception:
            return False
    
    @staticmethod
    def supports_256_colors() -> bool:
        """
        Check if terminal supports 256 colors.
        
        Returns:
            True if 256 colors are supported
        """
        if not _curses_available:
            return False
        
        try:
            return curses.COLORS >= 256
        except Exception:
            return False


# Convenience function for quick styling
def style(text: str, name: str) -> str:
    """
    Quick function to style text with ANSI codes.
    
    Args:
        text: Text to style
        name: Style name
        
    Returns:
        Styled text
    """
    return ThemeManager().styled_text(text, name)
