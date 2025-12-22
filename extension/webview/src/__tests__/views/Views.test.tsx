import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentHierarchy } from '../../views/AgentHierarchy/AgentHierarchy';
import { History } from '../../views/History/History';
import { WorkflowProgress } from '../../views/WorkflowProgress/WorkflowProgress';
import * as AppContext from '../../context/AppContext';
import * as VSCodeContext from '../../context/VSCodeContext';
import * as useHistoryHook from '../../hooks/useHistory';
import * as useWorkflowHook from '../../hooks/useWorkflow';

// Mock contexts and hooks
vi.mock('../../context/AppContext');
vi.mock('../../context/VSCodeContext');
vi.mock('../../hooks/useHistory');
vi.mock('../../hooks/useWorkflow');

describe('AgentHierarchy View', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders empty state when no agents', () => {
        (AppContext.useAppContext as any).mockReturnValue({
            state: {
                currentAgent: null,
                handoffHistory: [],
            },
        });

        render(<AgentHierarchy />);
        expect(screen.getByText('No active agents')).toBeInTheDocument();
    });

    it('renders current agent', () => {
        (AppContext.useAppContext as any).mockReturnValue({
            state: {
                currentAgent: { name: 'ouroboros', level: 0 },
                handoffHistory: [],
            },
        });

        render(<AgentHierarchy />);
        expect(screen.getByText('ouroboros')).toBeInTheDocument();
    });

    it('renders handoff history', () => {
        (AppContext.useAppContext as any).mockReturnValue({
            state: {
                currentAgent: { name: 'coder', level: 2 },
                handoffHistory: [
                    {
                        from: { name: 'ouroboros', level: 0 },
                        to: { name: 'coder', level: 2 },
                        reason: 'Delegating coding task',
                    },
                ],
            },
        });

        render(<AgentHierarchy />);
        expect(screen.getByText('Handoff History')).toBeInTheDocument();
        expect(screen.getByText('Delegating coding task')).toBeInTheDocument();
    });

    it('renders agent levels legend', () => {
        (AppContext.useAppContext as any).mockReturnValue({
            state: {
                currentAgent: { name: 'ouroboros', level: 0 },
                handoffHistory: [],
            },
        });

        render(<AgentHierarchy />);
        expect(screen.getByText('Agent Levels')).toBeInTheDocument();
        expect(screen.getByText('God Mode')).toBeInTheDocument();
        expect(screen.getByText('Lead Agents')).toBeInTheDocument();
        expect(screen.getByText('Worker Agents')).toBeInTheDocument();
    });
});

describe('History View', () => {
    const mockClearHistory = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders empty state when no history', () => {
        (useHistoryHook.useHistory as any).mockReturnValue({
            history: [],
            clearHistory: mockClearHistory,
        });

        render(<History />);
        expect(screen.getByText('No interaction history')).toBeInTheDocument();
    });

    it('renders history items', () => {
        (useHistoryHook.useHistory as any).mockReturnValue({
            history: [
                {
                    id: '1',
                    timestamp: Date.now(),
                    type: 'ask',
                    agentName: 'Ouroboros',
                    agentLevel: 0,
                    question: 'What is your task?',
                    response: 'Build a feature',
                    status: 'responded',
                },
            ],
            clearHistory: mockClearHistory,
        });

        render(<History />);
        expect(screen.getByText('1 interactions')).toBeInTheDocument();
        expect(screen.getByText('What is your task?')).toBeInTheDocument();
        expect(screen.getByText('Build a feature')).toBeInTheDocument();
    });

    it('handles clear history click', () => {
        (useHistoryHook.useHistory as any).mockReturnValue({
            history: [
                {
                    id: '1',
                    timestamp: Date.now(),
                    type: 'ask',
                    agentName: 'Ouroboros',
                    agentLevel: 0,
                    status: 'responded',
                },
            ],
            clearHistory: mockClearHistory,
        });

        render(<History />);
        fireEvent.click(screen.getByText('Clear'));
        expect(mockClearHistory).toHaveBeenCalled();
    });

    it('renders different status variants', () => {
        (useHistoryHook.useHistory as any).mockReturnValue({
            history: [
                { id: '1', timestamp: Date.now(), type: 'ask', agentName: 'A', agentLevel: 0, status: 'responded' },
                { id: '2', timestamp: Date.now(), type: 'confirm', agentName: 'B', agentLevel: 1, status: 'cancelled' },
                { id: '3', timestamp: Date.now(), type: 'menu', agentName: 'C', agentLevel: 2, status: 'timeout' },
            ],
            clearHistory: mockClearHistory,
        });

        render(<History />);
        expect(screen.getByText('3 interactions')).toBeInTheDocument();
    });
});

describe('WorkflowProgress View', () => {
    const mockPostMessage = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        (VSCodeContext.useVSCode as any).mockReturnValue({
            postMessage: mockPostMessage,
        });
    });

    it('renders empty state when no workflow', () => {
        (useWorkflowHook.useWorkflow as any).mockReturnValue({
            type: null,
            specName: null,
            currentPhase: 0,
            totalPhases: 0,
            status: '',
            phases: [],
            executionMode: 'task-by-task',
        });

        render(<WorkflowProgress />);
        expect(screen.getByText('No active workflow')).toBeInTheDocument();
    });

    it('renders spec workflow', () => {
        (useWorkflowHook.useWorkflow as any).mockReturnValue({
            type: 'spec',
            specName: 'my-feature',
            currentPhase: 2,
            totalPhases: 4,
            status: 'Processing requirements',
            phases: [
                { number: 1, name: 'Requirements', status: 'completed' },
                { number: 2, name: 'Design', status: 'current' },
                { number: 3, name: 'Tasks', status: 'pending' },
            ],
            executionMode: 'task-by-task',
        });

        render(<WorkflowProgress />);
        expect(screen.getByText('SPEC')).toBeInTheDocument();
        expect(screen.getByText('my-feature')).toBeInTheDocument();
        expect(screen.getByText('Processing requirements')).toBeInTheDocument();
        expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('renders implement workflow', () => {
        (useWorkflowHook.useWorkflow as any).mockReturnValue({
            type: 'implement',
            specName: 'my-feature',
            currentPhase: 1,
            totalPhases: 3,
            status: 'Implementing',
            phases: [],
            executionMode: 'auto-run',
        });

        render(<WorkflowProgress />);
        expect(screen.getByText('IMPLEMENT')).toBeInTheDocument();
    });

    it('handles execution mode change', () => {
        (useWorkflowHook.useWorkflow as any).mockReturnValue({
            type: 'spec',
            specName: 'test',
            currentPhase: 1,
            totalPhases: 2,
            status: '',
            phases: [],
            executionMode: 'task-by-task',
        });

        render(<WorkflowProgress />);
        
        const select = screen.getByRole('combobox');
        fireEvent.change(select, { target: { value: 'auto-run' } });
        
        expect(mockPostMessage).toHaveBeenCalledWith({
            type: 'updateExecutionMode',
            payload: { mode: 'auto-run' },
        });
    });

    it('renders phases with different statuses', () => {
        (useWorkflowHook.useWorkflow as any).mockReturnValue({
            type: 'spec',
            specName: 'test',
            currentPhase: 2,
            totalPhases: 3,
            status: '',
            phases: [
                { number: 1, name: 'Done', status: 'completed' },
                { number: 2, name: 'Active', status: 'current' },
                { number: 3, name: '', status: 'pending' },
            ],
            executionMode: 'task-by-task',
        });

        render(<WorkflowProgress />);
        expect(screen.getByText('Phase 1: Done')).toBeInTheDocument();
        expect(screen.getByText('Phase 2: Active')).toBeInTheDocument();
        expect(screen.getByText('Phase 3')).toBeInTheDocument();
    });

    it('truncates long spec names', () => {
        (useWorkflowHook.useWorkflow as any).mockReturnValue({
            type: 'spec',
            specName: 'this-is-a-very-long-spec-name-that-should-be-truncated',
            currentPhase: 1,
            totalPhases: 2,
            status: '',
            phases: [],
            executionMode: 'task-by-task',
        });

        render(<WorkflowProgress />);
        // The truncate function should shorten the name
        expect(screen.getByText(/this-is-a-very-long-spec-name/)).toBeInTheDocument();
    });
});
