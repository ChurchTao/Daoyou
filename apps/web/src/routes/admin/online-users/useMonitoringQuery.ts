import { apiFetch } from '@app/lib/api/fetch';
import { useEffect, useState } from 'react';

export function useMonitoringQuery<T>(
  path: string,
  refresh: number,
  interval: number,
) {
  const [result, setResult] = useState<{
    path: string;
    data: T | null;
    error: string;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let loading = false;
    async function load() {
      if (loading) return;
      loading = true;
      try {
        const response = await apiFetch(path, {
          signal: controller.signal,
          cache: 'no-store',
        });
        const payload = (await response.json()) as {
          success: boolean;
          data?: T;
          error?: string;
        };
        if (!response.ok || !payload.success || payload.data === undefined) {
          throw new Error(payload.error || '读取失败，请刷新重试');
        }
        if (!controller.signal.aborted)
          setResult({ path, data: payload.data, error: '' });
      } catch (cause) {
        if (!controller.signal.aborted) {
          setResult((previous) => ({
            path,
            data: previous?.path === path ? previous.data : null,
            error:
              cause instanceof Error ? cause.message : '读取失败，请刷新重试',
          }));
        }
      } finally {
        loading = false;
      }
    }

    const loadWhenVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    void load();
    const timer = window.setInterval(loadWhenVisible, interval);
    document.addEventListener('visibilitychange', loadWhenVisible);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', loadWhenVisible);
    };
  }, [interval, path, refresh]);

  return result?.path === path ? result : null;
}
