/**
 * Input History Hook
 * Provides up/down arrow key navigation through input history
 * Uses VS Code webview state API for persistence (localStorage doesn't persist in webviews)
 */

import { useState, useCallback, useRef } from 'react';

const MAX_HISTORY_SIZE = 50;
const STORAGE_KEY = 'ouroboros-input-history';

// Get VS Code API for state persistence
const getVSCodeApi = () => {
    return (window as unknown as { vscodeApi?: { getState: () => unknown; setState: (state: unknown) => void } }).vscodeApi;
};

interface UseInputHistoryOptions {
    maxSize?: number;
    storageKey?: string;
}

interface UseInputHistoryReturn {
    /** Add a new entry to history */
    addToHistory: (value: string) => void;
    /** Navigate to previous entry (up arrow) */
    navigateUp: () => string | null;
    /** Navigate to next entry (down arrow) */
    navigateDown: () => string | null;
    /** Reset navigation index (when user types) */
    resetNavigation: () => void;
    /** Get current navigation index (-1 means not navigating) */
    navigationIndex: number;
    /** Handle keyboard event for textarea/input */
    handleKeyDown: (
        e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>,
        currentValue: string,
        setValue: (value: string) => void
    ) => boolean;
    /** Get all history entries */
    getHistory: () => string[];
    /** Clear all history */
    clearHistory: () => void;
}

/**
 * Hook for managing input history with up/down arrow navigation
 */
export function useInputHistory(options: UseInputHistoryOptions = {}): UseInputHistoryReturn {
    const { maxSize = MAX_HISTORY_SIZE, storageKey = STORAGE_KEY } = options;
    
    // Load initial history from VS Code state
    const loadHistory = (): string[] => {
        try {
            const vscode = getVSCodeApi();
            if (vscode) {
                const state = vscode.getState() as Record<string, unknown> | null;
                const stored = state?.[storageKey];
                console.log('[InputHistory] loadHistory from vscode state - storageKey:', storageKey, 'stored:', stored);
                if (Array.isArray(stored)) {
                    return stored.slice(0, maxSize);
                }
            }
            // Fallback to localStorage for dev/test
            const localStored = localStorage.getItem(storageKey);
            console.log('[InputHistory] loadHistory from localStorage - storageKey:', storageKey, 'stored:', localStored);
            if (localStored) {
                const parsed = JSON.parse(localStored);
                if (Array.isArray(parsed)) {
                    return parsed.slice(0, maxSize);
                }
            }
        } catch (err) {
            console.error('[InputHistory] loadHistory error:', err);
        }
        return [];
    };

    const [history, setHistory] = useState<string[]>(loadHistory);
    const [navigationIndex, setNavigationIndex] = useState(-1);
    
    // Store the current input before navigating
    const currentInputRef = useRef<string>('');

    // Save history to VS Code state
    const saveHistory = useCallback((newHistory: string[]) => {
        try {
            const vscode = getVSCodeApi();
            if (vscode) {
                const currentState = (vscode.getState() as Record<string, unknown>) || {};
                vscode.setState({ ...currentState, [storageKey]: newHistory });
                console.log('[InputHistory] saved to vscode state:', newHistory);
            }
            // Also save to localStorage as fallback
            localStorage.setItem(storageKey, JSON.stringify(newHistory));
        } catch (err) {
            console.error('[InputHistory] saveHistory error:', err);
        }
    }, [storageKey]);

    // Add new entry to history
    const addToHistory = useCallback((value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return;

        console.log('[InputHistory] addToHistory:', trimmed);

        setHistory(prev => {
            // Remove duplicate if exists
            const filtered = prev.filter(item => item !== trimmed);
            // Add to front, limit size
            const newHistory = [trimmed, ...filtered].slice(0, maxSize);
            console.log('[InputHistory] new history:', newHistory);
            saveHistory(newHistory);
            return newHistory;
        });
        
        // Reset navigation after adding
        setNavigationIndex(-1);
        currentInputRef.current = '';
    }, [maxSize, saveHistory]);

    // Navigate up (older entries)
    const navigateUp = useCallback((): string | null => {
        if (history.length === 0) return null;
        
        const newIndex = navigationIndex + 1;
        if (newIndex >= history.length) return null;
        
        setNavigationIndex(newIndex);
        return history[newIndex];
    }, [history, navigationIndex]);

    // Navigate down (newer entries)
    const navigateDown = useCallback((): string | null => {
        if (navigationIndex < 0) return null;
        
        const newIndex = navigationIndex - 1;
        setNavigationIndex(newIndex);
        
        if (newIndex < 0) {
            // Return to current input
            return currentInputRef.current;
        }
        
        return history[newIndex];
    }, [history, navigationIndex]);

    // Reset navigation (when user types)
    const resetNavigation = useCallback(() => {
        setNavigationIndex(-1);
    }, []);

    // Handle keyboard events
    const handleKeyDown = useCallback((
        e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>,
        currentValue: string,
        setValue: (value: string) => void
    ): boolean => {
        const target = e.target as HTMLTextAreaElement | HTMLInputElement;
        const isTextarea = target.tagName === 'TEXTAREA';
        
        // Debug logging
        console.log('[InputHistory] handleKeyDown:', {
            key: e.key,
            historyLength: history.length,
            navigationIndex,
            currentValue,
            isTextarea,
        });
        
        // For textarea, only handle up/down at start/end of content
        if (isTextarea) {
            const textarea = target as HTMLTextAreaElement;
            const { selectionStart, selectionEnd, value } = textarea;
            const hasNoSelection = selectionStart === selectionEnd;
            
            // Check if cursor is on first or last line
            const beforeCursor = value.substring(0, selectionStart ?? 0);
            const afterCursor = value.substring(selectionEnd ?? 0);
            const isOnFirstLine = !beforeCursor.includes('\n');
            const isOnLastLine = !afterCursor.includes('\n');
            
            console.log('[InputHistory] textarea state:', {
                selectionStart,
                selectionEnd,
                hasNoSelection,
                isOnFirstLine,
                isOnLastLine,
                valueLength: value.length,
            });
            
            if (e.key === 'ArrowUp' && isOnFirstLine && hasNoSelection) {
                // Store current input if starting navigation
                if (navigationIndex === -1) {
                    currentInputRef.current = currentValue;
                }
                
                const prevValue = navigateUp();
                console.log('[InputHistory] ArrowUp - prevValue:', prevValue);
                if (prevValue !== null) {
                    e.preventDefault();
                    setValue(prevValue);
                    // Move cursor to end after state update
                    setTimeout(() => {
                        textarea.selectionStart = textarea.selectionEnd = prevValue.length;
                    }, 0);
                    return true;
                }
            }
            
            if (e.key === 'ArrowDown' && isOnLastLine && hasNoSelection) {
                const nextValue = navigateDown();
                console.log('[InputHistory] ArrowDown - nextValue:', nextValue);
                if (nextValue !== null) {
                    e.preventDefault();
                    setValue(nextValue);
                    // Move cursor to end after state update
                    setTimeout(() => {
                        textarea.selectionStart = textarea.selectionEnd = nextValue.length;
                    }, 0);
                    return true;
                }
            }
        } else {
            // For regular input, always handle up/down
            if (e.key === 'ArrowUp') {
                // Store current input if starting navigation
                if (navigationIndex === -1) {
                    currentInputRef.current = currentValue;
                }
                
                const prevValue = navigateUp();
                if (prevValue !== null) {
                    e.preventDefault();
                    setValue(prevValue);
                    return true;
                }
            }
            
            if (e.key === 'ArrowDown') {
                const nextValue = navigateDown();
                if (nextValue !== null) {
                    e.preventDefault();
                    setValue(nextValue);
                    return true;
                }
            }
        }
        
        return false;
    }, [navigationIndex, navigateUp, navigateDown]);

    // Get all history
    const getHistory = useCallback(() => [...history], [history]);

    // Clear history
    const clearHistory = useCallback(() => {
        setHistory([]);
        setNavigationIndex(-1);
        currentInputRef.current = '';
        try {
            const vscode = getVSCodeApi();
            if (vscode) {
                const currentState = (vscode.getState() as Record<string, unknown>) || {};
                delete currentState[storageKey];
                vscode.setState(currentState);
            }
            localStorage.removeItem(storageKey);
        } catch {
            // Ignore storage errors
        }
    }, [storageKey]);

    return {
        addToHistory,
        navigateUp,
        navigateDown,
        resetNavigation,
        navigationIndex,
        handleKeyDown,
        getHistory,
        clearHistory,
    };
}
