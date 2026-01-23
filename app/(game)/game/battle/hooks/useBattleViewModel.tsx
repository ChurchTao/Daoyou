'use client';

import type { BattleEngineResult } from '@/engine/battle';
import { useCultivator } from '@/lib/contexts/CultivatorContext';
import type { Cultivator } from '@/types/cultivator';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

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
  battleResult?: BattleEngineResult;

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
  const searchParams = useSearchParams();
  const { cultivator } = useCultivator();

  const [player, setPlayer] = useState<Cultivator | null>(null);
  const [opponent, setOpponent] = useState<EnemyData | null>(null);
  const [battleResult, setBattleResult] = useState<BattleEngineResult>();
  const [streamingReport, setStreamingReport] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
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

  // 执行战斗 - 使用 ref 延迟读取，依赖为空数组
  const handleBattle = useCallback(
    async (pId?: string, oId?: string) => {
      // 延迟读取 ref 中的最新值
      const currentPid = pId || playerRef.current?.id;
      const currentOid = oId || opponentRef.current?.id;

      if (!currentPid || !currentOid) return;

      setLoading(true);
      setIsStreaming(true);
      setStreamingReport('');
      setBattleResult(undefined);

      try {
        const response = await fetch('/api/battle', {
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

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        if (!reader) throw new Error('无法读取响应流');

        let fullReport = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === 'battle_result') {
                  const result = data.data;
                  setBattleResult({
                    winner: result.winner,
                    loser: result.loser,
                    log: result.log,
                    turns: result.turns,
                    playerHp: result.playerHp,
                    opponentHp: result.opponentHp,
                    timeline: result.timeline ?? [],
                    player: result.player,
                    opponent: result.opponent,
                  });
                  const playerId = result.player;
                  const isPlayerWin = result.winner.id === playerId;
                  const playerInfo = isPlayerWin ? result.winner : result.loser;
                  const opponentInfo = isPlayerWin
                    ? result.loser
                    : result.winner;
                  setPlayer(playerInfo);
                  setOpponent(opponentInfo);
                } else if (data.type === 'chunk') {
                  fullReport += data.content;
                  setStreamingReport(fullReport);
                } else if (data.type === 'done') {
                  setIsStreaming(false);
                  setStreamingReport(fullReport);
                  setBattleEnd(true);
                } else if (data.type === 'error') {
                  throw new Error(data.error || '战斗失败');
                }
              } catch (e) {
                console.error('解析 SSE 数据失败:', e);
              }
            }
          }
        }
      } catch (error) {
        console.error('战斗失败:', error);
        setIsStreaming(false);
        setStreamingReport('');
        alert(error instanceof Error ? error.message : '战斗失败');
      } finally {
        setLoading(false);
      }
    },
    [], // 空依赖数组，使用 ref 延迟读取
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
    setBattleResult(undefined);
    setStreamingReport('');
    setIsStreaming(false);
    handleBattle();
  }, [handleBattle]);

  const isWin = battleResult?.winner.id === player?.id;
  const displayReport = streamingReport;
  const opponentName = opponent?.name ?? '神秘对手';

  return {
    player,
    opponent,
    battleResult,
    streamingReport,
    isStreaming,
    loading,
    battleEnd,
    isWin,
    displayReport,
    opponentName,
    handleBattleAgain,
  };
}
