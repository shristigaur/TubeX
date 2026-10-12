import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Integration-specific setup that enforces target validation before tests execute
    setupFiles: ['./tests/integration/setup.ts'],
    // Look specifically for integration test files
    include: ['tests/integration/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    // Exclude node_modules, dist, and unit tests
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/unit/**', 'tests/smoke.test.ts'],
    // Run integration tests serially to maintain isolation
    fileParallelism: false,
  },
});
