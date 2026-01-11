/**
 * Tests for CodeGraphManager
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode
vi.mock('vscode', () => ({
    workspace: {
        findFiles: vi.fn().mockResolvedValue([]),
        fs: {
            readFile: vi.fn().mockResolvedValue(new Uint8Array()),
        },
    },
    Uri: {
        joinPath: vi.fn(),
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

describe('CodeGraphManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should create manager with default config', async () => {
        const { CodeGraphManager } = await import('../../codeGraph/CodeGraphManager');
        
        const manager = new CodeGraphManager('/test/workspace');
        
        expect(manager).toBeDefined();
        expect(manager.isCurrentlyIndexing()).toBe(false);
    });

    it('should create manager with custom config', async () => {
        const { CodeGraphManager } = await import('../../codeGraph/CodeGraphManager');
        
        const manager = new CodeGraphManager('/test/workspace', {
            indexing: {
                include: ['**/*.ts'],
                exclude: ['**/node_modules/**'],
                maxFileSize: 500000,
            },
            entrypoints: {
                patterns: [],
                frameworks: ['nextjs'],
            },
            output: {
                digestTokenLimit: 300,
                issuesTokenLimit: 500,
                impactTokenLimit: 400,
            },
        });
        
        expect(manager).toBeDefined();
    });

    it('should return empty digest when not indexed', async () => {
        const { CodeGraphManager } = await import('../../codeGraph/CodeGraphManager');
        
        const manager = new CodeGraphManager('/test/workspace');
        const digest = manager.getDigest();
        
        expect(digest.summary.files).toBe(0);
        expect(digest.summary.modules).toBe(0);
        expect(digest.summary.entrypoints).toBe(0);
    });

    it('should return empty issues when not indexed', async () => {
        const { CodeGraphManager } = await import('../../codeGraph/CodeGraphManager');
        
        const manager = new CodeGraphManager('/test/workspace');
        const issues = manager.getIssues();
        
        expect(issues.issues).toHaveLength(0);
        expect(issues.stats.total).toBe(0);
    });

    it('should return impact analysis', async () => {
        const { CodeGraphManager } = await import('../../codeGraph/CodeGraphManager');
        
        const manager = new CodeGraphManager('/test/workspace');
        const impact = manager.getImpact('src/test.ts');
        
        expect(impact.target).toBe('src/test.ts');
        expect(impact.directDependents).toEqual([]);
    });

    it('should get store reference', async () => {
        const { CodeGraphManager } = await import('../../codeGraph/CodeGraphManager');
        
        const manager = new CodeGraphManager('/test/workspace');
        const store = manager.getStore();
        
        expect(store).toBeDefined();
        expect(store.getAllNodes()).toHaveLength(0);
    });

    it('should get meta information', async () => {
        const { CodeGraphManager } = await import('../../codeGraph/CodeGraphManager');
        
        const manager = new CodeGraphManager('/test/workspace');
        const meta = manager.getMeta();
        
        expect(meta.version).toBeDefined();
        expect(meta.nodeCount).toBe(0);
        expect(meta.edgeCount).toBe(0);
    });

    it('should dispose properly', async () => {
        const { CodeGraphManager } = await import('../../codeGraph/CodeGraphManager');
        
        const manager = new CodeGraphManager('/test/workspace');
        
        expect(() => manager.dispose()).not.toThrow();
    });

    it('should handle scoped digest', async () => {
        const { CodeGraphManager } = await import('../../codeGraph/CodeGraphManager');
        
        const manager = new CodeGraphManager('/test/workspace');
        const digest = manager.getDigest('src/components');
        
        expect(digest.meta.scopeApplied).toBe('src/components');
    });

    it('should handle filtered issues', async () => {
        const { CodeGraphManager } = await import('../../codeGraph/CodeGraphManager');
        
        const manager = new CodeGraphManager('/test/workspace');
        const issues = manager.getIssues({
            kind: 'HANDLER_UNREACHABLE',
            severity: 'warning',
            limit: 10,
        });
        
        expect(issues.issues).toHaveLength(0);
    });
});
