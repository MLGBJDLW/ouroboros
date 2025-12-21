/**
 * VS Code API utilities
 */

interface VSCodeAPI {
    postMessage(message: unknown): void;
    getState(): unknown;
    setState(state: unknown): void;
}

declare global {
    interface Window {
        vscodeApi?: VSCodeAPI;
        logoUri?: string;
    }
}

let vscodeApi: VSCodeAPI | undefined;

/**
 * Get the VS Code API instance
 */
export function getVSCodeAPI(): VSCodeAPI {
    if (vscodeApi) {
        return vscodeApi;
    }

    if (typeof window !== 'undefined' && window.vscodeApi) {
        vscodeApi = window.vscodeApi;
        return vscodeApi;
    }

    // Fallback for development outside VS Code
    console.warn('VS Code API not available, using mock');
    return {
        postMessage: (message) => console.log('postMessage:', message),
        getState: () => undefined,
        setState: (state) => console.log('setState:', state),
    };
}

/**
 * Post a message to the extension
 */
export function postMessage(message: unknown): void {
    getVSCodeAPI().postMessage(message);
}

/**
 * Get saved webview state
 */
export function getState<T>(): T | undefined {
    return getVSCodeAPI().getState() as T | undefined;
}

/**
 * Save webview state
 */
export function setState<T>(state: T): void {
    getVSCodeAPI().setState(state);
}
