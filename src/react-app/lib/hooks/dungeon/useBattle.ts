import type { ResourceOperation } from '@shared/engine/resource/types';
import type { BattleRecord } from '@shared/types/battle';
import { consumePlayerStateMeta } from '@app/lib/player-state/store';
import {
  DungeonRound,
  DungeonSettlement,
  DungeonState,
} from '@shared/lib/dungeon/types';
import { useState, useCallback } from 'react';

interface BattleCallbackData {
  isFinished: boolean;
  settlement?: DungeonSettlement;
  realGains?: ResourceOperation[];
  dungeonState?: DungeonState;
  roundData?: DungeonRound;
}

type BattleExecutionResult = {
  battleResult?: BattleRecord;
  callbackData: BattleCallbackData | null;
};

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
  const [battleResult, setBattleResult] = useState<BattleRecord>();
  const [battleEnd, setBattleEnd] = useState(false);
  const [loading, setLoading] = useState(false);

  /**
   * 执行战斗 (JSON)
   */
  const executeBattle = useCallback(async (battleId: string) => {
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
                requestId: getBattleExecutionRequestId(battleId),
              }),
            });

            if (!res.ok) {
              const errorData = await res.json();
              throw new Error(errorData.error || '战斗异常中断');
            }

            const raw = await res.json();
            const data = raw.success ? raw.data : raw;
            const result = {
              battleResult: data.battleResult as BattleRecord,
              callbackData: data.callbackData as BattleCallbackData,
            };

            if (raw.success && raw.state) {
              void consumePlayerStateMeta(raw.state, {
                deferRecovery: true,
              });
            }

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
