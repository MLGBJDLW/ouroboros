"""
Data layer package for Ouroboros TUI.

This package provides data management components including
TextBuffer, HistoryManager, and ConfigManager.

Uses lazy imports for fast startup (<200ms target).

"""

# Lazy import implementation for fast startup
_lazy_imports = {
    'TextBuffer': '.buffer',
    'HistoryManager': '.history',
    'ConfigManager': '.config',
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
