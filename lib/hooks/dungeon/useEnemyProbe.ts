import { useInkUI } from '@/components/providers/InkUIProvider';
import { Cultivator } from '@/types/cultivator';
import { useEffect, useRef, useState } from 'react';

/**
 * 敌人查探Hook
 * 负责查探敌人数据
 */
export function useEnemyProbe(battleId: string) {
  const { pushToast } = useInkUI();
  const [enemy, setEnemy] = useState<Cultivator | null>(null);
  const [isProbing, setIsProbing] = useState(false);
  const probingRef = useRef(false); // 防止重复请求的标记

  // battleId变化时重置状态
  useEffect(() => {
    setEnemy(null);
    probingRef.current = false;
  }, [battleId]);

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

      setEnemy(data.enemy);
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
      return data;
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
