import { ReactNode } from 'react';
import { Icon } from '../Icon';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
    icon: string;
    title: string;
    description?: string;
    action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
    return (
        <div className={styles.container} role="status">
            <div className={styles.iconWrapper}>
                <Icon name={icon} className={styles.icon} />
            </div>
            <h3 className={styles.title}>{title}</h3>
            {description && <p className={styles.description}>{description}</p>}
            {action && <div className={styles.action}>{action}</div>}
        </div>
    );
}
