/**
 * Copilot-style Attachment Input Component
 * Supports paste, drag & drop, and file picker
 */

import { useRef, useState, useCallback } from 'react';
import { Icon } from '../Icon';
import type { Attachment, AttachmentInputProps } from '../../types/attachments';
import {
    generateAttachmentId,
    isImageType,
    detectLanguage,
    formatFileSize,
    getFileIcon,
} from '../../types/attachments';
import styles from './AttachmentInput.module.css';

const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const DEFAULT_MAX_ATTACHMENTS = 10;

export function AttachmentInput({
    attachments,
    onAttachmentsChange,
    maxAttachments = DEFAULT_MAX_ATTACHMENTS,
    maxFileSize = DEFAULT_MAX_FILE_SIZE,
    acceptedTypes,
    placeholder = 'Type your message...',
    disabled = false,
}: AttachmentInputProps) {
    const [isDragOver, setIsDragOver] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [value, setValue] = useState('');

    const clearError = useCallback(() => {
        if (error) setTimeout(() => setError(null), 3000);
    }, [error]);

    const addAttachment = useCallback((attachment: Attachment) => {
        if (attachments.length >= maxAttachments) {
            setError(`Maximum ${maxAttachments} attachments allowed`);
            clearError();
            return false;
        }
        onAttachmentsChange([...attachments, attachment]);
        return true;
    }, [attachments, maxAttachments, onAttachmentsChange, clearError]);

    const removeAttachment = useCallback((id: string) => {
        const attachment = attachments.find(a => a.id === id);
        if (attachment?.previewUrl) {
            URL.revokeObjectURL(attachment.previewUrl);
        }
        onAttachmentsChange(attachments.filter(a => a.id !== id));
    }, [attachments, onAttachmentsChange]);

    const processFile = useCallback(async (file: File): Promise<Attachment | null> => {
        if (file.size > maxFileSize) {
            setError(`File too large. Max size: ${formatFileSize(maxFileSize)}`);
            clearError();
            return null;
        }

        if (acceptedTypes && !acceptedTypes.some(t => file.type.match(t))) {
            setError('File type not supported');
            clearError();
            return null;
        }

        const isImage = isImageType(file.type);
        
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
                const attachment: Attachment = {
                    id: generateAttachmentId(),
                    type: isImage ? 'image' : (detectLanguage(file.name) ? 'code' : 'file'),
                    name: file.name,
                    data: reader.result as string,
                    mimeType: file.type,
                    size: file.size,
                    language: detectLanguage(file.name),
                };

                if (isImage) {
                    attachment.previewUrl = URL.createObjectURL(file);
                }

                resolve(attachment);
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
        });
    }, [maxFileSize, acceptedTypes, clearError]);

    const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        const files: File[] = [];

        for (const item of items) {
            if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file) files.push(file);
            }
        }

        if (files.length > 0) {
            e.preventDefault();
            for (const file of files) {
                const attachment = await processFile(file);
                if (attachment) {
                    if (!addAttachment(attachment)) break;
                }
            }
        }
    }, [processFile, addAttachment]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) setIsDragOver(true);
    }, [disabled]);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        if (disabled) return;

        const files = Array.from(e.dataTransfer.files);
        for (const file of files) {
            const attachment = await processFile(file);
            if (attachment) {
                if (!addAttachment(attachment)) break;
            }
        }
    }, [disabled, processFile, addAttachment]);

    const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        for (const file of files) {
            const attachment = await processFile(file);
            if (attachment) {
                if (!addAttachment(attachment)) break;
            }
        }
        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, [processFile, addAttachment]);

    const openFilePicker = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setValue(e.target.value);
        // Auto-resize
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    }, []);

    return {
        value,
        setValue,
        textareaRef,
        attachments,
        removeAttachment,
        isDragOver,
        error,
        handlePaste,
        handleDragOver,
        handleDragLeave,
        handleDrop,
        handleFileSelect,
        openFilePicker,
        handleTextareaChange,
        fileInputRef,
        disabled,
        placeholder,
    };
}

/** Attachment Badge Component */
interface AttachmentBadgeProps {
    attachment: Attachment;
    onRemove: () => void;
    compact?: boolean;
}

export function AttachmentBadge({ attachment, onRemove, compact = false }: AttachmentBadgeProps) {
    const [showPreview, setShowPreview] = useState(false);

    return (
        <div 
            className={`${styles.badge} ${compact ? styles.badgeCompact : ''}`}
            onMouseEnter={() => setShowPreview(true)}
            onMouseLeave={() => setShowPreview(false)}
        >
            {attachment.type === 'image' && attachment.previewUrl ? (
                <img 
                    src={attachment.previewUrl} 
                    alt={attachment.name}
                    className={styles.badgeThumbnail}
                />
            ) : (
                <Icon name={getFileIcon(attachment)} className={styles.badgeIcon} />
            )}
            
            <span className={styles.badgeName} title={attachment.name}>
                {attachment.name}
            </span>
            
            {attachment.size && !compact && (
                <span className={styles.badgeSize}>
                    {formatFileSize(attachment.size)}
                </span>
            )}
            
            <button 
                className={styles.badgeRemove}
                onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                }}
                title="Remove"
            >
                <Icon name="close" />
            </button>

            {/* Image Preview Tooltip */}
            {showPreview && attachment.type === 'image' && attachment.previewUrl && (
                <div className={styles.previewTooltip}>
                    <img src={attachment.previewUrl} alt={attachment.name} />
                </div>
            )}
        </div>
    );
}

/** Attachments List Component */
interface AttachmentsListProps {
    attachments: Attachment[];
    onRemove: (id: string) => void;
    compact?: boolean;
}

export function AttachmentsList({ attachments, onRemove, compact = false }: AttachmentsListProps) {
    if (attachments.length === 0) return null;

    return (
        <div className={`${styles.list} ${compact ? styles.listCompact : ''}`}>
            {attachments.map(attachment => (
                <AttachmentBadge
                    key={attachment.id}
                    attachment={attachment}
                    onRemove={() => onRemove(attachment.id)}
                    compact={compact}
                />
            ))}
        </div>
    );
}

/** Drag Overlay Component */
interface DragOverlayProps {
    visible: boolean;
}

export function DragOverlay({ visible }: DragOverlayProps) {
    if (!visible) return null;

    return (
        <div className={styles.dragOverlay}>
            <Icon name="cloud-upload" className={styles.dragIcon} />
            <span>Drop files here</span>
        </div>
    );
}

/** Attachment Actions Bar */
interface AttachmentActionsProps {
    onOpenFilePicker: () => void;
    disabled?: boolean;
    attachmentCount: number;
    maxAttachments: number;
}

export function AttachmentActions({ 
    onOpenFilePicker, 
    disabled,
    attachmentCount,
    maxAttachments,
}: AttachmentActionsProps) {
    const canAddMore = attachmentCount < maxAttachments;

    return (
        <div className={styles.actions}>
            <button
                className={styles.actionButton}
                onClick={onOpenFilePicker}
                disabled={disabled || !canAddMore}
                title={canAddMore ? 'Attach file (images, code, documents)' : 'Max attachments reached'}
            >
                <Icon name="attach" />
            </button>
        </div>
    );
}
