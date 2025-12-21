import styles from './ProgressBar.module.css';

interface ProgressBarProps {
    value: number;
    max?: number;
    showLabel?: boolean;
    size?: 'small' | 'medium';
}

export function ProgressBar({
    value,
    max = 100,
    showLabel = false,
    size = 'medium',
}: ProgressBarProps) {
    const percentage = Math.min(100, Math.max(0, (value / max) * 100));

    return (
        <div className={`${styles.container} ${styles[size]}`}>
            <div className={styles.track}>
                <div
                    className={styles.fill}
                    style={{ width: `${percentage}%` }}
                />
            </div>
            {showLabel && (
                <span className={styles.label}>{Math.round(percentage)}%</span>
            )}
        </div>
    );
}
