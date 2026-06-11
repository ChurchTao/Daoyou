import { usePlayerState, usePlayerStateActions } from '@app/lib/player-state/store';
import { QI_MAX } from '@shared/config/qiSystem';
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
  const currency = usePlayerState((store) => store.snapshot.currency);
  const storeLoading = usePlayerState((store) => store.loading);
  const storeError = usePlayerState((store) => store.error);
  const { refresh: refreshPlayerState } = usePlayerStateActions();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (!cultivatorId) return;
    setRefreshing(true);
    try {
      await refreshPlayerState(['currency']);
    } finally {
      setRefreshing(false);
    }
  }, [cultivatorId, refreshPlayerState]);

  useEffect(() => {
    if (!cultivatorId) return;

    const handleQiInvalidated = (event: Event) => {
      const detail = (event as CustomEvent<{ cultivatorId?: string }>).detail;
      if (detail?.cultivatorId !== cultivatorId) return;
      void refresh();
    };
    window.addEventListener(QI_STATE_INVALIDATED_EVENT, handleQiInvalidated);

    if (autoRefresh && refreshInterval > 0) {
      const timer = window.setInterval(refresh, refreshInterval);
      return () => {
        window.removeEventListener(
          QI_STATE_INVALIDATED_EVENT,
          handleQiInvalidated,
        );
        window.clearInterval(timer);
      };
    }

    return () => {
      window.removeEventListener(
        QI_STATE_INVALIDATED_EVENT,
        handleQiInvalidated,
      );
    };
  }, [autoRefresh, cultivatorId, refresh, refreshInterval]);

  const state: QiState | null =
    cultivatorId && currency
      ? {
          current: currency.qi,
          max: QI_MAX,
        }
      : null;

  return {
    state,
    loading: cultivatorId ? storeLoading || refreshing : false,
    error: cultivatorId ? storeError : null,
    refresh,
  };
}
