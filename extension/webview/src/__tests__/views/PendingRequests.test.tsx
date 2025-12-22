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
        expect(screen.getByText('Waiting for agent input...')).toBeInTheDocument();
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

    it('handles ASK submission via Enter key', () => {
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
        fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });

        expect(mockRespond).toHaveBeenCalledWith('1', { response: 'My Answer', cancelled: false });
    });

    it('does not submit ASK on Shift+Enter', () => {
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
        fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });

        expect(mockRespond).not.toHaveBeenCalled();
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
        // Custom input is hidden by default, need to click toggle to show
        expect(screen.getByText('Custom response')).toBeInTheDocument();
    });

    it('shows custom input when toggle is clicked', () => {
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

        // Click the custom response toggle
        fireEvent.click(screen.getByText('Custom response'));
        
        // Now the input should be visible
        expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
    });

    it('handles MENU custom input submission', () => {
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

        // Click the custom response toggle
        fireEvent.click(screen.getByText('Custom response'));
        
        const input = screen.getByPlaceholderText('Type your message...');
        fireEvent.change(input, { target: { value: 'Custom Value' } });
        fireEvent.click(screen.getByTitle('Send'));

        expect(mockRespond).toHaveBeenCalledWith('2', expect.objectContaining({
            selectedIndex: -1,
            selectedOption: 'Custom Value',
            isCustom: true,
        }));
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

    it('handles CONFIRM Yes click', () => {
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

        fireEvent.click(screen.getByText('Yes'));

        expect(mockRespond).toHaveBeenCalledWith('3', { confirmed: true, cancelled: false });
    });

    it('handles CONFIRM No click', () => {
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

        fireEvent.click(screen.getByText('No'));

        expect(mockRespond).toHaveBeenCalledWith('3', { confirmed: false, cancelled: false });
    });

    it('renders CONFIRM with custom labels', () => {
        const requests = [{
            id: '3',
            type: 'confirm',
            agentName: 'Manager',
            agentLevel: 0,
            timestamp: Date.now(),
            data: {
                group: 'test',
                question: 'Proceed?',
                yesLabel: 'Continue',
                noLabel: 'Cancel',
            },
        }];

        (usePendingRequestsHook.usePendingRequests as any).mockReturnValue({
            requests,
            respond: mockRespond,
            cancel: mockCancel,
        });

        render(<PendingRequests />);

        expect(screen.getByText('Continue')).toBeInTheDocument();
        expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('handles CONFIRM custom input', () => {
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

        // Click the custom response toggle
        fireEvent.click(screen.getByText('Custom response'));
        
        const input = screen.getByPlaceholderText('Type your message...');
        fireEvent.change(input, { target: { value: 'Maybe later' } });
        fireEvent.click(screen.getByTitle('Send'));

        expect(mockRespond).toHaveBeenCalledWith('3', expect.objectContaining({
            customResponse: 'Maybe later',
            isCustom: true,
        }));
    });

    it('renders PLAN_REVIEW request correctly', () => {
        const requests = [{
            id: '4',
            type: 'plan_review',
            agentName: 'Planner',
            agentLevel: 1,
            timestamp: Date.now(),
            data: {
                group: 'test',
                plan: '# Plan\n- Step 1\n- Step 2',
                title: 'Implementation Plan',
                mode: 'review',
            },
        }];

        (usePendingRequestsHook.usePendingRequests as any).mockReturnValue({
            requests,
            respond: mockRespond,
            cancel: mockCancel,
        });

        render(<PendingRequests />);

        expect(screen.getByText('Implementation Plan')).toBeInTheDocument();
        // Use a function matcher for multiline text in pre element
        expect(screen.getByText((content, element) => {
            return element?.tagName === 'PRE' && content.includes('# Plan');
        })).toBeInTheDocument();
        expect(screen.getByText('Approve')).toBeInTheDocument();
        expect(screen.getByText('Request Changes')).toBeInTheDocument();
        expect(screen.getByText('Reject')).toBeInTheDocument();
    });

    it('handles PLAN_REVIEW approve', () => {
        const requests = [{
            id: '4',
            type: 'plan_review',
            agentName: 'Planner',
            agentLevel: 1,
            timestamp: Date.now(),
            data: {
                group: 'test',
                plan: 'Plan content',
            },
        }];

        (usePendingRequestsHook.usePendingRequests as any).mockReturnValue({
            requests,
            respond: mockRespond,
            cancel: mockCancel,
        });

        render(<PendingRequests />);

        fireEvent.click(screen.getByText('Approve'));

        expect(mockRespond).toHaveBeenCalledWith('4', expect.objectContaining({
            approved: true,
        }));
    });

    it('handles PLAN_REVIEW reject', () => {
        const requests = [{
            id: '4',
            type: 'plan_review',
            agentName: 'Planner',
            agentLevel: 1,
            timestamp: Date.now(),
            data: {
                group: 'test',
                plan: 'Plan content',
            },
        }];

        (usePendingRequestsHook.usePendingRequests as any).mockReturnValue({
            requests,
            respond: mockRespond,
            cancel: mockCancel,
        });

        render(<PendingRequests />);

        fireEvent.click(screen.getByText('Reject'));

        expect(mockRespond).toHaveBeenCalledWith('4', expect.objectContaining({
            approved: false,
        }));
    });

    it('handles PLAN_REVIEW request changes with feedback', () => {
        const requests = [{
            id: '4',
            type: 'plan_review',
            agentName: 'Planner',
            agentLevel: 1,
            timestamp: Date.now(),
            data: {
                group: 'test',
                plan: 'Plan content',
            },
        }];

        (usePendingRequestsHook.usePendingRequests as any).mockReturnValue({
            requests,
            respond: mockRespond,
            cancel: mockCancel,
        });

        render(<PendingRequests />);

        const feedbackInput = screen.getByPlaceholderText('Feedback (required for changes)...');
        fireEvent.change(feedbackInput, { target: { value: 'Please add more details' } });
        fireEvent.click(screen.getByText('Request Changes'));

        expect(mockRespond).toHaveBeenCalledWith('4', expect.objectContaining({
            approved: false,
            feedback: 'Please add more details',
        }));
    });

    it('handles PLAN_REVIEW custom input', () => {
        const requests = [{
            id: '4',
            type: 'plan_review',
            agentName: 'Planner',
            agentLevel: 1,
            timestamp: Date.now(),
            data: {
                group: 'test',
                plan: 'Plan content',
            },
        }];

        (usePendingRequestsHook.usePendingRequests as any).mockReturnValue({
            requests,
            respond: mockRespond,
            cancel: mockCancel,
        });

        render(<PendingRequests />);

        // Click the custom response toggle
        fireEvent.click(screen.getByText('Custom response'));
        
        const input = screen.getByPlaceholderText('Type your message...');
        fireEvent.change(input, { target: { value: 'Let me think about it' } });
        fireEvent.click(screen.getByTitle('Send'));

        expect(mockRespond).toHaveBeenCalledWith('4', expect.objectContaining({
            customResponse: 'Let me think about it',
            isCustom: true,
        }));
    });

    it('handles cancel via close button', () => {
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

        const closeButton = screen.getByTitle('Cancel (Esc)');
        fireEvent.click(closeButton);

        expect(mockCancel).toHaveBeenCalledWith('1');
    });

    it('shows only the most recent request when multiple exist', () => {
        const requests = [
            {
                id: '1',
                type: 'ask',
                agentName: 'Agent1',
                agentLevel: 0,
                timestamp: Date.now() - 1000,
                data: { group: 'test', question: 'First question?' },
            },
            {
                id: '2',
                type: 'ask',
                agentName: 'Agent2',
                agentLevel: 1,
                timestamp: Date.now(),
                data: { group: 'test', question: 'Second question?' },
            },
        ];

        (usePendingRequestsHook.usePendingRequests as any).mockReturnValue({
            requests,
            respond: mockRespond,
            cancel: mockCancel,
        });

        render(<PendingRequests />);

        // Should show only the most recent (second) request
        expect(screen.getByText('Second question?')).toBeInTheDocument();
        expect(screen.queryByText('First question?')).not.toBeInTheDocument();
    });

    it('renders PLAN_REVIEW with walkthrough mode', () => {
        const requests = [{
            id: '4',
            type: 'plan_review',
            agentName: 'Planner',
            agentLevel: 1,
            timestamp: Date.now(),
            data: {
                group: 'test',
                plan: 'Walkthrough content',
                title: 'Guide',
                mode: 'walkthrough',
            },
        }];

        (usePendingRequestsHook.usePendingRequests as any).mockReturnValue({
            requests,
            respond: mockRespond,
            cancel: mockCancel,
        });

        render(<PendingRequests />);

        expect(screen.getByText('Guide')).toBeInTheDocument();
        expect(screen.getByText('Walkthrough')).toBeInTheDocument();
    });

    // Keyboard shortcut tests
    it('handles ASK cancel via Escape key', () => {
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

        fireEvent.keyDown(window, { key: 'Escape' });

        expect(mockCancel).toHaveBeenCalledWith('1');
    });

    it('handles MENU number key selection', () => {
        const requests = [{
            id: '2',
            type: 'menu',
            agentName: 'Coder',
            agentLevel: 1,
            timestamp: Date.now(),
            data: {
                group: 'test',
                question: 'Choose',
                options: ['Option A', 'Option B', 'Option C'],
            },
        }];

        (usePendingRequestsHook.usePendingRequests as any).mockReturnValue({
            requests,
            respond: mockRespond,
            cancel: mockCancel,
        });

        render(<PendingRequests />);

        // Press '2' to select second option
        fireEvent.keyDown(window, { key: '2' });

        expect(mockRespond).toHaveBeenCalledWith('2', expect.objectContaining({
            selectedIndex: 1,
            selectedOption: 'Option B',
        }));
    });

    it('handles MENU custom input via C key', () => {
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

        // Press 'C' to show custom input
        fireEvent.keyDown(window, { key: 'C' });

        expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
    });

    it('handles CONFIRM Y key for yes', () => {
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

        fireEvent.keyDown(window, { key: 'Y' });

        expect(mockRespond).toHaveBeenCalledWith('3', { confirmed: true, cancelled: false });
    });

    it('handles CONFIRM N key for no', () => {
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

        fireEvent.keyDown(window, { key: 'n' });

        expect(mockRespond).toHaveBeenCalledWith('3', { confirmed: false, cancelled: false });
    });

    it('handles PLAN_REVIEW Ctrl+Enter for approve', () => {
        const requests = [{
            id: '4',
            type: 'plan_review',
            agentName: 'Planner',
            agentLevel: 1,
            timestamp: Date.now(),
            data: {
                group: 'test',
                plan: 'Plan content',
            },
        }];

        (usePendingRequestsHook.usePendingRequests as any).mockReturnValue({
            requests,
            respond: mockRespond,
            cancel: mockCancel,
        });

        render(<PendingRequests />);

        fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true });

        expect(mockRespond).toHaveBeenCalledWith('4', expect.objectContaining({
            approved: true,
        }));
    });

    it('handles MENU custom input Enter submission', () => {
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

        // Click the custom response toggle
        fireEvent.click(screen.getByText('Custom response'));
        
        const input = screen.getByPlaceholderText('Type your message...');
        fireEvent.change(input, { target: { value: 'Custom Value' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        expect(mockRespond).toHaveBeenCalledWith('2', expect.objectContaining({
            selectedIndex: -1,
            selectedOption: 'Custom Value',
            isCustom: true,
        }));
    });

    it('handles CONFIRM custom input Enter submission', () => {
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

        // Click the custom response toggle
        fireEvent.click(screen.getByText('Custom response'));
        
        const input = screen.getByPlaceholderText('Type your message...');
        fireEvent.change(input, { target: { value: 'Maybe' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        expect(mockRespond).toHaveBeenCalledWith('3', expect.objectContaining({
            customResponse: 'Maybe',
            isCustom: true,
        }));
    });

    it('handles PLAN_REVIEW custom input Enter submission', () => {
        const requests = [{
            id: '4',
            type: 'plan_review',
            agentName: 'Planner',
            agentLevel: 1,
            timestamp: Date.now(),
            data: {
                group: 'test',
                plan: 'Plan content',
            },
        }];

        (usePendingRequestsHook.usePendingRequests as any).mockReturnValue({
            requests,
            respond: mockRespond,
            cancel: mockCancel,
        });

        render(<PendingRequests />);

        // Click the custom response toggle
        fireEvent.click(screen.getByText('Custom response'));
        
        const input = screen.getByPlaceholderText('Type your message...');
        fireEvent.change(input, { target: { value: 'Need more time' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        expect(mockRespond).toHaveBeenCalledWith('4', expect.objectContaining({
            customResponse: 'Need more time',
            isCustom: true,
        }));
    });
});
