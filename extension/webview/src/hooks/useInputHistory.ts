/**
 * Input History Hook
 * Provides up/down arrow key navigation through input history
 * Uses the existing History tab data (StoredInteraction) for persistence
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';

const MAX_HISTORY_SIZE = 50;

interface UseInputHistoryOptions {
    maxSize?: number;
    /** Filter by request type (ask, menu, confirm, etc.) */
    filterType?: string;
}

interface UseInputHistoryReturn {
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
}

/**
 * Hook for managing input history with up/down arrow navigation
 * Uses the existing History tab data for persistence across sessions
 */
export function useInputHistory(options: UseInputHistoryOptions = {}): UseInputHistoryReturn {
    const { maxSize = MAX_HISTORY_SIZE, filterType } = options;
    const { state } = useAppContext();
    
    // Extract unique responses from history (most recent first)
    const history = useMemo(() => {
        const responses: string[] = [];
        const seen = new Set<string>();
        
        // History is already sorted by timestamp, but we want most recent first
        const sortedHistory = [...state.history]
            .filter(item => item.status === 'responded' && item.response)
            .sort((a, b) => b.timestamp - a.timestamp);
        
        for (const item of sortedHistory) {
            // Filter by type if specified
            if (filterType && item.type !== filterType) continue;
            
            const response = item.response?.trim();
            if (response && !seen.has(response)) {
                seen.add(response);
                responses.push(response);
                if (responses.length >= maxSize) break;
            }
        }
        
        console.log('[InputHistory] loaded from history tab:', responses.length, 'items');
        return responses;
    }, [state.history, maxSize, filterType]);

    const [navigationIndex, setNavigationIndex] = useState(-1);
    
    // Store the current input before navigating
    const currentInputRef = useRef<string>('');

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
            currentValue: currentValue.substring(0, 20) + (currentValue.length > 20 ? '...' : ''),
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
            
            if (e.key === 'ArrowUp' && isOnFirstLine && hasNoSelection) {
                // Store current input if starting navigation
                if (navigationIndex === -1) {
                    currentInputRef.current = currentValue;
                }
                
                // Direct navigation
                if (history.length === 0) return false;
                const newIndex = navigationIndex + 1;
                if (newIndex >= history.length) return false;
                
                const prevValue = history[newIndex];
                console.log('[InputHistory] ArrowUp - prevValue:', prevValue?.substring(0, 30));
                
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
                
                console.log('[InputHistory] ArrowDown - nextValue:', nextValue?.substring(0, 30));
                
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
    }, [history, navigationIndex]);

    // Get all history
    const getHistory = useCallback(() => [...history], [history]);

    return {
        navigateUp,
        navigateDown,
        resetNavigation,
        navigationIndex,
        handleKeyDown,
        getHistory,
    };
}

// For testing: export a function to clear test state
export const _clearGlobalHistoryStore = () => {
    // No-op now since we use AppContext
};
