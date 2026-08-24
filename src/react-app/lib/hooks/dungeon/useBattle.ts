import { consumeResourceMutation } from '@app/lib/resources/mutations';
import type { ResourceOperation } from '@shared/engine/resource/types';
import type { DungeonBattlePlan } from '@shared/lib/dungeon/battlePlan';
import {
  DungeonRound,
  DungeonSettlement,
  DungeonState,
} from '@shared/lib/dungeon/types';
import type { BattleRecordV3 } from '@shared/types/battle';
import { useCallback, useState } from 'react';

interface BattleCallbackData {
  isFinished: boolean;
  settlement?: DungeonSettlement;
  realGains?: ResourceOperation[];
  dungeonState?: DungeonState;
  roundData?: DungeonRound;
}

type BattleExecutionResult = {
  battleResult?: BattleRecordV3;
  callbackData: BattleCallbackData | null;
};

interface BattleExecutionInput {
  battleId: string;
  battlePlan: DungeonBattlePlan;
}

const battleExecutionRequests = new Map<string, Promise<BattleExecutionResult>>();
const battleExecutionResults = new Map<string, BattleExecutionResult>();
const battleExecutionRequestIds = new Map<string, string>();

function getBattleExecutionRequestId(battleId: string) {
  const existing = battleExecutionRequestIds.get(battleId);
  if (existing) return existing;
  const requestId =
    globalThis.crypto?.randomUUID?.() ?? `${battleId}-${Date.now()}`;
  battleExecutionRequestIds.set(battleId, requestId);
  return requestId;
}

/**
 * 战斗逻辑Hook (v5)
 * 负责处理副本中的战斗执行
 */
export function useBattle() {
  const [battleResult, setBattleResult] = useState<BattleRecordV3>();
  const [battleEnd, setBattleEnd] = useState(false);
  const [loading, setLoading] = useState(false);

  /**
   * 执行战斗 (JSON)
   */
  const executeBattle = useCallback(async ({
    battleId,
    battlePlan,
  }: BattleExecutionInput) => {
    try {
      setLoading(true);
      setBattleEnd(false);
      setBattleResult(undefined);

      const cached = battleExecutionResults.get(battleId);
      const execution =
        cached ??
        (await (() => {
          const inFlight = battleExecutionRequests.get(battleId);
          if (inFlight) return inFlight;

          const request = (async (): Promise<BattleExecutionResult> => {
            const res = await fetch('/api/dungeon/battle/execute/v5', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                battleId,
                battlePlan,
                requestId: getBattleExecutionRequestId(battleId),
              }),
            });

            if (!res.ok) {
              const errorData = await res.json();
              throw new Error(errorData.error || '战斗异常中断');
            }

            const data = await consumeResourceMutation<BattleExecutionResult>(
              res,
            );
            const result = {
              battleResult: data.battleResult as BattleRecordV3,
              callbackData: data.callbackData as BattleCallbackData,
            };

            battleExecutionResults.set(battleId, result);
            return result;
          })().finally(() => {
            battleExecutionRequests.delete(battleId);
          });

          battleExecutionRequests.set(battleId, request);
          return request;
        })());

      setBattleResult(execution.battleResult);
      setBattleEnd(true);

      return execution;
    } catch (error) {
      console.error('[useBattle] Error:', error);
      setBattleEnd(true);
      return { battleResult: undefined, callbackData: null };
    } finally {
      setLoading(false);
    }
  }, []);

  const resetBattle = useCallback(() => {
    setBattleResult(undefined);
    setBattleEnd(false);
    setLoading(false);
  }, []);

  return {
    battleResult,
    battleEnd,
    loading,
    executeBattle,
    resetBattle,
  };
}
