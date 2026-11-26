import { apiFetch } from '@app/lib/api/fetch';
import type {
  ContestBrewCommand,
  ContestStatus,
} from '@daoyou/contracts/alchemy/contest';
import { useCallback, useEffect, useRef, useState } from 'react';

async function requestContest(
  path: string,
  init?: RequestInit,
): Promise<ContestStatus> {
  const response = await apiFetch(`/api/alchemy-contest${path}`, init);
  if (!response.ok) {
    const issue = (await response.json().catch(() => null)) as {
      error?: unknown;
      message?: unknown;
    } | null;
    const detail = [issue?.message, issue?.error].find(
      (value): value is string => typeof value === 'string' && value.length > 0,
    );
    throw new Error(detail ?? '暂时无法连接丹塔，请重试。');
  }
  return response.json();
}

export function useContestSession() {
  const [status, setStatus] = useState<ContestStatus | null>(null);
  const [now, setNow] = useState(Date.now);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<'start' | 'brew' | 'finish' | null>(
    null,
  );
  const offset = useRef(0);
  const revision = useRef(0);
  const working = useRef(false);
  const loading = useRef<AbortController | null>(null);

  const receive = useCallback(
    (fresh: ContestStatus, arrivedAt = Date.now()) => {
      offset.current = Date.parse(fresh.serverTime) - arrivedAt;
      setNow(Date.now() + offset.current);
      setStatus(fresh);
    },
    [],
  );

  const refresh = useCallback(
    async (dismissError = false) => {
      if (working.current || loading.current) return;
      const controller = new AbortController();
      loading.current = controller;
      const requestedAt = revision.current;
      try {
        const result = await requestContest('', { signal: controller.signal });
        if (controller.signal.aborted || requestedAt !== revision.current)
          return;
        receive(result);
        if (dismissError) setError('');
      } catch (issue) {
        if (!controller.signal.aborted && requestedAt === revision.current)
          setError(
            issue instanceof Error
              ? issue.message
              : '暂时无法读取赛况，请重试。',
          );
      } finally {
        if (loading.current === controller) loading.current = null;
      }
    },
    [receive],
  );

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const poll = window.setInterval(() => void refresh(), 20_000);
    const tick = window.setInterval(
      () => setNow(Date.now() + offset.current),
      1000,
    );
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      loading.current?.abort();
      loading.current = null;
      window.clearTimeout(initial);
      window.clearInterval(poll);
      window.clearInterval(tick);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  async function send(
    action: 'start' | 'brew' | 'finish',
    body: { week: string } | ContestBrewCommand,
  ) {
    if (working.current) return null;
    working.current = true;
    revision.current += 1;
    loading.current?.abort();
    loading.current = null;
    setPending(action);
    setError('');
    const showIgnition =
      action === 'brew' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ignition = showIgnition
      ? new Promise<void>((resolve) => window.setTimeout(resolve, 540))
      : undefined;
    try {
      const result = await requestContest(`/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const arrivedAt = Date.now();
      await ignition;
      receive(result, arrivedAt);
      return result;
    } catch (issue) {
      setError(
        issue instanceof Error ? issue.message : '暂时无法连接丹塔，请重试。',
      );
      working.current = false;
      void refresh();
      return null;
    } finally {
      working.current = false;
      setPending(null);
    }
  }

  return { status, now, error, pending, send, refresh };
}
