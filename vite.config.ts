import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  publicDir: 'build',
  build: {
    target: ['es2021', 'chrome100', 'safari13'],
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'index.html',
        quickNote: 'quick-note.html',
      },
      output: {
        // Manual chunks for better code splitting
        manualChunks: {
          // highlight.js is large (~500KB) - load only when needed
          'highlight': ['highlight.js'],
          // CodeMirror core
          'codemirror': [
            '@codemirror/state',
            '@codemirror/view',
            '@codemirror/commands',
            '@codemirror/language',
            '@codemirror/lang-markdown',
            'codemirror'
          ],
          // Markdown parser
          'marked': ['marked'],
        },
      },
    },
  },
});
