import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Welcome } from '../../components/Welcome/Welcome';

// Mock useVSCode hook used by CopilotInsights
vi.mock('../../context/VSCodeContext', () => ({
    useVSCode: () => ({
        postMessage: vi.fn(),
    }),
}));

describe('Welcome Component', () => {
    const defaultProps = {
        onInitialize: vi.fn(),
        onOpenCopilot: vi.fn(),
        onUpdatePrompts: vi.fn(),
        isInitialized: false,
        hasCopilotChatOpened: false,
        hasUpdates: false,
        projectName: 'Test Project',
    };

    it('renders correctly with default props', () => {
        render(<Welcome {...defaultProps} />);
        expect(screen.getByText('Ouroboros')).toBeInTheDocument();
        expect(screen.getByText('Spec-Driven AI Workflow')).toBeInTheDocument();
        expect(screen.getByText('Not Initialized')).toBeInTheDocument();
        expect(screen.getByText('Initialize')).toBeInTheDocument();
    });

    it('shows Initialized status when isInitialized is true', () => {
        render(<Welcome {...defaultProps} isInitialized={true} />);
        expect(screen.getByText('Initialized')).toBeInTheDocument();
        expect(screen.getByText('Re-initialize')).toBeInTheDocument();
    });

    it('shows warning when no project name provided', () => {
        render(<Welcome {...defaultProps} projectName={undefined} />);
        expect(screen.getByText('No folder open')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Initialize/i })).toBeDisabled();
    });

    it('shows update available button when hasUpdates is true', () => {
        render(<Welcome {...defaultProps} isInitialized={true} hasUpdates={true} />);
        expect(screen.getByText('Update Available')).toBeInTheDocument();
    });

    it('handles interactions correctly', () => {
        render(<Welcome {...defaultProps} isInitialized={true} />);

        fireEvent.click(screen.getByText('Re-initialize'));
        expect(defaultProps.onInitialize).toHaveBeenCalled();

        fireEvent.click(screen.getByText('Open Copilot Chat'));
        expect(defaultProps.onOpenCopilot).toHaveBeenCalled();
    });
});
