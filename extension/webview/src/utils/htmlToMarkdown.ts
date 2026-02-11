/**
 * Lightweight HTML → Markdown converter for clipboard paste.
 *
 * Converts common HTML elements (headings, lists, code blocks, tables, etc.)
 * into their Markdown equivalents. Used when the user pastes with
 * Ctrl+Shift+V to preserve formatting from the clipboard.
 */

export function htmlToMarkdown(html: string): string {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const result = processNode(doc.body).trim();
    // Collapse runs of 3+ newlines into 2
    return result.replace(/\n{3,}/g, '\n\n');
}

// ---------------------------------------------------------------------------
// Core recursive converter
// ---------------------------------------------------------------------------

function processNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent ?? '';
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const children = () => processChildren(el);

    switch (tag) {
        // Headings
        case 'h1': return `# ${children().trim()}\n\n`;
        case 'h2': return `## ${children().trim()}\n\n`;
        case 'h3': return `### ${children().trim()}\n\n`;
        case 'h4': return `#### ${children().trim()}\n\n`;
        case 'h5': return `##### ${children().trim()}\n\n`;
        case 'h6': return `###### ${children().trim()}\n\n`;

        // Block elements
        case 'p': return `${children().trim()}\n\n`;
        case 'div': return `${children()}\n`;
        case 'br': return '\n';
        case 'hr': return '---\n\n';

        // Inline formatting
        case 'strong': case 'b': return `**${children()}**`;
        case 'em': case 'i': return `*${children()}*`;
        case 'del': case 's': return `~~${children()}~~`;
        case 'u': return children(); // no MD equivalent – pass through

        // Code
        case 'code': {
            // If inside <pre>, the parent handler takes care of fencing
            if (el.parentElement?.tagName.toLowerCase() === 'pre') {
                return el.textContent ?? '';
            }
            return `\`${children()}\``;
        }
        case 'pre': {
            const codeEl = el.querySelector('code');
            const lang = codeEl?.className?.match(/(?:language|lang)-(\w+)/)?.[1] ?? '';
            const content = (codeEl?.textContent ?? el.textContent ?? '').trim();
            return `\`\`\`${lang}\n${content}\n\`\`\`\n\n`;
        }

        // Links & images
        case 'a': {
            const href = el.getAttribute('href');
            const text = children();
            return href ? `[${text}](${href})` : text;
        }
        case 'img': {
            const alt = el.getAttribute('alt') ?? '';
            const src = el.getAttribute('src') ?? '';
            return src ? `![${alt}](${src})` : '';
        }

        // Lists
        case 'ul': case 'menu': return `${children()}\n`;
        case 'ol': return `${children()}\n`;
        case 'li': {
            const parent = el.parentElement;
            const content = children().trim();
            if (parent?.tagName.toLowerCase() === 'ol') {
                const idx = Array.from(parent.children).indexOf(el) + 1;
                return `${idx}. ${content}\n`;
            }
            return `- ${content}\n`;
        }

        // Blockquote
        case 'blockquote': {
            const inner = children().trim();
            return inner.split('\n').map(l => `> ${l}`).join('\n') + '\n\n';
        }

        // Table
        case 'table': return convertTable(el);
        case 'thead': case 'tbody': case 'tfoot':
        case 'tr': case 'th': case 'td':
            // Handled by convertTable – should not be reached in a well-formed
            // tree, but fall through to children just in case.
            return children();

        // Pass-through wrappers
        case 'span': case 'body': case 'html': case 'section':
        case 'article': case 'main': case 'header': case 'footer':
        case 'nav': case 'aside': case 'figure': case 'figcaption':
        case 'details': case 'summary': case 'mark':
            return children();

        default:
            return children();
    }
}

function processChildren(el: HTMLElement): string {
    return Array.from(el.childNodes).map(processNode).join('');
}

// ---------------------------------------------------------------------------
// Table converter
// ---------------------------------------------------------------------------

function convertTable(table: HTMLElement): string {
    const rows: string[][] = [];
    const headerRowCount = table.querySelectorAll('thead tr').length;

    table.querySelectorAll('tr').forEach(tr => {
        const cells: string[] = [];
        tr.querySelectorAll('th, td').forEach(cell => {
            cells.push(processChildren(cell as HTMLElement).trim());
        });
        if (cells.length > 0) rows.push(cells);
    });

    if (rows.length === 0) return '';

    // Normalise column count
    const colCount = Math.max(...rows.map(r => r.length));
    const normalised = rows.map(r => {
        while (r.length < colCount) r.push('');
        return r;
    });

    // Column widths (at least 3 for the separator dashes)
    const widths = Array.from({ length: colCount }, (_, i) =>
        Math.max(3, ...normalised.map(r => r[i].length)),
    );

    const formatRow = (cells: string[]) =>
        '| ' + cells.map((c, i) => c.padEnd(widths[i])).join(' | ') + ' |';

    const separator =
        '| ' + widths.map(w => '-'.repeat(w)).join(' | ') + ' |';

    const headerBoundary = headerRowCount > 0 ? headerRowCount : 1;
    const lines: string[] = [];
    normalised.forEach((row, idx) => {
        lines.push(formatRow(row));
        if (idx === headerBoundary - 1) lines.push(separator);
    });

    return lines.join('\n') + '\n\n';
}
