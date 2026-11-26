import { apiFetch } from '@app/lib/api/fetch';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';

const REFRESH_MS = 15_000;

export function useWeeklyRanking<T extends { period: { state: string } }>(
  endpoint: string,
  name: string,
) {
  const [params, setParams] = useSearchParams();
  const previous = params.get('period') === 'previous';
  const [result, setResult] = useState<{ previous: boolean; data: T }>();
  const [failure, setFailure] = useState<{ previous: boolean }>();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    let timer: number;
    let busy = false;
    let settled = false;

    async function load() {
      window.clearTimeout(timer);
      if (signal.aborted || busy || document.hidden) return;
      busy = true;
      try {
        const url = previous ? `${endpoint}?period=previous` : endpoint;
        const response = await apiFetch(url, { signal, cache: 'no-store' });
        if (!response.ok) throw new Error(name);
        const data: T = await response.json();
        if (signal.aborted) return;
        setResult({ previous, data });
        setFailure(undefined);
        settled = previous && data.period.state === 'settled';
      } catch {
        if (!signal.aborted) setFailure({ previous });
      } finally {
        busy = false;
        if (!signal.aborted && !settled && !document.hidden)
          timer = window.setTimeout(() => void load(), REFRESH_MS);
      }
    }

    const refresh = () => void load();
    refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [attempt, endpoint, name, previous]);

  const data = result?.previous === previous ? result.data : undefined;
  return {
    previous,
    data,
    error:
      !data && failure?.previous === previous ? `${name}暂时无法读取。` : '',
    retry() {
      setFailure(undefined);
      setAttempt((value) => value + 1);
    },
    changePeriod(value: string) {
      const next = new URLSearchParams(params);
      if (value === 'previous') next.set('period', 'previous');
      else next.delete('period');
      setParams(next, { replace: true, preventScrollReset: true });
    },
  };
}
