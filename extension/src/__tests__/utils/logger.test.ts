/**
 * Tests for logger utility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the output channel at module level
const mockAppendLine = vi.fn();
const mockShow = vi.fn();

vi.mock('vscode', () => ({
    window: {
        createOutputChannel: vi.fn().mockReturnValue({
            appendLine: mockAppendLine,
            append: vi.fn(),
            show: mockShow,
            dispose: vi.fn(),
        }),
    },
}));

describe('logger', () => {
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
        vi.clearAllMocks();

        // Spy on console methods
        consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('createLogger', () => {
        it('should create a logger with prefix', async () => {
            const { createLogger } = await import('../../utils/logger');
            const logger = createLogger('TestModule');
            expect(logger).toBeDefined();
            expect(logger.info).toBeInstanceOf(Function);
            expect(logger.warn).toBeInstanceOf(Function);
            expect(logger.error).toBeInstanceOf(Function);
            expect(logger.debug).toBeInstanceOf(Function);
        });
    });

    describe('log methods', () => {
        it('should log info messages to output channel', async () => {
            const { createLogger } = await import('../../utils/logger');
            const logger = createLogger('Test');

            logger.info('test message');

            expect(mockAppendLine).toHaveBeenCalled();
            const call = mockAppendLine.mock.calls[0][0];
            expect(call).toContain('[INFO]');
            expect(call).toContain('[Test]');
            expect(call).toContain('test message');
        });

        it('should log warn messages to output channel and console', async () => {
            const { createLogger } = await import('../../utils/logger');
            const logger = createLogger('Test');

            logger.warn('test warning');

            expect(mockAppendLine).toHaveBeenCalled();
            expect(consoleWarnSpy).toHaveBeenCalled();
            const call = mockAppendLine.mock.calls[0][0];
            expect(call).toContain('[WARN]');
        });

        it('should log error messages to output channel and console', async () => {
            const { createLogger } = await import('../../utils/logger');
            const logger = createLogger('Test');

            logger.error('test error');

            expect(mockAppendLine).toHaveBeenCalled();
            expect(consoleErrorSpy).toHaveBeenCalled();
            const call = mockAppendLine.mock.calls[0][0];
            expect(call).toContain('[ERROR]');
        });

        it('should log debug messages to output channel', async () => {
            const { createLogger } = await import('../../utils/logger');
            const logger = createLogger('Test');

            logger.debug('test debug');

            expect(mockAppendLine).toHaveBeenCalled();
            const call = mockAppendLine.mock.calls[0][0];
            expect(call).toContain('[DEBUG]');
        });
    });

    describe('argument formatting', () => {
        it('should format object arguments as JSON', async () => {
            const { createLogger } = await import('../../utils/logger');
            const logger = createLogger('Test');

            logger.info('message', { key: 'value' });

            expect(mockAppendLine).toHaveBeenCalled();
            const call = mockAppendLine.mock.calls[0][0];
            expect(call).toContain('key');
            expect(call).toContain('value');
        });

        it('should format primitive arguments as strings', async () => {
            const { createLogger } = await import('../../utils/logger');
            const logger = createLogger('Test');

            logger.info('message', 42, 'text', true);

            expect(mockAppendLine).toHaveBeenCalled();
            const call = mockAppendLine.mock.calls[0][0];
            expect(call).toContain('42');
            expect(call).toContain('text');
            expect(call).toContain('true');
        });

        it('should handle empty arguments', async () => {
            const { createLogger } = await import('../../utils/logger');
            const logger = createLogger('Test');

            logger.info('message only');

            expect(mockAppendLine).toHaveBeenCalled();
        });

        it('should handle circular objects gracefully', async () => {
            const { createLogger } = await import('../../utils/logger');
            const logger = createLogger('Test');

            const circular: Record<string, unknown> = { name: 'test' };
            circular.self = circular;

            // Should not throw
            expect(() => logger.info('circular', circular)).not.toThrow();
        });
    });

    describe('showOutputChannel', () => {
        it('should show the output channel', async () => {
            const { showOutputChannel } = await import('../../utils/logger');

            showOutputChannel();

            expect(mockShow).toHaveBeenCalled();
        });
    });

    describe('message format', () => {
        it('should include timestamp in ISO format', async () => {
            const { createLogger } = await import('../../utils/logger');
            const logger = createLogger('Test');

            logger.info('test');

            const call = mockAppendLine.mock.calls[0][0];
            // Check for ISO timestamp pattern
            expect(call).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        });
    });
});
