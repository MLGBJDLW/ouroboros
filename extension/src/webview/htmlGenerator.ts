/**
 * HTML generator for the webview
 */

import * as vscode from 'vscode';

/**
 * Generate the HTML content for the webview
 */
export function generateHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    // Get the webview script and style URIs
    const scriptUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, 'webview', 'dist', 'assets', 'index.js')
    );

    const styleUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, 'webview', 'dist', 'assets', 'index.css')
    );

    const codiconsUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css')
    );

    const logoUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, 'resources', 'icon.svg')
    );

    // Use a nonce to only allow specific scripts to run
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource}; img-src ${webview.cspSource};">
  <link href="${styleUri}" rel="stylesheet">
  <link href="${codiconsUri}" rel="stylesheet">
  <title>Ouroboros</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    window.vscodeApi = vscode;
    window.logoUri = "${logoUri}";
  </script>
  <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`;
}

/**
 * Generate a simple placeholder HTML when webview is not built
 */
export function generatePlaceholderHtml(webview: vscode.Webview): string {
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <style>
    body {
      padding: 16px;
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-sideBar-background);
    }
    .container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 200px;
      text-align: center;
    }
    .icon {
      font-size: 48px;
      margin-bottom: 16px;
      opacity: 0.5;
    }
    h2 {
      margin: 0 0 8px 0;
      font-weight: 500;
    }
    p {
      margin: 0;
      opacity: 0.8;
    }
    .status {
      margin-top: 24px;
      padding: 12px;
      background: var(--vscode-textBlockQuote-background);
      border-radius: 4px;
      font-size: 12px;
    }
  </style>
  <title>Ouroboros</title>
</head>
<body>
  <div class="container">
    <div class="icon">∞</div>
    <h2>Ouroboros</h2>
    <p>Structured AI Agent Workflow</p>
    <div class="status">
      <strong>Status:</strong> Ready<br>
      <span style="opacity: 0.7;">Waiting for agent requests...</span>
    </div>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    window.vscodeApi = vscode;
    
    // Notify extension that webview is ready
    vscode.postMessage({ type: 'ready' });
    
    // Listen for messages from extension
    window.addEventListener('message', event => {
      const message = event.data;
      console.log('Received message:', message);
    });
  </script>
</body>
</html>`;
}

/**
 * Generate a random nonce
 */
function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
