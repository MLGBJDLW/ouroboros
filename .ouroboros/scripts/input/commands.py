"""
Slash command handler module.

This module provides slash command detection, fuzzy matching,
and autocomplete functionality.

Requirements: 8.1-8.6, 18.1-18.4, 32.1-32.6
"""

from typing import List, Tuple, Optional, Dict

# Slash commands for orchestrator mode switching (5 main orchestrators)
SLASH_COMMANDS: Dict[str, Dict[str, str]] = {
    "/ouroboros":           {"desc": "Main Orchestrator", "file": "ouroboros.agent.md"},
    "/ouroboros-init":      {"desc": "Project Init", "file": "ouroboros-init.agent.md"},
    "/ouroboros-spec":      {"desc": "Spec Workflow", "file": "ouroboros-spec.agent.md"},
    "/ouroboros-implement": {"desc": "Implementation", "file": "ouroboros-implement.agent.md"},
    "/ouroboros-archive":   {"desc": "Archive Specs", "file": "ouroboros-archive.agent.md"},
}


class SlashCommandHandler:
    """Handles slash command detection and autocomplete suggestions."""
    
    def __init__(self):
        self.active = False
        self.prefix = ""
        self.matches: List[str] = []
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
    
    def update(self, prefix: str) -> List[str]:
        """
        Update matches based on current prefix using fuzzy matching.
        
        Priority:
        1. Commands that start with the search term
        2. Commands that contain the search term elsewhere
        
        Args:
            prefix: The current input prefix (including leading /)
            
        Returns:
            List of matching command strings
        """
        self.prefix = prefix
        if prefix.startswith("/"):
            search_term = prefix[1:].lower()
            
            if not search_term:
                self.matches = list(SLASH_COMMANDS.keys())
            else:
                starts_with = []
                contains = []
                for cmd in SLASH_COMMANDS:
                    cmd_name = cmd[1:].lower()
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
    
    def tab_complete(self) -> str:
        """
        Tab completion logic.
        
        - If only one match exists, complete immediately and add a space
        - If multiple matches, cycle to next match
        - If no matches, return current prefix unchanged
        
        Returns:
            The completed command string
        """
        if not self.matches:
            return self.prefix
        
        if len(self.matches) == 1:
            result = self.matches[0] + " "
            self.cancel()
            return result
        
        # Cycle to next match
        self.selected_index = (self.selected_index + 1) % len(self.matches)
        return self.matches[self.selected_index]
    
    def cancel(self) -> None:
        """Cancel command mode."""
        self.active = False
        self.prefix = ""
        self.matches = []
        self.selected_index = 0
    
    def get_dropdown_lines(self, max_width: int = 60) -> List[str]:
        """Get formatted dropdown lines for display."""
        lines = []
        for i, cmd in enumerate(self.matches):
            info = SLASH_COMMANDS.get(cmd, {})
            desc = info.get("desc", "")
            marker = ">" if i == self.selected_index else " "
            line = f"{marker} {cmd:<25} — {desc}"
            lines.append(line[:max_width])
        return lines
    
    def get_dropdown_items(self) -> List[Tuple[str, str]]:
        """Get items for dropdown display as (command, description) tuples."""
        items = []
        for cmd in self.matches:
            info = SLASH_COMMANDS.get(cmd, {})
            desc = info.get("desc", "")
            items.append((cmd, desc))
        return items


def prepend_instruction(content: str) -> str:
    """
    Prepend an instruction to follow the corresponding agent prompt
    when content starts with a valid slash command.
    
    Example:
        Input:  "/ouroboros-spec create auth feature"
        Output: "Follow the prompt '.github/agents/ouroboros-spec.agent.md'\\n\\n/ouroboros-spec create auth feature"
    
    Args:
        content: The input content that may start with a slash command
        
    Returns:
        Content with agent instruction prepended if slash command detected,
        otherwise returns content unchanged
    """
    content_stripped = content.strip()
    
    # Sort by length descending to match longer commands first
    for cmd in sorted(SLASH_COMMANDS.keys(), key=len, reverse=True):
        if content_stripped.startswith(cmd):
            # Check that it's a complete command (followed by space, newline, or end)
            rest = content_stripped[len(cmd):]
            if not rest or rest[0] in (' ', '\n', '\t'):
                info = SLASH_COMMANDS[cmd]
                agent_file = info.get("file", "")
                if agent_file:
                    prompt_path = f".github/agents/{agent_file}"
                    prefix = f"Follow the prompt '{prompt_path}'\n\n"
                    return prefix + content
    
    return content


def get_agent_file_for_command(command: str) -> Optional[str]:
    """
    Get the agent file path for a given slash command.
    
    Args:
        command: The slash command (e.g., "/ouroboros-spec")
        
    Returns:
        The agent file name or None if not found
    """
    info = SLASH_COMMANDS.get(command)
    if info:
        return info.get("file")
    return None


def is_valid_slash_command(text: str) -> bool:
    """
    Check if text starts with a valid slash command.
    
    Args:
        text: The text to check
        
    Returns:
        True if text starts with a valid slash command
    """
    text_stripped = text.strip()
    for cmd in SLASH_COMMANDS:
        if text_stripped.startswith(cmd):
            rest = text_stripped[len(cmd):]
            if not rest or rest[0] in (' ', '\n', '\t'):
                return True
    return False
