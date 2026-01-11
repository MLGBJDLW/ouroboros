/**
 * Tests for tool types
 */

import { describe, it, expect } from 'vitest';
import type {
    AskInput,
    AskOutput,
    MenuInput,
    MenuOutput,
    ConfirmInput,
    ConfirmOutput,
    PlanReviewInput,
    PlanReviewOutput,
    HandoffInput,
    HandoffOutput,
    StoredInteraction,
    PendingRequest,
    ToolResult,
} from '../../tools/types';

// PhaseProgressInput and PhaseProgressOutput are not exported from types.ts
// Define them locally for testing purposes
interface PhaseProgressInput {
    workflow: string;
    specName: string;
    currentPhase: number;
    totalPhases: number;
    status: string;
}

interface PhaseProgressOutput {
    acknowledged: boolean;
}

describe('tool types', () => {
    describe('AskInput', () => {
        it('should accept valid ask input', () => {
            const input: AskInput = {
                question: 'What would you like to do?',
                type: 'task',
                inputLabel: 'Enter task',
                agentName: 'ouroboros',
                agentLevel: 0,
            };
            expect(input.question).toBe('What would you like to do?');
            expect(input.type).toBe('task');
        });

        it('should accept minimal ask input', () => {
            const input: AskInput = {};
            expect(input).toBeDefined();
        });
    });

    describe('AskOutput', () => {
        it('should have required response fields', () => {
            const output: AskOutput = {
                response: 'user response',
                cancelled: false,
            };
            expect(output.response).toBe('user response');
            expect(output.cancelled).toBe(false);
        });

        it('should support optional timeout field', () => {
            const output: AskOutput = {
                response: '',
                cancelled: true,
                timeout: true,
            };
            expect(output.timeout).toBe(true);
        });
    });

    describe('MenuInput', () => {
        it('should require question and options', () => {
            const input: MenuInput = {
                question: 'Choose an option',
                options: ['Option A', 'Option B', 'Option C'],
            };
            expect(input.options).toHaveLength(3);
        });

        it('should support allowCustom option', () => {
            const input: MenuInput = {
                question: 'Choose or enter custom',
                options: ['Default'],
                allowCustom: true,
            };
            expect(input.allowCustom).toBe(true);
        });
    });

    describe('MenuOutput', () => {
        it('should have selection details', () => {
            const output: MenuOutput = {
                selectedIndex: 1,
                selectedOption: 'Option B',
                isCustom: false,
                cancelled: false,
            };
            expect(output.selectedIndex).toBe(1);
            expect(output.isCustom).toBe(false);
        });

        it('should indicate custom input', () => {
            const output: MenuOutput = {
                selectedIndex: -1,
                selectedOption: 'Custom value',
                isCustom: true,
                cancelled: false,
            };
            expect(output.isCustom).toBe(true);
        });
    });

    describe('ConfirmInput', () => {
        it('should require question', () => {
            const input: ConfirmInput = {
                question: 'Are you sure?',
            };
            expect(input.question).toBeTruthy();
        });

        it('should support custom button labels', () => {
            const input: ConfirmInput = {
                question: 'Proceed?',
                yesLabel: 'Continue',
                noLabel: 'Go Back',
            };
            expect(input.yesLabel).toBe('Continue');
            expect(input.noLabel).toBe('Go Back');
        });
    });

    describe('ConfirmOutput', () => {
        it('should indicate confirmation', () => {
            const output: ConfirmOutput = {
                confirmed: true,
                cancelled: false,
            };
            expect(output.confirmed).toBe(true);
        });

        it('should handle cancellation', () => {
            const output: ConfirmOutput = {
                confirmed: false,
                cancelled: true,
            };
            expect(output.cancelled).toBe(true);
        });
    });

    describe('PlanReviewInput', () => {
        it('should require plan content', () => {
            const input: PlanReviewInput = {
                plan: '# Implementation Plan\n\n## Steps\n1. Step one',
            };
            expect(input.plan).toContain('# Implementation Plan');
        });

        it('should support review modes', () => {
            const input: PlanReviewInput = {
                plan: 'Plan content',
                title: 'Feature Plan',
                mode: 'review',
            };
            expect(input.mode).toBe('review');
        });
    });

    describe('PlanReviewOutput', () => {
        it('should indicate approval', () => {
            const output: PlanReviewOutput = {
                approved: true,
                cancelled: false,
            };
            expect(output.approved).toBe(true);
        });

        it('should support feedback', () => {
            const output: PlanReviewOutput = {
                approved: false,
                feedback: 'Please add more details',
                cancelled: false,
            };
            expect(output.feedback).toBeTruthy();
        });
    });

    describe('PhaseProgressInput', () => {
        it('should have all required fields', () => {
            const input: PhaseProgressInput = {
                workflow: 'spec',
                specName: 'feature-x',
                currentPhase: 2,
                totalPhases: 5,
                status: 'Analyzing requirements',
            };
            expect(input.currentPhase).toBe(2);
            expect(input.totalPhases).toBe(5);
        });
    });

    describe('PhaseProgressOutput', () => {
        it('should acknowledge progress', () => {
            const output: PhaseProgressOutput = {
                acknowledged: true,
            };
            expect(output.acknowledged).toBe(true);
        });
    });

    describe('HandoffInput', () => {
        it('should specify agent transfer', () => {
            const input: HandoffInput = {
                from: 'ouroboros',
                to: 'ouroboros-coder',
                fromLevel: 0,
                toLevel: 1,
                reason: 'Delegating implementation',
            };
            expect(input.from).toBe('ouroboros');
            expect(input.toLevel).toBe(1);
        });
    });

    describe('HandoffOutput', () => {
        it('should acknowledge handoff', () => {
            const output: HandoffOutput = {
                acknowledged: true,
            };
            expect(output.acknowledged).toBe(true);
        });
    });

    describe('StoredInteraction', () => {
        it('should store complete interaction details', () => {
            const interaction: StoredInteraction = {
                id: 'int-001',
                timestamp: Date.now(),
                type: 'ask',
                agentName: 'ouroboros',
                agentLevel: 0,
                question: 'What task?',
                response: 'Build feature',
                status: 'responded',
            };
            expect(interaction.id).toBe('int-001');
            expect(interaction.status).toBe('responded');
        });

        it('should support workflow context', () => {
            const interaction: StoredInteraction = {
                id: 'int-002',
                timestamp: Date.now(),
                type: 'confirm',
                agentName: 'ouroboros-coder',
                agentLevel: 1,
                status: 'pending',
                workflowContext: {
                    workflow: 'implement',
                    specName: 'feature-x',
                    phase: 3,
                },
            };
            expect(interaction.workflowContext?.workflow).toBe('implement');
        });
    });

    describe('PendingRequest', () => {
        it('should have request details and callbacks', () => {
            const request: PendingRequest = {
                id: 'req-001',
                timestamp: Date.now(),
                type: 'ask',
                agentName: 'ouroboros',
                agentLevel: 0,
                data: { question: 'Test?' },
                resolve: () => {},
                reject: () => {},
            };
            expect(request.id).toBe('req-001');
            expect(typeof request.resolve).toBe('function');
        });
    });

    describe('ToolResult', () => {
        it('should indicate success with data', () => {
            const result: ToolResult<string> = {
                success: true,
                data: 'result value',
            };
            expect(result.success).toBe(true);
            expect(result.data).toBe('result value');
        });

        it('should indicate failure with error', () => {
            const result: ToolResult<never> = {
                success: false,
                error: 'Something went wrong',
            };
            expect(result.success).toBe(false);
            expect(result.error).toBeTruthy();
        });
    });
});
