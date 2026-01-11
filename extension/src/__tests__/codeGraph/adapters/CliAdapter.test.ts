/**
 * CliAdapter Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CliAdapter } from '../../../codeGraph/adapters/js/CliAdapter';
import { GraphStore } from '../../../codeGraph/core/GraphStore';
import type { PackageJson } from '../../../codeGraph/adapters/types';

describe('CliAdapter', () => {
    let adapter: CliAdapter;
    let store: GraphStore;

    beforeEach(() => {
        adapter = new CliAdapter();
        store = new GraphStore();
    });

    describe('detect', () => {
        it('should detect commander', async () => {
            const packageJson: PackageJson = {
                dependencies: { commander: '^11.0.0' },
            };
            
            const result = await adapter.detect('/workspace', packageJson);
            expect(result).toBe(true);
        });

        it('should detect yargs', async () => {
            const packageJson: PackageJson = {
                dependencies: { yargs: '^17.0.0' },
            };
            
            const result = await adapter.detect('/workspace', packageJson);
            expect(result).toBe(true);
        });

        it('should detect cac', async () => {
            const packageJson: PackageJson = {
                dependencies: { cac: '^6.0.0' },
            };
            
            const result = await adapter.detect('/workspace', packageJson);
            expect(result).toBe(true);
        });

        it('should return false without package.json', async () => {
            const result = await adapter.detect('/workspace');
            expect(result).toBe(false);
        });

        it('should return false without CLI framework', async () => {
            const packageJson: PackageJson = {
                dependencies: { express: '^4.0.0' },
            };
            
            const result = await adapter.detect('/workspace', packageJson);
            expect(result).toBe(false);
        });
    });

    describe('extractEntrypoints', () => {
        it('should detect commander commands', async () => {
            store.addNode({
                id: 'file:src/cli.ts',
                kind: 'file',
                name: 'cli.ts',
                path: 'src/cli.ts',
                meta: {
                    content: `
                        program
                            .command('init')
                            .description('Initialize project')
                            .action(initCommand);
                        
                        program
                            .command('build')
                            .action(buildCommand);
                    `,
                },
            });

            const entrypoints = await adapter.extractEntrypoints(store, '/workspace');
            
            expect(entrypoints.length).toBeGreaterThanOrEqual(2);
            expect(entrypoints.some(e => e.name.includes('init'))).toBe(true);
            expect(entrypoints.some(e => e.name.includes('build'))).toBe(true);
        });

        it('should detect yargs commands', async () => {
            store.addNode({
                id: 'file:src/cli.ts',
                kind: 'file',
                name: 'cli.ts',
                path: 'src/cli.ts',
                meta: {
                    content: `
                        yargs
                            .command('serve', 'Start the server', {}, serveHandler)
                            .command('deploy', 'Deploy to production', {}, deployHandler);
                    `,
                },
            });

            const entrypoints = await adapter.extractEntrypoints(store, '/workspace');
            
            expect(entrypoints.length).toBeGreaterThanOrEqual(2);
            expect(entrypoints.some(e => e.name.includes('serve'))).toBe(true);
            expect(entrypoints.some(e => e.name.includes('deploy'))).toBe(true);
        });

        it('should handle files without commands', async () => {
            store.addNode({
                id: 'file:src/utils.ts',
                kind: 'file',
                name: 'utils.ts',
                path: 'src/utils.ts',
                meta: {
                    content: 'export const helper = () => {};',
                },
            });

            const entrypoints = await adapter.extractEntrypoints(store, '/workspace');
            expect(entrypoints).toHaveLength(0);
        });
    });

    describe('extractRegistrations', () => {
        it('should extract command-handler edges', async () => {
            store.addNode({
                id: 'file:src/cli.ts',
                kind: 'file',
                name: 'cli.ts',
                path: 'src/cli.ts',
                meta: {
                    content: `
                        program
                            .command('test')
                            .action(testHandler);
                    `,
                },
            });

            const edges = await adapter.extractRegistrations(store, '/workspace');
            
            expect(edges.some(e => e.meta?.handlerName === 'testHandler')).toBe(true);
        });
    });

    it('should have correct metadata', () => {
        expect(adapter.name).toBe('cli');
        expect(adapter.displayName).toBe('CLI (commander/yargs)');
        expect(adapter.category).toBe('cli');
    });
});
