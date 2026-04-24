'use client';

import { BattlePageLayout } from '@/components/feature/battle/BattlePageLayout';
import { CombatStatusHeader } from '@/components/feature/battle/v5/CombatStatusHeader';
import { CombatActionLog } from '@/components/feature/battle/v5/CombatActionLog';
import { CombatControlBar } from '@/components/feature/battle/v5/CombatControlBar';
import { InkButton } from '@/components/ui/InkButton';
import { useCombatPlayer } from '../hooks/useCombatPlayer';
import type { BattleRecord } from '@/lib/services/battleResult';
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
  const [battleResult, setBattleResult] = useState<BattleRecord>();
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

  // 播放器 Hook
  const {
    currentIndex,
    isPlaying,
    playbackSpeed,
    setPlaybackSpeed,
    play,
    pause,
    currentFrames,
    totalActions,
    progress,
  } = useCombatPlayer(battleResult);

  // 防止 React Strict Mode 重复调用战斗 API
  const hasBattleStarted = useRef(false);

  const targetId = searchParams.get('targetId');

  // 初始化 & 自动开始战斗
  useEffect(() => {
    if (hasBattleStarted.current) return;
    hasBattleStarted.current = true;
    handleChallengeBattle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 战斗数据到达后自动播放
  useEffect(() => {
    if (battleResult && totalActions > 0 && currentIndex === -1 && !isPlaying) {
      play();
    }
  }, [battleResult, totalActions, currentIndex, isPlaying, play]);

  // 执行挑战战斗
  const handleChallengeBattle = async () => {
    setLoading(true);
    setBattleResult(undefined);
    setError(undefined);

    try {
      const response = await fetch('/api/rankings/challenge-battle/v5', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetId: targetId || null }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '挑战失败');
      }

      const data = await response.json();

      if (data.type === 'direct_entry') {
        setDirectEntry({ rank: data.rank });
      } else if (data.type === 'battle_result') {
        const result = data.battleResult as BattleRecord;
        setBattleResult(result);
        setRankingUpdate(data.rankingUpdate);

        const isPlayerWin = result.winner.id === result.player;
        setPlayer(isPlayerWin ? result.winner : result.loser);
        setOpponent(isPlayerWin ? result.loser : result.winner);
        setBattleEnd(true);
      }
    } catch (error) {
      console.error('挑战战斗失败:', error);
      setError(error instanceof Error ? error.message : '挑战失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="bg-paper flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-crimson mb-4">{error}</p>
          <InkButton onClick={() => router.push('/game/rankings')}>
            返回排行榜
          </InkButton>
        </div>
      </div>
    );
  }

  if (directEntry) {
    return (
      <div className="bg-paper flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="font-ma-shan-zheng text-ink mb-4 text-2xl">成功上榜！</h1>
          <p className="text-ink mb-6">你已占据万界金榜第 {directEntry.rank} 名</p>
          <InkButton onClick={() => router.push('/game/rankings')} variant="primary">
            返回排行榜
          </InkButton>
        </div>
      </div>
    );
  }

  // 计算实时状态快照
  const playerUnitId = battleResult?.player;
  const opponentUnitId = battleResult?.opponent;
  const initialPlayerFrame = battleResult?.stateTimeline?.frames[0]?.units[playerUnitId || ''];
  const initialOpponentFrame = battleResult?.stateTimeline?.frames[0]?.units[opponentUnitId || ''];
  const currentPlayerFrame = currentFrames?.find(f => f.units[playerUnitId || ''])?.units[playerUnitId || ''] || initialPlayerFrame;
  const currentOpponentFrame = currentFrames?.find(f => f.units[opponentUnitId || ''])?.units[opponentUnitId || ''] || initialOpponentFrame;

  const isWin = rankingUpdate?.isWin;
  const opponentName = opponent?.name ?? '神秘对手';

  return (
    <BattlePageLayout
      title={`【挑战 · ${!player ? '加载中' : `${player?.name} vs ${opponentName}`}】`}
      backHref="/game/rankings"
      backLabel="返回排行榜"
      error={error}
      loading={loading}
      battleResult={battleResult}
      isStreaming={false}
      actions={{
        primary: {
          label: '返回排行榜',
          onClick: () => router.push('/game/rankings'),
        },
      }}
    >
      <div className="flex flex-col gap-4 mb-8">
        {/* 状态栏 */}
        {currentPlayerFrame && currentOpponentFrame && (
          <CombatStatusHeader player={currentPlayerFrame} opponent={currentOpponentFrame} />
        )}

        {/* 战报日志 */}
        {battleResult && (
          <CombatActionLog spans={battleResult.logSpans} currentIndex={currentIndex} />
        )}

        {/* 控制栏 */}
        {battleResult && (
          <CombatControlBar 
            isPlaying={isPlaying}
            playbackSpeed={playbackSpeed}
            progress={progress}
            onToggle={() => isPlaying ? pause() : play()}
            onSpeedChange={setPlaybackSpeed}
          />
        )}
      </div>

      {/* 结算结果 */}
      {battleEnd && currentIndex >= totalActions - 1 && (
        <div className="mt-4 p-4 border border-crimson/30 bg-crimson/5 rounded-sm text-center animate-fade-in">
          <p className="text-crimson text-xl font-heading mb-2">
            {isWin ? '挑战成功！' : '挑战失败'}
          </p>
          {rankingUpdate && (
            <div className="text-ink/80 text-sm space-y-1">
              {isWin && rankingUpdate.challengerRank && (
                <p>你的排名已更新为第 {rankingUpdate.challengerRank} 名</p>
              )}
              <p className="text-xs opacity-60">今日剩余挑战次数：{rankingUpdate.remainingChallenges}/10</p>
            </div>
          )}
        </div>
      )}
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
        <div className="bg-paper flex min-h-screen items-center justify-center">
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
