import build from '@hono/vite-build/bun';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@app': fileURLToPath(new URL('./src/react-app', import.meta.url)),
      '@server': fileURLToPath(new URL('./src/server', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
    },
  },
  plugins: [build({ entry: './src/index.ts', emptyOutDir: true })],
});
