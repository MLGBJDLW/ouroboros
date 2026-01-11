/**
 * NestjsAdapter Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NestjsAdapter } from '../../../codeGraph/adapters/js/NestjsAdapter';
import { GraphStore } from '../../../codeGraph/core/GraphStore';
import type { PackageJson } from '../../../codeGraph/adapters/types';

describe('NestjsAdapter', () => {
    let adapter: NestjsAdapter;
    let store: GraphStore;

    beforeEach(() => {
        adapter = new NestjsAdapter();
        store = new GraphStore();
    });

    describe('detect', () => {
        it('should detect nestjs', async () => {
            const packageJson: PackageJson = {
                dependencies: { '@nestjs/core': '^10.0.0' },
            };
            
            const result = await adapter.detect('/workspace', packageJson);
            expect(result).toBe(true);
        });

        it('should return false without package.json', async () => {
            const result = await adapter.detect('/workspace');
            expect(result).toBe(false);
        });

        it('should return false without nestjs dependency', async () => {
            const packageJson: PackageJson = {
                dependencies: { express: '^4.0.0' },
            };
            
            const result = await adapter.detect('/workspace', packageJson);
            expect(result).toBe(false);
        });
    });

    describe('extractEntrypoints', () => {
        it('should detect controller routes', async () => {
            store.addNode({
                id: 'file:src/users/users.controller.ts',
                kind: 'file',
                name: 'users.controller.ts',
                path: 'src/users/users.controller.ts',
                meta: {
                    content: `
                        @Controller('users')
                        export class UsersController {
                            @Get()
                            findAll() {}
                            
                            @Post()
                            create() {}
                            
                            @Get(':id')
                            findOne() {}
                        }
                    `,
                },
            });

            const entrypoints = await adapter.extractEntrypoints(store, '/workspace');
            
            expect(entrypoints.length).toBeGreaterThanOrEqual(3);
            expect(entrypoints.some(e => e.name.includes('GET /users'))).toBe(true);
            expect(entrypoints.some(e => e.name.includes('POST /users'))).toBe(true);
        });

        it('should detect modules', async () => {
            store.addNode({
                id: 'file:src/app.module.ts',
                kind: 'file',
                name: 'app.module.ts',
                path: 'src/app.module.ts',
                meta: {
                    content: `
                        @Module({
                            imports: [UsersModule],
                            controllers: [AppController],
                            providers: [AppService],
                        })
                        export class AppModule {}
                    `,
                },
            });

            const entrypoints = await adapter.extractEntrypoints(store, '/workspace');
            
            expect(entrypoints.some(e => e.meta?.entrypointType === 'module')).toBe(true);
        });
    });

    describe('extractRegistrations', () => {
        it('should extract module-controller registrations', async () => {
            store.addNode({
                id: 'file:src/users/users.module.ts',
                kind: 'file',
                name: 'users.module.ts',
                path: 'src/users/users.module.ts',
                meta: {
                    content: `
                        @Module({
                            controllers: [UsersController],
                            providers: [UsersService],
                        })
                        export class UsersModule {}
                    `,
                },
            });

            const edges = await adapter.extractRegistrations(store, '/workspace');
            
            expect(edges.some(e => e.meta?.type === 'controller')).toBe(true);
            expect(edges.some(e => e.meta?.type === 'provider')).toBe(true);
        });
    });

    describe('detectIssues', () => {
        it('should detect unregistered controllers', async () => {
            // Controller defined but not registered
            store.addNode({
                id: 'file:src/orphan.controller.ts',
                kind: 'file',
                name: 'orphan.controller.ts',
                path: 'src/orphan.controller.ts',
                meta: {
                    content: `
                        @Controller('orphan')
                        export class OrphanController {}
                    `,
                },
            });

            // Module without the controller
            store.addNode({
                id: 'file:src/app.module.ts',
                kind: 'file',
                name: 'app.module.ts',
                path: 'src/app.module.ts',
                meta: {
                    content: `
                        @Module({
                            controllers: [AppController],
                        })
                        export class AppModule {}
                    `,
                },
            });

            const issues = await adapter.detectIssues!(store);
            
            expect(issues.some(i => i.kind === 'NOT_REGISTERED')).toBe(true);
            expect(issues.some(i => i.message?.includes('OrphanController'))).toBe(true);
        });
    });

    it('should have correct metadata', () => {
        expect(adapter.name).toBe('nestjs');
        expect(adapter.displayName).toBe('NestJS');
        expect(adapter.category).toBe('api');
    });
});
