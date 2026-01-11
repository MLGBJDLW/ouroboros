/**
 * NextjsAdapter Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NextjsAdapter } from '../../../codeGraph/adapters/js/NextjsAdapter';
import { GraphStore } from '../../../codeGraph/core/GraphStore';
import type { PackageJson } from '../../../codeGraph/adapters/types';

describe('NextjsAdapter', () => {
    let adapter: NextjsAdapter;
    let store: GraphStore;

    beforeEach(() => {
        adapter = new NextjsAdapter();
        store = new GraphStore();
    });

    describe('detect', () => {
        it('should detect next.js', async () => {
            const packageJson: PackageJson = {
                dependencies: { next: '^14.0.0' },
            };
            
            const result = await adapter.detect('/workspace', packageJson);
            expect(result).toBe(true);
        });

        it('should return false without package.json', async () => {
            const result = await adapter.detect('/workspace');
            expect(result).toBe(false);
        });

        it('should return false without next dependency', async () => {
            const packageJson: PackageJson = {
                dependencies: { react: '^18.0.0' },
            };
            
            const result = await adapter.detect('/workspace', packageJson);
            expect(result).toBe(false);
        });
    });

    describe('extractEntrypoints - Pages Router', () => {
        it('should detect pages', async () => {
            store.addNode({
                id: 'file:pages/index.tsx',
                kind: 'file',
                name: 'index.tsx',
                path: 'pages/index.tsx',
                meta: { content: 'export default function Home() {}' },
            });

            store.addNode({
                id: 'file:pages/about.tsx',
                kind: 'file',
                name: 'about.tsx',
                path: 'pages/about.tsx',
                meta: { content: 'export default function About() {}' },
            });

            const entrypoints = await adapter.extractEntrypoints(store, '/workspace');
            
            expect(entrypoints.length).toBeGreaterThanOrEqual(2);
            expect(entrypoints.some(e => e.meta?.route === '/')).toBe(true);
            expect(entrypoints.some(e => e.meta?.route === '/about')).toBe(true);
        });

        it('should detect API routes', async () => {
            store.addNode({
                id: 'file:pages/api/users.ts',
                kind: 'file',
                name: 'users.ts',
                path: 'pages/api/users.ts',
                meta: { content: 'export default function handler(req, res) {}' },
            });

            const entrypoints = await adapter.extractEntrypoints(store, '/workspace');
            
            expect(entrypoints.some(e => e.meta?.entrypointType === 'api')).toBe(true);
        });

        it('should handle dynamic routes', async () => {
            store.addNode({
                id: 'file:pages/users/[id].tsx',
                kind: 'file',
                name: '[id].tsx',
                path: 'pages/users/[id].tsx',
                meta: { content: 'export default function User() {}' },
            });

            const entrypoints = await adapter.extractEntrypoints(store, '/workspace');
            
            expect(entrypoints.some(e => (e.meta?.route as string)?.includes(':id'))).toBe(true);
        });
    });

    describe('extractEntrypoints - App Router', () => {
        it('should detect app router pages', async () => {
            store.addNode({
                id: 'file:app/page.tsx',
                kind: 'file',
                name: 'page.tsx',
                path: 'app/page.tsx',
                meta: { content: 'export default function Home() {}' },
            });

            store.addNode({
                id: 'file:app/dashboard/page.tsx',
                kind: 'file',
                name: 'page.tsx',
                path: 'app/dashboard/page.tsx',
                meta: { content: 'export default function Dashboard() {}' },
            });

            const entrypoints = await adapter.extractEntrypoints(store, '/workspace');
            
            expect(entrypoints.some(e => e.meta?.route === '/')).toBe(true);
            expect(entrypoints.some(e => e.meta?.route === '/dashboard')).toBe(true);
        });

        it('should detect app router API routes', async () => {
            store.addNode({
                id: 'file:app/api/users/route.ts',
                kind: 'file',
                name: 'route.ts',
                path: 'app/api/users/route.ts',
                meta: { content: 'export async function GET() {}' },
            });

            const entrypoints = await adapter.extractEntrypoints(store, '/workspace');
            
            expect(entrypoints.some(e => e.meta?.entrypointType === 'api')).toBe(true);
        });

        it('should detect layouts', async () => {
            store.addNode({
                id: 'file:app/layout.tsx',
                kind: 'file',
                name: 'layout.tsx',
                path: 'app/layout.tsx',
                meta: { content: 'export default function RootLayout() {}' },
            });

            const entrypoints = await adapter.extractEntrypoints(store, '/workspace');
            
            expect(entrypoints.some(e => e.meta?.entrypointType === 'layout')).toBe(true);
        });
    });

    describe('detectIssues', () => {
        it('should detect missing default export in pages', async () => {
            store.addNode({
                id: 'file:pages/broken.tsx',
                kind: 'file',
                name: 'broken.tsx',
                path: 'pages/broken.tsx',
                meta: { content: 'export function Page() {}' }, // Missing default
            });

            const issues = await (adapter.detectIssues as NonNullable<typeof adapter.detectIssues>)(store);
            
            expect(issues.some(i => i.kind === 'BROKEN_EXPORT_CHAIN')).toBe(true);
        });

        it('should detect missing handler in API routes', async () => {
            store.addNode({
                id: 'file:pages/api/broken.ts',
                kind: 'file',
                name: 'broken.ts',
                path: 'pages/api/broken.ts',
                meta: { content: 'const x = 1;' }, // No handler
            });

            const issues = await (adapter.detectIssues as NonNullable<typeof adapter.detectIssues>)(store);
            
            expect(issues.some(i => i.kind === 'ENTRY_MISSING_HANDLER')).toBe(true);
        });
    });

    it('should have correct metadata', () => {
        expect(adapter.name).toBe('nextjs');
        expect(adapter.displayName).toBe('Next.js');
        expect(adapter.category).toBe('fullstack');
    });
});
