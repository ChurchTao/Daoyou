import type { DungeonState } from '@shared/lib/dungeon/types';
import { useCallback, useEffect, useRef, useState } from 'react';

export function useDungeonState(cultivatorId: string | undefined) {
  const [state, setState] = useState<DungeonState | null>(null);
  const [loading, setLoading] = useState(!!cultivatorId);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);
  const storageKey = `dungeon:last-run:${cultivatorId}`;
  useEffect(() => {
    if (cultivatorId && state?.runId)
      sessionStorage.setItem(storageKey, state.runId);
  }, [cultivatorId, state?.runId, storageKey]);

  const refresh = useCallback(async () => {
    if (!cultivatorId) return;
    const request = ++sequence.current;
    setLoading(true);
    async function read(runId?: string): Promise<DungeonState | null> {
      const res = await fetch(
        `/api/dungeon/state${runId ? `?runId=${encodeURIComponent(runId)}` : ''}`,
        { signal: AbortSignal.timeout(15000) },
      );
      if (res.status === 409 || res.status === 429)
        throw new Error('探索仍在处理中，请稍后重新读取');
      if (!res.ok) throw new Error('暂时无法读取探索结果，请重新读取');
      const data = await res.json();
      if (data.error || !('state' in data))
        throw new Error('探索状态读取失败，请重新读取');
      return data.state;
    }
    try {
      let next = await read();
      const lastRun = sessionStorage.getItem(storageKey);
      if (!next && lastRun) next = await read(lastRun);
      if (request !== sequence.current) return;
      setState(next);
      setError(null);
    } catch (reason) {
      if (request !== sequence.current) return;
      setError(
        reason instanceof Error && reason.name !== 'SyntaxError'
          ? reason.message
          : '暂时无法读取探索结果，请重新读取',
      );
    } finally {
      if (request === sequence.current) setLoading(false);
    }
  }, [cultivatorId, storageKey]);

  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0);
    const requests = sequence;
    return () => {
      clearTimeout(timer);
      requests.current++;
    };
  }, [refresh]);

  return {
    state,
    setState,
    loading,
    error,
    refresh,
    dismissSettlement: () => {
      sessionStorage.removeItem(storageKey);
      setState(null);
    },
  };
}
