import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import {
  cleanupOutdatedCaches,
  precacheAndRoute,
  type PrecacheEntry,
} from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import {
  CacheFirst,
  NetworkOnly,
  StaleWhileRevalidate,
} from 'workbox-strategies';

declare global {
  interface WorkerGlobalScope {
    __WB_MANIFEST: Array<PrecacheEntry | string>;
  }
}

const scope = self as unknown as ServiceWorkerGlobalScope;

const SHELL_CACHE = 'daoyou-shell';
const BUILD_ASSET_CACHE = 'daoyou-build-assets';
const MEDIA_CACHE = 'daoyou-media';
const SHELL_URL = '/index.html';
const NAVIGATION_TIMEOUT_MS = 4_000;
const HASHED_BUILD_ASSET =
  /^\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.(?:js|css)$/;

// version.json is how the open page detects a new build. API responses carry
// identity and game state, so neither can be replayed from cache.
function isNetworkOnlyPath(url: URL) {
  return (
    url.pathname === '/version.json' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/internal/')
  );
}

function isSameOrigin(url: URL) {
  return url.origin === self.location.origin;
}

function isHashedBuildAsset(url: URL) {
  return isSameOrigin(url) && HASHED_BUILD_ASSET.test(url.pathname);
}

function isRuntimeMedia(request: Request, url: URL) {
  if (request.method !== 'GET' || !isSameOrigin(url) || isNetworkOnlyPath(url)) {
    return false;
  }
  if (isHashedBuildAsset(url)) return false;

  return (
    request.destination === 'image' ||
    request.destination === 'font' ||
    request.destination === 'style' ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/favicon.svg'
  );
}

async function storeShell(response: Response) {
  if (!response.ok || response.type !== 'basic') return;
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html')) return;

  const body = await response.blob();
  const cache = await caches.open(SHELL_CACHE);
  await cache.put(
    SHELL_URL,
    new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    }),
  );
}

async function refreshShellFromNetwork() {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    NAVIGATION_TIMEOUT_MS,
  );
  try {
    const response = await fetch(SHELL_URL, {
      cache: 'reload',
      signal: controller.signal,
    });
    await storeShell(response);
  } catch {
    // Activation still claims clients when the shell request fails.
  } finally {
    clearTimeout(timeoutId);
  }
}

async function readShell() {
  const cache = await caches.open(SHELL_CACHE);
  return cache.match(SHELL_URL);
}

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

scope.addEventListener('message', (event) => {
  const data: unknown = event.data;
  if (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    data.type === 'SKIP_WAITING'
  ) {
    void scope.skipWaiting();
  }
});

scope.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await caches.delete('daoyou-documents');
      await scope.clients.claim();
      await refreshShellFromNetwork();
    })(),
  );
});

registerRoute(
  ({ url }) => isSameOrigin(url) && isNetworkOnlyPath(url),
  new NetworkOnly(),
);

registerRoute(
  ({ request, url }) => request.method === 'GET' && isHashedBuildAsset(url),
  new CacheFirst({
    cacheName: BUILD_ASSET_CACHE,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({
        maxEntries: 400,
        purgeOnQuotaError: true,
      }),
    ],
  }),
);

registerRoute(
  ({ request, url }) => isRuntimeMedia(request, url),
  new StaleWhileRevalidate({
    cacheName: MEDIA_CACHE,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({
        maxEntries: 100,
        purgeOnQuotaError: true,
      }),
    ],
  }),
);

// Every app route is the same SPA document. A slow or failed navigation can
// use the saved shell; an HTTP error from the network is returned as-is.
async function handleNavigation(
  request: Request,
  event: ExtendableEvent,
): Promise<Response> {
  const responsePromise = fetch(request);
  const completed = responsePromise.then(async (response) => {
    await storeShell(response.clone());
  });
  event.waitUntil(completed.catch(() => undefined));

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => {
    timeoutId = setTimeout(() => resolve('timeout'), NAVIGATION_TIMEOUT_MS);
  });

  try {
    const winner = await Promise.race([
      responsePromise.then((response) => ({ response })),
      timeout,
    ]);

    if (winner !== 'timeout') {
      return winner.response;
    }

    const shell = await readShell();
    if (shell) return shell;
    return await responsePromise;
  } catch {
    const shell = await readShell();
    if (shell) return shell;
    return Response.error();
  } finally {
    clearTimeout(timeoutId);
  }
}

registerRoute(
  ({ request, url }) =>
    request.mode === 'navigate' &&
    isSameOrigin(url) &&
    !isNetworkOnlyPath(url),
  ({ event, request }) => handleNavigation(request, event),
);
