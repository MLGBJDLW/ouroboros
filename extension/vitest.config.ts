import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.test.ts'],
        exclude: ['node_modules', 'dist', 'webview'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['src/**/*.ts'],
            exclude: [
                'src/**/*.test.ts',
                'src/**/*.d.ts',
                'src/__mocks__/**',
            ],
            thresholds: {
                statements: 35,
                branches: 75,
                functions: 55,
                lines: 35,
            },
        },
        alias: {
            vscode: new URL('./src/__mocks__/vscode.ts', import.meta.url).pathname,
        },
    },
});
