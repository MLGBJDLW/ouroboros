/**
 * Debounce utility function
 */

/**
 * Creates a debounced function that delays invoking func until after
 * wait milliseconds have elapsed since the last time the debounced
 * function was invoked.
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    return function debounced(...args: Parameters<T>): void {
        if (timeoutId !== undefined) {
            clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
            timeoutId = undefined;
            func(...args);
        }, wait);
    };
}

/**
 * Creates a throttled function that only invokes func at most once
 * per every wait milliseconds.
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let lastCall = 0;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    return function throttled(...args: Parameters<T>): void {
        const now = Date.now();
        const remaining = wait - (now - lastCall);

        if (remaining <= 0) {
            if (timeoutId !== undefined) {
                clearTimeout(timeoutId);
                timeoutId = undefined;
            }
            lastCall = now;
            func(...args);
        } else if (timeoutId === undefined) {
            timeoutId = setTimeout(() => {
                lastCall = Date.now();
                timeoutId = undefined;
                func(...args);
            }, remaining);
        }
    };
}
