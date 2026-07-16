import build from '@hono/vite-build/bun';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';

const alias = {
  '@app': fileURLToPath(new URL('./src/react-app', import.meta.url)),
  '@server': fileURLToPath(new URL('./src/server', import.meta.url)),
  '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
};
const devApiTarget = () => `http://localhost:${process.env.API_PORT ?? 3000}`;

const applyEnvToProcess = (mode: string) => {
  const env = loadEnv(mode, process.cwd(), '');

  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
};

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

export default defineConfig(({ command, mode }) => {
  applyEnvToProcess(mode);
  const buildId = createBuildId();

  if (mode === 'client') {
    return {
      resolve: { alias },
      define: { __APP_BUILD_ID__: JSON.stringify(buildId) },
      plugins: [react(), tailwindcss(), appVersionManifestPlugin(buildId)],
      build: {
        outDir: 'dist',
        emptyOutDir: true,
      },
    };
  }

  if (command === 'build') {
    return {
      resolve: { alias },
      plugins: [
        build({
          entry: './src/index.ts',
          emptyOutDir: true,
        }),
      ],
    };
  }

  return {
    resolve: { alias },
    define: { __APP_BUILD_ID__: JSON.stringify(buildId) },
    plugins: [react(), tailwindcss()],
    server: {
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
