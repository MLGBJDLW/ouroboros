/**
 * Validation utilities
 */

/**
 * Check if a string is not empty
 */
export function isNotEmpty(value: string): boolean {
    return value.trim().length > 0;
}

/**
 * Check if a value is within a range
 */
export function isInRange(value: number, min: number, max: number): boolean {
    return value >= min && value <= max;
}

/**
 * Validate agent level
 */
export function isValidAgentLevel(level: number): level is 0 | 1 | 2 {
    return level === 0 || level === 1 || level === 2;
}
