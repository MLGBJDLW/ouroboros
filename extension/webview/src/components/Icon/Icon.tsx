import styles from './Icon.module.css';

interface IconProps {
    name: string;
    className?: string;
    spin?: boolean;
}

export function Icon({ name, className = '', spin = false }: IconProps) {
    const classes = [
        'codicon',
        `codicon-${name}`,
        styles.icon,
        spin ? styles.spin : '',
        className,
    ]
        .filter(Boolean)
        .join(' ');

    return <i className={classes} />;
}
