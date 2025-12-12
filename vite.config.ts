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
    },
  },
});
