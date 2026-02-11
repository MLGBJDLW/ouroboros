/**
 * useFormattedPaste – auto-convert rich HTML to Markdown on paste.
 *
 * Usage:
 *   const fp = useFormattedPaste(textareaRef, setValue, setCursorPosition);
 *
 *   <textarea
 *     onPaste={(e) => { if (!fp.tryFormatPaste(e)) handlePaste(e); }}
 *   />
 *
 * On every paste, `tryFormatPaste` checks whether the clipboard contains
 * `text/html`.  If it does **and** the HTML is richer than plain text
 * (i.e. it contains actual markup tags), the HTML is converted to Markdown
 * and inserted at the cursor.  Returns `true` when the paste was handled.
 *
 * Plain-text pastes (no HTML, or trivial wrapper-only HTML) fall through
 * so the browser's default behaviour (or the caller's handlePaste) kicks in.
 */

import { useCallback } from 'react';
import type React from 'react';
import { htmlToMarkdown } from '../utils/htmlToMarkdown';

/** Returns true if the HTML contains meaningful rich-text markup. */
function hasRichContent(html: string): boolean {
    // Browsers wrap even plain text in <html><body>…</body></html>.
    // Strip those wrappers and check whether any real tags remain.
    const stripped = html
        .replace(/<\/?(html|head|body|meta|!doctype)[^>]*>/gi, '')
        .trim();
    // If after stripping wrappers there are still HTML tags, it's rich.
    return /<[a-z][^>]*>/i.test(stripped);
}

export function useFormattedPaste(
    textareaRef: React.RefObject<HTMLTextAreaElement | null>,
    setValue: (value: string) => void,
    setCursorPosition?: (pos: number) => void,
) {
    /**
     * Call at the **start** of every onPaste handler.
     * Returns `true` when it consumed the event (caller should `return`).
     */
    const tryFormatPaste = useCallback(
        (e: React.ClipboardEvent): boolean => {
            const html = e.clipboardData.getData('text/html');
            if (!html || !hasRichContent(html)) return false;

            e.preventDefault();

            const markdown = htmlToMarkdown(html);
            if (!markdown.trim()) return false;

            const textarea = textareaRef.current;
            if (!textarea) return true;

            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const cur = textarea.value;
            const next = cur.substring(0, start) + markdown + cur.substring(end);

            setValue(next);

            const newCursor = start + markdown.length;
            setCursorPosition?.(newCursor);

            // Restore cursor after React re-renders the controlled value
            requestAnimationFrame(() => {
                if (textareaRef.current) {
                    textareaRef.current.selectionStart = newCursor;
                    textareaRef.current.selectionEnd = newCursor;
                }
            });

            return true;
        },
        [textareaRef, setValue, setCursorPosition],
    );

    return { tryFormatPaste } as const;
}
