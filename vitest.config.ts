import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    exclude: ['**/dist/**', 'node_modules/**'],
    globals: true,
    include: [
      'packages/shared/src/**/*.test.ts',
      'packages/shared/src/**/*.spec.ts',
      'packages/shared/src/**/*.test.tsx',
      'packages/shared/src/**/*.spec.tsx',
    ],
    restoreMocks: true,
  },
});
