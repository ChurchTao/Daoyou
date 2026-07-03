import build from '@hono/vite-build/bun';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

const alias = {
  '@app': fileURLToPath(new URL('./src/react-app', import.meta.url)),
  '@server': fileURLToPath(new URL('./src/server', import.meta.url)),
  '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
};
const devApiTarget = () =>
  `http://localhost:${process.env.API_PORT ?? 3000}`;

const applyEnvToProcess = (mode: string) => {
  const env = loadEnv(mode, process.cwd(), '');

  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
};

export default defineConfig(({ command, mode }) => {
  applyEnvToProcess(mode);

  if (mode === 'client') {
    return {
      resolve: { alias },
      plugins: [react(), tailwindcss()],
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
          entryContentDefaultExportHook: (
            appName,
          ) => `export default websocket !== undefined
  ? {
      port: Number(process.env.PORT ?? 3000),
      fetch: ${appName}.fetch.bind(${appName}),
      websocket,
    }
  : {
      port: Number(process.env.PORT ?? 3000),
      fetch: ${appName}.fetch.bind(${appName}),
    }`,
        }),
      ],
    };
  }

  return {
    resolve: { alias },
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
