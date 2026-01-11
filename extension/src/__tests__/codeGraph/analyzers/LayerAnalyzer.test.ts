/**
 * LayerAnalyzer Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LayerAnalyzer, COMMON_LAYER_RULES } from '../../../codeGraph/analyzers/LayerAnalyzer';
import { GraphStore } from '../../../codeGraph/core/GraphStore';

describe('LayerAnalyzer', () => {
    let store: GraphStore;
    let analyzer: LayerAnalyzer;

    beforeEach(() => {
        store = new GraphStore();
        analyzer = new LayerAnalyzer(store);
    });

    describe('setRules / getRules / addRule', () => {
        it('should set and get rules', () => {
            const rules = [
                { name: 'Test Rule', from: 'src/ui/**', cannotImport: 'src/db/**', severity: 'error' as const },
            ];
            analyzer.setRules(rules);
            expect(analyzer.getRules()).toEqual(rules);
        });

        it('should add a single rule', () => {
            const rule = { name: 'Test Rule', from: 'src/ui/**', cannotImport: 'src/db/**', severity: 'error' as const };
            analyzer.addRule(rule);
            expect(analyzer.getRules()).toContainEqual(rule);
        });
    });

    describe('checkViolations', () => {
        it('should return empty array when no violations', () => {
            store.addNode({ id: 'file:src/ui/Button.tsx', kind: 'file', name: 'Button.tsx', path: 'src/ui/Button.tsx' });
            store.addNode({ id: 'file:src/utils/helpers.ts', kind: 'file', name: 'helpers.ts', path: 'src/utils/helpers.ts' });
            store.addEdge({ id: 'e1', from: 'file:src/ui/Button.tsx', to: 'file:src/utils/helpers.ts', kind: 'imports', confidence: 'high' });

            const rules = [
                { name: 'UI cannot import DB', from: 'src/ui/**', cannotImport: 'src/db/**', severity: 'error' as const },
            ];

            const violations = analyzer.checkViolations({ rules });
            expect(violations).toHaveLength(0);
        });

        it('should detect layer violation', () => {
            store.addNode({ id: 'file:src/ui/Button.tsx', kind: 'file', name: 'Button.tsx', path: 'src/ui/Button.tsx' });
            store.addNode({ id: 'file:src/db/connection.ts', kind: 'file', name: 'connection.ts', path: 'src/db/connection.ts' });
            store.addEdge({ id: 'e1', from: 'file:src/ui/Button.tsx', to: 'file:src/db/connection.ts', kind: 'imports', confidence: 'high' });

            const rules = [
                { name: 'UI cannot import DB', from: 'src/ui/**', cannotImport: 'src/db/**', severity: 'error' as const },
            ];

            const violations = analyzer.checkViolations({ rules });
            expect(violations).toHaveLength(1);
            expect(violations[0].rule.name).toBe('UI cannot import DB');
            expect(violations[0].sourceFile).toBe('src/ui/Button.tsx');
            expect(violations[0].targetFile).toBe('src/db/connection.ts');
        });

        it('should detect multiple violations', () => {
            store.addNode({ id: 'file:src/ui/Button.tsx', kind: 'file', name: 'Button.tsx', path: 'src/ui/Button.tsx' });
            store.addNode({ id: 'file:src/ui/Form.tsx', kind: 'file', name: 'Form.tsx', path: 'src/ui/Form.tsx' });
            store.addNode({ id: 'file:src/db/connection.ts', kind: 'file', name: 'connection.ts', path: 'src/db/connection.ts' });
            store.addEdge({ id: 'e1', from: 'file:src/ui/Button.tsx', to: 'file:src/db/connection.ts', kind: 'imports', confidence: 'high' });
            store.addEdge({ id: 'e2', from: 'file:src/ui/Form.tsx', to: 'file:src/db/connection.ts', kind: 'imports', confidence: 'high' });

            const rules = [
                { name: 'UI cannot import DB', from: 'src/ui/**', cannotImport: 'src/db/**', severity: 'error' as const },
            ];

            const violations = analyzer.checkViolations({ rules });
            expect(violations).toHaveLength(2);
        });

        it('should respect scope option', () => {
            store.addNode({ id: 'file:src/ui/Button.tsx', kind: 'file', name: 'Button.tsx', path: 'src/ui/Button.tsx' });
            store.addNode({ id: 'file:src/features/ui/Card.tsx', kind: 'file', name: 'Card.tsx', path: 'src/features/ui/Card.tsx' });
            store.addNode({ id: 'file:src/db/connection.ts', kind: 'file', name: 'connection.ts', path: 'src/db/connection.ts' });
            store.addEdge({ id: 'e1', from: 'file:src/ui/Button.tsx', to: 'file:src/db/connection.ts', kind: 'imports', confidence: 'high' });
            store.addEdge({ id: 'e2', from: 'file:src/features/ui/Card.tsx', to: 'file:src/db/connection.ts', kind: 'imports', confidence: 'high' });

            const rules = [
                { name: 'UI cannot import DB', from: '**/*', cannotImport: 'src/db/**', severity: 'error' as const },
            ];

            const violations = analyzer.checkViolations({ rules, scope: 'src/ui/**' });
            expect(violations).toHaveLength(1);
            expect(violations[0].sourceFile).toBe('src/ui/Button.tsx');
        });

        it('should only check import edges', () => {
            store.addNode({ id: 'file:src/ui/Button.tsx', kind: 'file', name: 'Button.tsx', path: 'src/ui/Button.tsx' });
            store.addNode({ id: 'file:src/db/connection.ts', kind: 'file', name: 'connection.ts', path: 'src/db/connection.ts' });
            store.addEdge({ id: 'e1', from: 'file:src/ui/Button.tsx', to: 'file:src/db/connection.ts', kind: 'exports', confidence: 'high' });

            const rules = [
                { name: 'UI cannot import DB', from: 'src/ui/**', cannotImport: 'src/db/**', severity: 'error' as const },
            ];

            const violations = analyzer.checkViolations({ rules });
            expect(violations).toHaveLength(0);
        });
    });

    describe('detectLayerIssues', () => {
        it('should convert violations to GraphIssues', () => {
            store.addNode({ id: 'file:src/ui/Button.tsx', kind: 'file', name: 'Button.tsx', path: 'src/ui/Button.tsx' });
            store.addNode({ id: 'file:src/db/connection.ts', kind: 'file', name: 'connection.ts', path: 'src/db/connection.ts' });
            store.addEdge({ id: 'e1', from: 'file:src/ui/Button.tsx', to: 'file:src/db/connection.ts', kind: 'imports', confidence: 'high' });

            const rules = [
                { name: 'UI cannot import DB', from: 'src/ui/**', cannotImport: 'src/db/**', severity: 'error' as const, description: 'UI should not access DB' },
            ];
            analyzer.setRules(rules);

            const issues = analyzer.detectLayerIssues();
            expect(issues).toHaveLength(1);
            expect(issues[0].kind).toBe('LAYER_VIOLATION');
            expect(issues[0].severity).toBe('error');
            expect(issues[0].title).toContain('UI cannot import DB');
            expect(issues[0].evidence).toBeDefined();
            expect(issues[0].suggestedFix).toBeDefined();
        });

        it('should include line number in meta', () => {
            store.addNode({ id: 'file:src/ui/Button.tsx', kind: 'file', name: 'Button.tsx', path: 'src/ui/Button.tsx' });
            store.addNode({ id: 'file:src/db/connection.ts', kind: 'file', name: 'connection.ts', path: 'src/db/connection.ts' });
            store.addEdge({ 
                id: 'e1', 
                from: 'file:src/ui/Button.tsx', 
                to: 'file:src/db/connection.ts', 
                kind: 'imports', 
                confidence: 'high',
                meta: { loc: { line: 5, column: 0 } }
            });

            const rules = [
                { name: 'UI cannot import DB', from: 'src/ui/**', cannotImport: 'src/db/**', severity: 'error' as const },
            ];
            analyzer.setRules(rules);

            const issues = analyzer.detectLayerIssues();
            expect(issues[0].meta?.line).toBe(5);
        });
    });

    describe('suggestRules', () => {
        it('should suggest rules based on directory structure', () => {
            store.addNode({ id: 'file:src/ui/Button.tsx', kind: 'file', name: 'Button.tsx', path: 'src/ui/Button.tsx' });
            store.addNode({ id: 'file:src/db/connection.ts', kind: 'file', name: 'connection.ts', path: 'src/db/connection.ts' });
            store.addNode({ id: 'file:src/utils/helpers.ts', kind: 'file', name: 'helpers.ts', path: 'src/utils/helpers.ts' });

            const suggestions = analyzer.suggestRules();
            expect(suggestions.length).toBeGreaterThan(0);
        });

        it('should return empty array for flat structure', () => {
            store.addNode({ id: 'file:a.ts', kind: 'file', name: 'a.ts', path: 'a.ts' });
            store.addNode({ id: 'file:b.ts', kind: 'file', name: 'b.ts', path: 'b.ts' });

            const suggestions = analyzer.suggestRules();
            expect(suggestions).toHaveLength(0);
        });
    });

    describe('COMMON_LAYER_RULES', () => {
        it('should have predefined common rules', () => {
            expect(COMMON_LAYER_RULES.length).toBeGreaterThan(0);
            expect(COMMON_LAYER_RULES.some(r => r.name.includes('UI'))).toBe(true);
        });

        it('should work with common rules', () => {
            store.addNode({ id: 'file:src/ui/Button.tsx', kind: 'file', name: 'Button.tsx', path: 'src/ui/Button.tsx' });
            store.addNode({ id: 'file:src/db/connection.ts', kind: 'file', name: 'connection.ts', path: 'src/db/connection.ts' });
            store.addEdge({ id: 'e1', from: 'file:src/ui/Button.tsx', to: 'file:src/db/connection.ts', kind: 'imports', confidence: 'high' });

            const violations = analyzer.checkViolations({ rules: COMMON_LAYER_RULES });
            expect(violations.length).toBeGreaterThan(0);
        });
    });

    describe('glob pattern matching', () => {
        it('should match ** glob pattern', () => {
            store.addNode({ id: 'file:src/ui/components/Button.tsx', kind: 'file', name: 'Button.tsx', path: 'src/ui/components/Button.tsx' });
            store.addNode({ id: 'file:src/db/connection.ts', kind: 'file', name: 'connection.ts', path: 'src/db/connection.ts' });
            store.addEdge({ id: 'e1', from: 'file:src/ui/components/Button.tsx', to: 'file:src/db/connection.ts', kind: 'imports', confidence: 'high' });

            const rules = [
                { name: 'UI cannot import DB', from: 'src/ui/**', cannotImport: 'src/db/**', severity: 'error' as const },
            ];

            const violations = analyzer.checkViolations({ rules });
            expect(violations).toHaveLength(1);
        });

        it('should match * glob pattern', () => {
            store.addNode({ id: 'file:src/ui/Button.tsx', kind: 'file', name: 'Button.tsx', path: 'src/ui/Button.tsx' });
            store.addNode({ id: 'file:src/db/connection.ts', kind: 'file', name: 'connection.ts', path: 'src/db/connection.ts' });
            store.addEdge({ id: 'e1', from: 'file:src/ui/Button.tsx', to: 'file:src/db/connection.ts', kind: 'imports', confidence: 'high' });

            const rules = [
                { name: 'UI cannot import DB', from: 'src/ui/*.tsx', cannotImport: 'src/db/*', severity: 'error' as const },
            ];

            const violations = analyzer.checkViolations({ rules });
            expect(violations).toHaveLength(1);
        });
    });
});
