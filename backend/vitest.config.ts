import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    // Exclude node_modules and dist
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
