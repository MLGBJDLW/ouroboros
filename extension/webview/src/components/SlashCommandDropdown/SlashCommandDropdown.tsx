/**
 * Slash Command Dropdown Component
 * 
 * Displays autocomplete suggestions for slash commands.
 */

import { useEffect, useRef } from 'react';
import { Icon } from '../Icon';
import type { SlashCommand } from '../../hooks/useSlashCommands';
import styles from './SlashCommandDropdown.module.css';

interface SlashCommandDropdownProps {
    matches: SlashCommand[];
    selectedIndex: number;
    onSelect: (command: SlashCommand) => void;
}

export function SlashCommandDropdown({ matches, selectedIndex, onSelect }: SlashCommandDropdownProps) {
    const listRef = useRef<HTMLDivElement>(null);
    const selectedRef = useRef<HTMLButtonElement>(null);

    // Scroll selected item into view
    useEffect(() => {
        if (selectedRef.current && listRef.current) {
            selectedRef.current.scrollIntoView({
                block: 'nearest',
                behavior: 'smooth',
            });
        }
    }, [selectedIndex]);

    if (matches.length === 0) {
        return null;
    }

    return (
        <div className={styles.dropdown} ref={listRef}>
            <div className={styles.header}>
                <Icon name="terminal" className={styles.headerIcon} />
                <span>SLASH COMMANDS</span>
            </div>
            <div className={styles.list}>
                {matches.map((cmd, index) => (
                    <button
                        key={cmd.command}
                        ref={index === selectedIndex ? selectedRef : null}
                        className={`${styles.item} ${index === selectedIndex ? styles.selected : ''}`}
                        onClick={() => onSelect(cmd)}
                        type="button"
                    >
                        <span className={styles.command}>{cmd.command}</span>
                        <span className={styles.description}>{cmd.description}</span>
                    </button>
                ))}
            </div>
            <div className={styles.footer}>
                <span><kbd>↑↓</kbd> navigate</span>
                <span><kbd>Tab</kbd> complete</span>
                <span><kbd>Esc</kbd> cancel</span>
            </div>
        </div>
    );
}
