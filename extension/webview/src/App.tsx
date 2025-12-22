import { useState, useCallback, useEffect } from 'react';
import { PendingRequests } from './views/PendingRequests';
import { WorkflowProgress } from './views/WorkflowProgress';
import { AgentHierarchy } from './views/AgentHierarchy';
import { History } from './views/History';
import { Icon } from './components/Icon';
import { Tooltip } from './components/Tooltip';
import { Welcome } from './components/Welcome';
import { Spinner } from './components/Spinner';
import { useAppContext } from './context/AppContext';
import { useVSCode } from './context/VSCodeContext';
import styles from './App.module.css';

type ViewType = 'home' | 'pending' | 'workflow' | 'agents' | 'history';

interface TabConfig {
    id: ViewType;
    icon: string;
    label: string;
    shortcut: string;
}

const TABS: TabConfig[] = [
    { id: 'home', icon: 'home', label: 'Home', shortcut: '0' },
    { id: 'pending', icon: 'bell', label: 'Pending Requests', shortcut: '1' },
    { id: 'workflow', icon: 'pulse', label: 'Workflow Progress', shortcut: '2' },
    { id: 'agents', icon: 'organization', label: 'Agent Hierarchy', shortcut: '3' },
    { id: 'history', icon: 'history', label: 'History', shortcut: '4' },
];

function App() {
    const [activeView, setActiveView] = useState<ViewType>('home');
    const { state } = useAppContext();
    const vscode = useVSCode();

    // Keyboard navigation
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // Number keys for tab switching
        if (e.key >= '0' && e.key <= '4' && !e.ctrlKey && !e.altKey && !e.metaKey) {
            const index = parseInt(e.key);
            if (TABS[index]) {
                setActiveView(TABS[index].id);
            }
        }

        // Arrow keys for navigation
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            const currentIndex = TABS.findIndex((tab) => tab.id === activeView);
            let newIndex: number;

            if (e.key === 'ArrowLeft') {
                newIndex = currentIndex > 0 ? currentIndex - 1 : TABS.length - 1;
            } else {
                newIndex = currentIndex < TABS.length - 1 ? currentIndex + 1 : 0;
            }

            setActiveView(TABS[newIndex].id);
        }
    }, [activeView]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    // Auto-switch to pending when new request arrives
    useEffect(() => {
        if (state.pendingRequests.length > 0 && activeView !== 'pending') {
            setActiveView('pending');
        }
    }, [state.pendingRequests.length]);

    const handleInitialize = useCallback(() => {
        vscode.postMessage({ type: 'command', payload: { command: 'ouroboros.initializeProject' } });
    }, [vscode]);

    const handleOpenCopilot = useCallback(() => {
        vscode.postMessage({ type: 'openCopilotChat' });
    }, [vscode]);

    const handleUpdatePrompts = useCallback(() => {
        vscode.postMessage({ type: 'command', payload: { command: 'ouroboros.updatePrompts' } });
    }, [vscode]);

    const handleSelectWorkspace = useCallback((path: string) => {
        vscode.postMessage({ type: 'selectWorkspace', payload: { path } });
    }, [vscode]);

    if (state.isLoading) {
        return (
            <div className={styles.loading}>
                <Spinner size="large" />
                <span>Loading...</span>
            </div>
        );
    }

    const renderView = () => {
        switch (activeView) {
            case 'home':
                return (
                    <Welcome
                        onInitialize={handleInitialize}
                        onOpenCopilot={handleOpenCopilot}
                        onUpdatePrompts={handleUpdatePrompts}
                        onSelectWorkspace={handleSelectWorkspace}
                        isInitialized={state.workspaceState?.isInitialized}
                        hasCopilotChatOpened={state.workspaceState?.hasCopilotChatOpened}
                        projectName={state.workspaceState?.projectName}
                        workspaces={state.workspaces}
                        selectedWorkspacePath={state.workspaceState?.selectedWorkspacePath}
                    />
                );
            case 'pending':
                return <PendingRequests />;
            case 'workflow':
                return <WorkflowProgress />;
            case 'agents':
                return <AgentHierarchy />;
            case 'history':
                return <History />;
            default:
                return <Welcome onInitialize={handleInitialize} />;
        }
    };

    const pendingCount = state.pendingRequests.length;

    return (
        <div className={styles.container}>
            <nav className={styles.tabs} role="tablist" aria-label="View navigation">
                {TABS.map((tab) => (
                    <Tooltip key={tab.id} content={`${tab.label} (${tab.shortcut})`}>
                        <button
                            role="tab"
                            aria-selected={activeView === tab.id}
                            aria-controls={`panel-${tab.id}`}
                            tabIndex={activeView === tab.id ? 0 : -1}
                            className={`${styles.tab} ${activeView === tab.id ? styles.active : ''}`}
                            onClick={() => setActiveView(tab.id)}
                        >
                            <Icon name={tab.icon} />
                            <span className={styles.tabLabel}>{tab.label}</span>
                            {tab.id === 'pending' && pendingCount > 0 && (
                                <span className={styles.badge} aria-label={`${pendingCount} pending`}>
                                    {pendingCount}
                                </span>
                            )}
                        </button>
                    </Tooltip>
                ))}
            </nav>
            <main
                id={`panel-${activeView}`}
                role="tabpanel"
                aria-labelledby={`tab-${activeView}`}
                className={styles.content}
            >
                {renderView()}
            </main>
        </div>
    );
}

export default App;
