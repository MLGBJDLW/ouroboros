import { useEffect, useCallback } from 'react';
import type { ExtensionMessage } from '../types/messages';

type MessageHandler = (message: ExtensionMessage) => void;

/**
 * Hook to listen for messages from the VS Code extension
 */
export function useVSCodeMessage(handler: MessageHandler): void {
    const handleMessage = useCallback(
        (event: MessageEvent<ExtensionMessage>) => {
            handler(event.data);
        },
        [handler]
    );

    useEffect(() => {
        window.addEventListener('message', handleMessage);
        return () => {
            window.removeEventListener('message', handleMessage);
        };
    }, [handleMessage]);
}
