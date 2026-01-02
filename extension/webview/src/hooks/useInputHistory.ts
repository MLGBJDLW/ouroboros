/**
 * Input History Hook
 * Provides up/down arrow key navigation through input history
 * Uses VS Code webview state API for persistence (localStorage doesn't persist in webviews)
 */

import { useState, useCallback, useRef, useEffect } from 'react';

const MAX_HISTORY_SIZE = 50;
const STORAGE_KEY = 'ouroboros-input-history';

// Get VS Code API for state persistence
const getVSCodeApi = () => {
    return (window as unknown as { vscodeApi?: { getState: () => unknown; setState: (state: unknown) => void } }).vscodeApi;
};

// Global history storage - persists across component remounts
const globalHistoryStore: Record<string, string[]> = {};

// For testing: clear global store
export const _clearGlobalHistoryStore = (key?: string) => {
    if (key) {
        delete globalHistoryStore[key];
    } else {
        Object.keys(globalHistoryStore).forEach(k => delete globalHistoryStore[k]);
    }
};

// Load history from storage (called once per key)
const loadHistoryFromStorage = (storageKey: string, maxSize: number): string[] => {
    // Check global store first (for same-session persistence)
    if (globalHistoryStore[storageKey]?.length > 0) {
        console.log('[InputHistory] loadHistory from global store:', storageKey, globalHistoryStore[storageKey]);
        return globalHistoryStore[storageKey].slice(0, maxSize);
    }
    
    try {
        const vscode = getVSCodeApi();
        if (vscode) {
            const state = vscode.getState() as Record<string, unknown> | null;
            const stored = state?.[storageKey];
            console.log('[InputHistory] loadHistory from vscode state - storageKey:', storageKey, 'stored:', stored);
            if (Array.isArray(stored) && stored.length > 0) {
                globalHistoryStore[storageKey] = stored.slice(0, maxSize);
                return globalHistoryStore[storageKey];
            }
        }
        // Fallback to localStorage for dev/test
        const localStored = localStorage.getItem(storageKey);
        console.log('[InputHistory] loadHistory from localStorage - storageKey:', storageKey, 'stored:', localStored);
        if (localStored) {
            const parsed = JSON.parse(localStored);
            if (Array.isArray(parsed) && parsed.length > 0) {
                globalHistoryStore[storageKey] = parsed.slice(0, maxSize);
                return globalHistoryStore[storageKey];
            }
        }
    } catch (err) {
        console.error('[InputHistory] loadHistory error:', err);
    }
    return [];
};

// Save history to storage
const saveHistoryToStorage = (storageKey: string, history: string[]) => {
    console.log('[InputHistory] saveHistory:', storageKey, history);
    
    // Always update global store
    globalHistoryStore[storageKey] = history;
    
    try {
        const vscode = getVSCodeApi();
        if (vscode) {
            const currentState = (vscode.getState() as Record<string, unknown>) || {};
            vscode.setState({ ...currentState, [storageKey]: history });
        }
        // Also save to localStorage as fallback
        localStorage.setItem(storageKey, JSON.stringify(history));
    } catch (err) {
        console.error('[InputHistory] saveHistory error:', err);
    }
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
    
    // Use ref to store history to avoid closure issues
    const historyRef = useRef<string[]>(loadHistoryFromStorage(storageKey, maxSize));
    const [, forceUpdate] = useState(0);
    const [navigationIndex, setNavigationIndex] = useState(-1);
    
    // Store the current input before navigating
    const currentInputRef = useRef<string>('');

    // Sync with global store on mount
    useEffect(() => {
        const stored = loadHistoryFromStorage(storageKey, maxSize);
        if (stored.length > 0 && historyRef.current.length === 0) {
            historyRef.current = stored;
            forceUpdate(n => n + 1);
        }
    }, [storageKey, maxSize]);

    // Add new entry to history
    const addToHistory = useCallback((value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return;

        console.log('[InputHistory] addToHistory:', trimmed);

        // Remove duplicate if exists
        const filtered = historyRef.current.filter(item => item !== trimmed);
        // Add to front, limit size
        const newHistory = [trimmed, ...filtered].slice(0, maxSize);
        
        console.log('[InputHistory] new history:', newHistory);
        
        // Update ref and save
        historyRef.current = newHistory;
        saveHistoryToStorage(storageKey, newHistory);
        
        // Reset navigation after adding
        setNavigationIndex(-1);
        currentInputRef.current = '';
        
        // Force re-render
        forceUpdate(n => n + 1);
    }, [maxSize, storageKey]);

    // Navigate up (older entries)
    const navigateUp = useCallback((): string | null => {
        const history = historyRef.current;
        if (history.length === 0) return null;
        
        const newIndex = navigationIndex + 1;
        if (newIndex >= history.length) return null;
        
        setNavigationIndex(newIndex);
        return history[newIndex];
    }, [navigationIndex]);

    // Navigate down (newer entries)
    const navigateDown = useCallback((): string | null => {
        if (navigationIndex < 0) return null;
        
        const newIndex = navigationIndex - 1;
        setNavigationIndex(newIndex);
        
        if (newIndex < 0) {
            // Return to current input
            return currentInputRef.current;
        }
        
        return historyRef.current[newIndex];
    }, [navigationIndex]);

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
        const history = historyRef.current;
        
        // Debug logging
        console.log('[InputHistory] handleKeyDown:', {
            key: e.key,
            historyLength: history.length,
            navigationIndex,
            currentValue,
            isTextarea,
            history: history.slice(0, 3),
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
                
                // Direct navigation using ref
                if (history.length === 0) return false;
                const newIndex = navigationIndex + 1;
                if (newIndex >= history.length) return false;
                
                const prevValue = history[newIndex];
                console.log('[InputHistory] ArrowUp - prevValue:', prevValue);
                
                setNavigationIndex(newIndex);
                e.preventDefault();
                setValue(prevValue);
                // Move cursor to end after state update
                setTimeout(() => {
                    textarea.selectionStart = textarea.selectionEnd = prevValue.length;
                }, 0);
                return true;
            }
            
            if (e.key === 'ArrowDown' && isOnLastLine && hasNoSelection) {
                if (navigationIndex < 0) return false;
                
                const newIndex = navigationIndex - 1;
                setNavigationIndex(newIndex);
                
                let nextValue: string;
                if (newIndex < 0) {
                    nextValue = currentInputRef.current;
                } else {
                    nextValue = history[newIndex];
                }
                
                console.log('[InputHistory] ArrowDown - nextValue:', nextValue);
                
                e.preventDefault();
                setValue(nextValue);
                // Move cursor to end after state update
                setTimeout(() => {
                    textarea.selectionStart = textarea.selectionEnd = nextValue.length;
                }, 0);
                return true;
            }
        } else {
            // For regular input, always handle up/down
            if (e.key === 'ArrowUp') {
                // Store current input if starting navigation
                if (navigationIndex === -1) {
                    currentInputRef.current = currentValue;
                }
                
                if (history.length === 0) return false;
                const newIndex = navigationIndex + 1;
                if (newIndex >= history.length) return false;
                
                const prevValue = history[newIndex];
                setNavigationIndex(newIndex);
                e.preventDefault();
                setValue(prevValue);
                return true;
            }
            
            if (e.key === 'ArrowDown') {
                if (navigationIndex < 0) return false;
                
                const newIndex = navigationIndex - 1;
                setNavigationIndex(newIndex);
                
                const nextValue = newIndex < 0 ? currentInputRef.current : history[newIndex];
                e.preventDefault();
                setValue(nextValue);
                return true;
            }
        }
        
        return false;
    }, [navigationIndex]);

    // Get all history
    const getHistory = useCallback(() => [...historyRef.current], []);

    // Clear history
    const clearHistory = useCallback(() => {
        historyRef.current = [];
        globalHistoryStore[storageKey] = [];
        setNavigationIndex(-1);
        currentInputRef.current = '';
        forceUpdate(n => n + 1);
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
