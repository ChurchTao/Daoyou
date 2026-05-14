import type { ResourceOperation } from '@shared/engine/resource/types';
import type { BattleRecord } from '@shared/types/battle';
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

      const res = await fetch('/api/dungeon/battle/execute/v5', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ battleId }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || '战斗异常中断');
      }

      const data = await res.json();
      const result = data.battleResult as BattleRecord;
      
      setBattleResult(result);
      setBattleEnd(true);
      
      return { battleResult: result, callbackData: data.callbackData as BattleCallbackData };
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
