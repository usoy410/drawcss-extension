import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    define: {
        'process.env': {},
        'process.browser': true,
        'global': 'window',
    },
    build: {
        outDir: 'media',
        lib: {
            entry: 'src/webview/main.tsx',
            formats: ['iife'],
            name: 'webviewStudio',
            fileName: () => 'webview.js',
        },
        rollupOptions: {
            output: {
                extend: true,
            },
        },
    },
    resolve: {
        alias: {
            '@': '/src/webview',
        },
    },
});
