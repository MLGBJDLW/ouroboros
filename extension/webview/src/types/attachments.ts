/**
 * Attachment types for Copilot-style file/image attachments
 */

export type AttachmentType = 'image' | 'file' | 'code';

export interface Attachment {
    id: string;
    type: AttachmentType;
    name: string;
    /** Base64 data for images, or file path for workspace files */
    data: string;
    /** MIME type for images */
    mimeType?: string;
    /** File size in bytes */
    size?: number;
    /** Preview URL for images (blob URL) */
    previewUrl?: string;
    /** Language for code files */
    language?: string;
}

export interface AttachmentInputProps {
    attachments: Attachment[];
    onAttachmentsChange: (attachments: Attachment[]) => void;
    maxAttachments?: number;
    maxFileSize?: number; // in bytes, default 5MB
    acceptedTypes?: string[]; // MIME types
    placeholder?: string;
    disabled?: boolean;
}

/** Generate unique attachment ID */
export function generateAttachmentId(): string {
    return `att-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/** Get file extension from name */
export function getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
}

/** Detect language from file extension */
export function detectLanguage(filename: string): string | undefined {
    const ext = getFileExtension(filename);
    const languageMap: Record<string, string> = {
        ts: 'typescript',
        tsx: 'typescriptreact',
        js: 'javascript',
        jsx: 'javascriptreact',
        py: 'python',
        rs: 'rust',
        go: 'go',
        java: 'java',
        cpp: 'cpp',
        c: 'c',
        cs: 'csharp',
        rb: 'ruby',
        php: 'php',
        swift: 'swift',
        kt: 'kotlin',
        md: 'markdown',
        json: 'json',
        yaml: 'yaml',
        yml: 'yaml',
        xml: 'xml',
        html: 'html',
        css: 'css',
        scss: 'scss',
        sql: 'sql',
        sh: 'shell',
        bash: 'shell',
    };
    return languageMap[ext];
}

/** Format file size for display */
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Check if MIME type is an image */
export function isImageType(mimeType: string): boolean {
    return mimeType.startsWith('image/');
}

/** Get icon name for file type */
export function getFileIcon(attachment: Attachment): string {
    if (attachment.type === 'image') return 'file-media';
    if (attachment.type === 'code') return 'file-code';
    
    const ext = getFileExtension(attachment.name);
    const iconMap: Record<string, string> = {
        pdf: 'file-pdf',
        doc: 'file-text',
        docx: 'file-text',
        txt: 'file-text',
        md: 'markdown',
        json: 'json',
        xml: 'file-code',
        zip: 'file-zip',
        tar: 'file-zip',
        gz: 'file-zip',
    };
    return iconMap[ext] || 'file';
}
