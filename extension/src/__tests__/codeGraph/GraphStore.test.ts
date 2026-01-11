/**
 * Tests for GraphStore
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GraphStore } from '../../codeGraph/core/GraphStore';
import type { GraphNode, GraphEdge, GraphIssue } from '../../codeGraph/core/types';

describe('GraphStore', () => {
    let store: GraphStore;

    beforeEach(() => {
        store = new GraphStore();
    });

    describe('Node Operations', () => {
        it('should add and retrieve a node', () => {
            const node: GraphNode = {
                id: 'file:src/index.ts',
                kind: 'file',
                name: 'index.ts',
                path: 'src/index.ts',
            };

            store.addNode(node);
            const retrieved = store.getNode('file:src/index.ts');

            expect(retrieved).toEqual(node);
            expect(store.nodeCount).toBe(1);
        });

        it('should retrieve node by path', () => {
            const node: GraphNode = {
                id: 'file:src/utils.ts',
                kind: 'file',
                name: 'utils.ts',
                path: 'src/utils.ts',
            };

            store.addNode(node);
            const retrieved = store.getNodeByPath('src/utils.ts');

            expect(retrieved).toEqual(node);
        });

        it('should retrieve nodes by kind', () => {
            store.addNode({ id: 'file:a.ts', kind: 'file', name: 'a.ts', path: 'a.ts' });
            store.addNode({ id: 'file:b.ts', kind: 'file', name: 'b.ts', path: 'b.ts' });
            store.addNode({ id: 'entrypoint:main', kind: 'entrypoint', name: 'main' });

            const files = store.getNodesByKind('file');
            const entrypoints = store.getNodesByKind('entrypoint');

            expect(files).toHaveLength(2);
            expect(entrypoints).toHaveLength(1);
        });

        it('should remove a node and its edges', () => {
            store.addNode({ id: 'file:a.ts', kind: 'file', name: 'a.ts', path: 'a.ts' });
            store.addNode({ id: 'file:b.ts', kind: 'file', name: 'b.ts', path: 'b.ts' });
            store.addEdge({
                id: 'edge:a:b',
                from: 'file:a.ts',
                to: 'file:b.ts',
                kind: 'imports',
                confidence: 'high',
            });

            store.removeNode('file:a.ts');

            expect(store.getNode('file:a.ts')).toBeUndefined();
            expect(store.edgeCount).toBe(0);
        });
    });

    describe('Edge Operations', () => {
        it('should add and retrieve an edge', () => {
            const edge: GraphEdge = {
                id: 'edge:a:b',
                from: 'file:a.ts',
                to: 'file:b.ts',
                kind: 'imports',
                confidence: 'high',
                reason: 'static import',
            };

            store.addEdge(edge);
            const retrieved = store.getEdge('edge:a:b');

            expect(retrieved).toEqual(edge);
            expect(store.edgeCount).toBe(1);
        });

        it('should retrieve edges from a node', () => {
            store.addEdge({
                id: 'edge:a:b',
                from: 'file:a.ts',
                to: 'file:b.ts',
                kind: 'imports',
                confidence: 'high',
            });
            store.addEdge({
                id: 'edge:a:c',
                from: 'file:a.ts',
                to: 'file:c.ts',
                kind: 'imports',
                confidence: 'high',
            });

            const edges = store.getEdgesFrom('file:a.ts');

            expect(edges).toHaveLength(2);
        });

        it('should retrieve edges to a node', () => {
            store.addEdge({
                id: 'edge:a:c',
                from: 'file:a.ts',
                to: 'file:c.ts',
                kind: 'imports',
                confidence: 'high',
            });
            store.addEdge({
                id: 'edge:b:c',
                from: 'file:b.ts',
                to: 'file:c.ts',
                kind: 'imports',
                confidence: 'high',
            });

            const edges = store.getEdgesTo('file:c.ts');

            expect(edges).toHaveLength(2);
        });
    });

    describe('Issue Operations', () => {
        it('should set and retrieve issues', () => {
            const issues: GraphIssue[] = [
                {
                    id: 'issue:1',
                    kind: 'HANDLER_UNREACHABLE',
                    severity: 'warning',
                    title: 'Unreachable file',
                    evidence: ['Not imported'],
                },
            ];

            store.setIssues(issues);

            expect(store.getIssues()).toEqual(issues);
            expect(store.issueCount).toBe(1);
        });

        it('should filter issues by kind', () => {
            store.setIssues([
                { id: '1', kind: 'HANDLER_UNREACHABLE', severity: 'warning', title: 'A', evidence: [] },
                { id: '2', kind: 'BROKEN_EXPORT_CHAIN', severity: 'error', title: 'B', evidence: [] },
                { id: '3', kind: 'HANDLER_UNREACHABLE', severity: 'info', title: 'C', evidence: [] },
            ]);

            const unreachable = store.getIssuesByKind('HANDLER_UNREACHABLE');

            expect(unreachable).toHaveLength(2);
        });
    });

    describe('Serialization', () => {
        it('should serialize and deserialize', () => {
            store.addNode({ id: 'file:a.ts', kind: 'file', name: 'a.ts', path: 'a.ts' });
            store.addEdge({
                id: 'edge:a:b',
                from: 'file:a.ts',
                to: 'file:b.ts',
                kind: 'imports',
                confidence: 'high',
            });
            store.setIssues([
                { id: '1', kind: 'HANDLER_UNREACHABLE', severity: 'warning', title: 'Test', evidence: [] },
            ]);

            const serialized = store.toSerializable();
            const newStore = new GraphStore();
            newStore.fromSerializable(serialized);

            expect(newStore.nodeCount).toBe(1);
            expect(newStore.edgeCount).toBe(1);
            expect(newStore.issueCount).toBe(1);
        });
    });

    describe('Clear', () => {
        it('should clear all data', () => {
            store.addNode({ id: 'file:a.ts', kind: 'file', name: 'a.ts' });
            store.addEdge({
                id: 'edge:a:b',
                from: 'file:a.ts',
                to: 'file:b.ts',
                kind: 'imports',
                confidence: 'high',
            });
            store.setIssues([{ id: '1', kind: 'HANDLER_UNREACHABLE', severity: 'warning', title: 'Test', evidence: [] }]);

            store.clear();

            expect(store.nodeCount).toBe(0);
            expect(store.edgeCount).toBe(0);
            expect(store.issueCount).toBe(0);
        });
    });
});
