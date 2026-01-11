/**
 * Tests for TypeScriptIndexer
 */

import { describe, it, expect } from 'vitest';
import { TypeScriptIndexer } from '../../codeGraph/indexers/TypeScriptIndexer';

describe('TypeScriptIndexer', () => {
    const indexer = new TypeScriptIndexer({ workspaceRoot: '/test' });

    describe('supports', () => {
        it('should support TypeScript files', () => {
            expect(indexer.supports('src/index.ts')).toBe(true);
            expect(indexer.supports('src/App.tsx')).toBe(true);
        });

        it('should support JavaScript files', () => {
            expect(indexer.supports('src/utils.js')).toBe(true);
            expect(indexer.supports('src/Component.jsx')).toBe(true);
        });

        it('should not support non-JS/TS files', () => {
            expect(indexer.supports('src/styles.css')).toBe(false);
            expect(indexer.supports('README.md')).toBe(false);
        });
    });

    describe('indexFile', () => {
        it('should extract static imports', async () => {
            const content = `
import { foo } from './utils';
import bar from '../lib/bar';
import * as helpers from './helpers';
            `;

            const result = await indexer.indexFile('src/index.ts', content);

            expect(result.nodes.length).toBeGreaterThanOrEqual(1); // file node + possible entrypoint
            expect(result.edges.length).toBeGreaterThanOrEqual(3);
            expect(result.edges.some((e) => e.kind === 'imports')).toBe(true);
        });

        it('should extract dynamic imports', async () => {
            const content = `
const module = await import('./dynamic');
            `;

            const result = await indexer.indexFile('src/index.ts', content);

            const dynamicEdge = result.edges.find((e) => e.meta?.isDynamic);
            expect(dynamicEdge).toBeDefined();
            expect(dynamicEdge?.confidence).toBe('medium');
        });

        it('should extract exports', async () => {
            const content = `
export const foo = 1;
export function bar() {}
export class Baz {}
export default function main() {}
            `;

            const result = await indexer.indexFile('src/index.ts', content);

            const fileNode = result.nodes.find((n) => n.kind === 'file');
            expect(fileNode?.meta?.exports).toContain('foo');
            expect(fileNode?.meta?.exports).toContain('bar');
            expect(fileNode?.meta?.exports).toContain('Baz');
        });

        it('should extract re-exports', async () => {
            const content = `
export { foo } from './utils';
export * from './helpers';
            `;

            const result = await indexer.indexFile('src/index.ts', content);

            const reexportEdges = result.edges.filter((e) => e.kind === 'reexports');
            expect(reexportEdges.length).toBeGreaterThanOrEqual(2);
        });

        it('should detect Next.js page entrypoints', async () => {
            const content = `
export default function Page() {
  return <div>Hello</div>;
}

export async function getServerSideProps() {
  return { props: {} };
}
            `;

            const result = await indexer.indexFile('pages/dashboard.tsx', content);

            const entrypoint = result.nodes.find((n) => n.kind === 'entrypoint');
            expect(entrypoint).toBeDefined();
            expect(entrypoint?.meta?.framework).toBe('nextjs');
        });

        it('should detect Express routes', async () => {
            const content = `
app.get('/api/users', (req, res) => {
  res.json([]);
});
router.post('/api/items', handler);
            `;

            const result = await indexer.indexFile('src/routes/api.ts', content);

            const fileNode = result.nodes.find((n) => n.kind === 'file');
            expect(fileNode?.meta?.framework).toBe('express');
        });

        it('should detect barrel files', async () => {
            const content = `
export { foo } from './foo';
export { bar } from './bar';
export * from './utils';
            `;

            const result = await indexer.indexFile('src/index.ts', content);

            const entrypoint = result.nodes.find((n) => n.kind === 'entrypoint');
            expect(entrypoint?.meta?.entrypointType).toBe('barrel');
        });
    });
});
