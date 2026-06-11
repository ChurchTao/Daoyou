import { usePlayerState, usePlayerStateActions } from '@app/lib/player-state/store';
import {
  QI_MAX,
  QI_NATURAL_RESTORE_PER_HOUR,
} from '@shared/config/qiSystem';
import type { QiState } from '@shared/contracts/qi';
import { useCallback, useEffect, useState } from 'react';

const QI_NATURAL_RESTORE_INTERVAL_MS = 60 * 60 * 1000;

export type QiRecoveryStatus =
  | 'recovering'
  | 'full'
  | 'overflow'
  | 'unknown';

export interface QiRecoveryInfo {
  status: QiRecoveryStatus;
  nextRestoreAt: string | null;
  fullRestoreAt: string | null;
  nextRestoreInMs: number | null;
  fullRestoreInMs: number | null;
}

export type QiStateWithRecovery = QiState & {
  recovery: QiRecoveryInfo;
};

export function deriveQiState(input: {
  current: number;
  max?: number;
  qiLastRefreshedAt?: string | null;
  nowMs?: number;
}): QiStateWithRecovery {
  const max = input.max ?? QI_MAX;
  const nowMs = input.nowMs ?? Date.now();
  const current = Math.max(0, Math.floor(input.current));

  if (current >= max) {
    return {
      current,
      max,
      recovery: {
        status: current > max ? 'overflow' : 'full',
        nextRestoreAt: null,
        fullRestoreAt: null,
        nextRestoreInMs: null,
        fullRestoreInMs: null,
      },
    };
  }

  const baseMs =
    input.qiLastRefreshedAt === null || input.qiLastRefreshedAt === undefined
      ? Number.NaN
      : Date.parse(input.qiLastRefreshedAt);
  if (!Number.isFinite(baseMs)) {
    return {
      current,
      max,
      recovery: {
        status: 'unknown',
        nextRestoreAt: null,
        fullRestoreAt: null,
        nextRestoreInMs: null,
        fullRestoreInMs: null,
      },
    };
  }

  const elapsedHours = Math.floor(
    Math.max(0, nowMs - baseMs) / QI_NATURAL_RESTORE_INTERVAL_MS,
  );
  const settledCurrent = Math.min(
    max,
    current + elapsedHours * QI_NATURAL_RESTORE_PER_HOUR,
  );
  if (settledCurrent >= max) {
    return {
      current: settledCurrent,
      max,
      recovery: {
        status: 'full',
        nextRestoreAt: null,
        fullRestoreAt: null,
        nextRestoreInMs: null,
        fullRestoreInMs: null,
      },
    };
  }

  const settledBaseMs =
    baseMs + elapsedHours * QI_NATURAL_RESTORE_INTERVAL_MS;
  const nextRestoreMs = settledBaseMs + QI_NATURAL_RESTORE_INTERVAL_MS;
  const hoursToFull = Math.ceil(
    (max - settledCurrent) / QI_NATURAL_RESTORE_PER_HOUR,
  );
  const fullRestoreMs =
    settledBaseMs + hoursToFull * QI_NATURAL_RESTORE_INTERVAL_MS;

  return {
    current: settledCurrent,
    max,
    recovery: {
      status: 'recovering',
      nextRestoreAt: new Date(nextRestoreMs).toISOString(),
      fullRestoreAt: new Date(fullRestoreMs).toISOString(),
      nextRestoreInMs: Math.max(0, nextRestoreMs - nowMs),
      fullRestoreInMs: Math.max(0, fullRestoreMs - nowMs),
    },
  };
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
  const [nowMs, setNowMs] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    if (!cultivatorId) return;
    setRefreshing(true);
    try {
      await refreshPlayerState(['currency']);
    } finally {
      setNowMs(Date.now());
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

  const state: QiStateWithRecovery | null =
    cultivatorId && currency
      ? deriveQiState({
          current: currency.qi,
          max: QI_MAX,
          qiLastRefreshedAt: currency.qiLastRefreshedAt,
          nowMs,
        })
      : null;

  return {
    state,
    loading: cultivatorId ? storeLoading || refreshing : false,
    error: cultivatorId ? storeError : null,
    refresh,
  };
}
