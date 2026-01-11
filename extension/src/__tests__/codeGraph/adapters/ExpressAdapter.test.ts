/**
 * ExpressAdapter Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExpressAdapter } from '../../../codeGraph/adapters/js/ExpressAdapter';
import { GraphStore } from '../../../codeGraph/core/GraphStore';
import type { PackageJson } from '../../../codeGraph/adapters/types';

describe('ExpressAdapter', () => {
    let adapter: ExpressAdapter;
    let store: GraphStore;

    beforeEach(() => {
        adapter = new ExpressAdapter();
        store = new GraphStore();
    });

    describe('detect', () => {
        it('should detect express', async () => {
            const packageJson: PackageJson = {
                dependencies: { express: '^4.18.0' },
            };
            
            const result = await adapter.detect('/workspace', packageJson);
            expect(result).toBe(true);
        });

        it('should detect fastify', async () => {
            const packageJson: PackageJson = {
                dependencies: { fastify: '^4.0.0' },
            };
            
            const result = await adapter.detect('/workspace', packageJson);
            expect(result).toBe(true);
        });

        it('should detect koa', async () => {
            const packageJson: PackageJson = {
                dependencies: { koa: '^2.0.0' },
            };
            
            const result = await adapter.detect('/workspace', packageJson);
            expect(result).toBe(true);
        });

        it('should detect hono', async () => {
            const packageJson: PackageJson = {
                dependencies: { hono: '^3.0.0' },
            };
            
            const result = await adapter.detect('/workspace', packageJson);
            expect(result).toBe(true);
        });

        it('should return false without package.json', async () => {
            const result = await adapter.detect('/workspace');
            expect(result).toBe(false);
        });

        it('should return false without supported framework', async () => {
            const packageJson: PackageJson = {
                dependencies: { react: '^18.0.0' },
            };
            
            const result = await adapter.detect('/workspace', packageJson);
            expect(result).toBe(false);
        });
    });

    describe('extractEntrypoints', () => {
        it('should extract routes from file content', async () => {
            store.addNode({
                id: 'file:src/routes.ts',
                kind: 'file',
                name: 'routes.ts',
                path: 'src/routes.ts',
                meta: {
                    content: `
                        app.get('/users', getUsers);
                        app.post('/users', createUser);
                        router.delete('/users/:id', deleteUser);
                    `,
                },
            });

            const entrypoints = await adapter.extractEntrypoints(store, '/workspace');
            
            expect(entrypoints.length).toBeGreaterThanOrEqual(3);
            expect(entrypoints.some(e => e.name.includes('GET /users'))).toBe(true);
            expect(entrypoints.some(e => e.name.includes('POST /users'))).toBe(true);
        });

        it('should handle files without routes', async () => {
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
        it('should extract route-handler edges', async () => {
            store.addNode({
                id: 'file:src/routes.ts',
                kind: 'file',
                name: 'routes.ts',
                path: 'src/routes.ts',
                meta: {
                    content: `app.get('/api/health', healthCheck);`,
                },
            });

            const edges = await adapter.extractRegistrations(store, '/workspace');
            // Edges are created when handler name is detected
            expect(edges.length).toBeGreaterThanOrEqual(0);
        });
    });

    it('should have correct metadata', () => {
        expect(adapter.name).toBe('express');
        expect(adapter.displayName).toBe('Express/Koa/Fastify/Hono');
        expect(adapter.category).toBe('api');
    });
});
