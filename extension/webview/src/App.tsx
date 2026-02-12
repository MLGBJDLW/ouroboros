import { useState, useCallback, useEffect } from 'react';
import { PendingRequests } from './views/PendingRequests';
import { WorkflowProgress } from './views/WorkflowProgress';
import { History } from './views/History';
import { CodeGraph } from './views/CodeGraph';
import { Icon } from './components/Icon';
import { Tooltip } from './components/Tooltip';
import { Welcome } from './components/Welcome';
import { Spinner } from './components/Spinner';
import { useAppContext } from './context/AppContext';
import { useVSCode } from './context/VSCodeContext';
import styles from './App.module.css';

type ViewType = 'home' | 'pending' | 'workflow' | 'graph' | 'history';

interface TabConfig {
    id: ViewType;
    icon: string;
    label: string;
}

const TABS: TabConfig[] = [
    { id: 'home', icon: 'home', label: 'Home' },
    { id: 'pending', icon: 'bell', label: 'Pending' },
    { id: 'workflow', icon: 'pulse', label: 'Workflow' },
    { id: 'graph', icon: 'type-hierarchy', label: 'Graph' },
    { id: 'history', icon: 'history', label: 'History' },
];

function App() {
    const [activeView, setActiveView] = useState<ViewType>('home');
    const { state } = useAppContext();
    const vscode = useVSCode();

    // Auto-switch to pending when new request arrives
    useEffect(() => {
        if (state.pendingRequests.length > 0 && activeView !== 'pending') {
            setActiveView('pending');
        }
    }, [state.pendingRequests.length]);

    const handleInitialize = useCallback(() => {
        // Pass the selected workspace path as argument
        const targetPath = state.workspaceState?.selectedWorkspacePath;
        vscode.postMessage({
            type: 'command',
            payload: {
                command: 'ouroboros.initializeProject',
                args: targetPath ? [targetPath] : []
            }
        });
    }, [vscode, state.workspaceState?.selectedWorkspacePath]);

    const handleOpenCopilot = useCallback(() => {
        vscode.postMessage({ type: 'openCopilotChat' });
    }, [vscode]);

    const handleUpdatePrompts = useCallback(() => {
        // Pass the selected workspace path as argument
        const targetPath = state.workspaceState?.selectedWorkspacePath;
        vscode.postMessage({
            type: 'command',
            payload: {
                command: 'ouroboros.updatePrompts',
                args: targetPath ? [targetPath] : []
            }
        });
    }, [vscode, state.workspaceState?.selectedWorkspacePath]);

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
                        version={state.version}
                    />
                );
            case 'pending':
                return <PendingRequests />;
            case 'workflow':
                return <WorkflowProgress />;
            case 'graph':
                return <CodeGraph />;
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
                    <Tooltip key={tab.id} content={tab.label}>
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
