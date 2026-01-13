import {
    createContext,
    useContext,
    useReducer,
    ReactNode,
} from 'react';
import type { PendingRequest } from '../types/requests';
import type {
    StoredInteraction,
    WorkspaceStatePayload,
    WorkspaceInfo,
} from '../types/messages';
import type { AgentHandoff } from '../types/agent';
import { useVSCodeMessage } from '../hooks/useVSCodeMessage';

interface AppState {
    pendingRequests: PendingRequest[];
    history: StoredInteraction[];
    workspaceState: WorkspaceStatePayload | null;
    workspaces: WorkspaceInfo[];
    currentAgent: { name: string; level: 0 | 1 | 2 } | null;
    handoffHistory: AgentHandoff[];
    isLoading: boolean;
    graphContextCount: number;
    version: string | null;
    dependencyCruiserAvailable: boolean;
}

type AppAction =
    | { type: 'SET_PENDING_REQUESTS'; payload: PendingRequest[] }
    | { type: 'ADD_PENDING_REQUEST'; payload: PendingRequest }
    | { type: 'REMOVE_PENDING_REQUEST'; payload: string }
    | { type: 'SET_HISTORY'; payload: StoredInteraction[] }
    | { type: 'SET_WORKSPACE_STATE'; payload: WorkspaceStatePayload }
    | { type: 'SET_CURRENT_AGENT'; payload: { name: string; level: 0 | 1 | 2 } }
    | { type: 'ADD_HANDOFF'; payload: AgentHandoff }
    | { type: 'SET_LOADING'; payload: boolean }
    | { type: 'SET_GRAPH_CONTEXT_COUNT'; payload: number }
    | { type: 'INIT'; payload: { workspaceState: WorkspaceStatePayload; history: StoredInteraction[]; pendingRequests?: PendingRequest[]; workspaces?: WorkspaceInfo[]; version?: string; dependencyCruiserAvailable?: boolean } };

const initialState: AppState = {
    pendingRequests: [],
    history: [],
    workspaceState: null,
    workspaces: [],
    currentAgent: null,
    handoffHistory: [],
    isLoading: true,
    graphContextCount: 0,
    version: null,
    dependencyCruiserAvailable: false,
};

function appReducer(state: AppState, action: AppAction): AppState {
    switch (action.type) {
        case 'INIT':
            return {
                ...state,
                workspaceState: action.payload.workspaceState,
                workspaces: action.payload.workspaces ?? [],
                history: action.payload.history,
                pendingRequests: action.payload.pendingRequests ?? [],
                version: action.payload.version ?? null,
                dependencyCruiserAvailable: action.payload.dependencyCruiserAvailable ?? false,
                isLoading: false,
            };
        case 'SET_PENDING_REQUESTS':
            return { ...state, pendingRequests: action.payload };
        case 'ADD_PENDING_REQUEST':
            return {
                ...state,
                pendingRequests: [...state.pendingRequests, action.payload],
            };
        case 'REMOVE_PENDING_REQUEST':
            return {
                ...state,
                pendingRequests: state.pendingRequests.filter(
                    (r) => r.id !== action.payload
                ),
            };
        case 'SET_HISTORY':
            return { ...state, history: action.payload };
        case 'SET_WORKSPACE_STATE':
            return { ...state, workspaceState: action.payload };
        case 'SET_CURRENT_AGENT':
            return { ...state, currentAgent: action.payload };
        case 'ADD_HANDOFF':
            return {
                ...state,
                handoffHistory: [...state.handoffHistory, action.payload],
                currentAgent: action.payload.to,
            };
        case 'SET_LOADING':
            return { ...state, isLoading: action.payload };
        case 'SET_GRAPH_CONTEXT_COUNT':
            return { ...state, graphContextCount: action.payload };
        default:
            return state;
    }
}

interface AppContextValue {
    state: AppState;
    dispatch: React.Dispatch<AppAction>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(appReducer, initialState);

    // Listen to messages from extension
    useVSCodeMessage((message) => {
        switch (message.type) {
            case 'init':
                dispatch({ type: 'INIT', payload: message.payload });
                break;
            case 'stateUpdate':
                dispatch({ type: 'SET_WORKSPACE_STATE', payload: message.payload });
                break;
            case 'newRequest':
                dispatch({ type: 'ADD_PENDING_REQUEST', payload: message.payload });
                break;
            case 'pendingRequestsUpdate':
                dispatch({ type: 'SET_PENDING_REQUESTS', payload: message.payload });
                break;
            case 'historyUpdate':
                dispatch({ type: 'SET_HISTORY', payload: message.payload });
                break;
            case 'agentHandoff':
                dispatch({ type: 'ADD_HANDOFF', payload: message.payload });
                break;
            case 'refresh':
                // Extension is telling us to refresh - request updated state
                import('../utils/vscodeApi').then(({ postMessage }) => {
                    postMessage({ type: 'ready' });
                });
                break;
            case 'graphContextUpdate':
                // Update graph context count when items are added/consumed
                dispatch({ type: 'SET_GRAPH_CONTEXT_COUNT', payload: (message.payload as unknown[])?.length || 0 });
                break;
        }
    });

    return (
        <AppContext.Provider value={{ state, dispatch }}>
            {children}
        </AppContext.Provider>
    );
}

export function useAppContext(): AppContextValue {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useAppContext must be used within AppProvider');
    }
    return context;
}
