import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
    },
  },
  build: {
    ssr: './src/server/workers/onlineBattleResolver.worker.ts',
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      output: { entryFileNames: 'online-battle-resolver.js' },
    },
  },
});
