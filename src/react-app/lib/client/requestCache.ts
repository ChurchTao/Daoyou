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

/**
 * Client-side request dedupe with short-lived cache.
 * - Dedupes concurrent requests by key
 * - Reuses fresh data within ttlMs to avoid remount refetch storms
 */
export async function fetchJsonCached<T>(
  input: RequestInfo | URL,
  { key, ttlMs = 0, ...init }: FetchJsonCachedOptions,
): Promise<T> {
  const now = Date.now();
  const cached = dataCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.data as T;
  }

  const inflight = inflightCache.get(key);
  if (inflight) {
    return inflight as Promise<T>;
  }

  const request = fetch(input, init)
    .then(async (res) => {
      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof json?.error === 'string' ? json.error : `HTTP ${res.status}`,
        );
      }
      if (ttlMs > 0) {
        dataCache.set(key, { data: json, expiresAt: Date.now() + ttlMs });
      }
      return json as T;
    })
    .finally(() => {
      inflightCache.delete(key);
    });

  inflightCache.set(key, request);
  return request as Promise<T>;
}

export function invalidateCachedRequest(key: string) {
  dataCache.delete(key);
  inflightCache.delete(key);
}
