import { useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { useVSCode } from '../context/VSCodeContext';

/**
 * Hook for managing pending requests
 */
export function usePendingRequests() {
    const { state, dispatch } = useAppContext();
    const { postMessage } = useVSCode();

    const respond = useCallback(
        (requestId: string, response: unknown) => {
            postMessage({
                type: 'response',
                payload: { requestId, response },
            });
            dispatch({ type: 'REMOVE_PENDING_REQUEST', payload: requestId });
        },
        [postMessage, dispatch]
    );

    const cancel = useCallback(
        (requestId: string) => {
            postMessage({
                type: 'cancel',
                payload: { requestId },
            });
            dispatch({ type: 'REMOVE_PENDING_REQUEST', payload: requestId });
        },
        [postMessage, dispatch]
    );

    return {
        requests: state.pendingRequests,
        respond,
        cancel,
    };
}
