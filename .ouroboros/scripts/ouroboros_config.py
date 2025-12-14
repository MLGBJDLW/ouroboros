#!/usr/bin/env python3
"""
ouroboros_config.py - Configuration and History Management

Provides configuration persistence and command history for the Ouroboros CCL system.

Dependencies: Python 3.6+ standard library only
"""

import os
import sys
import json

# Config and history file paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(SCRIPT_DIR, 'ouroboros.config.json')
HISTORY_FILE = os.path.join(SCRIPT_DIR, 'ouroboros.history')

# =============================================================================
# DEFAULT CONFIGURATION
# =============================================================================

DEFAULT_CONFIG = {
    "platform": "windows" if sys.platform == 'win32' else "unix",
    "ansi_colors": True,
    "unicode_box": True,
    "theme": "mystic_purple",
    "auto_multiline": True,
    "compress_threshold": 10,
    "history_max_entries": 1000,
    "use_fallback_input": False,  # Set to True if IME input doesn't work
}


# =============================================================================
# CONFIG MANAGER
# =============================================================================

class ConfigManager:
    """Manages configuration with file persistence."""

    def __init__(self, config_file: str = CONFIG_FILE):
        self.config_file = config_file
        self.config = dict(DEFAULT_CONFIG)
        self._load()

    def _load(self) -> None:
        """Load config from file, create with defaults if not exists."""
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    loaded = json.load(f)
                    self.config.update(loaded)
            else:
                # Create default config file
                self._save()
        except (IOError, OSError, json.JSONDecodeError):
            pass

    def _save(self) -> None:
        """Save config to file."""
        try:
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, indent=2)
        except (IOError, OSError):
            pass

    def get(self, key: str, default=None):
        """Get config value."""
        return self.config.get(key, default)

    def set(self, key: str, value) -> None:
        """Set config value and save."""
        self.config[key] = value
        self._save()


# Global config instance
_config = None


def get_config() -> ConfigManager:
    """Get or create global config manager."""
    global _config
    if _config is None:
        _config = ConfigManager()
    return _config


# =============================================================================
# HISTORY MANAGER
# =============================================================================

class HistoryManager:
    """Manages command history with file persistence."""

    def __init__(self, history_file: str = HISTORY_FILE, max_entries: int = None):
        self.history_file = history_file
        # Use config value if not specified
        if max_entries is None:
            max_entries = get_config().get('history_max_entries', 1000)
        self.max_entries = max_entries
        self.entries = []
        self.position = 0  # Current position in history (0 = newest)
        self._temp_current = ''  # Temp storage for current input when browsing
        self._load()

    def _load(self) -> None:
        """Load history from file."""
        try:
            if os.path.exists(self.history_file):
                with open(self.history_file, 'r', encoding='utf-8') as f:
                    lines = f.read().strip().split('\n')
                    self.entries = [line for line in lines if line.strip()]
        except (IOError, OSError):
            self.entries = []
        self.position = len(self.entries)  # Start at end (newest)

    def _save(self) -> None:
        """Save history to file."""
        try:
            # Keep only max_entries
            entries_to_save = self.entries[-self.max_entries:]
            with open(self.history_file, 'w', encoding='utf-8') as f:
                f.write('\n'.join(entries_to_save) + '\n')
        except (IOError, OSError):
            pass

    def add(self, entry: str) -> None:
        """Add entry to history (avoid duplicates of last entry)."""
        entry = entry.strip()
        if not entry:
            return
        # Avoid duplicate of last entry
        if self.entries and self.entries[-1] == entry:
            return
        self.entries.append(entry)
        self._save()
        self.reset_position()

    def reset_position(self) -> None:
        """Reset position to end of history."""
        self.position = len(self.entries)
        self._temp_current = ''

    def go_back(self, current_input: str = '') -> str:
        """Go back in history (older). Returns the history entry or current input."""
        if not self.entries:
            return current_input

        # Save current input when starting to browse
        if self.position == len(self.entries):
            self._temp_current = current_input

        if self.position > 0:
            self.position -= 1
            return self.entries[self.position]

        return self.entries[0] if self.entries else current_input

    def go_forward(self) -> str:
        """Go forward in history (newer). Returns the history entry or temp current."""
        if self.position < len(self.entries) - 1:
            self.position += 1
            return self.entries[self.position]
        elif self.position == len(self.entries) - 1:
            self.position = len(self.entries)
            return self._temp_current
        return self._temp_current

    def search(self, prefix: str) -> list:
        """Search history entries starting with prefix."""
        if not prefix:
            return self.entries[-10:]  # Return last 10
        return [e for e in self.entries if e.startswith(prefix)][-10:]

    @property
    def at_end(self) -> bool:
        """Check if at end of history (newest position)."""
        return self.position >= len(self.entries)

    @property
    def at_start(self) -> bool:
        """Check if at start of history (oldest position)."""
        return self.position <= 0


# Global history instance
_history = None


def get_history() -> HistoryManager:
    """Get or create global history manager."""
    global _history
    if _history is None:
        _history = HistoryManager()
    return _history
