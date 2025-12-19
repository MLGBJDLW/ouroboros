"""
Property Test: Agent Instruction Prepending

**Feature: curses-tui-frontend, Property 10: Agent Instruction Prepending**
**Validates: Requirements 32.1-32.6**

Property 10: Agent Instruction Prepending
*For any* content starting with a valid slash command, the `prepend_instruction(content)`
function SHALL prepend exactly `Follow the prompt '.github/agents/{agent}.agent.md'\\n\\n`
where {agent} matches the command's agent file.
"""

import sys
import os
import unittest
import random
from typing import List

# Add scripts directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from tests.pbt_framework import property_test, Generator, StringGenerator
from input.commands import (
    prepend_instruction,
    SLASH_COMMANDS,
    get_agent_file_for_command,
    is_valid_slash_command,
)


class SlashCommandContentGenerator(Generator[str]):
    """Generate content starting with valid slash commands."""

    def __init__(self):
        self.commands = list(SLASH_COMMANDS.keys())

    def generate(self, rng: random.Random) -> str:
        cmd = rng.choice(self.commands)

        # Generate various content after the command
        choice = rng.random()

        if choice < 0.2:
            # Just the command
            return cmd
        elif choice < 0.5:
            # Command with space and text
            text_len = rng.randint(1, 50)
            text = "".join(rng.choices("abcdefghijklmnopqrstuvwxyz ", k=text_len))
            return f"{cmd} {text}"
        elif choice < 0.7:
            # Command with newline and text
            text_len = rng.randint(1, 30)
            text = "".join(rng.choices("abcdefghijklmnopqrstuvwxyz ", k=text_len))
            return f"{cmd}\n{text}"
        else:
            # Command with multiple lines
            lines = []
            for _ in range(rng.randint(1, 5)):
                line_len = rng.randint(0, 40)
                line = "".join(rng.choices("abcdefghijklmnopqrstuvwxyz ", k=line_len))
                lines.append(line)
            return f"{cmd} " + "\n".join(lines)

    def shrink(self, value: str) -> List[str]:
        # Try just the command
        for cmd in self.commands:
            if value.startswith(cmd):
                return [cmd]
        return []


class NonSlashContentGenerator(Generator[str]):
    """Generate content that does NOT start with a valid slash command."""

    def generate(self, rng: random.Random) -> str:
        choice = rng.random()

        if choice < 0.3:
            # Regular text
            text_len = rng.randint(1, 50)
            return "".join(rng.choices("abcdefghijklmnopqrstuvwxyz ", k=text_len))
        elif choice < 0.5:
            # Invalid slash command
            return "/invalid-command some text"
        elif choice < 0.7:
            # Partial command name
            return "/ouro"  # Not a complete valid command
        else:
            # Empty or whitespace
            return rng.choice(["", "   ", "\n\n"])

    def shrink(self, value: str) -> List[str]:
        return ["hello"]


class TestAgentInstructionPrepending(unittest.TestCase):
    """
    Property 10: Agent Instruction Prepending

    **Feature: curses-tui-frontend, Property 10: Agent Instruction Prepending**
    **Validates: Requirements 32.1-32.6**
    """

    @property_test(SlashCommandContentGenerator(), iterations=100)
    def test_prepend_instruction_format(self, content: str):
        """
        **Feature: curses-tui-frontend, Property 10: Agent Instruction Prepending**
        **Validates: Requirements 32.1-32.6**

        For any content starting with a valid slash command, prepend_instruction
        should prepend exactly the expected instruction format.
        """
        result = prepend_instruction(content)

        # Find which command was used
        content_stripped = content.strip()
        matched_cmd = None
        for cmd in sorted(SLASH_COMMANDS.keys(), key=len, reverse=True):
            if content_stripped.startswith(cmd):
                rest = content_stripped[len(cmd) :]
                if not rest or rest[0] in (" ", "\n", "\t"):
                    matched_cmd = cmd
                    break

        self.assertIsNotNone(matched_cmd, f"Content should start with valid command: {content}")

        # Get expected agent file
        agent_file = get_agent_file_for_command(matched_cmd)
        self.assertIsNotNone(agent_file, f"Command {matched_cmd} should have agent file")

        # Check the result format
        expected_prefix = f"Follow the prompt '.github/agents/{agent_file}'\n\n"

        self.assertTrue(
            result.startswith(expected_prefix),
            f"Result should start with '{expected_prefix}' but got '{result[:100]}...'",
        )

        # Check that original content is preserved after prefix
        self.assertTrue(result.endswith(content), f"Original content should be preserved at end")

        # Check exact structure
        self.assertEqual(
            result,
            expected_prefix + content,
            f"Result should be exactly prefix + original content",
        )

    @property_test(NonSlashContentGenerator(), iterations=100)
    def test_no_prepend_for_non_slash_content(self, content: str):
        """
        **Feature: curses-tui-frontend, Property 10: Agent Instruction Prepending**
        **Validates: Requirements 32.1-32.6**

        For content that does NOT start with a valid slash command,
        prepend_instruction should return the content unchanged.
        """
        result = prepend_instruction(content)

        self.assertEqual(result, content, f"Non-slash content should be returned unchanged")

    def test_specific_commands(self):
        """
        **Feature: curses-tui-frontend, Property 10: Agent Instruction Prepending**
        **Validates: Requirements 32.2-32.6**

        Test each specific slash command maps to correct agent file.
        """
        expected_mappings = {
            "/ouroboros": "ouroboros.agent.md",
            "/ouroboros-spec": "ouroboros-spec.agent.md",
            "/ouroboros-init": "ouroboros-init.agent.md",
            "/ouroboros-implement": "ouroboros-implement.agent.md",
            "/ouroboros-archive": "ouroboros-archive.agent.md",
        }

        for cmd, expected_file in expected_mappings.items():
            content = f"{cmd} test content"
            result = prepend_instruction(content)

            expected_prefix = f"Follow the prompt '.github/agents/{expected_file}'\n\n"

            self.assertTrue(
                result.startswith(expected_prefix),
                f"Command {cmd} should map to {expected_file}",
            )

    def test_longer_command_matched_first(self):
        """
        **Feature: curses-tui-frontend, Property 10: Agent Instruction Prepending**
        **Validates: Requirements 32.1-32.6**

        When content starts with a longer command that is a prefix of a shorter one,
        the longer command should be matched.
        """
        # /ouroboros-spec should be matched, not /ouroboros
        content = "/ouroboros-spec create feature"
        result = prepend_instruction(content)

        self.assertIn(
            "ouroboros-spec.agent.md",
            result,
            "Should match /ouroboros-spec, not /ouroboros",
        )
        self.assertNotIn(
            "Follow the prompt '.github/agents/ouroboros.agent.md'",
            result,
            "Should not match shorter /ouroboros command",
        )

    def test_command_must_be_complete(self):
        """
        **Feature: curses-tui-frontend, Property 10: Agent Instruction Prepending**
        **Validates: Requirements 32.1**

        Partial command names should not trigger prepending.
        """
        # /ouroborosXYZ is not a valid command
        content = "/ouroborosXYZ some text"
        result = prepend_instruction(content)

        self.assertEqual(result, content, "Partial/invalid command should not trigger prepending")


if __name__ == "__main__":
    unittest.main()
