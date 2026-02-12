import { useState, useMemo } from 'react';
import { useHistory } from '../../hooks/useHistory';
import { Card, CardBody } from '../../components/Card';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { List, ListItem } from '../../components/List';
import { formatRelativeTime, formatRequestType, formatAgentLevel, formatDateTime } from '../../utils/formatters';
import styles from './History.module.css';

const TYPE_FILTERS = ['all', 'ask', 'menu', 'confirm', 'plan_review'] as const;
type TypeFilter = typeof TYPE_FILTERS[number];

export function History() {
    const { history, clearHistory } = useHistory();
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

    const filteredHistory = useMemo(() => {
        let items = history.slice().reverse();

        if (typeFilter !== 'all') {
            items = items.filter(item => item.type === typeFilter);
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            items = items.filter(item =>
                (item.question?.toLowerCase().includes(query)) ||
                (item.response?.toLowerCase().includes(query)) ||
                (item.agentName?.toLowerCase().includes(query))
            );
        }

        return items;
    }, [history, searchQuery, typeFilter]);

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

            {/* Search & Filter Bar */}
            <div className={styles.filterBar}>
                <div className={styles.searchWrapper}>
                    <Icon name="search" className={styles.searchIcon} />
                    <input
                        type="text"
                        className={styles.searchInput}
                        placeholder="Search history..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button
                            className={styles.clearSearch}
                            onClick={() => setSearchQuery('')}
                            title="Clear search"
                        >
                            <Icon name="close" />
                        </button>
                    )}
                </div>
                <div className={styles.typeFilters}>
                    {TYPE_FILTERS.map(filter => (
                        <button
                            key={filter}
                            className={`${styles.typeFilterBtn} ${typeFilter === filter ? styles.typeFilterActive : ''}`}
                            onClick={() => setTypeFilter(filter)}
                        >
                            {filter === 'all' ? 'ALL' : formatRequestType(filter)}
                        </button>
                    ))}
                </div>
            </div>

            {filteredHistory.length === 0 ? (
                <div className={styles.noResults}>
                    <Icon name="search" />
                    <span>No matching results</span>
                </div>
            ) : (
                <List className={styles.list}>
                    {filteredHistory.map((item) => (
                        <ListItem key={item.id} className={styles.listItem}>
                            <HistoryItem item={item} />
                        </ListItem>
                    ))}
                </List>
            )}
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
