/**
 * Tests for HTML generator
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create proper mock setup
const mockWebview = {
    asWebviewUri: vi.fn().mockImplementation((uri: { path?: string; fsPath?: string }) => {
        const path = uri?.path ?? uri?.fsPath ?? '/mock/path';
        return {
            toString: () => `vscode-webview://mock${path}`,
            path,
            fsPath: path,
            scheme: 'vscode-webview',
        };
    }),
    cspSource: 'https://mock.vscode-cdn.net',
};

const mockExtensionUri = {
    fsPath: '/test/extension',
    path: '/test/extension',
    scheme: 'file',
};

// Mock vscode module
vi.mock('vscode', () => ({
    Uri: {
        joinPath: vi
            .fn()
            .mockImplementation(
                (base: { fsPath: string; path?: string }, ...segments: string[]) => {
                    const fullPath = [base.fsPath, ...segments].join('/');
                    return {
                        fsPath: fullPath,
                        path: fullPath,
                        scheme: 'file',
                    };
                }
            ),
    },
}));

describe('htmlGenerator', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        // Reset the mock implementation
        mockWebview.asWebviewUri.mockImplementation((uri: { path?: string; fsPath?: string }) => {
            const path = uri?.path ?? uri?.fsPath ?? '/mock/path';
            return {
                toString: () => `vscode-webview://mock${path}`,
                path,
                fsPath: path,
                scheme: 'vscode-webview',
            };
        });
    });

    describe('generateHtml', () => {
        it('should generate valid HTML structure', async () => {
            const { generateHtml } = await import('../../webview/htmlGenerator');
            const html = generateHtml(mockWebview as never, mockExtensionUri as never);

            expect(html).toContain('<!DOCTYPE html>');
            expect(html).toContain('<html lang="en">');
            expect(html).toContain('<head>');
            expect(html).toContain('<body>');
            expect(html).toContain('</html>');
        });

        it('should include root div for React', async () => {
            const { generateHtml } = await import('../../webview/htmlGenerator');
            const html = generateHtml(mockWebview as never, mockExtensionUri as never);

            expect(html).toContain('<div id="root">');
        });

        it('should include title', async () => {
            const { generateHtml } = await import('../../webview/htmlGenerator');
            const html = generateHtml(mockWebview as never, mockExtensionUri as never);

            expect(html).toContain('<title>Ouroboros</title>');
        });

        it('should include nonce in script tags', async () => {
            const { generateHtml } = await import('../../webview/htmlGenerator');
            const html = generateHtml(mockWebview as never, mockExtensionUri as never);

            expect(html).toMatch(/nonce="[A-Za-z0-9]+"/);
        });

        it('should include CSP source', async () => {
            const { generateHtml } = await import('../../webview/htmlGenerator');
            const html = generateHtml(mockWebview as never, mockExtensionUri as never);

            expect(html).toContain(mockWebview.cspSource);
        });

        it('should include vscode API initialization', async () => {
            const { generateHtml } = await import('../../webview/htmlGenerator');
            const html = generateHtml(mockWebview as never, mockExtensionUri as never);

            expect(html).toContain('acquireVsCodeApi');
            expect(html).toContain('window.vscodeApi');
        });
    });

    describe('generatePlaceholderHtml', () => {
        it('should generate valid placeholder HTML', async () => {
            const { generatePlaceholderHtml } = await import('../../webview/htmlGenerator');
            const html = generatePlaceholderHtml(mockWebview as never);

            expect(html).toContain('<!DOCTYPE html>');
            expect(html).toContain('Ouroboros');
        });

        it('should include ready message script', async () => {
            const { generatePlaceholderHtml } = await import('../../webview/htmlGenerator');
            const html = generatePlaceholderHtml(mockWebview as never);

            expect(html).toContain("postMessage({ type: 'ready' })");
        });

        it('should include status section', async () => {
            const { generatePlaceholderHtml } = await import('../../webview/htmlGenerator');
            const html = generatePlaceholderHtml(mockWebview as never);

            expect(html).toContain('Status');
            expect(html).toContain('Ready');
        });

        it('should include infinity icon', async () => {
            const { generatePlaceholderHtml } = await import('../../webview/htmlGenerator');
            const html = generatePlaceholderHtml(mockWebview as never);

            expect(html).toContain('∞');
        });

        it('should include inline styles', async () => {
            const { generatePlaceholderHtml } = await import('../../webview/htmlGenerator');
            const html = generatePlaceholderHtml(mockWebview as never);

            expect(html).toContain('<style>');
            expect(html).toContain('--vscode-');
        });
    });

    describe('nonce generation', () => {
        it('should generate nonces with alphanumeric characters', async () => {
            const { generateHtml } = await import('../../webview/htmlGenerator');
            const html = generateHtml(mockWebview as never, mockExtensionUri as never);

            const nonceMatch = html.match(/nonce="([A-Za-z0-9]+)"/);
            expect(nonceMatch).toBeTruthy();
            expect(nonceMatch?.[1]).toMatch(/^[A-Za-z0-9]+$/);
        });
    });
});
