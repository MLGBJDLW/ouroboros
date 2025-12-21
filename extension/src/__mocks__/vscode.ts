/**
 * VS Code API Mock for Testing
 */

import { vi } from 'vitest';

export const Uri = {
    file: (path: string) => ({ fsPath: path, path, scheme: 'file' }),
    joinPath: (base: { fsPath: string }, ...segments: string[]) => ({
        fsPath: [base.fsPath, ...segments].join('/'),
        path: [base.fsPath, ...segments].join('/'),
        scheme: 'file',
    }),
    parse: (uri: string) => ({ fsPath: uri, path: uri, scheme: 'file' }),
};

export const workspace = {
    fs: {
        readFile: vi.fn().mockResolvedValue(new Uint8Array()),
        writeFile: vi.fn().mockResolvedValue(undefined),
        createDirectory: vi.fn().mockResolvedValue(undefined),
        stat: vi.fn().mockRejectedValue(new Error('File not found')),
    },
    workspaceFolders: [{ uri: Uri.file('/test-workspace'), name: 'test', index: 0 }],
    getConfiguration: vi.fn().mockReturnValue({
        get: vi.fn().mockReturnValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
    }),
    onDidChangeConfiguration: vi.fn().mockReturnValue({ dispose: vi.fn() }),
};

export const window = {
    showInformationMessage: vi.fn().mockResolvedValue(undefined),
    showWarningMessage: vi.fn().mockResolvedValue(undefined),
    showErrorMessage: vi.fn().mockResolvedValue(undefined),
    showQuickPick: vi.fn().mockResolvedValue(undefined),
    showInputBox: vi.fn().mockResolvedValue(undefined),
    createOutputChannel: vi.fn().mockReturnValue({
        appendLine: vi.fn(),
        append: vi.fn(),
        show: vi.fn(),
        dispose: vi.fn(),
    }),
    withProgress: vi.fn().mockImplementation(async (_options, callback) => {
        return callback({ report: vi.fn() });
    }),
    createStatusBarItem: vi.fn().mockReturnValue({
        show: vi.fn(),
        hide: vi.fn(),
        dispose: vi.fn(),
        text: '',
        tooltip: '',
        command: undefined,
    }),
};

export const commands = {
    registerCommand: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    executeCommand: vi.fn().mockResolvedValue(undefined),
};

export const ExtensionContext = vi.fn();

export class Disposable {
    static from(...disposables: { dispose: () => unknown }[]) {
        return {
            dispose: () => disposables.forEach((d) => d.dispose()),
        };
    }
    dispose() {}
}

export class EventEmitter<T> {
    private listeners: ((e: T) => void)[] = [];

    event = (listener: (e: T) => void) => {
        this.listeners.push(listener);
        return { dispose: () => this.listeners.splice(this.listeners.indexOf(listener), 1) };
    };

    fire(data: T) {
        this.listeners.forEach((l) => l(data));
    }

    dispose() {
        this.listeners = [];
    }
}

export class CancellationTokenSource {
    token = {
        isCancellationRequested: false,
        onCancellationRequested: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    };
    cancel() {
        this.token.isCancellationRequested = true;
    }
    dispose() {}
}

export class LanguageModelToolResult {
    constructor(public parts: LanguageModelTextPart[]) {}
}

export class LanguageModelTextPart {
    constructor(public value: string) {}
}

export const ProgressLocation = {
    Notification: 1,
    SourceControl: 10,
    Window: 15,
};

export const StatusBarAlignment = {
    Left: 1,
    Right: 2,
};

export const lm = {
    registerTool: vi.fn().mockReturnValue({ dispose: vi.fn() }),
};

export default {
    Uri,
    workspace,
    window,
    commands,
    Disposable,
    EventEmitter,
    CancellationTokenSource,
    LanguageModelToolResult,
    LanguageModelTextPart,
    ProgressLocation,
    StatusBarAlignment,
    lm,
};
