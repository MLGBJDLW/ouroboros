"""
Utility functions package for Ouroboros TUI.

This package provides text utilities, badge processing,
and file path detection functions.

Uses lazy imports for fast startup (<200ms target).

"""

# Lazy import implementation for fast startup
_lazy_imports = {
    # Text utilities
    "char_width": ".text",
    "visible_len": ".text",
    "strip_ansi": ".text",
    "pad_text": ".text",
    "wrap_text": ".text",
    # Badge utilities
    "create_file_marker": ".badge",
    "create_paste_marker": ".badge",
    "expand_markers": ".badge",
    "render_for_display": ".badge",
    "is_file_marker": ".badge",
    "is_paste_marker": ".badge",
    "extract_file_path": ".badge",
    "extract_paste_content": ".badge",
    "parse_paste_marker": ".badge",
    "format_file_badge": ".badge",
    "format_paste_badge": ".badge",
    "find_markers": ".badge",
    "get_marker_at_position": ".badge",
    # File path utilities
    "is_file_path": ".filepath",
    "get_file_extension": ".filepath",
    "get_file_category": ".filepath",
    "get_filename": ".filepath",
    "detect_windows_path_start": ".filepath",
    "is_windows_path_pattern": ".filepath",
    "FILE_EXTENSIONS": ".filepath",
    "ALL_EXTENSIONS": ".filepath",
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
