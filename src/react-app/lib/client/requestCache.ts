type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

interface FetchJsonCachedOptions extends RequestInit {
  key: string;
  ttlMs?: number;
}

const dataCache = new Map<string, CacheEntry<unknown>>();
const inflightCache = new Map<string, Promise<unknown>>();
const privatePlayerStateKeyPrefixes = [
  'player:',
  'cultivator:',
  'inventory:',
  'mail:',
  'tasks:',
  'products:',
  'qi:',
];

/**
 * Client-side request dedupe with short-lived cache.
 * - Dedupes concurrent requests by key
 * - Reuses fresh data within ttlMs to avoid remount refetch storms
 */
export async function fetchJsonCached<T>(
  input: RequestInfo | URL,
  { key, ttlMs = 0, ...init }: FetchJsonCachedOptions,
): Promise<T> {
  const isPrivatePlayerStateKey = privatePlayerStateKeyPrefixes.some((prefix) =>
    key.startsWith(prefix),
  );
  if (import.meta.env.DEV && isPrivatePlayerStateKey) {
    console.warn(
      `[request-cache] ${key} looks like private player state; use PlayerStateStore instead of TTL cache.`,
    );
  }

  const now = Date.now();
  const cached = dataCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.data as T;
  }

  // A signal belongs to one caller's lifecycle. Sharing that request would let
  // one unmount abort unrelated consumers, so signal-bound callers dedupe at
  // their own query layer instead.
  const sharesInflightRequest = !init.signal;
  const inflight = sharesInflightRequest ? inflightCache.get(key) : undefined;
  if (inflight) return inflight as Promise<T>;

  const request = fetch(input, init)
    .then(async (res) => {
      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof json?.error === 'string' ? json.error : `HTTP ${res.status}`,
        );
      }
      if (ttlMs > 0 && !isPrivatePlayerStateKey) {
        dataCache.set(key, { data: json, expiresAt: Date.now() + ttlMs });
      }
      return json as T;
    })
    .finally(() => {
      if (sharesInflightRequest) inflightCache.delete(key);
    });

  if (sharesInflightRequest) inflightCache.set(key, request);
  return request as Promise<T>;
}

export function invalidateCachedRequest(key: string) {
  dataCache.delete(key);
  inflightCache.delete(key);
}
