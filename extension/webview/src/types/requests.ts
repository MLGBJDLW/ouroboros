/**
 * TypeScript types for webview requests
 */

import type { Attachment } from './attachments';

export type RequestType = 'ask' | 'menu' | 'confirm' | 'plan_review';
export type RequestStatus = 'pending' | 'responded' | 'cancelled' | 'timeout';

export interface AskRequestData {
    question?: string;
    type?: 'task' | 'question' | 'feature';
    inputLabel?: string;
    /** Whether to allow attachments in the response */
    allowAttachments?: boolean;
}

export interface MenuRequestData {
    question: string;
    options: string[];
    allowCustom?: boolean;
    /** Whether to allow attachments in custom response */
    allowAttachments?: boolean;
}

export interface ConfirmRequestData {
    question: string;
    yesLabel?: string;
    noLabel?: string;
    /** Whether to allow attachments in custom response */
    allowAttachments?: boolean;
}

export interface PlanReviewRequestData {
    plan: string;
    title?: string;
    mode?: 'review' | 'walkthrough';
    /** Whether to allow attachments in feedback */
    allowAttachments?: boolean;
}

export type RequestData =
    | AskRequestData
    | MenuRequestData
    | ConfirmRequestData
    | PlanReviewRequestData;

export interface PendingRequest {
    id: string;
    type: RequestType;
    agentName: string;
    agentLevel: 0 | 1 | 2;
    data: RequestData;
    timestamp: number;
}

/** Serialized attachment for transmission (without blob URLs) */
export interface SerializedAttachment {
    id: string;
    type: 'image' | 'file' | 'code';
    name: string;
    data: string; // base64
    mimeType?: string;
    size?: number;
    language?: string;
}

export interface AskResponse {
    response: string;
    cancelled: boolean;
    /** Attached files/images */
    attachments?: SerializedAttachment[];
}

export interface MenuResponse {
    selectedIndex: number;
    selectedOption: string;
    isCustom: boolean;
    cancelled: boolean;
    /** Attached files/images (only for custom responses) */
    attachments?: SerializedAttachment[];
}

export interface ConfirmResponse {
    confirmed: boolean;
    cancelled: boolean;
    customResponse?: string;
    isCustom?: boolean;
    /** Attached files/images (only for custom responses) */
    attachments?: SerializedAttachment[];
}

export interface PlanReviewResponse {
    approved: boolean;
    feedback?: string;
    cancelled: boolean;
    customResponse?: string;
    isCustom?: boolean;
    /** Attached files/images */
    attachments?: SerializedAttachment[];
}

/** Helper to serialize attachments for transmission */
export function serializeAttachments(attachments: Attachment[]): SerializedAttachment[] {
    return attachments.map(({ id, type, name, data, mimeType, size, language }) => ({
        id,
        type,
        name,
        data,
        mimeType,
        size,
        language,
    }));
}
