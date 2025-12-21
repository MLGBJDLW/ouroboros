/**
 * Zod validation schemas for LM Tools
 */

import { z } from 'zod';

// Agent Level schema - ensures proper type inference as 0 | 1 | 2
const AgentLevelSchema = z.union([z.literal(0), z.literal(1), z.literal(2)]);

// ============================================================================
// Ask Tool Schema
// ============================================================================

export const AskInputSchema = z.object({
    question: z.string().optional(),
    type: z.enum(['task', 'question', 'feature']).optional(),
    inputLabel: z.string().optional(),
    agentName: z.string().optional(),
    agentLevel: AgentLevelSchema.optional(),
});

// ============================================================================
// Menu Tool Schema
// ============================================================================

export const MenuInputSchema = z.object({
    question: z.string().min(1, 'Question is required'),
    options: z
        .array(z.string())
        .min(1, 'At least one option is required')
        .max(10, 'Maximum 10 options allowed'),
    allowCustom: z.boolean().optional(),
    agentName: z.string().optional(),
    agentLevel: AgentLevelSchema.optional(),
});

// ============================================================================
// Confirm Tool Schema
// ============================================================================

export const ConfirmInputSchema = z.object({
    question: z.string().min(1, 'Question is required'),
    yesLabel: z.string().optional(),
    noLabel: z.string().optional(),
    agentName: z.string().optional(),
    agentLevel: AgentLevelSchema.optional(),
});

// ============================================================================
// Plan Review Tool Schema
// ============================================================================

export const PlanReviewInputSchema = z.object({
    plan: z.string().min(1, 'Plan content is required'),
    title: z.string().optional(),
    mode: z.enum(['review', 'walkthrough']).optional(),
    agentName: z.string().optional(),
    agentLevel: AgentLevelSchema.optional(),
});

// ============================================================================
// Phase Progress Tool Schema
// ============================================================================

export const PhaseProgressInputSchema = z.object({
    workflow: z.enum(['spec', 'implement']),
    specName: z.string().min(1, 'Spec name is required'),
    currentPhase: z.number().min(1, 'Phase must be at least 1'),
    totalPhases: z.number().min(1, 'Total phases must be at least 1'),
    status: z.string().min(1, 'Status is required'),
    agentName: z.string().optional(),
    agentLevel: AgentLevelSchema.optional(),
});

// ============================================================================
// Agent Handoff Tool Schema
// ============================================================================

export const HandoffInputSchema = z.object({
    from: z.string().min(1, 'Source agent name is required'),
    to: z.string().min(1, 'Target agent name is required'),
    fromLevel: AgentLevelSchema,
    toLevel: AgentLevelSchema,
    reason: z.string().optional(),
});

// ============================================================================
// Schema Validation Helper
// ============================================================================

export function validateInput<T>(
    schema: z.ZodSchema<T>,
    input: unknown
): { success: true; data: T } | { success: false; error: string } {
    const result = schema.safeParse(input);
    if (result.success) {
        return { success: true, data: result.data };
    }
    const errorMessages = result.error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join('; ');
    return { success: false, error: errorMessages };
}
