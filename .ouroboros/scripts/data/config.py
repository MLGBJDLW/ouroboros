"""
ConfigManager module.

This module provides configuration management with JSON persistence.


"""

import os
import sys
import json
from typing import Any, Optional

# Default config file path
SCRIPT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_CONFIG_FILE = os.path.join(SCRIPT_DIR, 'ouroboros.config.json')

# Default configuration values
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


class ConfigManager:
    """
    Manages configuration with JSON persistence.
    
    Features:
    - JSON persistence to ouroboros.config.json
    - Platform detection (windows/unix)
    - UI preferences (ansi_colors, unicode_box, theme)
    - Behavior settings (auto_multiline, compress_threshold, history_max_entries)
    - Fallback flag (use_fallback_input for IME issues)
    - Graceful handling of corrupted config file
    

    """

    def __init__(self, config_file: str = None):
        """
        Initialize ConfigManager.
        
        Args:
            config_file: Path to config file (default: ouroboros.config.json)
        """
        self.config_file = config_file or DEFAULT_CONFIG_FILE
        self.config = dict(DEFAULT_CONFIG)
        self._load()

    def _load(self) -> None:
        """
        Load config from file, create with defaults if not exists.
        
        Handles corrupted config file gracefully by using defaults.
        """
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    loaded = json.load(f)
                    self.config.update(loaded)
            else:
                # Create default config file
                self._save()
        except (IOError, OSError, json.JSONDecodeError, UnicodeDecodeError):
            # Handle corrupted file gracefully - use defaults
            self.config = dict(DEFAULT_CONFIG)


    def _save(self) -> None:
        """Save config to file."""
        try:
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, indent=2)
        except (IOError, OSError):
            pass  # Silently fail on save errors

    def get(self, key: str, default: Any = None) -> Any:
        """
        Get config value.
        
        Args:
            key: Configuration key
            default: Default value if key not found
            
        Returns:
            Configuration value or default
        """
        return self.config.get(key, default)

    def set(self, key: str, value: Any) -> None:
        """
        Set config value and save.
        
        Args:
            key: Configuration key
            value: Value to set
        """
        self.config[key] = value
        self._save()

    def reset(self) -> None:
        """Reset configuration to defaults."""
        self.config = dict(DEFAULT_CONFIG)
        self._save()

    @property
    def platform(self) -> str:
        """Get platform (windows/unix)."""
        return self.get('platform', DEFAULT_CONFIG['platform'])

    @property
    def ansi_colors(self) -> bool:
        """Get whether ANSI colors are enabled."""
        return self.get('ansi_colors', True)

    @property
    def unicode_box(self) -> bool:
        """Get whether Unicode box-drawing characters are enabled."""
        return self.get('unicode_box', True)

    @property
    def theme(self) -> str:
        """Get current theme name."""
        return self.get('theme', 'mystic_purple')

    @property
    def auto_multiline(self) -> bool:
        """Get whether auto-multiline mode is enabled."""
        return self.get('auto_multiline', True)

    @property
    def compress_threshold(self) -> int:
        """Get paste compression threshold (lines)."""
        return self.get('compress_threshold', 10)

    @property
    def history_max_entries(self) -> int:
        """Get maximum history entries."""
        return self.get('history_max_entries', 1000)

    @property
    def use_fallback_input(self) -> bool:
        """Get whether to use fallback input for IME compatibility."""
        return self.get('use_fallback_input', False)


# Global config instance
_config: Optional[ConfigManager] = None


def get_config() -> ConfigManager:
    """Get or create global config manager."""
    global _config
    if _config is None:
        _config = ConfigManager()
    return _config


def reset_global_config() -> None:
    """Reset global config instance (useful for testing)."""
    global _config
    _config = None
