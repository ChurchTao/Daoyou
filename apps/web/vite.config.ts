import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin, type UserConfig } from 'vite';
import type { Options as FontOptions } from 'vite-plugin-font';
import { VitePWA } from 'vite-plugin-pwa';

const alias = {
  '@app': fileURLToPath(new URL('./src', import.meta.url)),
};
const devApiTarget = () => `http://127.0.0.1:${process.env.PORT ?? 3000}`;

// pnpm disables dependency install scripts. Install the splitter's native
// library on demand for both development and clean deployment builds.
function ensureFontSplit() {
  const require = createRequire(import.meta.url);
  const fontRequire = createRequire(require.resolve('vite-plugin-font'));
  const dist = join(
    dirname(fontRequire.resolve('cn-font-split/package.json')),
    'dist',
  );
  if (
    readdirSync(dist).some((name) => /^libffi-.+\.(dylib|so|dll)$/.test(name))
  )
    return;
  execFileSync(process.execPath, [join(dist, 'cli.js'), 'i', 'default@7.6.8'], {
    stdio: 'inherit',
  });
  if (
    !readdirSync(dist).some((name) => /^libffi-.+\.(dylib|so|dll)$/.test(name))
  ) {
    throw new Error('Font splitter native library installation failed.');
  }
}

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

export default defineConfig(async (): Promise<UserConfig> => {
  ensureFontSplit();
  // Loading the plugin initializes FFI, so the native library must exist first.
  const { default: font } = await import('vite-plugin-font');
  const buildId = createBuildId();
  return {
    envDir: false,
    resolve: { alias },
    define: { __APP_BUILD_ID__: JSON.stringify(buildId) },
    plugins: [
      react(),
      tailwindcss(),
      // Full-font mode retains dynamic chat, names and generated text. The
      // splitter groups common characters and keeps the rest behind unicode-range.
      font.vite({
        scanFiles: ['src/**/*.{ts,tsx}'],
        // Full-font language grouping omits these symbol aliases from the
        // original cmaps; retain them explicitly in the interface subsets.
        whiteList:
          '\u00a0¢£¤¥¦¨©¬¯°±÷ˆˇ˚˜―’‚„‥‰€™\u3000〈〉『』〔〕〖〗﹉﹊﹋﹌﹍﹎﹏－．＿｛｝฿࿕࿖',
        subsetChunkSize: 100000,
        chunkSize: 2 * 1024 * 1024,
        // The published type is a protobuf class; the runtime accepts this object.
        css: { fontDisplay: 'swap' } as FontOptions['css'],
      }),
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
            /^assets\/[^/]+-[A-Za-z0-9_-]{8,}\.(?:js|css|woff2)$/,
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
