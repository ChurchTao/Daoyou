import { useInkUI } from '@app/components/providers/InkUIProvider';
import type { ResourceOperation } from '@shared/engine/resource/types';
import type { DungeonSettlement } from '@shared/lib/dungeon/types';
import { Cultivator } from '@shared/types/cultivator';
import { useRef, useState } from 'react';

export interface DungeonAbandonBattleResult {
  isFinished: boolean;
  settlement?: DungeonSettlement;
  realGains?: ResourceOperation[];
}

/**
 * 敌人查探Hook
 * 负责查探敌人数据
 */
export function useEnemyProbe(battleId: string) {
  const { pushToast } = useInkUI();
  const [enemyState, setEnemyState] = useState<{
    battleId: string;
    enemy: Cultivator | null;
  }>({
    battleId: '',
    enemy: null,
  });
  const [isProbing, setIsProbing] = useState(false);
  const probingRef = useRef(false); // 防止重复请求的标记
  const enemy = enemyState.battleId === battleId ? enemyState.enemy : null;

  /**
   * 查探敌人
   */
  const probeEnemy = async () => {
    if (enemy) {
      // 已经查探过
      return enemy;
    }

    // 如果正在请求中，直接返回
    if (probingRef.current) {
      return null;
    }

    try {
      probingRef.current = true;
      setIsProbing(true);
      const res = await fetch(`/api/dungeon/battle/probe?battleId=${battleId}`);
      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setEnemyState({ battleId, enemy: data.enemy });
      return data.enemy;
    } catch (e) {
      pushToast({
        message: e instanceof Error ? e.message : '查探失败',
        tone: 'danger',
      });
      return null;
    } finally {
      setIsProbing(false);
      probingRef.current = false;
    }
  };

  /**
   * 放弃战斗
   */
  const abandonBattle = async () => {
    try {
      const res = await fetch('/api/dungeon/battle/abandon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          battleId,
        }),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      pushToast({ message: '已放弃战斗', tone: 'success' });
      return data as DungeonAbandonBattleResult;
    } catch (e) {
      pushToast({
        message: e instanceof Error ? e.message : '操作失败',
        tone: 'danger',
      });
      return null;
    }
  };

  return {
    enemy,
    isProbing,
    probeEnemy,
    abandonBattle,
  };
}
