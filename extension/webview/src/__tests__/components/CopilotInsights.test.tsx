import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CopilotInsights } from '../../components/CopilotInsights/CopilotInsights';

// Mock useVSCode hook
const mockPostMessage = vi.fn();
vi.mock('../../context/VSCodeContext', () => ({
    useVSCode: () => ({
        postMessage: mockPostMessage,
    }),
}));

describe('CopilotInsights Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders idle state by default', () => {
        render(<CopilotInsights />);
        
        expect(screen.getByText('Copilot Usage')).toBeInTheDocument();
        expect(screen.getByText('Load Usage')).toBeInTheDocument();
        expect(screen.getByText(/Uses internal GitHub API/)).toBeInTheDocument();
    });

    it('sends fetchCopilotInsights message when Load Usage is clicked', () => {
        render(<CopilotInsights />);
        
        fireEvent.click(screen.getByText('Load Usage'));
        
        expect(mockPostMessage).toHaveBeenCalledWith({
            type: 'fetchCopilotInsights',
        });
    });

    it('shows loading state after clicking Load Usage', () => {
        render(<CopilotInsights />);
        
        fireEvent.click(screen.getByText('Load Usage'));
        
        expect(screen.getByText('Fetching usage data...')).toBeInTheDocument();
    });

    it('displays data when successful response is received', async () => {
        render(<CopilotInsights />);
        
        // Click to start loading
        fireEvent.click(screen.getByText('Load Usage'));
        
        // Simulate successful response
        const successMessage = new MessageEvent('message', {
            data: {
                type: 'copilotInsightsResult',
                payload: {
                    success: true,
                    data: {
                        copilot_plan: 'Pro',
                        chat_enabled: true,
                        quota_snapshots: {
                            premium_interactions: {
                                quota_id: 'premium_interactions',
                                entitlement: 1000,
                                remaining: 750,
                                percent_remaining: 75,
                                unlimited: false,
                                overage_permitted: false,
                                overage_count: 0,
                            },
                        },
                        quota_reset_date_utc: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                    },
                },
            },
        });
        
        window.dispatchEvent(successMessage);
        
        await waitFor(() => {
            expect(screen.getByText('Pro')).toBeInTheDocument();
            // New UI shows "used / total" format with separate elements
            expect(screen.getByText('250')).toBeInTheDocument(); // used count
            expect(screen.getByText('1,000')).toBeInTheDocument(); // total count
            expect(screen.getByText('25.0%')).toBeInTheDocument(); // used percentage
            expect(screen.getByText('used')).toBeInTheDocument(); // label
        });
    });

    it('displays unlimited badge when quota is unlimited', async () => {
        render(<CopilotInsights />);
        
        fireEvent.click(screen.getByText('Load Usage'));
        
        const successMessage = new MessageEvent('message', {
            data: {
                type: 'copilotInsightsResult',
                payload: {
                    success: true,
                    data: {
                        copilot_plan: 'Enterprise',
                        chat_enabled: true,
                        quota_snapshots: {
                            premium_interactions: {
                                quota_id: 'premium_interactions',
                                entitlement: 0,
                                remaining: 0,
                                percent_remaining: 100,
                                unlimited: true,
                                overage_permitted: false,
                                overage_count: 0,
                            },
                        },
                        quota_reset_date_utc: '',
                    },
                },
            },
        });
        
        window.dispatchEvent(successMessage);
        
        await waitFor(() => {
            // New UI shows "Unlimited" and "Premium Requests" as separate elements
            expect(screen.getByText('Unlimited')).toBeInTheDocument();
            expect(screen.getByText('Premium Requests')).toBeInTheDocument();
            expect(screen.getByText('Enterprise')).toBeInTheDocument();
        });
    });

    it('displays error state when request fails', async () => {
        render(<CopilotInsights />);
        
        fireEvent.click(screen.getByText('Load Usage'));
        
        const errorMessage = new MessageEvent('message', {
            data: {
                type: 'copilotInsightsResult',
                payload: {
                    success: false,
                    error: 'Authentication required',
                },
            },
        });
        
        window.dispatchEvent(errorMessage);
        
        await waitFor(() => {
            expect(screen.getByText('Authentication required')).toBeInTheDocument();
            expect(screen.getByText('Retry')).toBeInTheDocument();
        });
    });

    it('allows retry after error', async () => {
        render(<CopilotInsights />);
        
        // First attempt
        fireEvent.click(screen.getByText('Load Usage'));
        
        // Simulate error
        window.dispatchEvent(new MessageEvent('message', {
            data: {
                type: 'copilotInsightsResult',
                payload: { success: false, error: 'Network error' },
            },
        }));
        
        await waitFor(() => {
            expect(screen.getByText('Retry')).toBeInTheDocument();
        });
        
        // Clear mock and retry
        mockPostMessage.mockClear();
        fireEvent.click(screen.getByText('Retry'));
        
        expect(mockPostMessage).toHaveBeenCalledWith({
            type: 'fetchCopilotInsights',
        });
    });
});
