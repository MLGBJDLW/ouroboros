/**
 * Tests for FileMentionDropdown component
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FileMentionDropdown } from '../../components/FileMentionDropdown';
import type { FileMention } from '../../hooks/useFileMentions';

const mockFiles: FileMention[] = [
    { path: 'src/index.ts', name: 'index.ts', isDirectory: false },
    { path: 'src/utils/helper.ts', name: 'helper.ts', isDirectory: false },
    { path: 'src/components', name: 'components', isDirectory: true },
];

describe('FileMentionDropdown', () => {
    describe('rendering', () => {
        it('renders with matches', () => {
            render(
                <FileMentionDropdown
                    matches={mockFiles}
                    selectedIndex={0}
                    onSelect={vi.fn()}
                />
            );

            expect(screen.getByText('FILE REFERENCE')).toBeInTheDocument();
            expect(screen.getByText('index.ts')).toBeInTheDocument();
            expect(screen.getByText('helper.ts')).toBeInTheDocument();
            expect(screen.getByText('components')).toBeInTheDocument();
        });

        it('renders empty state when no matches', () => {
            render(
                <FileMentionDropdown
                    matches={[]}
                    selectedIndex={0}
                    onSelect={vi.fn()}
                />
            );

            expect(screen.getByText('No matching files')).toBeInTheDocument();
        });

        it('shows loading indicator', () => {
            render(
                <FileMentionDropdown
                    matches={mockFiles}
                    selectedIndex={0}
                    onSelect={vi.fn()}
                    isLoading={true}
                />
            );

            expect(screen.getByText('Loading...')).toBeInTheDocument();
        });

        it('displays file paths', () => {
            render(
                <FileMentionDropdown
                    matches={mockFiles}
                    selectedIndex={0}
                    onSelect={vi.fn()}
                />
            );

            expect(screen.getByText('src/index.ts')).toBeInTheDocument();
            expect(screen.getByText('src/utils/helper.ts')).toBeInTheDocument();
        });
    });

    describe('selection', () => {
        it('highlights selected item', () => {
            const { container } = render(
                <FileMentionDropdown
                    matches={mockFiles}
                    selectedIndex={1}
                    onSelect={vi.fn()}
                />
            );

            const items = container.querySelectorAll('button');
            // Second item should have selected class
            expect(items[1].className).toContain('selected');
        });

        it('calls onSelect when item is clicked', () => {
            const handleSelect = vi.fn();
            render(
                <FileMentionDropdown
                    matches={mockFiles}
                    selectedIndex={0}
                    onSelect={handleSelect}
                />
            );

            fireEvent.click(screen.getByText('helper.ts'));
            expect(handleSelect).toHaveBeenCalledWith(mockFiles[1]);
        });
    });

    describe('keyboard hints', () => {
        it('shows navigation hints in footer', () => {
            render(
                <FileMentionDropdown
                    matches={mockFiles}
                    selectedIndex={0}
                    onSelect={vi.fn()}
                />
            );

            expect(screen.getByText('navigate')).toBeInTheDocument();
            expect(screen.getByText('complete')).toBeInTheDocument();
            expect(screen.getByText('cancel')).toBeInTheDocument();
        });
    });

    describe('file icons', () => {
        it('shows folder icon for directories', () => {
            const { container } = render(
                <FileMentionDropdown
                    matches={[{ path: 'src', name: 'src', isDirectory: true }]}
                    selectedIndex={0}
                    onSelect={vi.fn()}
                />
            );

            // Check that folder icon class is present
            const icon = container.querySelector('.codicon-folder');
            expect(icon).toBeInTheDocument();
        });

        it('shows file icon for files', () => {
            const { container } = render(
                <FileMentionDropdown
                    matches={[{ path: 'readme.md', name: 'readme.md', isDirectory: false }]}
                    selectedIndex={0}
                    onSelect={vi.fn()}
                />
            );

            // Check that a file-related icon is present
            const icon = container.querySelector('[class*="codicon-"]');
            expect(icon).toBeInTheDocument();
        });
    });
});
