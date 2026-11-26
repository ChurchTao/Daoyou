import { fetchJsonCached } from '@app/lib/client/requestCache';
import { usePolledJson } from '@app/lib/hooks/usePolledJson';
export async function huntRequest<T>(
  url: string,
  actorId: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetchJsonCached<{ data: T }>(url, {
    key: `hunts:${actorId}:${url}`,
    signal,
    ...(body === undefined
      ? {}
      : {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }),
  });
  return response.data;
}
export function useHunts<T>(url: string, interval = 5000) {
  const feed = usePolledJson<{ data: T }>(url, interval);
  return { ...feed, data: feed.data?.data };
}
