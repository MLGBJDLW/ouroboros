import styles from './Badge.module.css';

interface BadgeProps {
    children: React.ReactNode;
    variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
    size?: 'small' | 'medium';
}

export function Badge({
    children,
    variant = 'default',
    size = 'medium',
}: BadgeProps) {
    const classes = [styles.badge, styles[variant], styles[size]].join(' ');

    return <span className={classes}>{children}</span>;
}
