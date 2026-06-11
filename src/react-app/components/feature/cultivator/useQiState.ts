import { usePlayerState, usePlayerStateActions } from '@app/lib/player-state/store';
import { QI_MAX } from '@shared/config/qiSystem';
import type { QiState } from '@shared/contracts/qi';
import { useCallback, useEffect, useState } from 'react';

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
    if (!cultivatorId || !autoRefresh || refreshInterval <= 0) return;

    const timer = window.setInterval(refresh, refreshInterval);
    return () => {
      window.clearInterval(timer);
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
