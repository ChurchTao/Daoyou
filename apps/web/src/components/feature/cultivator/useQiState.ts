import { useCultivatorCurrency } from '@app/lib/resources/player';
import {
  getEstimatedServerNowMs,
  useRecoveryClock,
} from '@app/lib/resources/recoveryClock';
import { QI_MAX } from '@daoyou/shared/config/qiSystem';
import type { QiState } from '@daoyou/shared/contracts/qi';
import {
  projectNaturalQiState,
  type NaturalQiProjection,
  type QiRecoveryStatus,
} from '@daoyou/shared/lib/qi';

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

function toQiState(projection: NaturalQiProjection): QiStateWithRecovery {
  return {
    current: projection.current,
    max: projection.max,
    recovery: {
      status: projection.recovery.status,
      nextRestoreAt: projection.recovery.nextRestoreAt?.toISOString() ?? null,
      fullRestoreAt: projection.recovery.fullRestoreAt?.toISOString() ?? null,
      nextRestoreInMs: projection.recovery.nextRestoreInMs,
      fullRestoreInMs: projection.recovery.fullRestoreInMs,
    },
  };
}

export function useQiState({ cultivatorId }: { cultivatorId: string }) {
  const currencyResource = useCultivatorCurrency(Boolean(cultivatorId));
  const currency = currencyResource.data;
  const storeLoading = currencyResource.loading;
  const storeError = currencyResource.error;
  const estimatedNowMs = getEstimatedServerNowMs();
  const initialProjection =
    cultivatorId && currency
      ? projectNaturalQiState({
          qi: currency.qi,
          qiLastRefreshedAt: currency.qiLastRefreshedAt,
          now: new Date(estimatedNowMs),
        })
      : null;
  const shouldTick = initialProjection?.recovery.status === 'recovering';
  const nowMs = useRecoveryClock(
    shouldTick,
    initialProjection?.recovery.nextRestoreAt?.getTime() ?? null,
  );

  const state: QiStateWithRecovery | null =
    cultivatorId && currency
      ? toQiState(
          projectNaturalQiState({
            qi: currency.qi,
            qiLastRefreshedAt: currency.qiLastRefreshedAt,
            now: new Date(nowMs),
            max: QI_MAX,
          }),
        )
      : null;

  return {
    state,
    loading: cultivatorId ? storeLoading : false,
    error: cultivatorId ? storeError : null,
  };
}
