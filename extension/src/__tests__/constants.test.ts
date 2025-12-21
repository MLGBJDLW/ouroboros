/**
 * Tests for extension constants
 */

import { describe, it, expect } from 'vitest';
import {
    EXTENSION_ID,
    EXTENSION_DISPLAY_NAME,
    SIDEBAR_VIEW_ID,
    SIDEBAR_CONTAINER_ID,
    COMMANDS,
    TOOLS,
    CONFIG,
    TIMEOUTS,
    STORAGE_KEYS,
} from '../constants';

describe('constants', () => {
    describe('extension identifiers', () => {
        it('should have correct extension ID', () => {
            expect(EXTENSION_ID).toBe('ouroboros-ai');
        });

        it('should have correct display name', () => {
            expect(EXTENSION_DISPLAY_NAME).toBe('Ouroboros AI');
        });

        it('should have correct sidebar view ID', () => {
            expect(SIDEBAR_VIEW_ID).toBe('ouroboros.sidebarView');
        });

        it('should have correct sidebar container ID', () => {
            expect(SIDEBAR_CONTAINER_ID).toBe('ouroboros-sidebar');
        });
    });

    describe('COMMANDS', () => {
        it('should have initialize project command', () => {
            expect(COMMANDS.INITIALIZE_PROJECT).toBe('ouroboros.initializeProject');
        });

        it('should have open sidebar command', () => {
            expect(COMMANDS.OPEN_SIDEBAR).toBe('ouroboros.openSidebar');
        });

        it('should have clear history command', () => {
            expect(COMMANDS.CLEAR_HISTORY).toBe('ouroboros.clearHistory');
        });

        it('should have cancel current request command', () => {
            expect(COMMANDS.CANCEL_CURRENT_REQUEST).toBe('ouroboros.cancelCurrentRequest');
        });
    });

    describe('TOOLS', () => {
        it('should have ask tool', () => {
            expect(TOOLS.ASK).toBe('ouroborosai_ask');
        });

        it('should have menu tool', () => {
            expect(TOOLS.MENU).toBe('ouroborosai_menu');
        });

        it('should have confirm tool', () => {
            expect(TOOLS.CONFIRM).toBe('ouroborosai_confirm');
        });

        it('should have plan review tool', () => {
            expect(TOOLS.PLAN_REVIEW).toBe('ouroborosai_plan_review');
        });

        it('should have phase progress tool', () => {
            expect(TOOLS.PHASE_PROGRESS).toBe('ouroborosai_phase_progress');
        });

        it('should have agent handoff tool', () => {
            expect(TOOLS.AGENT_HANDOFF).toBe('ouroborosai_agent_handoff');
        });
    });

    describe('CONFIG', () => {
        it('should have execution mode config', () => {
            expect(CONFIG.EXECUTION_MODE).toBe('ouroboros.executionMode');
        });

        it('should have show status bar config', () => {
            expect(CONFIG.SHOW_STATUS_BAR).toBe('ouroboros.showStatusBar');
        });

        it('should have history limit config', () => {
            expect(CONFIG.HISTORY_LIMIT).toBe('ouroboros.historyLimit');
        });
    });

    describe('TIMEOUTS', () => {
        it('should have user confirmation timeout of 5 minutes', () => {
            expect(TIMEOUTS.USER_CONFIRMATION).toBe(5 * 60 * 1000);
        });

        it('should have auto run task timeout of 30 seconds', () => {
            expect(TIMEOUTS.AUTO_RUN_TASK).toBe(30 * 1000);
        });
    });

    describe('STORAGE_KEYS', () => {
        describe('WORKSPACE', () => {
            it('should have current spec key', () => {
                expect(STORAGE_KEYS.WORKSPACE.CURRENT_SPEC).toBe('currentSpec');
            });

            it('should have current phase key', () => {
                expect(STORAGE_KEYS.WORKSPACE.CURRENT_PHASE).toBe('currentPhase');
            });

            it('should have task progress key', () => {
                expect(STORAGE_KEYS.WORKSPACE.TASK_PROGRESS).toBe('taskProgress');
            });

            it('should have execution mode key', () => {
                expect(STORAGE_KEYS.WORKSPACE.EXECUTION_MODE).toBe('executionMode');
            });
        });

        describe('GLOBAL', () => {
            it('should have interaction history key', () => {
                expect(STORAGE_KEYS.GLOBAL.INTERACTION_HISTORY).toBe('interactionHistory');
            });
        });
    });
});
