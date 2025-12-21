import { useAppContext } from '../../context/AppContext';
import { Card, CardBody } from '../../components/Card';
import { Icon } from '../../components/Icon';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { AGENT_DISPLAY_NAMES } from '../../types/agent';
import styles from './AgentHierarchy.module.css';

export function AgentHierarchy() {
    const { state } = useAppContext();

    if (!state.currentAgent && state.handoffHistory.length === 0) {
        return (
            <EmptyState
                icon="organization"
                title="No active agents"
                description="Agent hierarchy will appear during workflows"
            />
        );
    }

    return (
        <div className={styles.container}>
            {/* Current Agent */}
            {state.currentAgent && (
                <Card highlighted>
                    <CardBody>
                        <div className={styles.currentAgent}>
                            <Icon name="arrow-right" className={styles.activeIcon} />
                            <span className={styles.agentName}>
                                {getDisplayName(state.currentAgent.name)}
                            </span>
                            <Badge variant="info">L{state.currentAgent.level}</Badge>
                        </div>
                    </CardBody>
                </Card>
            )}

            {/* Handoff History */}
            {state.handoffHistory.length > 0 && (
                <div className={styles.historySection}>
                    <h4 className={styles.sectionTitle}>Handoff History</h4>
                    <div className={styles.timeline}>
                        {state.handoffHistory.slice().reverse().map((handoff, index) => (
                            <div key={index} className={styles.handoffItem}>
                                <div className={styles.handoffAgents}>
                                    <span className={styles.fromAgent}>
                                        {getDisplayName(handoff.from.name)}
                                        <Badge size="small">L{handoff.from.level}</Badge>
                                    </span>
                                    <Icon name="arrow-right" className={styles.handoffArrow} />
                                    <span className={styles.toAgent}>
                                        {getDisplayName(handoff.to.name)}
                                        <Badge size="small">L{handoff.to.level}</Badge>
                                    </span>
                                </div>
                                {handoff.reason && (
                                    <span className={styles.handoffReason}>{handoff.reason}</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Agent Levels Legend */}
            <div className={styles.legend}>
                <h4 className={styles.sectionTitle}>Agent Levels</h4>
                <div className={styles.legendItems}>
                    <div className={styles.legendItem}>
                        <Badge variant="error">L0</Badge>
                        <span>God Mode</span>
                    </div>
                    <div className={styles.legendItem}>
                        <Badge variant="warning">L1</Badge>
                        <span>Lead Agents</span>
                    </div>
                    <div className={styles.legendItem}>
                        <Badge variant="success">L2</Badge>
                        <span>Worker Agents</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function getDisplayName(agentName: string): string {
    return AGENT_DISPLAY_NAMES[agentName] ?? agentName;
}
