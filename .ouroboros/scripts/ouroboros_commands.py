#!/usr/bin/env python3
"""
ouroboros_commands.py - Slash Command Handler

Provides slash command detection, autocomplete, and handling for the Ouroboros CCL system.

Dependencies: Python 3.6+ standard library only
"""

# =============================================================================
# SLASH COMMANDS DEFINITION
# =============================================================================

# Slash commands for orchestrator mode switching (5 main orchestrators)
SLASH_COMMANDS = {
    "/ouroboros":           {"desc": "Main Orchestrator", "file": "ouroboros.agent.md"},
    "/ouroboros-init":      {"desc": "Project Init", "file": "ouroboros-init.agent.md"},
    "/ouroboros-spec":      {"desc": "Spec Workflow", "file": "ouroboros-spec.agent.md"},
    "/ouroboros-implement": {"desc": "Implementation", "file": "ouroboros-implement.agent.md"},
    "/ouroboros-archive":   {"desc": "Archive Specs", "file": "ouroboros-archive.agent.md"},
}


# =============================================================================
# SLASH COMMAND HANDLER
# =============================================================================

class SlashCommandHandler:
    """Handles slash command detection and autocomplete suggestions."""

    def __init__(self):
        self.active = False
        self.prefix = ""
        self.matches = []
        self.selected_index = 0

    def start(self, char: str = "/") -> bool:
        """Start command mode if char is '/'. Returns True if started."""
        if char == "/" and not self.active:
            self.active = True
            self.prefix = "/"
            self.matches = list(SLASH_COMMANDS.keys())
            self.selected_index = 0
            return True
        return False

    def update(self, prefix: str) -> list:
        """Update matches based on current prefix using fuzzy matching."""
        self.prefix = prefix
        if prefix.startswith("/"):
            # Extract search term (remove leading /)
            search_term = prefix[1:].lower()

            if not search_term:
                # Just "/" - show all commands
                self.matches = list(SLASH_COMMANDS.keys())
            else:
                # Fuzzy match: command contains the search term
                # Priority: 1) starts with search term, 2) contains search term
                starts_with = []
                contains = []
                for cmd in SLASH_COMMANDS:
                    cmd_name = cmd[1:].lower()  # Remove leading /
                    if cmd_name.startswith(search_term):
                        starts_with.append(cmd)
                    elif search_term in cmd_name:
                        contains.append(cmd)
                self.matches = starts_with + contains

            if self.selected_index >= len(self.matches):
                self.selected_index = max(0, len(self.matches) - 1)
        else:
            self.cancel()
        return self.matches

    def move_up(self) -> int:
        """Move selection up. Returns new index."""
        if self.matches and self.selected_index > 0:
            self.selected_index -= 1
        return self.selected_index

    def move_down(self) -> int:
        """Move selection down. Returns new index."""
        if self.matches and self.selected_index < len(self.matches) - 1:
            self.selected_index += 1
        return self.selected_index

    def complete(self) -> str:
        """Complete with selected command. Returns completed text."""
        if self.matches and 0 <= self.selected_index < len(self.matches):
            result = self.matches[self.selected_index]
            self.cancel()
            return result
        return self.prefix

    def cancel(self) -> None:
        """Cancel command mode."""
        self.active = False
        self.prefix = ""
        self.matches = []
        self.selected_index = 0

    def get_dropdown_lines(self, max_width: int = 60) -> list:
        """Get formatted dropdown lines for display."""
        lines = []
        for i, cmd in enumerate(self.matches):
            info = SLASH_COMMANDS.get(cmd, {})
            desc = info.get("desc", "")
            marker = ">" if i == self.selected_index else " "
            line = f"{marker} {cmd:<25} — {desc}"
            lines.append(line[:max_width])
        return lines

    def get_dropdown_items(self) -> list:
        """Get items for dropdown display as (command, description) tuples."""
        items = []
        for cmd in self.matches:
            info = SLASH_COMMANDS.get(cmd, {})
            desc = info.get("desc", "")
            items.append((cmd, desc))
        return items


# =============================================================================
# COMMAND INSTRUCTION PREPENDING
# =============================================================================

def prepend_slash_command_instruction(content: str) -> str:
    """
    Prepend an instruction to follow the corresponding agent prompt
    when content starts with a valid slash command.

    Example:
        Input:  "/ouroboros-spec create auth feature"
        Output: "Follow the prompt '.github/agents/ouroboros-spec.agent.md'\n\n/ouroboros-spec create auth feature"
    """
    content_stripped = content.strip()

    # Check if content starts with a valid slash command
    # Sort by length descending to match longer commands first (e.g., /ouroboros-spec before /ouroboros)
    for cmd in sorted(SLASH_COMMANDS.keys(), key=len, reverse=True):
        if content_stripped.startswith(cmd):
            info = SLASH_COMMANDS[cmd]
            agent_file = info.get("file", "")
            if agent_file:
                prompt_path = f".github/agents/{agent_file}"
                prefix = f"Follow the prompt '{prompt_path}'\n\n"
                return prefix + content

    # No slash command detected, return as-is
    return content
