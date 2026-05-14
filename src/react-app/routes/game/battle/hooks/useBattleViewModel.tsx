import { useCultivator } from '@app/lib/contexts/CultivatorContext';
import type { BattleRecord } from '@shared/types/battle';
import type { Cultivator } from '@shared/types/cultivator';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';


/**
 * 敌人数据类型（简化版）
 */
export type EnemyData = {
  id: string;
  name: string;
  realm: string;
  realm_stage: string;
  spiritual_roots: Array<{ element: string; strength: number }>;
  background?: string;
  combatRating: number;
};

export interface UseBattleViewModelReturn {
  // 数据
  player: Cultivator | null;
  opponent: EnemyData | null;
  battleResult?: BattleRecord;

  // 状态
  streamingReport: string;
  isStreaming: boolean;
  loading: boolean;
  battleEnd: boolean;

  // 计算属性
  isWin: boolean;
  displayReport: string;
  opponentName: string;

  // 操作
  handleBattleAgain: () => void;
}

/**
 * 战斗页面 ViewModel
 */
export function useBattleViewModel(): UseBattleViewModelReturn {
  const [searchParams] = useSearchParams();
  const { cultivator } = useCultivator();

  const [player, setPlayer] = useState<Cultivator | null>(null);
  const [opponent, setOpponent] = useState<EnemyData | null>(null);
  const [battleResult, setBattleResult] = useState<BattleRecord>();
  const [loading, setLoading] = useState(false);
  const [battleEnd, setBattleEnd] = useState(false);

  // 使用 ref 来跟踪最新的 player 和 opponent，避免依赖变化
  const playerRef = useRef(player);
  const opponentRef = useRef(opponent);

  // 同步 ref 值
  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  useEffect(() => {
    opponentRef.current = opponent;
  }, [opponent]);

  // 执行战斗
  const handleBattle = useCallback(
    async (pId?: string, oId?: string) => {
      const currentPid = pId || playerRef.current?.id;
      const currentOid = oId || opponentRef.current?.id;

      if (!currentPid || !currentOid) return;

      setLoading(true);
      setBattleResult(undefined);
      setBattleEnd(false);

      try {
        const response = await fetch('/api/battle/v5', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            opponentId: currentOid,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || '战斗失败');
        }

        const result = (await response.json()) as BattleRecord;
        setBattleResult(result);

        // 更新角色快照信息
        const playerId = result.player;
        const isPlayerWin = result.winner.id === playerId;
        const playerInfo = isPlayerWin ? result.winner : result.loser;
        const opponentInfo = isPlayerWin ? result.loser : result.winner;

        setPlayer(playerInfo);
        setOpponent({
          id: opponentInfo.id ?? '',
          name: opponentInfo.name,
          realm: opponentInfo.realm,
          realm_stage: opponentInfo.realm_stage,
          spiritual_roots: opponentInfo.spiritual_roots ?? [],
          background: opponentInfo.background,
          combatRating: 0,
        });

        setBattleEnd(true);
      } catch (error) {
        console.error('战斗失败:', error);
        alert(error instanceof Error ? error.message : '战斗失败');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // 初始化 & 自动开始战斗
  useEffect(() => {
    const opponentId = searchParams.get('opponent');

    const init = async () => {
      if (!cultivator || !opponentId) return;
      handleBattle(cultivator.id, opponentId);
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // 再战一次
  const handleBattleAgain = useCallback(() => {
    handleBattle();
  }, [handleBattle]);

  const isWin = battleResult?.winner.id === player?.id;
  const displayReport = ''; // 不再使用 streamingReport
  const opponentName = opponent?.name ?? '神秘对手';

  return {
    player,
    opponent,
    battleResult,
    streamingReport: '',
    isStreaming: false,
    loading,
    battleEnd,
    isWin,
    displayReport,
    opponentName,
    handleBattleAgain,
  };
}
