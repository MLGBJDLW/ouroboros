import { ReactNode } from 'react';
import styles from './List.module.css';

interface ListProps {
    children: ReactNode;
    className?: string;
}

export function List({ children, className = '' }: ListProps) {
    return <ul className={`${styles.list} ${className}`}>{children}</ul>;
}

interface ListItemProps {
    children: ReactNode;
    className?: string;
    onClick?: () => void;
    active?: boolean;
}

export function ListItem({
    children,
    className = '',
    onClick,
    active = false,
}: ListItemProps) {
    const classes = [
        styles.item,
        onClick ? styles.clickable : '',
        active ? styles.active : '',
        className,
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <li className={classes} onClick={onClick}>
            {children}
        </li>
    );
}
