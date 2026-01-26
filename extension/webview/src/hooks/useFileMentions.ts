/**
 * File Mention Handler Hook
 * 
 * Provides @ file mention detection, fuzzy matching, and autocomplete functionality.
 * Similar to useSlashCommands but for file paths.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { postMessage } from '../utils/vscodeApi';

export interface FileMention {
    path: string;
    name: string;
    isDirectory: boolean;
}

export interface UseFileMentionsResult {
    /** Whether file mention mode is active */
    isActive: boolean;
    /** Current matches based on input */
    matches: FileMention[];
    /** Currently selected index */
    selectedIndex: number;
    /** Whether files are being loaded */
    isLoading: boolean;
    /** Update matches based on input value and cursor position */
    update: (value: string, cursorPosition: number) => void;
    /** Move selection up */
    moveUp: () => void;
    /** Move selection down */
    moveDown: () => void;
    /** Complete with selected file, returns the completed text */
    complete: (currentValue: string, cursorPosition: number) => { text: string; newCursor: number };
    /** Cancel file mention mode */
    cancel: () => void;
    /** Get the current @ mention being typed (for positioning dropdown) */
    getCurrentMention: () => { start: number; end: number; query: string } | null;
}

const MAX_MATCHES = 15;

/**
 * Hook for handling @ file mentions in input fields
 */
export function useFileMentions(): UseFileMentionsResult {
    const [isActive, setIsActive] = useState(false);
    const [matches, setMatches] = useState<FileMention[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [allFiles, setAllFiles] = useState<FileMention[]>([]);
    const [currentMention, setCurrentMention] = useState<{ start: number; end: number; query: string } | null>(null);

    // Listen for file list responses
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            if (message.type === 'fileListResponse') {
                const files = (message.payload as FileMention[]) || [];
                console.log('[FileMentions] Received file list:', files.length, 'files');
                if (files.length > 0) {
                    console.log('[FileMentions] Sample files:', files.slice(0, 5).map(f => f.path));
                }
                setAllFiles(files);
                setIsLoading(false);
            }
        };
        
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    // Request file list on mount
    useEffect(() => {
        setIsLoading(true);
        console.log('[FileMentions] Requesting file list...');
        postMessage({ type: 'getFileList' });
    }, []);

    const findMentionAtCursor = useCallback((value: string, cursorPosition: number): { start: number; end: number; query: string } | null => {
        // Look backwards from cursor to find @
        let atIndex = -1;
        for (let i = cursorPosition - 1; i >= 0; i--) {
            const char = value[i];
            // Stop if we hit whitespace or another special char before finding @
            if (char === ' ' || char === '\n' || char === '\t') {
                break;
            }
            if (char === '@') {
                atIndex = i;
                break;
            }
        }

        if (atIndex === -1) {
            return null;
        }

        // Find the end of the mention (next whitespace or end of string)
        let endIndex = cursorPosition;
        for (let i = cursorPosition; i < value.length; i++) {
            const char = value[i];
            if (char === ' ' || char === '\n' || char === '\t') {
                break;
            }
            endIndex = i + 1;
        }

        const query = value.slice(atIndex + 1, cursorPosition);
        return { start: atIndex, end: endIndex, query };
    }, []);

    const fuzzyMatch = useCallback((files: FileMention[], query: string): FileMention[] => {
        if (!query) {
            // Show recent/common files when just @ is typed
            return files.slice(0, MAX_MATCHES);
        }

        const lowerQuery = query.toLowerCase();
        const scored: Array<{ file: FileMention; score: number }> = [];

        for (const file of files) {
            const lowerPath = file.path.toLowerCase();
            const lowerName = file.name.toLowerCase();

            // Calculate fuzzy match score
            const score = Math.max(
                fuzzyScore(lowerName, lowerQuery) * 2, // Name matches weighted higher
                fuzzyScore(lowerPath, lowerQuery)
            );

            if (score > 0) {
                scored.push({ file, score });
            }
        }

        // Sort by score descending
        scored.sort((a, b) => b.score - a.score);

        return scored.slice(0, MAX_MATCHES).map(s => s.file);
    }, []);

    /**
     * Calculate fuzzy match score between text and query
     * Returns 0 if no match, higher score = better match
     */
    function fuzzyScore(text: string, query: string): number {
        if (!query) return 0;
        if (text === query) return 1000; // Exact match
        if (text.startsWith(query)) return 500 + (100 - text.length); // Starts with
        
        // Check if all query chars appear in order (fuzzy)
        let queryIdx = 0;
        let score = 0;
        let consecutiveBonus = 0;
        let lastMatchIdx = -2;
        
        for (let i = 0; i < text.length && queryIdx < query.length; i++) {
            if (text[i] === query[queryIdx]) {
                // Bonus for consecutive matches
                if (i === lastMatchIdx + 1) {
                    consecutiveBonus += 10;
                } else {
                    consecutiveBonus = 0;
                }
                
                // Bonus for matching at word boundaries (after /, -, _, .)
                const prevChar = i > 0 ? text[i - 1] : '/';
                if (prevChar === '/' || prevChar === '-' || prevChar === '_' || prevChar === '.') {
                    score += 20;
                }
                
                score += 10 + consecutiveBonus;
                lastMatchIdx = i;
                queryIdx++;
            }
        }
        
        // All query chars must be found
        if (queryIdx < query.length) {
            return 0;
        }
        
        // Bonus for shorter paths (more specific matches)
        score += Math.max(0, 50 - text.length);
        
        return score;
    }

    const update = useCallback((value: string, cursorPosition: number) => {
        const mention = findMentionAtCursor(value, cursorPosition);
        setCurrentMention(mention);

        if (!mention) {
            setIsActive(false);
            setMatches([]);
            setSelectedIndex(0);
            return;
        }

        setIsActive(true);
        console.log('[FileMentions] Searching for:', mention.query, 'in', allFiles.length, 'files');
        const newMatches = fuzzyMatch(allFiles, mention.query);
        console.log('[FileMentions] Found', newMatches.length, 'matches');
        setMatches(newMatches);
        setSelectedIndex(prev => Math.min(prev, Math.max(0, newMatches.length - 1)));
    }, [findMentionAtCursor, fuzzyMatch, allFiles]);

    const moveUp = useCallback(() => {
        setSelectedIndex(prev => Math.max(0, prev - 1));
    }, []);

    const moveDown = useCallback(() => {
        setSelectedIndex(prev => Math.min(matches.length - 1, prev + 1));
    }, [matches.length]);

    const complete = useCallback((currentValue: string, cursorPosition: number): { text: string; newCursor: number } => {
        if (!currentMention || matches.length === 0 || selectedIndex < 0 || selectedIndex >= matches.length) {
            return { text: currentValue, newCursor: cursorPosition };
        }

        const selectedFile = matches[selectedIndex];
        const before = currentValue.slice(0, currentMention.start);
        const after = currentValue.slice(currentMention.end);
        const insertion = `@${selectedFile.path} `;
        const newText = before + insertion + after;
        const newCursor = before.length + insertion.length;

        setIsActive(false);
        setMatches([]);
        setSelectedIndex(0);
        setCurrentMention(null);

        return { text: newText, newCursor };
    }, [currentMention, matches, selectedIndex]);

    const cancel = useCallback(() => {
        setIsActive(false);
        setMatches([]);
        setSelectedIndex(0);
        setCurrentMention(null);
    }, []);

    const getCurrentMention = useCallback(() => currentMention, [currentMention]);

    // Refresh file list when requested
    const refreshFiles = useCallback(() => {
        setIsLoading(true);
        postMessage({ type: 'getFileList' });
    }, []);

    // Refresh on window focus (files might have changed)
    useEffect(() => {
        const handleFocus = () => refreshFiles();
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [refreshFiles]);

    return useMemo(() => ({
        isActive,
        matches,
        selectedIndex,
        isLoading,
        update,
        moveUp,
        moveDown,
        complete,
        cancel,
        getCurrentMention,
    }), [isActive, matches, selectedIndex, isLoading, update, moveUp, moveDown, complete, cancel, getCurrentMention]);
}
