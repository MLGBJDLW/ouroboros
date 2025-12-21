/**
 * Unit tests for promptTransformer
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    transformForExtensionMode,
    transformWorkerForExtensionMode,
    extractYamlFrontmatter,
    preserveYamlFrontmatter,
} from '../../utils/promptTransformer';

// Mock vscode for fetchAndTransformPrompts tests
vi.mock('vscode', () => ({
    workspace: {
        fs: {
            writeFile: vi.fn().mockResolvedValue(undefined),
            createDirectory: vi.fn().mockResolvedValue(undefined),
        },
    },
    Uri: {
        joinPath: vi.fn().mockImplementation((base, ...segments) => ({
            fsPath: [base.fsPath, ...segments].join('/'),
        })),
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

describe('transformForExtensionMode', () => {
    describe('Table cell patterns', () => {
        it('should transform TASK command in table cell', () => {
            const input = '| TASK | Next task | `python -c "task = input(\'[Ouroboros] > \')"` |';
            const result = transformForExtensionMode(input);
            expect(result).toContain('ouroborosai_ask');
            expect(result).not.toContain('python -c');
        });

        it('should transform MENU command in table cell', () => {
            const input =
                "| MENU | Options | `python -c \"print('📋 Question'); print(); print('[1] A'); print('[2] B'); choice = input('Select: ')\"` |";
            const result = transformForExtensionMode(input);
            expect(result).toContain('ouroborosai_menu');
            expect(result).not.toContain('python -c');
        });

        it('should transform CONFIRM command in table cell', () => {
            const input =
                "| CONFIRM | Yes/No | `python -c \"print('⚠️ Question'); print(); print('[y] Yes'); print('[n] No'); confirm = input('[y/n]: ')\"` |";
            const result = transformForExtensionMode(input);
            expect(result).toContain('ouroborosai_confirm');
            expect(result).not.toContain('python -c');
        });

        it('should transform FEATURE command in table cell', () => {
            const input =
                "| FEATURE | Input | `python -c \"print('🔧 Question'); feature = input('Feature: ')\"` |";
            const result = transformForExtensionMode(input);
            expect(result).toContain('ouroborosai_ask');
        });

        it('should transform QUESTION command in table cell', () => {
            const input =
                "| QUESTION | Input | `python -c \"print('❓ Question'); question = input('Answer: ')\"` |";
            const result = transformForExtensionMode(input);
            expect(result).toContain('ouroborosai_ask');
        });

        it('should transform TASK+Q command in table cell', () => {
            const input =
                "| TASK+Q | With question | `python -c \"print('🎯 What next?'); task = input('[Ouroboros] > ')\"` |";
            const result = transformForExtensionMode(input);
            expect(result).toContain('ouroborosai_ask');
        });
    });

    describe('Code block patterns', () => {
        it('should transform standalone python code block', () => {
            const input = `\`\`\`python
python -c "task = input('[Ouroboros] > ')"
\`\`\``;
            const result = transformForExtensionMode(input);
            expect(result).toContain('ouroborosai_ask');
        });

        it('should transform code block with menu command', () => {
            const input = `\`\`\`python
python -c "print('Select option'); print(); print('[1] Option A'); print('[2] Option B'); choice = input('Select: ')"
\`\`\``;
            const result = transformForExtensionMode(input);
            expect(result).toContain('ouroborosai_menu');
        });

        it('should transform code block with confirm command', () => {
            const input = `\`\`\`python
python -c "print('Are you sure?'); confirm = input('[y/n]: ')"
\`\`\``;
            const result = transformForExtensionMode(input);
            expect(result).toContain('ouroborosai_confirm');
        });

        it('should transform code block with feature command', () => {
            const input = `\`\`\`python
python -c "print('Describe feature'); feature = input('Feature: ')"
\`\`\``;
            const result = transformForExtensionMode(input);
            expect(result).toContain('ouroborosai_ask');
        });

        it('should transform bash code block', () => {
            const input = `\`\`\`bash
python -c "task = input('[Ouroboros] > ')"
\`\`\``;
            const result = transformForExtensionMode(input);
            expect(result).toContain('ouroborosai_ask');
        });
    });

    describe('Labeled code block patterns', () => {
        it('should transform USE run_command TOOL labeled block', () => {
            const input = `**USE \`run_command\` TOOL:**
\`\`\`python
python -c "task = input('[Ouroboros] > ')"
\`\`\``;
            const result = transformForExtensionMode(input);
            expect(result).toContain('ouroborosai_ask');
            expect(result).toContain('Ouroboros LM Tools');
        });

        it('should transform Execute via run_command labeled block', () => {
            const input = `**Execute via \`run_command\` tool (Type A):**
\`\`\`python
python -c "task = input('[Ouroboros] > ')"
\`\`\``;
            const result = transformForExtensionMode(input);
            expect(result).toContain('ouroborosai_ask');
        });

        it('should transform menu in labeled block', () => {
            const input = `**USE \`run_command\` TOOL:**
\`\`\`python
python -c "print('Choose'); choice = input('Select: ')"
\`\`\``;
            const result = transformForExtensionMode(input);
            expect(result).toContain('ouroborosai_menu');
        });

        it('should transform confirm in labeled block', () => {
            const input = `**USE \`run_command\` TOOL:**
\`\`\`python
python -c "print('Confirm?'); confirm = input('[y/n]: ')"
\`\`\``;
            const result = transformForExtensionMode(input);
            expect(result).toContain('ouroborosai_confirm');
        });
    });

    describe('Documentation context patterns', () => {
        it('should handle NEVER execute CCL pattern', () => {
            const input = 'NEVER execute CCL (`python -c "task = input(\'[Ouroboros] > \')"`)';
            const result = transformForExtensionMode(input);
            expect(result).toContain('ouroborosai_ask');
            expect(result).not.toContain('python -c');
        });

        it('should handle NEVER** execute pattern', () => {
            const input = 'NEVER** execute `python -c "task = input(\'[Ouroboros] > \')"`';
            const result = transformForExtensionMode(input);
            expect(result).toContain('ouroborosai_ask');
        });

        it('should handle inline with dash pattern', () => {
            const input = '`python -c "task = input(\'[Ouroboros] > \')"` - this is CCL';
            const result = transformForExtensionMode(input);
            expect(result).toContain('ouroborosai_ask');
        });
    });

    describe('Inline patterns', () => {
        it('should transform task input pattern', () => {
            const input = 'python -c "task = input(\'[Ouroboros] > \')"';
            const result = transformForExtensionMode(input);
            expect(result).toContain('ouroborosai_ask');
        });

        it('should transform task with question pattern', () => {
            const input =
                "python -c \"print('What would you like to do?'); task = input('[Ouroboros] > ')\"";
            const result = transformForExtensionMode(input);
            expect(result).toContain('ouroborosai_ask');
            expect(result).toContain('What would you like to do?');
        });

        it('should transform feature input pattern', () => {
            const input =
                "python -c \"print('Describe the feature'); feature = input('Feature: ')\"";
            const result = transformForExtensionMode(input);
            expect(result).toContain('ouroborosai_ask');
        });

        it('should transform feature without question', () => {
            const input = 'python -c "feature = input(\'Enter feature: \')"';
            const result = transformForExtensionMode(input);
            expect(result).toContain('ouroborosai_ask');
        });

        it('should transform question input pattern', () => {
            const input = 'python -c "question = input(\'Your question: \')"';
            const result = transformForExtensionMode(input);
            expect(result).toContain('ouroborosai_ask');
        });

        it('should transform question with question pattern', () => {
            const input = "python -c \"print('Ask me anything'); question = input('Question: ')\"";
            const result = transformForExtensionMode(input);
            expect(result).toContain('ouroborosai_ask');
        });

        it('should transform simple confirm pattern', () => {
            const input = 'python -c "confirm = input(\'[y/n]: \')"';
            const result = transformForExtensionMode(input);
            expect(result).toContain('ouroborosai_confirm');
        });

        it('should transform confirm with header', () => {
            const input = "python -c \"print('Proceed?'); confirm = input('[y/n]: ')\"";
            const result = transformForExtensionMode(input);
            expect(result).toContain('ouroborosai_confirm');
        });

        it('should transform full confirm pattern', () => {
            const input =
                "python -c \"print('Are you sure?'); print(); print('[y] Yes'); print('[n] No'); confirm = input('[y/n]: ')\"";
            const result = transformForExtensionMode(input);
            expect(result).toContain('ouroborosai_confirm');
        });

        it('should transform simple menu pattern', () => {
            const input = "python -c \"print('Options:'); choice = input('Select: ')\"";
            const result = transformForExtensionMode(input);
            expect(result).toContain('ouroborosai_menu');
        });

        it('should transform full menu pattern', () => {
            const input =
                "python -c \"print('Choose:'); print(); print('[1] A'); print('[2] B'); choice = input('Select: ')\"";
            const result = transformForExtensionMode(input);
            expect(result).toContain('ouroborosai_menu');
        });
    });

    describe('Enhanced mode patterns', () => {
        it('should transform enhanced script with question', () => {
            const input = 'python .ouroboros/scripts/ouroboros_input.py --question "What next?"';
            const result = transformForExtensionMode(input);
            expect(result).toContain('ouroborosai_ask');
            expect(result).toContain('What next?');
        });

        it('should transform enhanced script standard', () => {
            const input = 'python .ouroboros/scripts/ouroboros_input.py';
            const result = transformForExtensionMode(input);
            expect(result).toContain('ouroborosai_ask');
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

    describe('Edge cases', () => {
        it('should handle empty input', () => {
            const result = transformForExtensionMode('');
            expect(result).toContain('OUROBOROS EXTENSION MODE');
        });

        it('should handle input with no patterns', () => {
            const input = '# Just a heading\n\nSome text without any patterns.';
            const result = transformForExtensionMode(input);
            expect(result).toContain('Just a heading');
            expect(result).toContain('OUROBOROS EXTENSION MODE');
        });

        it('should escape quotes in questions', () => {
            const input = "python -c \"print('What next?'); task = input('[Ouroboros] > ')\"";
            const result = transformForExtensionMode(input);
            expect(result).toContain('ouroborosai_ask');
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
        expect(result).toContain('ouroborosai_ask');
    });

    it('should add note about Extension mode for CCL references', () => {
        const input = 'Only Level 0/1 may execute CCL';
        const result = transformWorkerForExtensionMode(input);
        expect(result).toContain('via LM Tools in Extension mode');
    });

    it('should preserve YAML frontmatter', () => {
        const input = `---
description: Worker
---
# Worker Content`;
        const result = transformWorkerForExtensionMode(input);
        expect(result).toMatch(/^---/);
    });

    it('should handle empty input', () => {
        const result = transformWorkerForExtensionMode('');
        expect(result).toContain('WORKER AGENT');
    });
});

describe('extractYamlFrontmatter', () => {
    it('should extract YAML frontmatter from content', () => {
        const content = `---
description: Test agent
tools: ['read', 'write']
---
# Content here`;
        const result = extractYamlFrontmatter(content);
        expect(result).not.toBeNull();
        expect(result?.content).toContain('description: Test agent');
        expect(result?.body).toContain('# Content here');
    });

    it('should return null for content without frontmatter', () => {
        const content = '# No YAML here\nJust content';
        const result = extractYamlFrontmatter(content);
        expect(result).toBeNull();
    });

    it('should handle minimal YAML frontmatter', () => {
        const content = `---
description: ""
---
# Content`;
        const result = extractYamlFrontmatter(content);
        expect(result).not.toBeNull();
        expect(result?.content).toBe('description: ""');
    });
});

describe('preserveYamlFrontmatter', () => {
    it('should preserve user YAML while updating body', () => {
        const existingContent = `---
description: My custom description
tools: ['read', 'my-custom-tool']
---
# Old content`;

        const newContent = `---
description: Default description
tools: ['read']
---
# New content`;

        const result = preserveYamlFrontmatter(existingContent, newContent);
        expect(result).toContain('My custom description');
        expect(result).toContain('my-custom-tool');
        expect(result).toContain('# New content');
        expect(result).not.toContain('# Old content');
    });

    it('should use new content when existing has no YAML', () => {
        const existingContent = '# Just content, no YAML';
        const newContent = `---
description: New
---
# New content`;

        const result = preserveYamlFrontmatter(existingContent, newContent);
        expect(result).toBe(newContent);
    });

    it('should keep existing when new content has no YAML', () => {
        const existingContent = `---
description: Existing
---
# Existing content`;
        const newContent = '# New content without YAML';

        const result = preserveYamlFrontmatter(existingContent, newContent);
        expect(result).toBe(existingContent);
    });

    it('should inject Ouroboros tools for orchestrators', () => {
        const existingContent = `---
description: Orchestrator
tools: ['agent']
---
# Content`;

        const newContent = `---
description: Default
---
# New content`;

        const result = preserveYamlFrontmatter(existingContent, newContent, true);
        expect(result).toContain('mlgbjdlw.ouroboros-ai/ouroborosai_ask');
    });
});
