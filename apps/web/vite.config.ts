import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin, type UserConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const alias = {
  '@app': fileURLToPath(new URL('./src', import.meta.url)),
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

const cloudflareNotFoundPlugin = (): Plugin => ({
  name: 'cloudflare-not-found',
  generateBundle() {
    // Cloudflare 用根目录 404.html 区分缺失资源；EdgeOne 的 SPA 产物不能包含它。
    if (!process.env.CF_PAGES_COMMIT_SHA) return;
    this.emitFile({
      type: 'asset',
      fileName: '404.html',
      source: readFileSync(
        fileURLToPath(new URL('./cloudflare/404.html', import.meta.url)),
        'utf8',
      ),
    });
  },
});

export default defineConfig((): UserConfig => {
  const buildId = createBuildId();
  return {
    envDir: false,
    resolve: { alias },
    define: { __APP_BUILD_ID__: JSON.stringify(buildId) },
    plugins: [
      react(),
      tailwindcss(),
      appVersionManifestPlugin(buildId),
      cloudflareNotFoundPlugin(),
      ...VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        injectRegister: false,
        manifest: false,
        devOptions: { enabled: false },
        injectManifest: {
          rollupFormat: 'iife',
          // public 目录下的图片没有内容哈希。
          dontCacheBustURLsMatching:
            /^assets\/[^/]+-[A-Za-z0-9_-]{8,}\.(?:js|css)$/,
          globPatterns: [
            'manifest.webmanifest',
            'favicon.svg',
            'icons/*.png',
            'assets/paper.webp',
            'assets/app-boot/*.{svg,webp}',
          ],
        },
      }),
    ],
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
