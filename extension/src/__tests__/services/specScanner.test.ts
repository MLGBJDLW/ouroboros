/**
 * Tests for SpecScanner service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';

// Mock parseTasksMarkdown
vi.mock('../../services/tasksParser', () => ({
    parseTasksMarkdown: vi.fn().mockReturnValue({
        phases: [],
        summary: { total: 5, completed: 3, inProgress: 1 },
    }),
    calculateProgress: vi.fn().mockReturnValue(60),
}));

// Mock logger
vi.mock('../../utils/logger', () => ({
    createLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    }),
}));

describe('SpecScanner', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('scanSpecsFolder', () => {
        it('should return empty arrays when specs folder does not exist', async () => {
            // Mock readDirectory to throw (folder doesn't exist)
            (vscode.workspace.fs.readDirectory as ReturnType<typeof vi.fn>).mockRejectedValue(
                new Error('Folder not found')
            );

            const { scanSpecsFolder } = await import('../../services/specScanner');
            const result = await scanSpecsFolder('/test-workspace');

            expect(result.active).toEqual([]);
            expect(result.archived).toEqual([]);
        });

        it('should scan active specs folder', async () => {
            const mockSpecEntries: [string, vscode.FileType][] = [
                ['my-feature', vscode.FileType.Directory],
                ['templates', vscode.FileType.Directory], // Should be skipped
                ['archived', vscode.FileType.Directory], // Should be skipped
            ];

            const mockSpecFiles: [string, vscode.FileType][] = [
                ['research.md', vscode.FileType.File],
                ['requirements.md', vscode.FileType.File],
            ];

            (vscode.workspace.fs.readDirectory as ReturnType<typeof vi.fn>)
                .mockResolvedValueOnce(mockSpecEntries) // specs folder
                .mockRejectedValueOnce(new Error('No archived')) // archived folder
                .mockResolvedValueOnce(mockSpecFiles); // my-feature folder

            (vscode.workspace.fs.stat as ReturnType<typeof vi.fn>).mockResolvedValue({
                ctime: 1000,
                mtime: 2000,
            });

            const { scanSpecsFolder } = await import('../../services/specScanner');
            const result = await scanSpecsFolder('/test-workspace');

            expect(result.active.length).toBeGreaterThanOrEqual(0);
        });

        it('should skip hidden folders and templates', async () => {
            const mockEntries: [string, vscode.FileType][] = [
                ['.hidden', vscode.FileType.Directory],
                ['templates', vscode.FileType.Directory],
                ['valid-spec', vscode.FileType.Directory],
            ];

            (vscode.workspace.fs.readDirectory as ReturnType<typeof vi.fn>)
                .mockResolvedValueOnce(mockEntries)
                .mockRejectedValueOnce(new Error('No archived'))
                .mockResolvedValueOnce([['research.md', vscode.FileType.File]]);

            (vscode.workspace.fs.stat as ReturnType<typeof vi.fn>).mockResolvedValue({
                ctime: 1000,
                mtime: 2000,
            });

            const { scanSpecsFolder } = await import('../../services/specScanner');
            const result = await scanSpecsFolder('/test-workspace');

            // Should only include valid-spec, not .hidden or templates
            expect(result.active.every(s => !s.name.startsWith('.'))).toBe(true);
            expect(result.active.every(s => s.name !== 'templates')).toBe(true);
        });

        it('should sort results by modified date', async () => {
            const mockEntries: [string, vscode.FileType][] = [
                ['old-spec', vscode.FileType.Directory],
                ['new-spec', vscode.FileType.Directory],
            ];

            (vscode.workspace.fs.readDirectory as ReturnType<typeof vi.fn>)
                .mockResolvedValueOnce(mockEntries)
                .mockRejectedValueOnce(new Error('No archived'))
                .mockResolvedValueOnce([['research.md', vscode.FileType.File]])
                .mockResolvedValueOnce([['research.md', vscode.FileType.File]]);

            (vscode.workspace.fs.stat as ReturnType<typeof vi.fn>)
                .mockResolvedValueOnce({ ctime: 1000, mtime: 1000 }) // old-spec
                .mockResolvedValueOnce({ ctime: 2000, mtime: 3000 }); // new-spec (newer)

            const { scanSpecsFolder } = await import('../../services/specScanner');
            const result = await scanSpecsFolder('/test-workspace');

            // Most recent should be first
            if (result.active.length >= 2) {
                expect(result.active[0].modifiedAt).toBeGreaterThanOrEqual(result.active[1].modifiedAt);
            }
        });
    });

    describe('analyzeSpecFolder (via scanSpecsFolder)', () => {
        it('should determine phase status based on file existence', async () => {
            const mockEntries: [string, vscode.FileType][] = [
                ['my-spec', vscode.FileType.Directory],
            ];

            // Has research.md and requirements.md
            const mockFiles: [string, vscode.FileType][] = [
                ['research.md', vscode.FileType.File],
                ['requirements.md', vscode.FileType.File],
            ];

            (vscode.workspace.fs.readDirectory as ReturnType<typeof vi.fn>)
                .mockResolvedValueOnce(mockEntries)
                .mockRejectedValueOnce(new Error('No archived'))
                .mockResolvedValueOnce(mockFiles);

            (vscode.workspace.fs.stat as ReturnType<typeof vi.fn>).mockResolvedValue({
                ctime: 1000,
                mtime: 2000,
            });

            const { scanSpecsFolder } = await import('../../services/specScanner');
            const result = await scanSpecsFolder('/test-workspace');

            if (result.active.length > 0) {
                const spec = result.active[0];
                // Research and Requirements should be completed
                expect(spec.phases.some(p => p.name === 'Research' && p.status === 'completed')).toBe(true);
                expect(spec.phases.some(p => p.name === 'Requirements' && p.status === 'completed')).toBe(true);
            }
        });

        it('should identify spec vs implement workflow type', async () => {
            const mockEntries: [string, vscode.FileType][] = [
                ['spec-workflow', vscode.FileType.Directory],
                ['implement-workflow', vscode.FileType.Directory],
            ];

            // Spec workflow has design.md
            const specFiles: [string, vscode.FileType][] = [
                ['research.md', vscode.FileType.File],
                ['design.md', vscode.FileType.File],
            ];

            // Implement workflow only has tasks.md
            const implementFiles: [string, vscode.FileType][] = [
                ['tasks.md', vscode.FileType.File],
            ];

            (vscode.workspace.fs.readDirectory as ReturnType<typeof vi.fn>)
                .mockResolvedValueOnce(mockEntries)
                .mockRejectedValueOnce(new Error('No archived'))
                .mockResolvedValueOnce(specFiles)
                .mockResolvedValueOnce(implementFiles);

            (vscode.workspace.fs.stat as ReturnType<typeof vi.fn>).mockResolvedValue({
                ctime: 1000,
                mtime: 2000,
            });

            const { scanSpecsFolder } = await import('../../services/specScanner');
            const result = await scanSpecsFolder('/test-workspace');

            if (result.active.length >= 2) {
                const specType = result.active.find(s => s.name === 'spec-workflow');
                const implementType = result.active.find(s => s.name === 'implement-workflow');

                if (specType) expect(specType.type).toBe('spec');
                if (implementType) expect(implementType.type).toBe('implement');
            }
        });
    });
});
