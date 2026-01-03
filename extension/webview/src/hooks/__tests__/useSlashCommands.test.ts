/**
 * Tests for useSlashCommands hook
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSlashCommands, SLASH_COMMANDS, isValidSlashCommand } from '../useSlashCommands';

describe('useSlashCommands', () => {
    describe('initial state', () => {
        it('should start inactive with no matches', () => {
            const { result } = renderHook(() => useSlashCommands());

            expect(result.current.isActive).toBe(false);
            expect(result.current.matches).toEqual([]);
            expect(result.current.selectedIndex).toBe(0);
        });
    });

    describe('update', () => {
        it('should activate when input starts with /', () => {
            const { result } = renderHook(() => useSlashCommands());

            act(() => {
                result.current.update('/');
            });

            expect(result.current.isActive).toBe(true);
            expect(result.current.matches).toEqual(SLASH_COMMANDS);
        });

        it('should not activate for non-slash input', () => {
            const { result } = renderHook(() => useSlashCommands());

            act(() => {
                result.current.update('hello');
            });

            expect(result.current.isActive).toBe(false);
            expect(result.current.matches).toEqual([]);
        });

        it('should filter commands that start with search term', () => {
            const { result } = renderHook(() => useSlashCommands());

            act(() => {
                result.current.update('/ouroboros-s');
            });

            expect(result.current.isActive).toBe(true);
            expect(result.current.matches.length).toBe(1);
            expect(result.current.matches[0].command).toBe('/ouroboros-spec');
        });

        it('should prioritize starts-with over contains', () => {
            const { result } = renderHook(() => useSlashCommands());

            act(() => {
                result.current.update('/impl');
            });

            expect(result.current.matches.length).toBe(1);
            expect(result.current.matches[0].command).toBe('/ouroboros-implement');
        });

        it('should match commands containing search term', () => {
            const { result } = renderHook(() => useSlashCommands());

            act(() => {
                result.current.update('/spec');
            });

            // Should find /ouroboros-spec (starts with 'spec' after removing /ouroboros-)
            expect(result.current.matches.some(m => m.command === '/ouroboros-spec')).toBe(true);
        });

        it('should be case insensitive', () => {
            const { result } = renderHook(() => useSlashCommands());

            act(() => {
                result.current.update('/OUROBOROS');
            });

            expect(result.current.matches.length).toBeGreaterThan(0);
        });

        it('should return empty matches for non-matching input', () => {
            const { result } = renderHook(() => useSlashCommands());

            act(() => {
                result.current.update('/xyz123');
            });

            expect(result.current.isActive).toBe(true);
            expect(result.current.matches).toEqual([]);
        });
    });

    describe('navigation', () => {
        it('should move selection down', () => {
            const { result } = renderHook(() => useSlashCommands());

            act(() => {
                result.current.update('/');
            });

            expect(result.current.selectedIndex).toBe(0);

            act(() => {
                result.current.moveDown();
            });

            expect(result.current.selectedIndex).toBe(1);
        });

        it('should move selection up', () => {
            const { result } = renderHook(() => useSlashCommands());

            act(() => {
                result.current.update('/');
            });

            act(() => {
                result.current.moveDown();
            });

            act(() => {
                result.current.moveDown();
            });

            expect(result.current.selectedIndex).toBe(2);

            act(() => {
                result.current.moveUp();
            });

            expect(result.current.selectedIndex).toBe(1);
        });

        it('should not go below 0', () => {
            const { result } = renderHook(() => useSlashCommands());

            act(() => {
                result.current.update('/');
                result.current.moveUp();
            });

            expect(result.current.selectedIndex).toBe(0);
        });

        it('should not exceed matches length', () => {
            const { result } = renderHook(() => useSlashCommands());

            act(() => {
                result.current.update('/');
            });

            const maxIndex = SLASH_COMMANDS.length - 1;

            // Move down many times
            act(() => {
                for (let i = 0; i < 10; i++) {
                    result.current.moveDown();
                }
            });

            expect(result.current.selectedIndex).toBe(maxIndex);
        });
    });

    describe('complete', () => {
        it('should return selected command with space', () => {
            const { result } = renderHook(() => useSlashCommands());

            act(() => {
                result.current.update('/ouro');
            });

            let completed = '';
            act(() => {
                completed = result.current.complete('/ouro');
            });

            expect(completed).toBe('/ouroboros ');
            expect(result.current.isActive).toBe(false);
        });

        it('should preserve text after command', () => {
            const { result } = renderHook(() => useSlashCommands());

            act(() => {
                result.current.update('/ouroboros-spec');
            });

            let completed = '';
            act(() => {
                completed = result.current.complete('/ouroboros-spec create auth');
            });

            expect(completed).toBe('/ouroboros-spec create auth');
        });

        it('should return original value if no matches', () => {
            const { result } = renderHook(() => useSlashCommands());

            act(() => {
                result.current.update('/xyz');
            });

            let completed = '';
            act(() => {
                completed = result.current.complete('/xyz');
            });

            expect(completed).toBe('/xyz');
        });
    });

    describe('cancel', () => {
        it('should reset state', () => {
            const { result } = renderHook(() => useSlashCommands());

            act(() => {
                result.current.update('/');
                result.current.moveDown();
            });

            expect(result.current.isActive).toBe(true);

            act(() => {
                result.current.cancel();
            });

            expect(result.current.isActive).toBe(false);
            expect(result.current.matches).toEqual([]);
            expect(result.current.selectedIndex).toBe(0);
        });
    });

    describe('prependInstruction', () => {
        it('should prepend instruction for valid slash command', () => {
            const { result } = renderHook(() => useSlashCommands());

            const content = '/ouroboros-spec create auth feature';
            const processed = result.current.prependInstruction(content);

            expect(processed).toContain("Follow the prompt '.github/agents/ouroboros-spec.agent.md'");
            expect(processed).toContain(content);
        });

        it('should not modify content without slash command', () => {
            const { result } = renderHook(() => useSlashCommands());

            const content = 'just some regular text';
            const processed = result.current.prependInstruction(content);

            expect(processed).toBe(content);
        });

        it('should handle partial command names', () => {
            const { result } = renderHook(() => useSlashCommands());

            // /ouroboros-specXYZ is not a valid command
            const content = '/ouroboros-specXYZ';
            const processed = result.current.prependInstruction(content);

            expect(processed).toBe(content);
        });

        it('should match longer commands first', () => {
            const { result } = renderHook(() => useSlashCommands());

            // /ouroboros-spec should match before /ouroboros
            const content = '/ouroboros-spec';
            const processed = result.current.prependInstruction(content);

            expect(processed).toContain('ouroboros-spec.agent.md');
        });
    });
});

describe('isValidSlashCommand', () => {
    it('should return true for valid commands', () => {
        expect(isValidSlashCommand('/ouroboros')).toBe(true);
        expect(isValidSlashCommand('/ouroboros-spec')).toBe(true);
        expect(isValidSlashCommand('/ouroboros-init')).toBe(true);
        expect(isValidSlashCommand('/ouroboros-implement')).toBe(true);
        expect(isValidSlashCommand('/ouroboros-archive')).toBe(true);
    });

    it('should return true for commands with trailing content', () => {
        expect(isValidSlashCommand('/ouroboros create feature')).toBe(true);
        expect(isValidSlashCommand('/ouroboros-spec\nsome text')).toBe(true);
    });

    it('should return false for invalid commands', () => {
        expect(isValidSlashCommand('/invalid')).toBe(false);
        expect(isValidSlashCommand('ouroboros')).toBe(false);
        expect(isValidSlashCommand('/ouroboros-specXYZ')).toBe(false);
    });

    it('should handle whitespace', () => {
        expect(isValidSlashCommand('  /ouroboros  ')).toBe(true);
    });
});

describe('SLASH_COMMANDS', () => {
    it('should have 5 commands', () => {
        expect(SLASH_COMMANDS.length).toBe(5);
    });

    it('should have required properties', () => {
        for (const cmd of SLASH_COMMANDS) {
            expect(cmd.command).toBeDefined();
            expect(cmd.command.startsWith('/')).toBe(true);
            expect(cmd.description).toBeDefined();
            expect(cmd.agentFile).toBeDefined();
            expect(cmd.agentFile.endsWith('.agent.md')).toBe(true);
        }
    });
});
