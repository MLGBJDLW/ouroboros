/**
 * File Mention Dropdown Component
 * 
 * Displays autocomplete suggestions for @ file mentions.
 */

import { useEffect, useRef } from 'react';
import { Icon } from '../Icon';
import type { FileMention } from '../../hooks/useFileMentions';
import styles from './FileMentionDropdown.module.css';

interface FileMentionDropdownProps {
    matches: FileMention[];
    selectedIndex: number;
    onSelect: (file: FileMention) => void;
    isLoading?: boolean;
}

function getFileIcon(file: FileMention): string {
    if (file.isDirectory) return 'folder';
    
    const ext = file.name.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'ts':
        case 'tsx':
            return 'file-code';
        case 'js':
        case 'jsx':
            return 'file-code';
        case 'json':
            return 'json';
        case 'md':
            return 'markdown';
        case 'css':
        case 'scss':
        case 'less':
            return 'file-code';
        case 'html':
            return 'file-code';
        case 'py':
            return 'file-code';
        case 'yml':
        case 'yaml':
            return 'file-code';
        default:
            return 'file';
    }
}

export function FileMentionDropdown({ matches, selectedIndex, onSelect, isLoading }: FileMentionDropdownProps) {
    const listRef = useRef<HTMLDivElement>(null);
    const selectedRef = useRef<HTMLButtonElement>(null);

    // Scroll selected item into view
    useEffect(() => {
        if (selectedRef.current && listRef.current && selectedRef.current.scrollIntoView) {
            selectedRef.current.scrollIntoView({
                block: 'nearest',
                behavior: 'smooth',
            });
        }
    }, [selectedIndex]);

    if (matches.length === 0 && !isLoading) {
        return (
            <div className={styles.dropdown} ref={listRef}>
                <div className={styles.header}>
                    <Icon name="file" className={styles.headerIcon} />
                    <span>FILE REFERENCE</span>
                </div>
                <div className={styles.empty}>
                    <Icon name="search" />
                    <span>No matching files</span>
                </div>
                <div className={styles.footer}>
                    <span><kbd>Esc</kbd> cancel</span>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.dropdown} ref={listRef}>
            <div className={styles.header}>
                <Icon name="file" className={styles.headerIcon} />
                <span>FILE REFERENCE</span>
                {isLoading && <span className={styles.loading}>Loading...</span>}
            </div>
            <div className={styles.list}>
                {matches.map((file, index) => (
                    <button
                        key={file.path}
                        ref={index === selectedIndex ? selectedRef : null}
                        className={`${styles.item} ${index === selectedIndex ? styles.selected : ''}`}
                        onClick={() => onSelect(file)}
                        type="button"
                    >
                        <Icon name={getFileIcon(file)} className={styles.fileIcon} />
                        <div className={styles.fileInfo}>
                            <span className={styles.fileName}>{file.name}</span>
                            <span className={styles.filePath}>{file.path}</span>
                        </div>
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
