import { fetchJsonCached } from '@app/lib/client/requestCache';
import { useCultivatorIdentity } from '@app/lib/resources/player';
import { useCallback, useEffect, useState } from 'react';

export function usePolledJson<T>(
  url: string,
  interval: number,
  isComplete?: (data: T) => boolean,
) {
  const actorId = useCultivatorIdentity().data?.cultivator?.id ?? '';
  const [result, setResult] = useState<{
    data?: T;
    error?: string;
    actorId: string;
    url: string;
  }>();
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((n) => n + 1), []);

  useEffect(() => {
    if (!actorId) return;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;

    async function run() {
      let complete = false;
      try {
        const data = await fetchJsonCached<T>(url, {
          key: `feed:${actorId}:${url}`,
          signal: abort.signal,
        });
        complete = isComplete?.(data) ?? false;
        if (!abort.signal.aborted) setResult({ data, actorId, url });
      } catch (cause) {
        if (!abort.signal.aborted)
          setResult((previous) => ({
            data:
              previous?.actorId === actorId && previous.url === url
                ? previous.data
                : undefined,
            actorId,
            url,
            error: cause instanceof Error ? cause.message : '载入失败',
          }));
      } finally {
        if (!abort.signal.aborted && !complete)
          timer = setTimeout(() => {
            if (document.visibilityState === 'visible') void run();
            else timer = setTimeout(run, interval);
          }, interval);
      }
    }

    void run();
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
  }, [url, interval, actorId, revision, isComplete]);

  const current =
    result?.actorId === actorId && result.url === url ? result : undefined;
  return { data: current?.data, error: current?.error, actorId, refresh };
}
