import { BattlePageLayout } from '@app/components/feature/battle/BattlePageLayout';
import { CombatStatusHeader } from '@app/components/feature/battle/v5/CombatStatusHeader';
import { CombatActionLog } from '@app/components/feature/battle/v5/CombatActionLog';
import { CombatControlBar } from '@app/components/feature/battle/v5/CombatControlBar';
import { CombatAttributeModal } from '@app/components/feature/battle/v5/CombatAttributeModal';
import { CombatResultDialog } from '@app/components/feature/battle/v5/CombatResultDialog';
import { InkButton } from '@app/components/ui/InkButton';
import { fetchJsonCached } from '@app/lib/client/requestCache';
import type { UnitStateSnapshot } from '@shared/engine/battle-v5/systems/state/types';
import { useCombatPlayer } from '../hooks/useCombatPlayer';
import type { BattleRecord } from '@shared/types/battle';
import { Suspense, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

type ChallengeBattleResponse =
  | {
      type: 'direct_entry';
      rank: number;
      remainingChallenges: number;
    }
  | {
      type: 'battle_result';
      battleResult: BattleRecord;
      rankingUpdate: {
        isWin: boolean;
        challengerRank: number | null;
        targetRank: number | null;
        remainingChallenges: number;
      };
    };

/**
 * 挑战战斗播报页内容组件
 */
function ChallengeBattlePageContent() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [battleResult, setBattleResult] = useState<BattleRecord>();
  const [loading, setLoading] = useState(true);
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
  const [selectedUnit, setSelectedUnit] = useState<UnitStateSnapshot | null>(null);

  // 播放器 Hook
  const {
    currentIndex,
    isPlaying,
    playbackSpeed,
    setPlaybackSpeed,
    play,
    pause,
    reset,
    totalActions,
    progress,
    unitSnapshots,
  } = useCombatPlayer(battleResult);

  const targetId = searchParams.get('targetId');

  // 战斗数据到达后自动播放
  useEffect(() => {
    if (battleResult && totalActions > 0 && currentIndex === -1 && !isPlaying) {
      play();
    }
  }, [battleResult, totalActions, currentIndex, isPlaying, play]);

  // 初始化 & 自动开始战斗
  useEffect(() => {
    let cancelled = false;

    const startChallengeBattle = async () => {
      setLoading(true);
      setError(undefined);
      setDirectEntry(null);
      setBattleResult(undefined);
      setRankingUpdate(null);

      try {
        const data = await fetchJsonCached<ChallengeBattleResponse>(
          '/api/rankings/challenge-battle/v5',
          {
            key: `rankings:challenge-battle:${targetId ?? 'direct-entry'}`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetId: targetId || null }),
          },
        );
        if (cancelled) return;

        if (data.type === 'direct_entry') {
          setDirectEntry({ rank: data.rank });
        } else if (data.type === 'battle_result') {
          setBattleResult(data.battleResult);
          setRankingUpdate(data.rankingUpdate);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('挑战战斗失败:', error);
          setError(error instanceof Error ? error.message : '挑战失败，请稍后重试');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void startChallengeBattle();

    return () => {
      cancelled = true;
    };
  }, [targetId]);

  if (error) {
    return (
      <div className="bg-paper flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-crimson mb-4">{error}</p>
          <InkButton onClick={() => navigate('/game/rankings')}>
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
          <InkButton onClick={() => navigate('/game/rankings')} variant="primary">
            返回排行榜
          </InkButton>
        </div>
      </div>
    );
  }

  // 计算实时状态快照
  const playerUnitId = battleResult?.player || '';
  const opponentUnitId = battleResult?.opponent || '';
  const getUnitName = (unitId: string) => {
    if (battleResult?.winner.id === unitId) return battleResult.winner.name;
    if (battleResult?.loser.id === unitId) return battleResult.loser.name;
    return '神秘对手';
  };
  const playerName = playerUnitId ? getUnitName(playerUnitId) : '加载中';
  const opponentName = opponentUnitId ? getUnitName(opponentUnitId) : '神秘对手';
  const currentPlayerFrame = unitSnapshots[playerUnitId];
  const currentOpponentFrame = unitSnapshots[opponentUnitId];

  const isWin = rankingUpdate?.isWin;

  return (
    <BattlePageLayout
      title={`排行榜挑战 · ${battleResult ? `${playerName} vs ${opponentName}` : '加载中'}`}
      subtitle="这一战会直接影响你的榜单名次。"
      backHref="/game/rankings"
      backLabel="返回排行榜"
      error={error}
      loading={loading}
      battleResult={battleResult}
      isStreaming={false}
      actions={{
        primary: {
          label: '返回排行榜',
          onClick: () => navigate('/game/rankings'),
        },
      }}
    >
      <div className="flex flex-col gap-4 mb-8">
        {/* 状态栏 */}
        {currentPlayerFrame && currentOpponentFrame && (
          <CombatStatusHeader
            player={currentPlayerFrame}
            opponent={currentOpponentFrame}
            onShowPlayerDetails={() => setSelectedUnit(currentPlayerFrame)}
            onShowOpponentDetails={() => setSelectedUnit(currentOpponentFrame)}
            controls={
              <CombatControlBar
                isPlaying={isPlaying}
                playbackSpeed={playbackSpeed}
                progress={progress}
                onToggle={() => (isPlaying ? pause() : play())}
                onSpeedChange={setPlaybackSpeed}
                onReset={reset}
              />
            }
          />
        )}

        {/* 战报日志 */}
        {battleResult && (
          <CombatActionLog spans={battleResult.logSpans} currentIndex={currentIndex} />
        )}
      </div>

      <CombatAttributeModal
        unit={selectedUnit}
        isOpen={!!selectedUnit}
        onClose={() => setSelectedUnit(null)}
      />

      <CombatResultDialog
        key={`challenge-${battleResult?.turns}-${battleResult?.winner.id ?? 'unknown'}`}
        dialogKey={`challenge-${battleResult?.turns}-${battleResult?.winner.id ?? 'unknown'}`}
        open={!!battleResult && currentIndex >= totalActions - 1}
        title={isWin ? '挑战成功' : '挑战失利'}
        content={
          <div className="space-y-1 leading-8">
            {rankingUpdate?.challengerRank != null && isWin && (
              <p>你的排名已更新为第 {rankingUpdate.challengerRank} 名。</p>
            )}
            {rankingUpdate && (
              <p>今日剩余挑战次数：{rankingUpdate.remainingChallenges}/10。</p>
            )}
          </div>
        }
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
