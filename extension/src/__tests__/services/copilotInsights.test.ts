/**
 * Tests for CopilotInsights service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';

// Mock logger
vi.mock('../../utils/logger', () => ({
    createLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    }),
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('CopilotInsights Service', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('fetchCopilotInsights', () => {
        it('should return error when no GitHub session exists', async () => {
            (vscode.authentication.getSession as ReturnType<typeof vi.fn>)
                .mockResolvedValueOnce(null) // First call with createIfNone: false
                .mockResolvedValueOnce(null); // Second call with createIfNone: true

            const { fetchCopilotInsights } = await import('../../services/copilotInsights');
            const result = await fetchCopilotInsights();

            expect(result.success).toBe(false);
            expect(result.error).toContain('authentication');
        });

        it('should fetch data successfully with valid session', async () => {
            const mockSession = {
                accessToken: 'test-token',
                account: { id: '123', label: 'test@example.com' },
                scopes: ['user:email'],
            };

            (vscode.authentication.getSession as ReturnType<typeof vi.fn>)
                .mockResolvedValue(mockSession);

            const mockData = {
                copilot_plan: 'Pro',
                chat_enabled: true,
                quota_snapshots: {
                    premium_interactions: {
                        quota_id: 'premium_interactions',
                        entitlement: 1000,
                        remaining: 800,
                        percent_remaining: 80,
                        unlimited: false,
                    },
                },
                quota_reset_date_utc: '2025-01-15T00:00:00Z',
            };

            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockData),
            });

            const { fetchCopilotInsights } = await import('../../services/copilotInsights');
            const result = await fetchCopilotInsights();

            expect(result.success).toBe(true);
            expect(result.data?.copilot_plan).toBe('Pro');
            expect(result.data?.quota_snapshots.premium_interactions.remaining).toBe(800);
        });

        it('should handle 401 unauthorized error', async () => {
            const mockSession = {
                accessToken: 'expired-token',
                account: { id: '123', label: 'test@example.com' },
                scopes: ['user:email'],
            };

            (vscode.authentication.getSession as ReturnType<typeof vi.fn>)
                .mockResolvedValue(mockSession);

            mockFetch.mockResolvedValue({
                ok: false,
                status: 401,
                statusText: 'Unauthorized',
            });

            const { fetchCopilotInsights } = await import('../../services/copilotInsights');
            const result = await fetchCopilotInsights();

            expect(result.success).toBe(false);
            expect(result.error).toContain('expired');
        });

        it('should handle 403 forbidden error', async () => {
            const mockSession = {
                accessToken: 'test-token',
                account: { id: '123', label: 'test@example.com' },
                scopes: ['user:email'],
            };

            (vscode.authentication.getSession as ReturnType<typeof vi.fn>)
                .mockResolvedValue(mockSession);

            mockFetch.mockResolvedValue({
                ok: false,
                status: 403,
                statusText: 'Forbidden',
            });

            const { fetchCopilotInsights } = await import('../../services/copilotInsights');
            const result = await fetchCopilotInsights();

            expect(result.success).toBe(false);
            expect(result.error).toContain('Access denied');
        });

        it('should handle 404 not found error', async () => {
            const mockSession = {
                accessToken: 'test-token',
                account: { id: '123', label: 'test@example.com' },
                scopes: ['user:email'],
            };

            (vscode.authentication.getSession as ReturnType<typeof vi.fn>)
                .mockResolvedValue(mockSession);

            mockFetch.mockResolvedValue({
                ok: false,
                status: 404,
                statusText: 'Not Found',
            });

            const { fetchCopilotInsights } = await import('../../services/copilotInsights');
            const result = await fetchCopilotInsights();

            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });

        it('should handle network errors', async () => {
            const mockSession = {
                accessToken: 'test-token',
                account: { id: '123', label: 'test@example.com' },
                scopes: ['user:email'],
            };

            (vscode.authentication.getSession as ReturnType<typeof vi.fn>)
                .mockResolvedValue(mockSession);

            mockFetch.mockRejectedValue(new Error('Network error'));

            const { fetchCopilotInsights } = await import('../../services/copilotInsights');
            const result = await fetchCopilotInsights();

            expect(result.success).toBe(false);
            expect(result.error).toBe('Network error');
        });

        it('should call correct API endpoint with proper headers', async () => {
            const mockSession = {
                accessToken: 'my-secret-token',
                account: { id: '123', label: 'test@example.com' },
                scopes: ['user:email'],
            };

            (vscode.authentication.getSession as ReturnType<typeof vi.fn>)
                .mockResolvedValue(mockSession);

            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ copilot_plan: 'Free' }),
            });

            const { fetchCopilotInsights } = await import('../../services/copilotInsights');
            await fetchCopilotInsights();

            expect(mockFetch).toHaveBeenCalledWith(
                'https://api.github.com/copilot_internal/user',
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer my-secret-token',
                        'Accept': 'application/json',
                    }),
                })
            );
        });
    });
});
