import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const alias = {
  '@app': fileURLToPath(new URL('./src/react-app', import.meta.url)),
  '@server': fileURLToPath(new URL('./src/server', import.meta.url)),
  '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
};

/**
 * The battle process is a Node service, rather than a browser bundle.
 * Keep server dependencies external so Node resolves their supported runtime
 * entry points (notably boardgame.io, ioredis and nats).
 */
export default defineConfig({
  resolve: { alias },
  build: {
    ssr: './src/server/battle-server.ts',
    outDir: 'dist-battle',
    target: 'node22',
    sourcemap: true,
    emptyOutDir: true,
    rollupOptions: {
      output: {
        format: 'es',
        entryFileNames: 'battle-server.js',
      },
      external: ['boardgame.io', 'ioredis', 'nats', 'node-persist'],
    },
  },
});
