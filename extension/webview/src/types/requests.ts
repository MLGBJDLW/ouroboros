/**
 * TypeScript types for webview requests
 */

export type RequestType = 'ask' | 'menu' | 'confirm' | 'plan_review';
export type RequestStatus = 'pending' | 'responded' | 'cancelled' | 'timeout';

export interface AskRequestData {
    question?: string;
    type?: 'task' | 'question' | 'feature';
    inputLabel?: string;
}

export interface MenuRequestData {
    question: string;
    options: string[];
    allowCustom?: boolean;
}

export interface ConfirmRequestData {
    question: string;
    yesLabel?: string;
    noLabel?: string;
}

export interface PlanReviewRequestData {
    plan: string;
    title?: string;
    mode?: 'review' | 'walkthrough';
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

export interface AskResponse {
    response: string;
    cancelled: boolean;
}

export interface MenuResponse {
    selectedIndex: number;
    selectedOption: string;
    isCustom: boolean;
    cancelled: boolean;
}

export interface ConfirmResponse {
    confirmed: boolean;
    cancelled: boolean;
}

export interface PlanReviewResponse {
    approved: boolean;
    feedback?: string;
    cancelled: boolean;
}
