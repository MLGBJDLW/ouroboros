/**
 * Unit tests for promptTransformer
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    transformForExtensionMode,
    transformWorkerForExtensionMode,
} from '../utils/promptTransformer';

describe('transformForExtensionMode', () => {
    describe('Table cell patterns', () => {
        it('should transform TASK command in table cell', () => {
            const input = '| TASK | Next task | `python -c "task = input(\'[Ouroboros] > \')"` |';
            const result = transformForExtensionMode(input);
            expect(result).toContain('ouroboros_ask');
            expect(result).not.toContain('python -c');
        });

        it('should transform MENU command in table cell', () => {
            const input = '| MENU | Options | `python -c "print(\'📋 Question\'); print(); print(\'[1] A\'); print(\'[2] B\'); choice = input(\'Select: \')"` |';
            const result = transformForExtensionMode(input);
            expect(result).toContain('ouroboros_menu');
            expect(result).not.toContain('python -c');
        });

        it('should transform CONFIRM command in table cell', () => {
            const input = '| CONFIRM | Yes/No | `python -c "print(\'⚠️ Question\'); print(); print(\'[y] Yes\'); print(\'[n] No\'); confirm = input(\'[y/n]: \')"` |';
            const result = transformForExtensionMode(input);
            expect(result).toContain('ouroboros_confirm');
            expect(result).not.toContain('python -c');
        });
    });

    describe('Code block patterns', () => {
        it('should transform standalone python code block', () => {
            const input = `\`\`\`python
python -c "task = input('[Ouroboros] > ')"
\`\`\``;
            const result = transformForExtensionMode(input);
            expect(result).toContain('ouroboros_ask');
        });

        it('should transform code block with menu command', () => {
            const input = `\`\`\`python
python -c "print('Select option'); print(); print('[1] Option A'); print('[2] Option B'); choice = input('Select: ')"
\`\`\``;
            const result = transformForExtensionMode(input);
            expect(result).toContain('ouroboros_menu');
        });

        it('should transform code block with confirm command', () => {
            const input = `\`\`\`python
python -c "print('Are you sure?'); confirm = input('[y/n]: ')"
\`\`\``;
            const result = transformForExtensionMode(input);
            expect(result).toContain('ouroboros_confirm');
        });
    });

    describe('Documentation context patterns', () => {
        it('should handle NEVER execute CCL pattern', () => {
            const input = 'NEVER execute CCL (`python -c "task = input(\'[Ouroboros] > \')"`)';
            const result = transformForExtensionMode(input);
            expect(result).toContain('ouroboros_ask');
            expect(result).not.toContain('python -c');
        });
    });

    describe('Inline patterns', () => {
        it('should transform task input pattern', () => {
            const input = 'python -c "task = input(\'[Ouroboros] > \')"';
            const result = transformForExtensionMode(input);
            expect(result).toContain('ouroboros_ask');
        });

        it('should transform task with question pattern', () => {
            const input = 'python -c "print(\'What would you like to do?\'); task = input(\'[Ouroboros] > \')"';
            const result = transformForExtensionMode(input);
            expect(result).toContain('ouroboros_ask');
            expect(result).toContain('What would you like to do?');
        });

        it('should transform feature input pattern', () => {
            const input = 'python -c "print(\'Describe the feature\'); feature = input(\'Feature: \')"';
            const result = transformForExtensionMode(input);
            expect(result).toContain('ouroboros_ask');
        });
    });

    describe('Header injection', () => {
        it('should add extension mode header', () => {
            const input = '# Test Content';
            const result = transformForExtensionMode(input);
            expect(result).toContain('OUROBOROS EXTENSION MODE');
        });

        it('should preserve YAML frontmatter', () => {
            const input = `---
description: Test
tools: ['read']
---
# Content`;
            const result = transformForExtensionMode(input);
            expect(result).toMatch(/^---/);
            expect(result).toContain('description: Test');
        });
    });
});

describe('transformWorkerForExtensionMode', () => {
    it('should add worker-specific header', () => {
        const input = '# Worker Agent';
        const result = transformWorkerForExtensionMode(input);
        expect(result).toContain('WORKER AGENT');
        expect(result).toContain('Do NOT execute CCL');
    });

    it('should transform NEVER execute patterns', () => {
        const input = 'NEVER execute CCL (`python -c "task = input(\'[Ouroboros] > \')"`)';
        const result = transformWorkerForExtensionMode(input);
        expect(result).toContain('ouroboros_ask');
    });

    it('should add note about Extension mode for CCL references', () => {
        const input = 'Only Level 0/1 may execute CCL';
        const result = transformWorkerForExtensionMode(input);
        expect(result).toContain('via LM Tools in Extension mode');
    });
});
