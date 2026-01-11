/**
 * AdapterRegistry Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdapterRegistry, resetAdapterRegistry } from '../../../codeGraph/adapters/AdapterRegistry';
import type { FrameworkAdapter, PackageJson } from '../../../codeGraph/adapters/types';
import type { GraphStore } from '../../../codeGraph/core/GraphStore';

// Mock fs
vi.mock('fs', () => ({
    promises: {
        readFile: vi.fn(),
    },
}));

import * as fs from 'fs';

describe('AdapterRegistry', () => {
    let registry: AdapterRegistry;
    let mockAdapter: FrameworkAdapter;

    beforeEach(() => {
        vi.clearAllMocks();
        resetAdapterRegistry();
        registry = new AdapterRegistry();
        
        mockAdapter = {
            name: 'test-adapter',
            displayName: 'Test Adapter',
            category: 'api',
            filePatterns: ['**/*.ts'],
            detect: vi.fn().mockResolvedValue(true),
            extractEntrypoints: vi.fn().mockResolvedValue([]),
            extractRegistrations: vi.fn().mockResolvedValue([]),
        };
    });

    describe('register', () => {
        it('should register an adapter', () => {
            registry.register(mockAdapter);
            expect(registry.getAdapters()).toHaveLength(1);
            expect(registry.getAdapter('test-adapter')).toBe(mockAdapter);
        });

        it('should not register duplicate adapters', () => {
            registry.register(mockAdapter);
            registry.register(mockAdapter);
            expect(registry.getAdapters()).toHaveLength(1);
        });
    });

    describe('detectFrameworks', () => {
        it('should detect frameworks from package.json', async () => {
            const packageJson: PackageJson = {
                dependencies: { express: '^4.18.0' },
            };
            
            vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(packageJson));
            registry.register(mockAdapter);

            const detected = await registry.detectFrameworks('/workspace');
            
            expect(detected).toHaveLength(1);
            expect(detected[0].name).toBe('test-adapter');
        });

        it('should handle missing package.json', async () => {
            vi.mocked(fs.promises.readFile).mockRejectedValue(new Error('ENOENT'));
            registry.register(mockAdapter);

            const detected = await registry.detectFrameworks('/workspace');
            
            // Adapter detect() is called with undefined packageJson
            expect(mockAdapter.detect).toHaveBeenCalledWith('/workspace', undefined);
        });

        it('should handle adapter detection errors gracefully', async () => {
            vi.mocked(fs.promises.readFile).mockResolvedValue('{}');
            mockAdapter.detect = vi.fn().mockRejectedValue(new Error('Detection failed'));
            registry.register(mockAdapter);

            const detected = await registry.detectFrameworks('/workspace');
            
            expect(detected).toHaveLength(0);
        });
    });

    describe('extractAllEntrypoints', () => {
        it('should extract entrypoints from detected adapters', async () => {
            const mockEntrypoint = {
                id: 'entrypoint:test',
                kind: 'entrypoint' as const,
                name: 'Test Entry',
                path: 'test.ts',
            };
            
            mockAdapter.extractEntrypoints = vi.fn().mockResolvedValue([mockEntrypoint]);
            vi.mocked(fs.promises.readFile).mockResolvedValue('{}');
            
            registry.register(mockAdapter);
            await registry.detectFrameworks('/workspace');

            const mockStore = {} as GraphStore;
            const entrypoints = await registry.extractAllEntrypoints(mockStore, '/workspace');
            
            expect(entrypoints).toHaveLength(1);
            expect(entrypoints[0]).toEqual(mockEntrypoint);
        });
    });

    describe('extractAllRegistrations', () => {
        it('should extract registrations from detected adapters', async () => {
            const mockEdge = {
                id: 'edge:test',
                from: 'a',
                to: 'b',
                kind: 'registers' as const,
                confidence: 'high' as const,
            };
            
            mockAdapter.extractRegistrations = vi.fn().mockResolvedValue([mockEdge]);
            vi.mocked(fs.promises.readFile).mockResolvedValue('{}');
            
            registry.register(mockAdapter);
            await registry.detectFrameworks('/workspace');

            const mockStore = {} as GraphStore;
            const edges = await registry.extractAllRegistrations(mockStore, '/workspace');
            
            expect(edges).toHaveLength(1);
            expect(edges[0]).toEqual(mockEdge);
        });
    });

    describe('detectAllIssues', () => {
        it('should detect issues from adapters with detectIssues', async () => {
            const mockIssue = {
                id: 'issue:test',
                kind: 'ENTRY_MISSING_HANDLER' as const,
                severity: 'error' as const,
                message: 'Test issue',
            };
            
            mockAdapter.detectIssues = vi.fn().mockResolvedValue([mockIssue]);
            vi.mocked(fs.promises.readFile).mockResolvedValue('{}');
            
            registry.register(mockAdapter);
            await registry.detectFrameworks('/workspace');

            const mockStore = {} as GraphStore;
            const issues = await registry.detectAllIssues(mockStore);
            
            expect(issues).toHaveLength(1);
            expect(issues[0]).toEqual(mockIssue);
        });

        it('should skip adapters without detectIssues', async () => {
            delete mockAdapter.detectIssues;
            vi.mocked(fs.promises.readFile).mockResolvedValue('{}');
            
            registry.register(mockAdapter);
            await registry.detectFrameworks('/workspace');

            const mockStore = {} as GraphStore;
            const issues = await registry.detectAllIssues(mockStore);
            
            expect(issues).toHaveLength(0);
        });
    });

    describe('clear', () => {
        it('should clear all adapters and detections', async () => {
            vi.mocked(fs.promises.readFile).mockResolvedValue('{}');
            registry.register(mockAdapter);
            await registry.detectFrameworks('/workspace');

            registry.clear();

            expect(registry.getAdapters()).toHaveLength(0);
            expect(registry.getDetectedFrameworks()).toHaveLength(0);
        });
    });
});
