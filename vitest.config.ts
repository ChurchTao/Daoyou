import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    exclude: ['**/dist/**', 'node_modules/**'],
    globals: true,
    include: [
      'packages/*/src/**/*.test.ts',
      'packages/*/src/**/*.spec.ts',
      'packages/*/src/**/*.test.tsx',
      'packages/*/src/**/*.spec.tsx',
    ],
    restoreMocks: true,
  },
});
