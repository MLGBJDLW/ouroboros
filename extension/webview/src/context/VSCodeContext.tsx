import { createContext, useContext, ReactNode, useEffect } from 'react';
import { postMessage } from '../utils/vscodeApi';

interface VSCodeContextValue {
    postMessage: (message: unknown) => void;
}

const VSCodeContext = createContext<VSCodeContextValue | null>(null);

export function VSCodeProvider({ children }: { children: ReactNode }) {
    // Notify extension that webview is ready
    useEffect(() => {
        postMessage({ type: 'ready' });
    }, []);

    const value: VSCodeContextValue = {
        postMessage,
    };

    return (
        <VSCodeContext.Provider value={value}>{children}</VSCodeContext.Provider>
    );
}

export function useVSCode(): VSCodeContextValue {
    const context = useContext(VSCodeContext);
    if (!context) {
        throw new Error('useVSCode must be used within VSCodeProvider');
    }
    return context;
}
