/**
 * Tests for htmlToMarkdown utility
 */

import { describe, it, expect } from 'vitest';
import { htmlToMarkdown } from '../../utils/htmlToMarkdown';

describe('htmlToMarkdown', () => {
    describe('headings', () => {
        it('should convert h1-h6 tags', () => {
            expect(htmlToMarkdown('<h1>Title</h1>')).toBe('# Title');
            expect(htmlToMarkdown('<h2>Sub</h2>')).toBe('## Sub');
            expect(htmlToMarkdown('<h3>H3</h3>')).toBe('### H3');
            expect(htmlToMarkdown('<h4>H4</h4>')).toBe('#### H4');
            expect(htmlToMarkdown('<h5>H5</h5>')).toBe('##### H5');
            expect(htmlToMarkdown('<h6>H6</h6>')).toBe('###### H6');
        });
    });

    describe('inline formatting', () => {
        it('should convert bold', () => {
            expect(htmlToMarkdown('<strong>bold</strong>')).toBe('**bold**');
            expect(htmlToMarkdown('<b>bold</b>')).toBe('**bold**');
        });

        it('should convert italic', () => {
            expect(htmlToMarkdown('<em>italic</em>')).toBe('*italic*');
            expect(htmlToMarkdown('<i>italic</i>')).toBe('*italic*');
        });

        it('should convert strikethrough', () => {
            expect(htmlToMarkdown('<del>removed</del>')).toBe('~~removed~~');
            expect(htmlToMarkdown('<s>removed</s>')).toBe('~~removed~~');
        });

        it('should convert inline code', () => {
            expect(htmlToMarkdown('<code>foo()</code>')).toBe('`foo()`');
        });
    });

    describe('paragraphs and line breaks', () => {
        it('should convert paragraphs', () => {
            expect(htmlToMarkdown('<p>Hello</p><p>World</p>')).toBe('Hello\n\nWorld');
        });

        it('should convert br to newline', () => {
            expect(htmlToMarkdown('line1<br>line2')).toBe('line1\nline2');
        });

        it('should convert hr', () => {
            expect(htmlToMarkdown('<p>above</p><hr><p>below</p>')).toBe('above\n\n---\n\nbelow');
        });
    });

    describe('links and images', () => {
        it('should convert links', () => {
            expect(htmlToMarkdown('<a href="https://example.com">Click</a>')).toBe('[Click](https://example.com)');
        });

        it('should handle links without href', () => {
            expect(htmlToMarkdown('<a>Text</a>')).toBe('Text');
        });

        it('should convert images', () => {
            expect(htmlToMarkdown('<img src="img.png" alt="A pic">')).toBe('![A pic](img.png)');
        });
    });

    describe('lists', () => {
        it('should convert unordered lists', () => {
            const html = '<ul><li>Alpha</li><li>Beta</li></ul>';
            const md = htmlToMarkdown(html);
            expect(md).toContain('- Alpha');
            expect(md).toContain('- Beta');
        });

        it('should convert ordered lists', () => {
            const html = '<ol><li>First</li><li>Second</li></ol>';
            const md = htmlToMarkdown(html);
            expect(md).toContain('1. First');
            expect(md).toContain('2. Second');
        });
    });

    describe('code blocks', () => {
        it('should convert pre/code to fenced code block', () => {
            const html = '<pre><code class="language-js">const x = 1;</code></pre>';
            const md = htmlToMarkdown(html);
            expect(md).toContain('```js');
            expect(md).toContain('const x = 1;');
            expect(md).toContain('```');
        });

        it('should handle pre/code without language', () => {
            const html = '<pre><code>plain code</code></pre>';
            const md = htmlToMarkdown(html);
            expect(md).toContain('```\n');
            expect(md).toContain('plain code');
        });
    });

    describe('blockquotes', () => {
        it('should convert blockquotes', () => {
            const html = '<blockquote>Quoted text</blockquote>';
            const md = htmlToMarkdown(html);
            expect(md).toContain('> Quoted text');
        });
    });

    describe('tables', () => {
        it('should convert a simple table', () => {
            const html = `
                <table>
                    <thead><tr><th>Name</th><th>Age</th></tr></thead>
                    <tbody><tr><td>Alice</td><td>30</td></tr></tbody>
                </table>
            `;
            const md = htmlToMarkdown(html);
            expect(md).toContain('| Name');
            expect(md).toContain('| Age');
            expect(md).toContain('| Alice');
            expect(md).toContain('---');
        });
    });

    describe('mixed content', () => {
        it('should handle nested formatting', () => {
            const html = '<p>This is <strong>bold and <em>italic</em></strong> text</p>';
            const md = htmlToMarkdown(html);
            expect(md).toContain('**bold and *italic***');
        });

        it('should collapse excessive newlines', () => {
            const html = '<p>A</p><p></p><p></p><p>B</p>';
            const md = htmlToMarkdown(html);
            // Should not have more than 2 consecutive newlines
            expect(md).not.toMatch(/\n{3,}/);
        });

        it('should handle empty input', () => {
            expect(htmlToMarkdown('')).toBe('');
        });

        it('should pass through plain text', () => {
            expect(htmlToMarkdown('just text')).toBe('just text');
        });
    });
});
