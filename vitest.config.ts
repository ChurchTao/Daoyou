import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const alias = {
  '@app': fileURLToPath(new URL('./src/react-app', import.meta.url)),
  '@server': fileURLToPath(new URL('./src/server', import.meta.url)),
  '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
};

export default defineConfig({
  resolve: { alias },
  test: {
    environment: 'node',
    exclude: ['dist/**', 'node_modules/**', 'src/react-app/**'],
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    restoreMocks: true,
  },
});
