/**
 * Tests for status bar formatters
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    formatStatusBarText,
    formatRelativeTime,
    truncate,
    formatAgentLevel,
    formatWorkflowType,
    formatExecutionMode,
} from '../../statusBar/formatters';
import type { WorkspaceState } from '../../storage/stateManager';

describe('formatters', () => {
    describe('formatStatusBarText', () => {
        it('should show basic label when no spec is active', () => {
            const state: WorkspaceState = {
                currentSpec: undefined,
                currentPhase: 0,
                workflowType: undefined,
                executionMode: 'task-by-task',
            };
            expect(formatStatusBarText(state)).toBe('$(infinity) Ouroboros');
        });

        it('should show spec name when active', () => {
            const state: WorkspaceState = {
                currentSpec: 'my-feature',
                currentPhase: 0,
                workflowType: undefined,
                executionMode: undefined,
            };
            const result = formatStatusBarText(state);
            expect(result).toContain('my-feature');
        });

        it('should show phase number when set', () => {
            const state: WorkspaceState = {
                currentSpec: 'test-spec',
                currentPhase: 3,
                workflowType: undefined,
                executionMode: undefined,
            };
            const result = formatStatusBarText(state);
            expect(result).toContain('(3)');
        });

        it('should show workflow type when set', () => {
            const state: WorkspaceState = {
                currentSpec: 'test-spec',
                currentPhase: 1,
                workflowType: 'spec',
                executionMode: undefined,
            };
            const result = formatStatusBarText(state);
            expect(result).toContain('Spec');
        });

        it('should show execution mode when set', () => {
            const state: WorkspaceState = {
                currentSpec: 'test-spec',
                currentPhase: 1,
                workflowType: 'implement',
                executionMode: 'auto-run',
            };
            const result = formatStatusBarText(state);
            expect(result).toContain('Auto-Run');
        });

        it('should truncate long spec names', () => {
            const state: WorkspaceState = {
                currentSpec: 'very-long-specification-name-that-exceeds-limit',
                currentPhase: 1,
                workflowType: undefined,
                executionMode: undefined,
            };
            const result = formatStatusBarText(state);
            expect(result.length).toBeLessThan(100);
        });
    });

    describe('formatRelativeTime', () => {
        beforeEach(() => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('should show "just now" for recent timestamps', () => {
            const timestamp = Date.now() - 5000; // 5 seconds ago
            expect(formatRelativeTime(timestamp)).toBe('just now');
        });

        it('should show seconds for timestamps under a minute', () => {
            const timestamp = Date.now() - 30000; // 30 seconds ago
            expect(formatRelativeTime(timestamp)).toBe('30s ago');
        });

        it('should show minutes for timestamps under an hour', () => {
            const timestamp = Date.now() - 5 * 60 * 1000; // 5 minutes ago
            expect(formatRelativeTime(timestamp)).toBe('5m ago');
        });

        it('should show hours for timestamps under a day', () => {
            const timestamp = Date.now() - 3 * 60 * 60 * 1000; // 3 hours ago
            expect(formatRelativeTime(timestamp)).toBe('3h ago');
        });

        it('should show days for old timestamps', () => {
            const timestamp = Date.now() - 2 * 24 * 60 * 60 * 1000; // 2 days ago
            expect(formatRelativeTime(timestamp)).toBe('2d ago');
        });
    });

    describe('truncate', () => {
        it('should not truncate short strings', () => {
            expect(truncate('hello', 10)).toBe('hello');
        });

        it('should truncate long strings with ellipsis', () => {
            expect(truncate('hello world', 8)).toBe('hello w…');
        });

        it('should handle exact length strings', () => {
            expect(truncate('hello', 5)).toBe('hello');
        });

        it('should handle empty strings', () => {
            expect(truncate('', 5)).toBe('');
        });
    });

    describe('formatAgentLevel', () => {
        it('should format level 0 as God', () => {
            expect(formatAgentLevel(0)).toBe('L0 (God)');
        });

        it('should format level 1 as Lead', () => {
            expect(formatAgentLevel(1)).toBe('L1 (Lead)');
        });

        it('should format level 2 as Worker', () => {
            expect(formatAgentLevel(2)).toBe('L2 (Worker)');
        });
    });

    describe('formatWorkflowType', () => {
        it('should format spec workflow', () => {
            expect(formatWorkflowType('spec')).toBe('$(checklist) Spec');
        });

        it('should format implement workflow', () => {
            expect(formatWorkflowType('implement')).toBe('$(gear) Implement');
        });
    });

    describe('formatExecutionMode', () => {
        it('should format task-by-task mode', () => {
            expect(formatExecutionMode('task-by-task')).toBe('Task-by-Task');
        });

        it('should format phase-by-phase mode', () => {
            expect(formatExecutionMode('phase-by-phase')).toBe('Phase-by-Phase');
        });

        it('should format auto-run mode', () => {
            expect(formatExecutionMode('auto-run')).toBe('Auto-Run');
        });
    });
});
