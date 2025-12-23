/**
 * Unit tests for tool schemas
 */

import { describe, it, expect } from 'vitest';
import {
    AskInputSchema,
    MenuInputSchema,
    ConfirmInputSchema,
    PlanReviewInputSchema,
    HandoffInputSchema,
    validateInput,
} from '../../tools/schemas';

describe('validateInput', () => {
    it('should return success for valid input', () => {
        const result = validateInput(AskInputSchema, { type: 'task' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).toBeDefined();
        }
    });

    it('should return error for invalid input', () => {
        const result = validateInput(MenuInputSchema, { question: 'test' });
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toBeDefined();
        }
    });
});

describe('AskInputSchema', () => {
    it('should validate minimal input', () => {
        const result = AskInputSchema.safeParse({});
        expect(result.success).toBe(true);
    });

    it('should validate full input', () => {
        const result = AskInputSchema.safeParse({
            question: 'What is your task?',
            type: 'task',
            inputLabel: 'Enter task:',
            agentName: 'ouroboros',
            agentLevel: 0,
        });
        expect(result.success).toBe(true);
    });

    it('should reject invalid type', () => {
        const result = AskInputSchema.safeParse({ type: 'invalid' });
        expect(result.success).toBe(false);
    });

    it('should reject invalid agent level', () => {
        const result = AskInputSchema.safeParse({ agentLevel: 5 });
        expect(result.success).toBe(false);
    });
});

describe('MenuInputSchema', () => {
    it('should validate valid menu input', () => {
        const result = MenuInputSchema.safeParse({
            question: 'Select an option',
            options: ['Option 1', 'Option 2'],
        });
        expect(result.success).toBe(true);
    });

    it('should require question', () => {
        const result = MenuInputSchema.safeParse({
            options: ['Option 1'],
        });
        expect(result.success).toBe(false);
    });

    it('should require options', () => {
        const result = MenuInputSchema.safeParse({
            question: 'Select an option',
        });
        expect(result.success).toBe(false);
    });

    it('should allow custom input flag', () => {
        const result = MenuInputSchema.safeParse({
            question: 'Select or type',
            options: ['Option 1'],
            allowCustom: true,
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.allowCustom).toBe(true);
        }
    });
});

describe('ConfirmInputSchema', () => {
    it('should validate valid confirm input', () => {
        const result = ConfirmInputSchema.safeParse({
            question: 'Are you sure?',
        });
        expect(result.success).toBe(true);
    });

    it('should require question', () => {
        const result = ConfirmInputSchema.safeParse({});
        expect(result.success).toBe(false);
    });

    it('should allow custom labels', () => {
        const result = ConfirmInputSchema.safeParse({
            question: 'Proceed?',
            yesLabel: 'Confirm',
            noLabel: 'Cancel',
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.yesLabel).toBe('Confirm');
            expect(result.data.noLabel).toBe('Cancel');
        }
    });
});

describe('PlanReviewInputSchema', () => {
    it('should validate valid plan review input', () => {
        const result = PlanReviewInputSchema.safeParse({
            plan: '# Implementation Plan\n\n- Step 1\n- Step 2',
        });
        expect(result.success).toBe(true);
    });

    it('should require plan', () => {
        const result = PlanReviewInputSchema.safeParse({
            title: 'My Plan',
        });
        expect(result.success).toBe(false);
    });

    it('should accept valid modes', () => {
        const reviewResult = PlanReviewInputSchema.safeParse({
            plan: 'content',
            mode: 'review',
        });
        expect(reviewResult.success).toBe(true);

        const walkthroughResult = PlanReviewInputSchema.safeParse({
            plan: 'content',
            mode: 'walkthrough',
        });
        expect(walkthroughResult.success).toBe(true);
    });

    it('should reject invalid mode', () => {
        const result = PlanReviewInputSchema.safeParse({
            plan: 'content',
            mode: 'invalid',
        });
        expect(result.success).toBe(false);
    });
});

describe('HandoffInputSchema', () => {
    it('should validate valid handoff', () => {
        const result = HandoffInputSchema.safeParse({
            from: 'ouroboros',
            to: 'ouroboros-coder',
            fromLevel: 0,
            toLevel: 2,
            reason: 'Delegating implementation task',
        });
        expect(result.success).toBe(true);
    });

    it('should require from and to', () => {
        const result = HandoffInputSchema.safeParse({
            fromLevel: 0,
            toLevel: 1,
        });
        expect(result.success).toBe(false);
    });

    it('should require valid levels', () => {
        const result = HandoffInputSchema.safeParse({
            from: 'a',
            to: 'b',
            fromLevel: 5,
            toLevel: 0,
        });
        expect(result.success).toBe(false);
    });
});
