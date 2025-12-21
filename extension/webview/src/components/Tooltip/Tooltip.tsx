import { ReactNode } from 'react';
import styles from './Tooltip.module.css';

interface TooltipProps {
    content: string;
    children: ReactNode;
    position?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ content, children, position = 'top' }: TooltipProps) {
    return (
        <div className={styles.container}>
            {children}
            <div
                className={`${styles.tooltip} ${styles[position]}`}
                role="tooltip"
            >
                {content}
            </div>
        </div>
    );
}
