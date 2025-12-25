import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Markdown } from '../../components/Markdown/Markdown';

describe('Markdown Component', () => {
    it('renders plain text', () => {
        render(<Markdown content="Hello World" />);
        expect(screen.getByText('Hello World')).toBeInTheDocument();
    });

    it('renders headings', () => {
        render(<Markdown content={`# Heading 1
## Heading 2
### Heading 3`} />);
        expect(screen.getByRole('heading', { level: 1, name: 'Heading 1' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 2, name: 'Heading 2' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 3, name: 'Heading 3' })).toBeInTheDocument();
    });

    it('renders unordered lists', () => {
        render(<Markdown content={`- Item 1
- Item 2
- Item 3`} />);
        expect(screen.getByText('Item 1')).toBeInTheDocument();
        expect(screen.getByText('Item 2')).toBeInTheDocument();
        expect(screen.getByText('Item 3')).toBeInTheDocument();
        expect(screen.getByRole('list')).toBeInTheDocument();
    });

    it('renders ordered lists', () => {
        render(<Markdown content={`1. First
2. Second
3. Third`} />);
        expect(screen.getByText('First')).toBeInTheDocument();
        expect(screen.getByText('Second')).toBeInTheDocument();
        expect(screen.getByText('Third')).toBeInTheDocument();
    });

    it('renders inline code', () => {
        render(<Markdown content="Use `const` for constants" />);
        expect(screen.getByText('const')).toBeInTheDocument();
    });

    it('renders code blocks', () => {
        render(<Markdown content={`\`\`\`javascript
const x = 1;
\`\`\``} />);
        expect(screen.getByText('const x = 1;')).toBeInTheDocument();
        expect(screen.getByText('javascript')).toBeInTheDocument();
    });

    it('renders links', () => {
        render(<Markdown content="[Click here](https://example.com)" />);
        const link = screen.getByRole('link', { name: 'Click here' });
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute('href', 'https://example.com');
        expect(link).toHaveAttribute('target', '_blank');
    });

    it('renders bold text', () => {
        render(<Markdown content="This is **bold** text" />);
        expect(screen.getByText('bold')).toBeInTheDocument();
    });

    it('renders italic text', () => {
        render(<Markdown content="This is *italic* text" />);
        expect(screen.getByText('italic')).toBeInTheDocument();
    });

    it('renders blockquotes', () => {
        render(<Markdown content="> This is a quote" />);
        expect(screen.getByText('This is a quote')).toBeInTheDocument();
    });

    it('renders tables (GFM)', () => {
        render(<Markdown content={`| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |`} />);
        expect(screen.getByText('Header 1')).toBeInTheDocument();
        expect(screen.getByText('Header 2')).toBeInTheDocument();
        expect(screen.getByText('Cell 1')).toBeInTheDocument();
        expect(screen.getByText('Cell 2')).toBeInTheDocument();
        expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('renders strikethrough (GFM)', () => {
        render(<Markdown content="~~deleted~~" />);
        expect(screen.getByText('deleted')).toBeInTheDocument();
    });

    it('applies custom className', () => {
        const { container } = render(<Markdown content="Test" className="custom-class" />);
        expect(container.querySelector('.custom-class')).toBeInTheDocument();
    });

    it('renders complex markdown document', () => {
        const content = `# Project Plan

## Overview
This is the **implementation plan** for the new feature.

## Tasks
1. Design the API
2. Implement backend
3. Create frontend

## Code Example
\`\`\`typescript
interface Task {
    id: string;
    title: string;
}
\`\`\`

> Note: This is a draft plan.

For more info, see [documentation](https://docs.example.com).
`;
        render(<Markdown content={content} />);
        
        expect(screen.getByRole('heading', { name: 'Project Plan' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument();
        expect(screen.getByText('implementation plan')).toBeInTheDocument();
        expect(screen.getByText('Design the API')).toBeInTheDocument();
        expect(screen.getByText('typescript')).toBeInTheDocument();
        expect(screen.getByText('Note: This is a draft plan.')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'documentation' })).toBeInTheDocument();
    });
});
