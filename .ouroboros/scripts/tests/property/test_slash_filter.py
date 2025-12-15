"""
Property Test: Slash Command Filtering

**Feature: curses-tui-frontend, Property 4: Slash Command Filtering**
**Validates: Requirements 8.1-8.6**

Property 4: Slash Command Filtering
*For any* prefix string starting with `/`, the `update(prefix)` method SHALL return
only commands that contain the prefix substring (case-insensitive), with commands
starting with the prefix appearing before commands containing it elsewhere.
"""

import sys
import os
import unittest
import random
from typing import List

# Add scripts directory to path
sys.path.insert(
    0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

from tests.pbt_framework import property_test, Generator, StringGenerator
from input.commands import SlashCommandHandler, SLASH_COMMANDS


class SlashPrefixGenerator(Generator[str]):
    """Generate slash command prefixes for testing."""

    def __init__(self):
        # Extract all unique substrings from command names
        self.command_parts = []
        for cmd in SLASH_COMMANDS.keys():
            name = cmd[1:]  # Remove leading /
            for i in range(len(name)):
                for j in range(i + 1, len(name) + 1):
                    self.command_parts.append(name[i:j])

    def generate(self, rng: random.Random) -> str:
        # Generate various prefix types
        choice = rng.random()

        if choice < 0.3:
            # Just "/"
            return "/"
        elif choice < 0.6:
            # Prefix from actual command parts
            part = rng.choice(self.command_parts)
            # Take a random prefix of this part
            length = rng.randint(1, len(part))
            return "/" + part[:length]
        elif choice < 0.8:
            # Random lowercase string
            length = rng.randint(1, 10)
            chars = "".join(rng.choices("abcdefghijklmnopqrstuvwxyz-", k=length))
            return "/" + chars
        else:
            # Non-matching prefix
            return "/" + "xyz" + str(rng.randint(0, 100))

    def shrink(self, value: str) -> List[str]:
        if len(value) <= 1:
            return []
        return ["/", value[: len(value) // 2 + 1]]


class TestSlashCommandFiltering(unittest.TestCase):
    """
    Property 4: Slash Command Filtering

    **Feature: curses-tui-frontend, Property 4: Slash Command Filtering**
    **Validates: Requirements 8.1-8.6**
    """

    @property_test(SlashPrefixGenerator(), iterations=100)
    def test_filter_returns_only_matching_commands(self, prefix: str):
        """
        **Feature: curses-tui-frontend, Property 4: Slash Command Filtering**
        **Validates: Requirements 8.1-8.6**

        For any prefix starting with /, all returned commands must contain
        the search term as a substring (case-insensitive).
        """
        handler = SlashCommandHandler()
        matches = handler.update(prefix)

        # Extract search term (everything after /)
        search_term = prefix[1:].lower() if len(prefix) > 1 else ""

        for cmd in matches:
            cmd_name = cmd[1:].lower()  # Remove leading /
            self.assertIn(
                search_term,
                cmd_name,
                f"Command '{cmd}' does not contain search term '{search_term}'",
            )

    @property_test(SlashPrefixGenerator(), iterations=100)
    def test_filter_ordering_starts_with_before_contains(self, prefix: str):
        """
        **Feature: curses-tui-frontend, Property 4: Slash Command Filtering**
        **Validates: Requirements 8.2-8.3**

        Commands starting with the prefix should appear before commands
        that only contain the prefix elsewhere.
        """
        handler = SlashCommandHandler()
        matches = handler.update(prefix)

        if len(prefix) <= 1:
            # Just "/" - all commands match, no ordering requirement
            return

        search_term = prefix[1:].lower()

        # Find the boundary between starts_with and contains
        found_contains = False
        for cmd in matches:
            cmd_name = cmd[1:].lower()
            starts_with = cmd_name.startswith(search_term)

            if found_contains and starts_with:
                self.fail(
                    f"Command '{cmd}' starts with '{search_term}' but appears "
                    f"after a command that only contains it"
                )

            if not starts_with:
                found_contains = True

    @property_test(SlashPrefixGenerator(), iterations=100)
    def test_filter_completeness(self, prefix: str):
        """
        **Feature: curses-tui-frontend, Property 4: Slash Command Filtering**
        **Validates: Requirements 8.1-8.6**

        All commands that should match the prefix are included in results.
        """
        handler = SlashCommandHandler()
        matches = handler.update(prefix)

        search_term = prefix[1:].lower() if len(prefix) > 1 else ""

        # Check that all matching commands are included
        for cmd in SLASH_COMMANDS.keys():
            cmd_name = cmd[1:].lower()
            should_match = search_term in cmd_name

            if should_match:
                self.assertIn(
                    cmd,
                    matches,
                    f"Command '{cmd}' should match prefix '{prefix}' but was not included",
                )
            else:
                self.assertNotIn(
                    cmd,
                    matches,
                    f"Command '{cmd}' should not match prefix '{prefix}' but was included",
                )

    def test_empty_prefix_returns_all_commands(self):
        """
        **Feature: curses-tui-frontend, Property 4: Slash Command Filtering**
        **Validates: Requirements 8.1**

        When prefix is just "/", all commands should be returned.
        """
        handler = SlashCommandHandler()
        matches = handler.update("/")

        self.assertEqual(
            set(matches),
            set(SLASH_COMMANDS.keys()),
            "Just '/' should return all commands",
        )

    def test_non_slash_prefix_cancels_mode(self):
        """
        **Feature: curses-tui-frontend, Property 4: Slash Command Filtering**
        **Validates: Requirements 8.1**

        When prefix doesn't start with /, command mode should be cancelled.
        """
        handler = SlashCommandHandler()
        handler.start("/")

        # Update with non-slash prefix
        matches = handler.update("ouroboros")

        self.assertEqual(matches, [], "Non-slash prefix should return empty list")
        self.assertFalse(handler.active, "Handler should not be active")


if __name__ == "__main__":
    unittest.main()
