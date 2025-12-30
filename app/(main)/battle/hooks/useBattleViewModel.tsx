'use client';

import type { BattleEngineResult } from '@/engine/battle';
import type { Cultivator } from '@/types/cultivator';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

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
  playerLoading: boolean;
  opponentLoading: boolean;
  opponentError?: string;
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

  const [player, setPlayer] = useState<Cultivator | null>(null);
  const [opponent, setOpponent] = useState<EnemyData | null>(null);
  const [battleResult, setBattleResult] = useState<BattleEngineResult>();
  const [streamingReport, setStreamingReport] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [opponentLoading, setOpponentLoading] = useState(false);
  const [opponentError, setOpponentError] = useState<string>();
  const [battleEnd, setBattleEnd] = useState(false);

  // 执行战斗
  const handleBattle = useCallback(
    async (pId?: string, oId?: string) => {
      const currentPid = pId || player?.id;
      const currentOid = oId || opponent?.id;

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
            cultivatorId: currentPid,
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
                  });
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
    [player?.id, opponent?.id],
  );

  // 初始化 & 自动开始战斗
  useEffect(() => {
    const opponentId = searchParams.get('opponent');

    const init = async () => {
      const fetchPlayerData = async () => {
        setPlayerLoading(true);
        try {
          const res = await fetch('/api/cultivators');
          const json = await res.json();
          if (json.success && json.data.length > 0) {
            setPlayer(json.data[0]);
            return json.data[0];
          }
        } catch (e) {
          console.error('获取玩家数据失败', e);
        } finally {
          setPlayerLoading(false);
        }
        return null;
      };

      const fetchOpponentData = async () => {
        if (!opponentId) {
          setOpponentError('天机未定，对手无踪，难启杀局。');
          return null;
        }
        setOpponentLoading(true);
        setOpponentError(undefined);
        try {
          const res = await fetch(`/api/enemies/${opponentId}`);
          const json = await res.json();
          if (res.ok && json.success) {
            setOpponent(json.data);
            return json.data;
          } else {
            throw new Error(json.error || 'fetch_failed');
          }
        } catch (e) {
          console.error('获取对手数据失败', e);
          const errMsg =
            e instanceof Error && e.message === 'missing_opponent'
              ? '天机未定，对手无踪，难启杀局。'
              : '天机逆乱，对手行迹莫测，战不可开。';
          setOpponentError(errMsg);
        } finally {
          setOpponentLoading(false);
        }
        return null;
      };

      const [pData, oData] = await Promise.all([
        fetchPlayerData(),
        fetchOpponentData(),
      ]);

      if (pData && oData) {
        handleBattle(pData.id, oData.id);
      }
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
    playerLoading,
    opponentLoading,
    opponentError,
    battleEnd,
    isWin,
    displayReport,
    opponentName,
    handleBattleAgain,
  };
}
