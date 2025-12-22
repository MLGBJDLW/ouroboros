/**
 * Logger utility for the extension
 */

import * as vscode from 'vscode';

const outputChannel = vscode.window.createOutputChannel('Ouroboros');

export interface Logger {
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
    debug(message: string, ...args: unknown[]): void;
}

/**
 * Create a logger with a specific prefix
 */
export function createLogger(prefix: string): Logger {
    const formatMessage = (level: string, message: string): string => {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${level}] [${prefix}] ${message}`;
    };

    const formatArgs = (args: unknown[]): string => {
        if (args.length === 0) {
            return '';
        }
        return (
            ' ' +
            args
                .map((arg) => {
                    if (typeof arg === 'object') {
                        try {
                            return JSON.stringify(arg, null, 2);
                        } catch {
                            return String(arg);
                        }
                    }
                    return String(arg);
                })
                .join(' ')
        );
    };

    return {
        info(message: string, ...args: unknown[]): void {
            const formatted = formatMessage('INFO', message) + formatArgs(args);
            outputChannel.appendLine(formatted);
        },

        warn(message: string, ...args: unknown[]): void {
            const formatted = formatMessage('WARN', message) + formatArgs(args);
            outputChannel.appendLine(formatted);
            // eslint-disable-next-line no-console
            console.warn(formatted);
        },

        error(message: string, ...args: unknown[]): void {
            const formatted = formatMessage('ERROR', message) + formatArgs(args);
            outputChannel.appendLine(formatted);
            // eslint-disable-next-line no-console
            console.error(formatted);
        },

        debug(message: string, ...args: unknown[]): void {
            const formatted = formatMessage('DEBUG', message) + formatArgs(args);
            outputChannel.appendLine(formatted);
        },
    };
}

/**
 * Show the output channel
 */
export function showOutputChannel(): void {
    outputChannel.show();
}
