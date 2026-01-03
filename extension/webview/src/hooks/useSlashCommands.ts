/**
 * Slash Command Handler Hook
 * 
 * Provides slash command detection, fuzzy matching, and autocomplete functionality.
 */

import { useState, useCallback, useMemo } from 'react';

export interface SlashCommand {
    command: string;
    description: string;
    agentFile: string;
}

// Slash commands for orchestrator mode switching (5 main orchestrators)
export const SLASH_COMMANDS: SlashCommand[] = [
    { command: '/ouroboros', description: 'Main Orchestrator', agentFile: 'ouroboros.agent.md' },
    { command: '/ouroboros-init', description: 'Project Init', agentFile: 'ouroboros-init.agent.md' },
    { command: '/ouroboros-spec', description: 'Spec Workflow', agentFile: 'ouroboros-spec.agent.md' },
    { command: '/ouroboros-implement', description: 'Implementation', agentFile: 'ouroboros-implement.agent.md' },
    { command: '/ouroboros-archive', description: 'Archive Specs', agentFile: 'ouroboros-archive.agent.md' },
];

export interface UseSlashCommandsResult {
    /** Whether slash command mode is active */
    isActive: boolean;
    /** Current matches based on input */
    matches: SlashCommand[];
    /** Currently selected index */
    selectedIndex: number;
    /** Update matches based on input value */
    update: (value: string) => SlashCommand[];
    /** Move selection up */
    moveUp: () => void;
    /** Move selection down */
    moveDown: () => void;
    /** Complete with selected command, returns the completed text */
    complete: (currentValue: string) => string;
    /** Cancel slash command mode */
    cancel: () => void;
    /** Prepend agent instruction to content if it starts with a slash command */
    prependInstruction: (content: string) => string;
}

/**
 * Hook for handling slash commands in input fields
 */
export function useSlashCommands(): UseSlashCommandsResult {
    const [isActive, setIsActive] = useState(false);
    const [matches, setMatches] = useState<SlashCommand[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);

    const update = useCallback((value: string): SlashCommand[] => {
        // Check if we should activate slash command mode
        if (!value.startsWith('/')) {
            setIsActive(false);
            setMatches([]);
            setSelectedIndex(0);
            return [];
        }

        setIsActive(true);
        const searchTerm = value.slice(1).toLowerCase();

        let newMatches: SlashCommand[];
        if (!searchTerm) {
            // Just "/" - show all commands
            newMatches = [...SLASH_COMMANDS];
        } else {
            // Fuzzy match: prioritize starts-with, then contains
            const startsWith: SlashCommand[] = [];
            const contains: SlashCommand[] = [];

            for (const cmd of SLASH_COMMANDS) {
                const cmdName = cmd.command.slice(1).toLowerCase();
                if (cmdName.startsWith(searchTerm)) {
                    startsWith.push(cmd);
                } else if (cmdName.includes(searchTerm)) {
                    contains.push(cmd);
                }
            }
            newMatches = [...startsWith, ...contains];
        }

        setMatches(newMatches);
        // Adjust selected index if out of bounds
        setSelectedIndex(prev => Math.min(prev, Math.max(0, newMatches.length - 1)));

        return newMatches;
    }, []);

    const moveUp = useCallback(() => {
        setSelectedIndex(prev => Math.max(0, prev - 1));
    }, []);

    const moveDown = useCallback(() => {
        setSelectedIndex(prev => Math.min(matches.length - 1, prev + 1));
    }, [matches.length]);

    const complete = useCallback((currentValue: string): string => {
        if (matches.length === 0 || selectedIndex < 0 || selectedIndex >= matches.length) {
            return currentValue;
        }

        const selectedCommand = matches[selectedIndex];
        // Extract any text after the partial command
        const spaceIndex = currentValue.indexOf(' ');
        const suffix = spaceIndex > 0 ? currentValue.slice(spaceIndex) : ' ';

        setIsActive(false);
        setMatches([]);
        setSelectedIndex(0);

        return selectedCommand.command + suffix;
    }, [matches, selectedIndex]);

    const cancel = useCallback(() => {
        setIsActive(false);
        setMatches([]);
        setSelectedIndex(0);
    }, []);

    const prependInstruction = useCallback((content: string): string => {
        const trimmed = content.trim();

        // Sort by length descending to match longer commands first
        const sortedCommands = [...SLASH_COMMANDS].sort(
            (a, b) => b.command.length - a.command.length
        );

        for (const cmd of sortedCommands) {
            if (trimmed.startsWith(cmd.command)) {
                // Check that it's a complete command (followed by space, newline, or end)
                const rest = trimmed.slice(cmd.command.length);
                if (!rest || rest[0] === ' ' || rest[0] === '\n' || rest[0] === '\t') {
                    const promptPath = `.github/agents/${cmd.agentFile}`;
                    return `Follow the prompt '${promptPath}'\n\n${content}`;
                }
            }
        }

        return content;
    }, []);

    return useMemo(() => ({
        isActive,
        matches,
        selectedIndex,
        update,
        moveUp,
        moveDown,
        complete,
        cancel,
        prependInstruction,
    }), [isActive, matches, selectedIndex, update, moveUp, moveDown, complete, cancel, prependInstruction]);
}

/**
 * Check if text starts with a valid slash command
 */
export function isValidSlashCommand(text: string): boolean {
    const trimmed = text.trim();
    for (const cmd of SLASH_COMMANDS) {
        if (trimmed.startsWith(cmd.command)) {
            const rest = trimmed.slice(cmd.command.length);
            if (!rest || rest[0] === ' ' || rest[0] === '\n' || rest[0] === '\t') {
                return true;
            }
        }
    }
    return false;
}
