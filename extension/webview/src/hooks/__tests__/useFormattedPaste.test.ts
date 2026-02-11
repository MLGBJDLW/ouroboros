/**
 * Tests for useFormattedPaste hook
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFormattedPaste } from '../useFormattedPaste';

/** Helper: build a minimal React.ClipboardEvent-like object. */
function makePasteEvent(htmlData: string, textData = ''): React.ClipboardEvent {
    const prevented = { value: false };
    return {
        clipboardData: {
            getData(type: string) {
                if (type === 'text/html') return htmlData;
                if (type === 'text/plain') return textData;
                return '';
            },
        },
        preventDefault() {
            prevented.value = true;
        },
        /** Expose for assertions */
        get defaultPrevented() {
            return prevented.value;
        },
    } as unknown as React.ClipboardEvent;
}

describe('useFormattedPaste', () => {
    function setup(initialValue = '') {
        const textarea = document.createElement('textarea');
        textarea.value = initialValue;
        textarea.selectionStart = initialValue.length;
        textarea.selectionEnd = initialValue.length;
        document.body.appendChild(textarea);

        const refObj = { current: textarea };
        const setValue = vi.fn();
        const setCursorPosition = vi.fn();

        const { result } = renderHook(() =>
            useFormattedPaste(refObj, setValue, setCursorPosition),
        );

        return { result, textarea, setValue, setCursorPosition, refObj };
    }

    it('should return false for pastes without HTML', () => {
        const { result } = setup();
        const e = makePasteEvent('', 'plain text');
        expect(result.current.tryFormatPaste(e)).toBe(false);
    });

    it('should return false for pastes with trivial HTML wrappers', () => {
        const { result } = setup();
        // Browsers wrap plain text in <html><body>…</body></html>
        const e = makePasteEvent('<html><body>plain text only</body></html>');
        expect(result.current.tryFormatPaste(e)).toBe(false);
    });

    it('should handle pastes with rich HTML content', () => {
        const { result, setValue } = setup();
        const e = makePasteEvent('<html><body><strong>bold</strong></body></html>');
        const handled = result.current.tryFormatPaste(e);
        expect(handled).toBe(true);
        expect(e.defaultPrevented).toBe(true);
        expect(setValue).toHaveBeenCalledWith(expect.stringContaining('**bold**'));
    });

    it('should insert markdown at cursor position', () => {
        const { result, setValue, textarea } = setup('before after');
        textarea.selectionStart = 7; // after "before "
        textarea.selectionEnd = 7;

        const e = makePasteEvent('<html><body><em>italic</em></body></html>');
        result.current.tryFormatPaste(e);

        expect(setValue).toHaveBeenCalled();
        const value = setValue.mock.calls[0][0] as string;
        expect(value).toBe('before *italic*after');
    });

    it('should replace selected text', () => {
        const { result, setValue, textarea } = setup('hello world');
        textarea.selectionStart = 6; // select "world"
        textarea.selectionEnd = 11;

        const e = makePasteEvent('<html><body><strong>earth</strong></body></html>');
        result.current.tryFormatPaste(e);

        const value = setValue.mock.calls[0][0] as string;
        expect(value).toBe('hello **earth**');
    });

    it('should set cursor position after insertion', () => {
        const { result, setCursorPosition } = setup('');
        const e = makePasteEvent('<html><body><h1>Title</h1></body></html>');
        result.current.tryFormatPaste(e);

        expect(setCursorPosition).toHaveBeenCalled();
        const pos = setCursorPosition.mock.calls[0][0] as number;
        expect(pos).toBeGreaterThan(0);
    });

    it('should return false when markdown result is empty', () => {
        const { result } = setup();
        // An empty paragraph produces no meaningful markdown
        const e = makePasteEvent('<html><body><p></p></body></html>');
        expect(result.current.tryFormatPaste(e)).toBe(false);
    });
});
