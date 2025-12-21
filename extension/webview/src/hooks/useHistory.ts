import { useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { useVSCode } from '../context/VSCodeContext';

/**
 * Hook for managing interaction history
 */
export function useHistory() {
    const { state } = useAppContext();
    const { postMessage } = useVSCode();

    const clearHistory = useCallback(() => {
        postMessage({ type: 'clearHistory' });
    }, [postMessage]);

    const refreshHistory = useCallback(() => {
        postMessage({ type: 'getHistory' });
    }, [postMessage]);

    return {
        history: state.history,
        clearHistory,
        refreshHistory,
    };
}
