import { useState, useCallback, useEffect } from 'react';
import { Icon } from '../Icon';
import { Button } from '../Button';
import { Card, CardHeader, CardBody } from '../Card';
import { ProgressBar } from '../ProgressBar';
import { Spinner } from '../Spinner';
import { Tooltip } from '../Tooltip';
import { useVSCode } from '../../context/VSCodeContext';
import styles from './CopilotInsights.module.css';

interface QuotaSnapshot {
    quota_id: string;
    entitlement: number;
    remaining: number;
    percent_remaining: number;
    unlimited: boolean;
    overage_permitted: boolean;
    overage_count: number;
}

interface CopilotData {
    copilot_plan: string;
    chat_enabled: boolean;
    quota_snapshots: Record<string, QuotaSnapshot>;
    quota_reset_date_utc: string;
}

type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export function CopilotInsights() {
    const [data, setData] = useState<CopilotData | null>(null);
    const [loadingState, setLoadingState] = useState<LoadingState>('idle');
    const [error, setError] = useState<string | null>(null);
    const vscode = useVSCode();

    const fetchCopilotData = useCallback(() => {
        setLoadingState('loading');
        setError(null);
        vscode.postMessage({ type: 'fetchCopilotInsights' });
    }, [vscode]);

    // Listen for response from extension
    useEffect(() => {
        const handler = (event: MessageEvent) => {
            const message = event.data;
            if (message.type === 'copilotInsightsResult') {
                if (message.payload.success) {
                    setData(message.payload.data);
                    setLoadingState('success');
                } else {
                    setError(message.payload.error || 'Failed to fetch data');
                    setLoadingState('error');
                }
            }
        };
        window.addEventListener('message', handler);
        return () => window.removeEventListener('message', handler);
    }, []);

    const formatResetDate = (dateStr: string): string => {
        const reset = new Date(dateStr);
        const now = new Date();
        const diffMs = reset.getTime() - now.getTime();
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        
        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h`;
        return 'Soon';
    };

    const getPremiumQuota = (): QuotaSnapshot | null => {
        if (!data?.quota_snapshots) return null;
        return Object.values(data.quota_snapshots).find(
            q => q.quota_id === 'premium_interactions'
        ) || null;
    };

    const getStatusColor = (percentRemaining: number): string => {
        if (percentRemaining > 50) return 'success';
        if (percentRemaining > 20) return 'warning';
        return 'error';
    };

    const premiumQuota = getPremiumQuota();

    return (
        <Card className={styles.card}>
            <CardHeader className={styles.header}>
                <div className={styles.headerLeft}>
                    <Icon name="github" />
                    <span>Copilot Usage</span>
                </div>
                <Tooltip content="Refresh usage data">
                    <Button
                        variant="ghost"
                        size="small"
                        onClick={fetchCopilotData}
                        disabled={loadingState === 'loading'}
                        className={styles.refreshButton}
                    >
                        {loadingState === 'loading' ? (
                            <Spinner size="small" />
                        ) : (
                            <Icon name="refresh" />
                        )}
                    </Button>
                </Tooltip>
            </CardHeader>
            <CardBody className={styles.body}>
                {loadingState === 'idle' && (
                    <div className={styles.idle}>
                        <p className={styles.idleText}>
                            View your Copilot plan and premium request usage
                        </p>
                        <Button
                            variant="secondary"
                            size="small"
                            onClick={fetchCopilotData}
                            className={styles.loadButton}
                        >
                            <Icon name="pulse" />
                            Load Usage
                        </Button>
                        <p className={styles.disclaimer}>
                            Uses internal GitHub API · May be rate limited
                        </p>
                    </div>
                )}

                {loadingState === 'loading' && (
                    <div className={styles.loading}>
                        <Spinner size="small" />
                        <span>Fetching usage data...</span>
                    </div>
                )}

                {loadingState === 'error' && (
                    <div className={styles.error}>
                        <Icon name="warning" />
                        <span>{error}</span>
                        <Button
                            variant="ghost"
                            size="small"
                            onClick={fetchCopilotData}
                        >
                            Retry
                        </Button>
                    </div>
                )}

                {loadingState === 'success' && data && (
                    <div className={styles.content}>
                        {/* Plan Info */}
                        <div className={styles.planRow}>
                            <span className={styles.planLabel}>Plan</span>
                            <span className={styles.planValue}>{data.copilot_plan}</span>
                        </div>

                        {/* Premium Quota */}
                        {premiumQuota && !premiumQuota.unlimited && (
                            <div className={styles.quotaSection}>
                                <div className={styles.quotaHeader}>
                                    <span className={styles.quotaLabel}>Premium Requests</span>
                                    <span className={`${styles.quotaPercent} ${styles[getStatusColor(premiumQuota.percent_remaining)]}`}>
                                        {Math.round(premiumQuota.percent_remaining)}% left
                                    </span>
                                </div>
                                <ProgressBar
                                    value={premiumQuota.remaining}
                                    max={premiumQuota.entitlement}
                                    size="small"
                                />
                                <div className={styles.quotaStats}>
                                    <span>{premiumQuota.remaining} / {premiumQuota.entitlement}</span>
                                    <span className={styles.resetTime}>
                                        Resets in {formatResetDate(data.quota_reset_date_utc)}
                                    </span>
                                </div>
                            </div>
                        )}

                        {premiumQuota?.unlimited && (
                            <div className={styles.unlimited}>
                                <Icon name="check" />
                                <span>Unlimited Premium Requests</span>
                            </div>
                        )}

                        {!premiumQuota && (
                            <div className={styles.noQuota}>
                                <span>No quota data available</span>
                            </div>
                        )}
                    </div>
                )}
            </CardBody>
        </Card>
    );
}
