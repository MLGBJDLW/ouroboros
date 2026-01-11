import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
    plugins: [react()],
    base: './',
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: resolve(__dirname, 'index.html'),
            output: {
                entryFileNames: 'assets/[name].js',
                chunkFileNames: 'assets/[name]-[hash].js',
                assetFileNames: 'assets/[name].[ext]',
                manualChunks: {
                    // React core
                    'vendor-react': ['react', 'react-dom'],
                    // Force graph library (large)
                    'vendor-graph': ['react-force-graph-2d'],
                    // Markdown rendering
                    'vendor-markdown': ['react-markdown', 'remark-gfm'],
                },
            },
        },
        sourcemap: true,
        minify: 'esbuild',
        chunkSizeWarningLimit: 300,
    },
    define: {
        'process.env.NODE_ENV': JSON.stringify('production'),
    },
});
