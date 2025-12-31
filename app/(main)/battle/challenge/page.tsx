'use client';

import { BattlePageLayout } from '@/components/feature/battle/BattlePageLayout';
import { BattleReportViewer } from '@/components/feature/battle/BattleReportViewer';
import { BattleTimelineViewer } from '@/components/feature/battle/BattleTimelineViewer';
import { InkButton } from '@/components/ui';
import type { BattleEngineResult } from '@/engine/battle';
import type { Cultivator } from '@/types/cultivator';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

/**
 * 挑战战斗播报页内容组件
 */
function ChallengeBattlePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [player, setPlayer] = useState<Cultivator | null>(null);
  const [opponent, setOpponent] = useState<Cultivator | null>(null);
  const [battleResult, setBattleResult] = useState<BattleEngineResult>();
  const [streamingReport, setStreamingReport] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [rankingUpdate, setRankingUpdate] = useState<{
    isWin: boolean;
    challengerRank: number | null;
    targetRank: number | null;
    remainingChallenges: number;
  } | null>(null);
  const [directEntry, setDirectEntry] = useState<{
    rank: number;
  } | null>(null);
  const [battleEnd, setBattleEnd] = useState(false);

  // 防止 React Strict Mode 重复调用战斗 API
  const hasBattleStarted = useRef(false);

  const targetId = searchParams.get('targetId');

  // 初始化 & 自动开始战斗
  useEffect(() => {
    // 防止重复调用
    if (hasBattleStarted.current) return;

    // 并行执行：获取玩家信息 和 开始战斗
    const init = async () => {
      // 2. 自动开始战斗
      const startBattlePromise = async () => {
        hasBattleStarted.current = true;
        await handleChallengeBattle();
      };

      await startBattlePromise();
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 执行挑战战斗
  const handleChallengeBattle = async () => {
    setLoading(true);
    setIsStreaming(true);
    setStreamingReport('');
    setBattleResult(undefined);
    setError(undefined);

    try {
      // 调用挑战战斗接口
      const response = await fetch('/api/rankings/challenge-battle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetId: targetId || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '挑战失败');
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

              if (data.type === 'direct_entry') {
                // 直接上榜
                setDirectEntry({ rank: data.rank });
                setIsStreaming(false);
              } else if (data.type === 'battle_result') {
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
                  player: result.player,
                  opponent: result.opponent,
                });

                const isPlayerWin = result.winner.id === result.player;
                const playerInfo = isPlayerWin ? result.winner : result.loser;
                const opponentInfo = isPlayerWin ? result.loser : result.winner;
                setPlayer(playerInfo);
                setOpponent(opponentInfo);
              } else if (data.type === 'chunk') {
                // 接收播报内容块
                fullReport += data.content;
                setStreamingReport(fullReport);
              } else if (data.type === 'ranking_update') {
                // 接收排名更新信息
                setRankingUpdate(data);
              } else if (data.type === 'done') {
                // 播报生成完成
                setIsStreaming(false);
                setStreamingReport(fullReport);
                setBattleEnd(true);
              } else if (data.type === 'error') {
                throw new Error(data.error || '挑战失败');
              }
            } catch (e) {
              console.error('解析 SSE 数据失败:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('挑战战斗失败:', error);
      setIsStreaming(false);
      setStreamingReport('');
      setError(error instanceof Error ? error.message : '挑战失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="bg-paper min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-crimson">{error}</p>
          <InkButton onClick={() => router.push('/rankings')}>
            返回排行榜
          </InkButton>
        </div>
      </div>
    );
  }

  if (directEntry) {
    return (
      <div className="bg-paper min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="mb-4 font-ma-shan-zheng text-2xl text-ink">
            成功上榜！
          </h1>
          <p className="mb-6 text-ink">
            你已占据万界金榜第 {directEntry.rank} 名
          </p>
          <InkButton onClick={() => router.push('/rankings')} variant="primary">
            返回排行榜
          </InkButton>
        </div>
      </div>
    );
  }

  const isWin = battleResult?.winner.id === player?.id;
  const displayReport = streamingReport;
  const opponentName = opponent?.name ?? '神秘对手';

  return (
    <BattlePageLayout
      title={`【挑战战报 · ${!player ? '加载中' : `${player?.name} vs ${opponentName}`}】`}
      backHref="/rankings"
      backLabel="返回排行榜"
      error={error}
      loading={loading}
      battleResult={battleResult}
      isStreaming={isStreaming}
      actions={{
        primary: {
          label: '返回排行榜',
          onClick: () => router.push('/rankings'),
        },
      }}
    >
      {/* 数值战斗回放 */}
      {battleResult?.timeline &&
        battleResult.timeline.length > 0 &&
        opponent &&
        player &&
        (isStreaming || battleEnd) && (
          <BattleTimelineViewer battleResult={battleResult} />
        )}

      {/* 战斗播报 */}
      <BattleReportViewer
        displayReport={displayReport}
        isStreaming={isStreaming}
        battleResult={battleResult}
        player={player}
        isWin={isWin}
        rankingUpdate={rankingUpdate}
      />
    </BattlePageLayout>
  );
}

/**
 * 挑战战斗播报页
 */
export default function ChallengeBattlePage() {
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
      <ChallengeBattlePageContent />
    </Suspense>
  );
}
