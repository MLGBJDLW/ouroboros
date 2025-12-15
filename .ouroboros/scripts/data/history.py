"""
HistoryManager module.

This module provides command history with file persistence
and search functionality.


"""

import os
from typing import List, Optional

# Default history file path
SCRIPT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_HISTORY_FILE = os.path.join(SCRIPT_DIR, "ouroboros.history")


class HistoryManager:
    """
    Manages command history with file persistence.

    Features:
    - Persistent storage to ouroboros.history file
    - One entry per line, max entries configurable
    - Up/Down arrow navigation (go_back/go_forward)
    - Ctrl+R reverse search functionality
    - Avoids consecutive duplicate entries
    - Graceful handling of corrupted history file


    """

    def __init__(self, history_file: str = None, max_entries: int = 1000):
        """
        Initialize HistoryManager.

        Args:
            history_file: Path to history file (default: ouroboros.history)
            max_entries: Maximum number of entries to keep (default: 1000)
        """
        self.history_file = history_file or DEFAULT_HISTORY_FILE
        self.max_entries = max_entries
        self.entries: List[str] = []
        self.position = 0  # Current position in history (0 = oldest)
        self._temp_current = ""  # Temp storage for current input when browsing
        self._load()

    def _load(self) -> None:
        """
        Load history from file.

        Handles corrupted history file gracefully by starting with empty history.
        """
        try:
            if os.path.exists(self.history_file):
                with open(self.history_file, "r", encoding="utf-8") as f:
                    lines = f.read().strip().split("\n")
                    self.entries = [line for line in lines if line.strip()]
        except (IOError, OSError, UnicodeDecodeError):
            # Handle corrupted file gracefully - start with empty history
            self.entries = []
        self.position = len(self.entries)  # Start at end (newest)

    def _save(self) -> None:
        """Save history to file, keeping only max_entries."""
        try:
            # Keep only max_entries
            entries_to_save = self.entries[-self.max_entries :]
            with open(self.history_file, "w", encoding="utf-8") as f:
                f.write("\n".join(entries_to_save) + "\n")
        except (IOError, OSError):
            pass  # Silently fail on save errors

    def add(self, entry: str) -> None:
        """
        Add entry to history.

        Avoids consecutive duplicate entries.

        Args:
            entry: The command/input to add to history
        """
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
        """Reset position to end of history (newest)."""
        self.position = len(self.entries)
        self._temp_current = ""

    def go_back(self, current_input: str = "") -> str:
        """
        Go back in history (older entries).

        Used for Up arrow navigation.

        Args:
            current_input: Current input to save when starting to browse

        Returns:
            The history entry at the new position, or current input if at start
        """
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
        """
        Go forward in history (newer entries).

        Used for Down arrow navigation.

        Returns:
            The history entry at the new position, or temp current if at end
        """
        if self.position < len(self.entries) - 1:
            self.position += 1
            return self.entries[self.position]
        elif self.position == len(self.entries) - 1:
            self.position = len(self.entries)
            return self._temp_current
        return self._temp_current

    def search(self, query: str) -> List[str]:
        """
        Search history entries containing query.

        Used for Ctrl+R reverse search.
        Results are ordered by recency (most recent first).

        Args:
            query: Search query string

        Returns:
            List of matching entries, most recent first
        """
        if not query:
            # Return last 10 entries when no query
            return list(reversed(self.entries[-10:]))

        # Find all entries containing the query (case-insensitive)
        matches = [e for e in self.entries if query.lower() in e.lower()]

        # Return in reverse order (most recent first)
        return list(reversed(matches))

    def search_backward(self, query: str, start_index: int = None) -> Optional[str]:
        """
        Search backward from current position for entry containing query.

        Used for Ctrl+R repeated presses.

        Args:
            query: Search query string
            start_index: Index to start searching from (default: current position - 1)

        Returns:
            Matching entry or None if not found
        """
        if not query or not self.entries:
            return None

        if start_index is None:
            start_index = self.position - 1

        # Search backward from start_index
        for i in range(start_index, -1, -1):
            if query.lower() in self.entries[i].lower():
                self.position = i
                return self.entries[i]

        return None

    @property
    def at_end(self) -> bool:
        """Check if at end of history (newest position)."""
        return self.position >= len(self.entries)

    @property
    def at_start(self) -> bool:
        """Check if at start of history (oldest position)."""
        return self.position <= 0

    @property
    def current_entry(self) -> Optional[str]:
        """Get current entry at position, or None if at end."""
        if 0 <= self.position < len(self.entries):
            return self.entries[self.position]
        return None

    def __len__(self) -> int:
        """Return number of history entries."""
        return len(self.entries)
