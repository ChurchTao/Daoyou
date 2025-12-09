'use client';

import { BattlePageLayout } from '@/components/BattlePageLayout';
import { BattleReportViewer } from '@/components/BattleReportViewer';
import { BattleTimelineViewer } from '@/components/BattleTimelineViewer';
import type { BattleEngineResult } from '@/engine/battleEngine';
import type { Cultivator } from '@/types/cultivator';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

/**
 * 敌人数据类型（简化版）
 */
type EnemyData = {
  id: string;
  name: string;
  realm: string;
  realm_stage: string;
  spiritual_roots: Array<{ element: string; strength: number }>;
  background?: string;
  combatRating: number;
};

/**
 * 对战播报页内容组件
 */
function BattlePageContent() {
  const searchParams = useSearchParams();
  const [player, setPlayer] = useState<Cultivator | null>(null);
  const [opponent, setOpponent] = useState<EnemyData | null>(null);
  const [battleResult, setBattleResult] = useState<BattleEngineResult>();
  const [streamingReport, setStreamingReport] = useState<string>('');
  const [finalReport, setFinalReport] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [opponentLoading, setOpponentLoading] = useState(false);
  const [opponentError, setOpponentError] = useState<string>();

  // 初始化
  useEffect(() => {
    // 获取玩家角色
    const fetchPlayer = async () => {
      setPlayerLoading(true);
      try {
        const playerResponse = await fetch('/api/cultivators');
        const playerResult = await playerResponse.json();

        if (playerResult.success && playerResult.data.length > 0) {
          setPlayer(playerResult.data[0]);
        }
      } catch (error) {
        console.error('获取玩家数据失败:', error);
      } finally {
        setPlayerLoading(false);
      }
    };

    // 获取对手角色
    const fetchOpponent = async () => {
      setOpponentLoading(true);
      setOpponentError(undefined);
      try {
        const opponentId = searchParams.get('opponent');
        if (!opponentId) {
          throw new Error('missing_opponent');
        }

        // 从敌人API获取对手数据
        const enemyResponse = await fetch(`/api/enemies/${opponentId}`);
        const enemyResult = await enemyResponse.json();

        if (!enemyResponse.ok || !enemyResult.success) {
          throw new Error(enemyResult.error || 'fetch_failed');
        }

        setOpponent(enemyResult.data);
      } catch (error) {
        console.error('获取对手数据失败:', error);
        const errMsg =
          error instanceof Error && error.message === 'missing_opponent'
            ? '天机未定，对手无踪，难启杀局。'
            : '天机逆乱，对手行迹莫测，战不可开。';
        setOpponentError(errMsg);
        setOpponent(null);
      } finally {
        setOpponentLoading(false);
      }
    };

    fetchPlayer();
    fetchOpponent();
  }, [searchParams]);

  // 自动开始战斗
  useEffect(() => {
    if (
      player &&
      opponent &&
      !battleResult &&
      !loading &&
      !playerLoading &&
      !opponentLoading &&
      !opponentError
    ) {
      handleBattle();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    player,
    opponent,
    battleResult,
    loading,
    playerLoading,
    opponentLoading,
    opponentError,
  ]);

  // 执行战斗（使用合并接口）
  const handleBattle = async () => {
    if (!player || !opponent) {
      return;
    }

    setLoading(true);
    setIsStreaming(true);
    setStreamingReport('');
    setFinalReport('');
    setBattleResult(undefined);

    try {
      // 调用合并的战斗接口（执行战斗并生成播报）
      const response = await fetch('/api/battle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cultivatorId: player.id,
          opponentId: opponent.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '战斗失败');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (!reader) {
        throw new Error('无法读取响应流');
      }

      let fullReport = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'battle_result') {
                // 接收战斗结果数据
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
                console.log('战斗结果：', result);
              } else if (data.type === 'chunk') {
                // 接收播报内容块
                fullReport += data.content;
                setStreamingReport(fullReport);
              } else if (data.type === 'done') {
                // 播报生成完成
                setIsStreaming(false);
                setFinalReport(fullReport);
                setStreamingReport(fullReport);
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
      setFinalReport('');
      alert(error instanceof Error ? error.message : '战斗失败');
    } finally {
      setLoading(false);
    }
  };

  // 再战一次
  const handleBattleAgain = () => {
    setBattleResult(undefined);
    setStreamingReport('');
    setFinalReport('');
    setIsStreaming(false);
    handleBattle();
  };

  if (!player) {
    return (
      <div className="bg-paper min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-ink">未找到角色信息</p>
          <Link href="/create" className="btn-primary">
            创建角色
          </Link>
        </div>
      </div>
    );
  }

  const isWin = battleResult?.winner.id === player.id;
  const displayReport =
    streamingReport ||
    finalReport ||
    (battleResult ? `${battleResult.winner.name} 获胜！` : '');
  const opponentName = opponent?.name ?? '未知对手';

  return (
    <BattlePageLayout
      title={`【战报 · ${player?.name} vs ${opponentName}】`}
      backHref="/"
      error={opponentError}
      loading={loading}
      battleResult={battleResult}
      isStreaming={isStreaming}
      actions={{
        primary: {
          label: '返回主界',
          href: '/',
        },
        secondary: [
          {
            label: '再战',
            onClick: handleBattleAgain,
          },
          {
            label: '分享战报',
            onClick: () => {
              alert('分享功能开发中...');
            },
          },
        ],
      }}
    >
      {/* 数值战斗回放 */}
      {battleResult?.timeline &&
        battleResult.timeline.length > 0 &&
        opponent && (
          <BattleTimelineViewer
            battleResult={battleResult}
            playerName={player.name}
            opponentName={opponent.name}
          />
        )}

      {/* 战斗播报 */}
      <BattleReportViewer
        displayReport={displayReport}
        isStreaming={isStreaming}
        battleResult={battleResult}
        player={player}
        isWin={isWin}
      />
    </BattlePageLayout>
  );
}

/**
 * 对战播报页
 * 目标：制造爽感 + 可分享
 */
export default function BattlePage() {
  return (
    <Suspense
      fallback={
        <div className="bg-paper min-h-screen flex items-center justify-center">
          <div className="text-center">
            <p className="text-ink">加载中...</p>
          </div>
        </div>
      }
    >
      <BattlePageContent />
    </Suspense>
  );
}
