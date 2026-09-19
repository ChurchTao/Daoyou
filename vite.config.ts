import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin, type UserConfig } from 'vite';

const alias = {
  '@app': fileURLToPath(new URL('./src/react-app', import.meta.url)),
  '@server': fileURLToPath(new URL('./src/server', import.meta.url)),
  '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
};
const devApiTarget = () => `http://127.0.0.1:${process.env.PORT ?? 3000}`;

const createBuildId = () =>
  process.env.CF_PAGES_COMMIT_SHA ?? process.env.GITHUB_SHA ?? randomUUID();

const appVersionManifestPlugin = (buildId: string): Plugin => ({
  name: 'app-version-manifest',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: `${JSON.stringify({ buildId })}\n`,
    });
  },
});

export default defineConfig((): UserConfig => {
  const buildId = createBuildId();
  return {
    resolve: { alias },
    define: { __APP_BUILD_ID__: JSON.stringify(buildId) },
    plugins: [react(), tailwindcss(), appVersionManifestPlugin(buildId)],
    build: { outDir: 'dist', emptyOutDir: true },
    server: {
      host: process.env.HOST ?? '127.0.0.1',
      port: Number(process.env.WEB_PORT ?? 5173),
      strictPort: true,
      proxy: {
        '/api': {
          target: devApiTarget(),
          changeOrigin: true,
          ws: true,
        },
        '/internal': {
          target: devApiTarget(),
          changeOrigin: true,
        },
      },
    },
  };
});
