/**
 * Copilot Insights Service
 * Fetches user's Copilot plan and quota information from GitHub's internal API
 * 
 * WARNING: This uses an undocumented internal API (copilot_internal/user)
 * It may change or be deprecated without notice.
 */

import * as vscode from 'vscode';
import { createLogger } from '../utils/logger';

const logger = createLogger('CopilotInsights');

interface QuotaSnapshot {
    quota_id: string;
    timestamp_utc: string;
    entitlement: number;
    quota_remaining: number;
    remaining: number;
    percent_remaining: number;
    unlimited: boolean;
    overage_permitted: boolean;
    overage_count: number;
}

interface Organization {
    login: string;
    name: string;
}

export interface CopilotUserData {
    copilot_plan: string;
    chat_enabled: boolean;
    access_type_sku: string;
    assigned_date: string;
    organization_list: Organization[];
    quota_snapshots: Record<string, QuotaSnapshot>;
    quota_reset_date_utc: string;
    quota_reset_date: string;
}

export interface CopilotInsightsResult {
    success: boolean;
    data?: CopilotUserData;
    error?: string;
}

/**
 * Fetch Copilot usage data from GitHub's internal API
 */
export async function fetchCopilotInsights(): Promise<CopilotInsightsResult> {
    try {
        // Get GitHub authentication session
        const session = await vscode.authentication.getSession(
            'github',
            ['user:email'],
            { createIfNone: false }
        );

        if (!session) {
            // Try to create a session if none exists
            const newSession = await vscode.authentication.getSession(
                'github',
                ['user:email'],
                { createIfNone: true }
            );

            if (!newSession) {
                return {
                    success: false,
                    error: 'GitHub authentication required. Please sign in.',
                };
            }
        }

        const activeSession = session || await vscode.authentication.getSession(
            'github',
            ['user:email'],
            { createIfNone: false }
        );

        if (!activeSession) {
            return {
                success: false,
                error: 'Failed to authenticate with GitHub',
            };
        }

        logger.debug('Fetching Copilot data from GitHub API');

        // Call the GitHub Copilot internal endpoint
        const response = await fetch('https://api.github.com/copilot_internal/user', {
            headers: {
                'Authorization': `Bearer ${activeSession.accessToken}`,
                'Accept': 'application/json',
                'User-Agent': 'Ouroboros-VSCode-Extension',
            },
        });

        if (!response.ok) {
            const statusText = response.statusText || 'Unknown error';
            
            if (response.status === 401) {
                return {
                    success: false,
                    error: 'Authentication expired. Please re-authenticate.',
                };
            }
            
            if (response.status === 403) {
                return {
                    success: false,
                    error: 'Access denied. Copilot may not be enabled for your account.',
                };
            }
            
            if (response.status === 404) {
                return {
                    success: false,
                    error: 'Copilot not found. You may not have an active Copilot subscription.',
                };
            }

            return {
                success: false,
                error: `GitHub API error: ${response.status} ${statusText}`,
            };
        }

        const data = await response.json() as CopilotUserData;
        logger.debug('Successfully fetched Copilot data', { plan: data.copilot_plan });

        return {
            success: true,
            data,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        logger.error('Failed to fetch Copilot insights:', error);
        
        return {
            success: false,
            error: errorMessage,
        };
    }
}
