/**
 * Attachment helper functions for tool results
 */

import * as vscode from 'vscode';
import type { SerializedAttachment } from './types';
import { createLogger } from '../utils/logger';

const logger = createLogger('AttachmentHelper');

/**
 * Convert base64 data URL to Uint8Array
 */
export function base64ToUint8Array(base64DataUrl: string): Uint8Array {
    // Remove data URL prefix (e.g., "data:image/png;base64,")
    const base64 = base64DataUrl.split(',')[1] || base64DataUrl;
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

/**
 * Decode base64 data URL to text string
 */
export function base64ToText(base64DataUrl: string): string {
    const base64 = base64DataUrl.split(',')[1] || base64DataUrl;
    return atob(base64);
}

/**
 * Convert attachments to LanguageModel parts
 * - Images -> LanguageModelDataPart.image()
 * - Code/Text files -> LanguageModelTextPart with formatted content
 */
export function attachmentsToDataParts(
    attachments?: SerializedAttachment[]
): Array<vscode.LanguageModelTextPart | vscode.LanguageModelDataPart> {
    const parts: Array<vscode.LanguageModelTextPart | vscode.LanguageModelDataPart> = [];

    if (!attachments || attachments.length === 0) {
        return parts;
    }

    for (const attachment of attachments) {
        try {
            if (attachment.type === 'image' && attachment.mimeType && attachment.data) {
                // Image -> LanguageModelDataPart
                const imageData = base64ToUint8Array(attachment.data);
                parts.push(vscode.LanguageModelDataPart.image(imageData, attachment.mimeType));
                logger.debug('Converted image attachment:', attachment.name, attachment.mimeType);
            } else if ((attachment.type === 'code' || attachment.type === 'file') && attachment.data) {
                // Code/Text file -> LanguageModelTextPart with content
                const content = base64ToText(attachment.data);
                const lang = attachment.language || '';
                const formatted = `\n--- File: ${attachment.name} ---\n\`\`\`${lang}\n${content}\n\`\`\`\n`;
                parts.push(new vscode.LanguageModelTextPart(formatted));
                logger.debug('Converted file attachment:', attachment.name, attachment.language);
            }
        } catch (error) {
            logger.error('Failed to convert attachment:', attachment.name, error);
        }
    }

    return parts;
}

/**
 * Build tool result with text output and optional image attachments
 */
export function buildToolResult<T>(
    output: T,
    attachments?: SerializedAttachment[]
): vscode.LanguageModelToolResult {
    const parts: Array<vscode.LanguageModelTextPart | vscode.LanguageModelDataPart> = [
        new vscode.LanguageModelTextPart(JSON.stringify(output)),
    ];

    // Add image attachments
    parts.push(...attachmentsToDataParts(attachments));

    return new vscode.LanguageModelToolResult(parts);
}
