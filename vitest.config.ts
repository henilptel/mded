import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/__tests__/**/*.test.ts'],
    setupFiles: ['src/renderer/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
    // Suppress unhandled errors from CodeMirror's DOM operations in jsdom
    dangerouslyIgnoreUnhandledErrors: true,
  },
});
