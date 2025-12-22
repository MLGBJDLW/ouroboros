import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Spinner } from '../../components/Spinner/Spinner';
import { Tooltip } from '../../components/Tooltip/Tooltip';
import { ProgressBar } from '../../components/ProgressBar/ProgressBar';
import { EmptyState } from '../../components/EmptyState/EmptyState';
import { List, ListItem } from '../../components/List/List';

describe('Spinner Component', () => {
    it('renders with default size', () => {
        render(<Spinner />);
        expect(screen.getByRole('status')).toBeInTheDocument();
        expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('renders with small size', () => {
        render(<Spinner size="small" />);
        expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('renders with large size', () => {
        render(<Spinner size="large" />);
        expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('applies custom className', () => {
        render(<Spinner className="custom-class" />);
        expect(screen.getByRole('status')).toHaveClass('custom-class');
    });
});

describe('Tooltip Component', () => {
    it('renders children and tooltip content', () => {
        render(
            <Tooltip content="Tooltip text">
                <button>Hover me</button>
            </Tooltip>
        );
        expect(screen.getByText('Hover me')).toBeInTheDocument();
        expect(screen.getByRole('tooltip')).toHaveTextContent('Tooltip text');
    });

    it('renders with different positions', () => {
        const { rerender } = render(
            <Tooltip content="Top" position="top">
                <span>Content</span>
            </Tooltip>
        );
        expect(screen.getByRole('tooltip')).toBeInTheDocument();

        rerender(
            <Tooltip content="Bottom" position="bottom">
                <span>Content</span>
            </Tooltip>
        );
        expect(screen.getByRole('tooltip')).toBeInTheDocument();

        rerender(
            <Tooltip content="Left" position="left">
                <span>Content</span>
            </Tooltip>
        );
        expect(screen.getByRole('tooltip')).toBeInTheDocument();

        rerender(
            <Tooltip content="Right" position="right">
                <span>Content</span>
            </Tooltip>
        );
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });
});

describe('ProgressBar Component', () => {
    it('renders with default props', () => {
        render(<ProgressBar value={50} />);
        expect(screen.queryByText('50%')).not.toBeInTheDocument(); // showLabel is false by default
    });

    it('renders with label when showLabel is true', () => {
        render(<ProgressBar value={75} showLabel />);
        expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('clamps value to 0-100 range', () => {
        render(<ProgressBar value={150} max={100} showLabel />);
        expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('handles negative values', () => {
        render(<ProgressBar value={-10} showLabel />);
        expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('calculates percentage based on max', () => {
        render(<ProgressBar value={5} max={10} showLabel />);
        expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('renders with small size', () => {
        render(<ProgressBar value={50} size="small" />);
        // Just verify it renders without error
        expect(document.querySelector('div')).toBeInTheDocument();
    });
});

describe('EmptyState Component', () => {
    it('renders with required props', () => {
        render(<EmptyState icon="inbox" title="No items" />);
        expect(screen.getByRole('status')).toBeInTheDocument();
        expect(screen.getByText('No items')).toBeInTheDocument();
    });

    it('renders with description', () => {
        render(
            <EmptyState
                icon="inbox"
                title="No items"
                description="Add some items to get started"
            />
        );
        expect(screen.getByText('Add some items to get started')).toBeInTheDocument();
    });

    it('renders with action', () => {
        render(
            <EmptyState
                icon="inbox"
                title="No items"
                action={<button>Add Item</button>}
            />
        );
        expect(screen.getByText('Add Item')).toBeInTheDocument();
    });
});

describe('List Component', () => {
    it('renders children', () => {
        render(
            <List>
                <ListItem>Item 1</ListItem>
                <ListItem>Item 2</ListItem>
            </List>
        );
        expect(screen.getByText('Item 1')).toBeInTheDocument();
        expect(screen.getByText('Item 2')).toBeInTheDocument();
    });

    it('applies custom className to List', () => {
        render(
            <List className="custom-list">
                <ListItem>Item</ListItem>
            </List>
        );
        expect(document.querySelector('.custom-list')).toBeInTheDocument();
    });

    it('handles ListItem click', () => {
        const handleClick = vi.fn();
        render(
            <List>
                <ListItem onClick={handleClick}>Clickable Item</ListItem>
            </List>
        );
        fireEvent.click(screen.getByText('Clickable Item'));
        expect(handleClick).toHaveBeenCalled();
    });

    it('renders active ListItem', () => {
        render(
            <List>
                <ListItem active>Active Item</ListItem>
            </List>
        );
        expect(screen.getByText('Active Item')).toBeInTheDocument();
    });

    it('applies custom className to ListItem', () => {
        render(
            <List>
                <ListItem className="custom-item">Item</ListItem>
            </List>
        );
        expect(document.querySelector('.custom-item')).toBeInTheDocument();
    });
});
