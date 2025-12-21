import { useHistory } from '../../hooks/useHistory';
import { Card, CardBody } from '../../components/Card';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { List, ListItem } from '../../components/List';
import { formatRelativeTime, formatRequestType, formatAgentLevel, formatDateTime } from '../../utils/formatters';
import styles from './History.module.css';

export function History() {
    const { history, clearHistory } = useHistory();

    if (history.length === 0) {
        return (
            <EmptyState
                icon="history"
                title="No interaction history"
                description="Past interactions will appear here"
            />
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <span className={styles.count}>{history.length} interactions</span>
                <Button variant="ghost" size="small" onClick={clearHistory}>
                    <Icon name="clear-all" />
                    Clear
                </Button>
            </div>

            <List className={styles.list}>
                {history.slice().reverse().map((item) => (
                    <ListItem key={item.id} className={styles.listItem}>
                        <HistoryItem item={item} />
                    </ListItem>
                ))}
            </List>
        </div>
    );
}

interface HistoryItemProps {
    item: {
        id: string;
        timestamp: number;
        type: string;
        agentName: string;
        agentLevel: 0 | 1 | 2;
        question?: string;
        response?: string;
        status: string;
    };
}

function HistoryItem({ item }: HistoryItemProps) {
    const statusVariant = getStatusVariant(item.status);

    return (
        <Card>
            <CardBody>
                <div className={styles.itemHeader}>
                    <Badge variant={statusVariant} size="small">
                        {formatRequestType(item.type)}
                    </Badge>
                    <span className={styles.agentInfo}>
                        {item.agentName} ({formatAgentLevel(item.agentLevel)})
                    </span>
                    <span className={styles.time} title={formatDateTime(item.timestamp)}>
                        {formatRelativeTime(item.timestamp)}
                    </span>
                </div>

                {item.question && (
                    <p className={styles.question}>{item.question}</p>
                )}

                {item.response && (
                    <p className={styles.response}>
                        <Icon name="reply" className={styles.responseIcon} />
                        {item.response}
                    </p>
                )}

                <div className={styles.status}>
                    <Badge size="small" variant={statusVariant}>
                        {item.status}
                    </Badge>
                </div>
            </CardBody>
        </Card>
    );
}

function getStatusVariant(status: string): 'default' | 'success' | 'warning' | 'error' {
    switch (status) {
        case 'responded':
            return 'success';
        case 'cancelled':
            return 'warning';
        case 'timeout':
            return 'error';
        default:
            return 'default';
    }
}
