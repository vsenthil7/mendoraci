import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      thresholds: {
        // Defensive guards (c8-ignored) lower nominal totals slightly.
        // All reachable code is 100% line-tested; branches at 85% allows
        // for combinatorics in regex passes that don't need exhaustive coverage.
        lines: 95,
        functions: 100,
        branches: 85,
        statements: 95,
      },
      include: ['src/**/*.ts'],
    },
  },
});
