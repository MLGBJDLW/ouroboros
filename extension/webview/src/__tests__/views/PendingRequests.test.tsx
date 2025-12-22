import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PendingRequests } from '../../views/PendingRequests/PendingRequests';
import * as usePendingRequestsHook from '../../hooks/usePendingRequests';

// Mock the hook
vi.mock('../../hooks/usePendingRequests');

describe('PendingRequests Component', () => {
    const mockRespond = vi.fn();
    const mockCancel = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        // Default mock implementation
        (usePendingRequestsHook.usePendingRequests as any).mockReturnValue({
            requests: [],
            respond: mockRespond,
            cancel: mockCancel,
        });
        // Mock scrollIntoView
        window.HTMLElement.prototype.scrollIntoView = vi.fn();
    });

    it('renders empty state correctly', () => {
        render(<PendingRequests />);
        expect(screen.getByText('No pending requests')).toBeInTheDocument();
    });

    it('renders ASK request correctly', () => {
        const requests = [{
            id: '1',
            type: 'ask',
            agentName: 'Ouroboros',
            agentLevel: 0,
            timestamp: Date.now(),
            data: {
                group: 'test',
                question: 'What is your name?',
                inputLabel: 'Name',
            },
        }];

        (usePendingRequestsHook.usePendingRequests as any).mockReturnValue({
            requests,
            respond: mockRespond,
            cancel: mockCancel,
        });

        render(<PendingRequests />);

        expect(screen.getByText('What is your name?')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Name')).toBeInTheDocument();
        expect(screen.getByText('Ouroboros (L0)')).toBeInTheDocument();
    });

    it('handles ASK submission', () => {
        const requests = [{
            id: '1',
            type: 'ask',
            agentName: 'Ouroboros',
            agentLevel: 0,
            timestamp: Date.now(),
            data: { group: 'test', question: 'Q?' },
        }];

        (usePendingRequestsHook.usePendingRequests as any).mockReturnValue({
            requests,
            respond: mockRespond,
            cancel: mockCancel,
        });

        render(<PendingRequests />);

        const input = screen.getByPlaceholderText('Type your answer...');
        fireEvent.change(input, { target: { value: 'My Answer' } });
        fireEvent.click(screen.getByText('Send'));

        expect(mockRespond).toHaveBeenCalledWith('1', { response: 'My Answer', cancelled: false });
    });

    it('renders MENU request correctly', () => {
        const requests = [{
            id: '2',
            type: 'menu',
            agentName: 'Coder',
            agentLevel: 1,
            timestamp: Date.now(),
            data: {
                group: 'test',
                question: 'Choose an option',
                options: ['Option A', 'Option B'],
                allowCustom: true,
            },
        }];

        (usePendingRequestsHook.usePendingRequests as any).mockReturnValue({
            requests,
            respond: mockRespond,
            cancel: mockCancel,
        });

        render(<PendingRequests />);

        expect(screen.getByText('Choose an option')).toBeInTheDocument();
        expect(screen.getByText('Option A')).toBeInTheDocument();
        expect(screen.getByText('Option B')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Or type custom response...')).toBeInTheDocument();
    });

    it('handles MENU selection', () => {
        const requests = [{
            id: '2',
            type: 'menu',
            agentName: 'Coder',
            agentLevel: 1,
            timestamp: Date.now(),
            data: {
                group: 'test',
                question: 'Choose',
                options: ['A', 'B'],
            },
        }];

        (usePendingRequestsHook.usePendingRequests as any).mockReturnValue({
            requests,
            respond: mockRespond,
            cancel: mockCancel,
        });

        render(<PendingRequests />);

        fireEvent.click(screen.getByText('A'));

        expect(mockRespond).toHaveBeenCalledWith('2', expect.objectContaining({
            selectedIndex: 0,
            selectedOption: 'A',
        }));
    });

    it('renders CONFIRM request correctly', () => {
        const requests = [{
            id: '3',
            type: 'confirm',
            agentName: 'Manager',
            agentLevel: 0,
            timestamp: Date.now(),
            data: {
                group: 'test',
                question: 'Are you sure?',
            },
        }];

        (usePendingRequestsHook.usePendingRequests as any).mockReturnValue({
            requests,
            respond: mockRespond,
            cancel: mockCancel,
        });

        render(<PendingRequests />);

        expect(screen.getByText('Are you sure?')).toBeInTheDocument();
        expect(screen.getByText('Yes')).toBeInTheDocument();
        expect(screen.getByText('No')).toBeInTheDocument();
    });
});
