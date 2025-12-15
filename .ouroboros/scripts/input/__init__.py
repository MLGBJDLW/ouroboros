"""
Input handling package for Ouroboros TUI.

This package provides cross-platform keyboard input handling,
paste detection, clipboard access, and slash command processing.

Uses lazy imports for fast startup (<200ms target).

"""

# Lazy import implementation for fast startup
_lazy_imports = {
    # KeyBuffer
    'KeyBuffer': '.keybuffer',
    'Keys': '.keybuffer',
    'is_printable': '.keybuffer',
    'is_pipe_input': '.keybuffer',
    # Paste
    'PasteDetector': '.paste',
    'BracketedPasteHandler': '.paste',
    'PasteSequenceParser': '.paste',
    'enable_bracketed_paste': '.paste',
    'disable_bracketed_paste': '.paste',
    'create_paste_detector': '.paste',
    # Clipboard
    'ClipboardManager': '.clipboard',
    'read_clipboard': '.clipboard',
    'has_clipboard_support': '.clipboard',
    # Commands
    'SlashCommandHandler': '.commands',
    'SLASH_COMMANDS': '.commands',
    'prepend_instruction': '.commands',
    'get_agent_file_for_command': '.commands',
    'is_valid_slash_command': '.commands',
}

__all__ = list(_lazy_imports.keys())

# Cache for loaded modules
_loaded = {}


def __getattr__(name):
    """Lazy import handler for module attributes."""
    if name in _lazy_imports:
        module_name = _lazy_imports[name]
        if module_name not in _loaded:
            import importlib
            _loaded[module_name] = importlib.import_module(module_name, __package__)
        return getattr(_loaded[module_name], name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


def __dir__():
    """Return list of available attributes."""
    return __all__
