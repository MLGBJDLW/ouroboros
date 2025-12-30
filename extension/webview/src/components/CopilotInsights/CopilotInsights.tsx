import { useState, useCallback, useEffect } from 'react';
import { Icon } from '../Icon';
import { Button } from '../Button';
import { Card, CardHeader, CardBody } from '../Card';
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

// Circular progress ring component
function CircularProgress({ 
    percent, 
    size = 100, 
    strokeWidth = 8 
}: { 
    percent: number; 
    size?: number; 
    strokeWidth?: number;
}) {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percent / 100) * circumference;
    
    // Color based on usage percentage
    // 0-75%: green (safe), 75-90%: orange (warning), 90%+: red (critical)
    const getColor = (pct: number): string => {
        if (pct < 75) return 'var(--success)';
        if (pct < 90) return 'var(--warning)';
        return 'var(--error)';
    };

    return (
        <svg 
            width={size} 
            height={size} 
            className={styles.circularProgress}
        >
            {/* Background circle */}
            <circle
                className={styles.circleBackground}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                strokeWidth={strokeWidth}
            />
            {/* Progress circle */}
            <circle
                className={styles.circleProgress}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                style={{ stroke: getColor(percent) }}
            />
        </svg>
    );
}

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

    const getStatusColor = (percentUsed: number): string => {
        if (percentUsed < 75) return 'success';
        if (percentUsed < 90) return 'warning';
        return 'error';
    };

    const premiumQuota = getPremiumQuota();

    // Calculate "used" instead of "remaining"
    const getUsageStats = (quota: QuotaSnapshot) => {
        const used = quota.entitlement - quota.remaining;
        const percentUsed = (used / quota.entitlement) * 100;
        return { used, percentUsed };
    };

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
                        {/* Premium Quota with Ring */}
                        {premiumQuota && !premiumQuota.unlimited && (() => {
                            const { used, percentUsed } = getUsageStats(premiumQuota);
                            return (
                                <div className={styles.quotaRing}>
                                    <div className={styles.ringContainer}>
                                        <CircularProgress percent={percentUsed} size={90} strokeWidth={8} />
                                        <div className={styles.ringCenter}>
                                            <span className={`${styles.ringPercent} ${styles[getStatusColor(percentUsed)]}`}>
                                                {percentUsed.toFixed(1)}%
                                            </span>
                                            <span className={styles.ringLabel}>used</span>
                                        </div>
                                    </div>
                                    <div className={styles.quotaDetails}>
                                        <div className={styles.quotaTitle}>Premium Requests</div>
                                        <div className={styles.quotaCount}>
                                            <span className={styles.quotaUsed}>{used.toLocaleString()}</span>
                                            <span className={styles.quotaSeparator}>/</span>
                                            <span className={styles.quotaTotal}>{premiumQuota.entitlement.toLocaleString()}</span>
                                        </div>
                                        <div className={styles.quotaMeta}>
                                            <span className={styles.planBadge}>{data.copilot_plan}</span>
                                            <span className={styles.resetTime}>
                                                Resets in {formatResetDate(data.quota_reset_date_utc)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {premiumQuota?.unlimited && (
                            <div className={styles.unlimited}>
                                <div className={styles.unlimitedIcon}>∞</div>
                                <div className={styles.unlimitedText}>
                                    <span className={styles.unlimitedTitle}>Unlimited</span>
                                    <span className={styles.unlimitedSub}>Premium Requests</span>
                                </div>
                                <span className={styles.planBadge}>{data.copilot_plan}</span>
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
