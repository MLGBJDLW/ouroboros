/**
 * Formatting utilities
 */

/**
 * Format a timestamp as relative time
 */
export function formatRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
        return `${days}d ago`;
    }
    if (hours > 0) {
        return `${hours}h ago`;
    }
    if (minutes > 0) {
        return `${minutes}m ago`;
    }
    if (seconds > 10) {
        return `${seconds}s ago`;
    }
    return 'just now';
}

/**
 * Format a timestamp as date/time
 */
export function formatDateTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleString();
}

/**
 * Format agent level for display
 */
export function formatAgentLevel(level: 0 | 1 | 2): string {
    switch (level) {
        case 0:
            return 'L0';
        case 1:
            return 'L1';
        case 2:
            return 'L2';
        default:
            return `L${level}`;
    }
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
        return text;
    }
    return text.substring(0, maxLength - 1) + '…';
}

/**
 * Get display name for request type
 */
export function formatRequestType(type: string): string {
    switch (type) {
        case 'ask':
            return 'Input';
        case 'menu':
            return 'Menu';
        case 'confirm':
            return 'Confirm';
        case 'plan_review':
            return 'Review';
        default:
            return type;
    }
}
