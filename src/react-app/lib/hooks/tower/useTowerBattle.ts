import { useInkUI } from '@app/components/providers/InkUIProvider';
import { consumePlayerStateMutation } from '@app/lib/player-state/store';
import type { PlayerStateMutationResponse } from '@shared/contracts/player';
import type {
  TowerMilestoneReward,
  TowerSettlement,
  TowerState,
} from '@shared/lib/tower';
import type { BattleRecord } from '@shared/types/battle';
import { useCallback, useState } from 'react';

export interface TowerBattleCallbackData {
  towerState: TowerState;
  isFinished: boolean;
  settlement?: TowerSettlement;
  milestoneReward?: TowerMilestoneReward;
}

type TowerBattlePayload = {
  battleResult?: BattleRecord;
  callbackData?: TowerBattleCallbackData;
};

function isTowerBattleMutationResponse(
  value: unknown,
): value is PlayerStateMutationResponse<TowerBattlePayload> {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value as { success?: unknown }).success === true &&
      (value as { state?: unknown }).state,
  );
}

export function useTowerBattle() {
  const { pushToast } = useInkUI();
  const [battleResult, setBattleResult] = useState<BattleRecord>();
  const [loading, setLoading] = useState(false);

  const executeBattle = useCallback(
    async (battleId: string) => {
      try {
        setLoading(true);
        setBattleResult(undefined);

        const response = await fetch('/api/tower/battle/execute/v5', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ battleId }),
        });
        const raw = (await response.json()) as {
          success?: boolean;
          data?: {
            battleResult?: BattleRecord;
            callbackData?: TowerBattleCallbackData;
          };
          state?: unknown;
          error?: string;
          battleResult?: BattleRecord;
          callbackData?: TowerBattleCallbackData;
        };
        const data: {
          error?: string;
          battleResult?: BattleRecord;
          callbackData?: TowerBattleCallbackData;
        } = isTowerBattleMutationResponse(raw)
          ? await consumePlayerStateMutation<TowerBattlePayload>(raw)
          : raw.success
            ? (raw.data ?? {})
            : raw;

        if (!response.ok || data.error || !data.battleResult || !data.callbackData) {
          throw new Error(data.error || '幻境战局异常中断');
        }

        setBattleResult(data.battleResult);
        return {
          battleResult: data.battleResult,
          callbackData: data.callbackData,
        };
      } catch (error) {
        pushToast({
          message: error instanceof Error ? error.message : '幻境战局异常中断',
          tone: 'danger',
        });
        return null;
      } finally {
        setLoading(false);
      }
    },
    [pushToast],
  );

  return {
    battleResult,
    loading,
    executeBattle,
  };
}
