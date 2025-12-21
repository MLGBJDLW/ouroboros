/**
 * Tests for versionService
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock vscode before imports
vi.mock('vscode', () => ({
    extensions: {
        getExtension: vi.fn(),
    },
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

import {
    getExtensionVersion,
    getRemoteVersion,
    compareVersions,
    checkPromptsVersion,
    extractVersionFromContent,
} from '../../utils/versionService';
import * as vscode from 'vscode';

describe('versionService', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getExtensionVersion', () => {
        it('should return version from installed extension', () => {
            const mockExtension = {
                packageJSON: { version: '3.2.2' },
            };
            vi.mocked(vscode.extensions.getExtension).mockReturnValue(
                mockExtension as unknown as ReturnType<typeof vscode.extensions.getExtension>
            );

            const version = getExtensionVersion();
            expect(version).toBe('3.2.2');
        });

        it('should return 0.0.0 when extension not found', () => {
            vi.mocked(vscode.extensions.getExtension).mockReturnValue(undefined);

            const version = getExtensionVersion();
            expect(version).toBe('0.0.0');
        });
    });

    describe('compareVersions', () => {
        it('should return 0 for equal versions', () => {
            expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
            expect(compareVersions('3.2.2', '3.2.2')).toBe(0);
        });

        it('should return 1 when first version is greater', () => {
            expect(compareVersions('2.0.0', '1.0.0')).toBe(1);
            expect(compareVersions('1.1.0', '1.0.0')).toBe(1);
            expect(compareVersions('1.0.1', '1.0.0')).toBe(1);
            expect(compareVersions('3.2.3', '3.2.2')).toBe(1);
        });

        it('should return -1 when first version is less', () => {
            expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
            expect(compareVersions('1.0.0', '1.1.0')).toBe(-1);
            expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
            expect(compareVersions('3.2.2', '3.2.3')).toBe(-1);
        });

        it('should handle versions with different segment counts', () => {
            expect(compareVersions('1.0', '1.0.0')).toBe(0);
            expect(compareVersions('1.0.0', '1.0')).toBe(0);
            expect(compareVersions('1.0.1', '1.0')).toBe(1);
        });
    });

    describe('getRemoteVersion', () => {
        it('should fetch version from GitHub API', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ tag_name: 'v3.2.3' }),
            });

            const version = await getRemoteVersion();
            expect(version).toBe('3.2.3');
        });

        it('should strip v prefix from tag', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ tag_name: 'v1.2.3' }),
            });

            const version = await getRemoteVersion();
            expect(version).toBe('1.2.3');
        });

        it('should return 0.0.0 on fetch failure', async () => {
            global.fetch = vi.fn().mockResolvedValue({
                ok: false,
                status: 404,
            });

            const version = await getRemoteVersion();
            expect(version).toBe('0.0.0');
        });

        it('should return 0.0.0 on network error', async () => {
            global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

            const version = await getRemoteVersion();
            expect(version).toBe('0.0.0');
        });
    });

    describe('checkPromptsVersion', () => {
        it('should return isOutdated true when remote is newer', async () => {
            vi.mocked(vscode.extensions.getExtension).mockReturnValue({
                packageJSON: { version: '3.2.2' },
            } as unknown as ReturnType<typeof vscode.extensions.getExtension>);

            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ tag_name: 'v3.2.3' }),
            });

            const result = await checkPromptsVersion();
            expect(result.isOutdated).toBe(true);
            expect(result.localVersion).toBe('3.2.2');
            expect(result.remoteVersion).toBe('3.2.3');
        });

        it('should return isOutdated false when versions are equal', async () => {
            vi.mocked(vscode.extensions.getExtension).mockReturnValue({
                packageJSON: { version: '3.2.2' },
            } as unknown as ReturnType<typeof vscode.extensions.getExtension>);

            global.fetch = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ tag_name: 'v3.2.2' }),
            });

            const result = await checkPromptsVersion();
            expect(result.isOutdated).toBe(false);
        });
    });

    describe('extractVersionFromContent', () => {
        it('should extract version from content with version marker', () => {
            const content = '<!-- Ouroboros v3.2.2 Extension Mode -->\n# Agent';
            const version = extractVersionFromContent(content);
            expect(version).toBe('3.2.2');
        });

        it('should return null when no version marker found', () => {
            const content = '# Agent\nSome content';
            const version = extractVersionFromContent(content);
            expect(version).toBeNull();
        });
    });
});
