import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentHierarchy } from '../../views/AgentHierarchy/AgentHierarchy';
import { History } from '../../views/History/History';
import { WorkflowProgress } from '../../views/WorkflowProgress/WorkflowProgress';
import * as AppContext from '../../context/AppContext';
import * as VSCodeContext from '../../context/VSCodeContext';
import * as useHistoryHook from '../../hooks/useHistory';
import * as useSpecsHook from '../../hooks/useSpecs';

// Mock contexts and hooks
vi.mock('../../context/AppContext');
vi.mock('../../context/VSCodeContext');
vi.mock('../../hooks/useHistory');
vi.mock('../../hooks/useSpecs');

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
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders empty state when no specs', () => {
        (useSpecsHook.useSpecs as any).mockReturnValue({
            activeSpecs: [],
            archivedSpecs: [],
            isLoading: false,
        });

        render(<WorkflowProgress />);
        expect(screen.getByText('No specs yet')).toBeInTheDocument();
    });

    it('renders loading state', () => {
        (useSpecsHook.useSpecs as any).mockReturnValue({
            activeSpecs: [],
            archivedSpecs: [],
            isLoading: true,
        });

        render(<WorkflowProgress />);
        expect(screen.getByText('Scanning specs...')).toBeInTheDocument();
    });

    it('renders active spec workflow', () => {
        (useSpecsHook.useSpecs as any).mockReturnValue({
            activeSpecs: [{
                name: 'my-feature',
                path: '/test/my-feature',
                type: 'spec',
                status: 'active',
                createdAt: Date.now(),
                modifiedAt: Date.now(),
                phases: [
                    { name: 'Research', file: 'research.md', status: 'completed' },
                    { name: 'Requirements', file: 'requirements.md', status: 'current' },
                    { name: 'Design', file: 'design.md', status: 'pending' },
                ],
                progress: 40,
            }],
            archivedSpecs: [],
            isLoading: false,
        });

        render(<WorkflowProgress />);
        expect(screen.getByText('SPEC')).toBeInTheDocument();
        expect(screen.getByText('my-feature')).toBeInTheDocument();
        expect(screen.getByText('Active Workflows')).toBeInTheDocument();
    });

    it('renders implement workflow type', () => {
        (useSpecsHook.useSpecs as any).mockReturnValue({
            activeSpecs: [{
                name: 'my-task',
                path: '/test/my-task',
                type: 'implement',
                status: 'active',
                createdAt: Date.now(),
                modifiedAt: Date.now(),
                phases: [],
                progress: 50,
            }],
            archivedSpecs: [],
            isLoading: false,
        });

        render(<WorkflowProgress />);
        expect(screen.getByText('IMPLEMENT')).toBeInTheDocument();
    });

    it('renders archived specs section', () => {
        (useSpecsHook.useSpecs as any).mockReturnValue({
            activeSpecs: [],
            archivedSpecs: [{
                name: 'old-feature',
                path: '/test/archived/old-feature',
                type: 'spec',
                status: 'archived',
                createdAt: Date.now() - 86400000,
                modifiedAt: Date.now() - 86400000,
                phases: [],
                progress: 100,
            }],
            isLoading: false,
        });

        render(<WorkflowProgress />);
        expect(screen.getByText('Archived')).toBeInTheDocument();
        expect(screen.getByText('old-feature')).toBeInTheDocument();
    });

    it('renders task summary when available', () => {
        (useSpecsHook.useSpecs as any).mockReturnValue({
            activeSpecs: [{
                name: 'task-spec',
                path: '/test/task-spec',
                type: 'spec',
                status: 'active',
                createdAt: Date.now(),
                modifiedAt: Date.now(),
                phases: [],
                progress: 60,
                taskSummary: {
                    total: 10,
                    completed: 6,
                    inProgress: 2,
                },
            }],
            archivedSpecs: [],
            isLoading: false,
        });

        render(<WorkflowProgress />);
        expect(screen.getByText('6/10 tasks')).toBeInTheDocument();
        expect(screen.getByText('(2 in progress)')).toBeInTheDocument();
    });

    it('truncates long spec names in archived list', () => {
        (useSpecsHook.useSpecs as any).mockReturnValue({
            activeSpecs: [],
            archivedSpecs: [{
                name: 'this-is-a-very-long-spec-name-that-should-be-truncated',
                path: '/test/long-name',
                type: 'spec',
                status: 'archived',
                createdAt: Date.now(),
                modifiedAt: Date.now(),
                phases: [],
                progress: 100,
            }],
            isLoading: false,
        });

        render(<WorkflowProgress />);
        // truncate(name, 24) shortens to "this-is-a-very-long-spe…"
        // The full name should be in the title attribute
        const specNameElement = screen.getByTitle('this-is-a-very-long-spec-name-that-should-be-truncated');
        expect(specNameElement).toBeInTheDocument();
        expect(specNameElement.textContent).toContain('…');
    });
});
