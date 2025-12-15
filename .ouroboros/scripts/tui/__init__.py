"""
TUI (Text User Interface) package for Ouroboros.

This package provides curses-based terminal UI components with
fallback to ANSI rendering when curses is unavailable.

Uses lazy imports for fast startup (<200ms target).

"""

# Lazy import implementation for fast startup
_lazy_imports = {
    # Main application
    "TUIApp": ".app",
    "run_tui": ".app",
    # Output formatting
    "format_output": ".output",
    "strip_ansi": ".output",
    "write_output": ".output",
    "write_ui": ".output",
    "has_ansi_codes": ".output",
    "validate_output_purity": ".output",
    "OutputFormatter": ".output",
    "get_formatter": ".output",
    # Main components
    "ScreenManager": ".screen",
    "curses_available": ".screen",
    "Window": ".window",
    "ThemeManager": ".theme",
    "style": ".theme",
    # Fallback components
    "ANSI": ".fallback",
    "FallbackScreen": ".fallback",
    "FallbackWindow": ".fallback",
    "FallbackScreenBuffer": ".fallback",
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
