import { fetchJsonCached } from '@app/lib/client/requestCache';
import { useEffect, useState } from 'react';

/** 由调用页按角色及地址挂载，切换页面时取消旧请求。 */
export function useHistory<T>(path: string, owner: string) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    void fetchJsonCached<{ success: boolean; data: T }>(path, {
      key: `dungeon-history:${owner}:${path}`,
      signal: abort.signal,
      cache: 'no-store',
    })
      .then((response) => {
        if (!abort.signal.aborted) setData(response.data);
      })
      .catch((e: Error) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    return () => abort.abort();
  }, [path, owner, attempt]);
  return {
    data,
    error,
    retry: () => {
      setError('');
      setAttempt((n) => n + 1);
    },
  };
}

export function historyPage(value: string | null) {
  return Math.min(10000, Math.max(1, Math.trunc(Number(value)) || 1));
}

export function historyDate(value: string) {
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
