import {
  fetchJsonCached,
  invalidateCachedRequest,
} from '@app/lib/client/requestCache';
import type { QiState } from '@shared/contracts/qi';
import { useCallback, useEffect, useState } from 'react';

const QI_STATE_INVALIDATED_EVENT = 'daoyou:qi-state-invalidated';

export function getQiStateCacheKey(cultivatorId: string) {
  return `cultivator:qi:${cultivatorId}`;
}

export function invalidateQiState(
  cultivatorId: string | undefined | null,
  options: { notify?: boolean } = {},
) {
  if (!cultivatorId) return;
  invalidateCachedRequest(getQiStateCacheKey(cultivatorId));

  if (options.notify === false || typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(QI_STATE_INVALIDATED_EVENT, {
      detail: { cultivatorId },
    }),
  );
}

export function useQiState({
  cultivatorId,
  autoRefresh = false,
  refreshInterval = 60_000,
}: {
  cultivatorId: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}) {
  const [state, setState] = useState<QiState | null>(null);
  const [loading, setLoading] = useState(Boolean(cultivatorId));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!cultivatorId) {
      setState(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      invalidateQiState(cultivatorId, { notify: false });
      const result = await fetchJsonCached<{
        success: boolean;
        data?: QiState;
        error?: string;
      }>('/api/cultivator/qi', {
        key: getQiStateCacheKey(cultivatorId),
        ttlMs: autoRefresh ? Math.min(refreshInterval, 5000) : 30_000,
      });

      if (!result.success || !result.data) {
        throw new Error(result.error || '获取灵气状态失败');
      }
      setState(result.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取灵气状态失败');
    } finally {
      setLoading(false);
    }
  }, [autoRefresh, cultivatorId, refreshInterval]);

  useEffect(() => {
    if (!cultivatorId) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const result = await fetchJsonCached<{
          success: boolean;
          data?: QiState;
          error?: string;
        }>('/api/cultivator/qi', {
          key: getQiStateCacheKey(cultivatorId),
          ttlMs: autoRefresh ? Math.min(refreshInterval, 5000) : 30_000,
        });

        if (cancelled) return;
        if (!result.success || !result.data) {
          throw new Error(result.error || '获取灵气状态失败');
        }
        setState(result.data);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '获取灵气状态失败');
          setState(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    const handleQiInvalidated = (event: Event) => {
      const detail = (event as CustomEvent<{ cultivatorId?: string }>).detail;
      if (detail?.cultivatorId !== cultivatorId) return;
      void load();
    };
    window.addEventListener(QI_STATE_INVALIDATED_EVENT, handleQiInvalidated);

    if (autoRefresh && refreshInterval > 0) {
      const timer = window.setInterval(load, refreshInterval);
      return () => {
        cancelled = true;
        window.removeEventListener(
          QI_STATE_INVALIDATED_EVENT,
          handleQiInvalidated,
        );
        window.clearInterval(timer);
      };
    }

    return () => {
      cancelled = true;
      window.removeEventListener(
        QI_STATE_INVALIDATED_EVENT,
        handleQiInvalidated,
      );
    };
  }, [autoRefresh, cultivatorId, refreshInterval]);

  return {
    state: cultivatorId ? state : null,
    loading: cultivatorId ? loading : false,
    error: cultivatorId ? error : null,
    refresh,
  };
}
