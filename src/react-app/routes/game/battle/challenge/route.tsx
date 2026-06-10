import { BattlePageLayout } from '@app/components/feature/battle/BattlePageLayout';
import { BattlePlaybackPanel } from '@app/components/feature/battle/BattlePlaybackPanel';
import { useBattlePlaybackState } from '@app/components/feature/battle/useBattlePlaybackState';
import { CombatResultDialog } from '@app/components/feature/battle/v5/CombatResultDialog';
import { GameImmersiveLoading } from '@app/components/game-shell';
import { InkButton } from '@app/components/ui/InkButton';
import { usePlayerStateActions } from '@app/lib/player-state/store';
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

export function ChallengeDirectEntryCard({
  rank,
  onBack,
}: {
  rank: number;
  onBack: () => void;
}) {
  return (
    <div className="flex h-full items-center justify-center px-4 py-20">
      <div className="border-battle-rule-strong bg-[rgba(248,243,230,0.92)] max-w-md border border-dashed px-5 py-5 text-center">
        <h1 className="font-ma-shan-zheng text-ink mb-4 text-2xl">成功上榜！</h1>
        <p className="text-ink mb-6">你已占据万界金榜第 {rank} 名</p>
        <InkButton onClick={onBack} variant="primary">
          返回排行榜
        </InkButton>
      </div>
    </div>
  );
}

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
  const playback = useBattlePlaybackState(battleResult);
  const { mutate } = usePlayerStateActions();

  const targetId = searchParams.get('targetId');

  useEffect(() => {
    let cancelled = false;

    const startChallengeBattle = async () => {
      setLoading(true);
      setError(undefined);
      setDirectEntry(null);
      setBattleResult(undefined);
      setRankingUpdate(null);

      try {
        const data = await mutate<ChallengeBattleResponse>(
          fetch('/api/rankings/challenge-battle/v5', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetId: targetId || null }),
          }),
        );
        if (cancelled) return;

        if (data.type === 'direct_entry') {
          setDirectEntry({ rank: data.rank });
        } else if (data.type === 'battle_result') {
          setBattleResult(data.battleResult);
          setRankingUpdate(data.rankingUpdate);
        }
      } catch (requestError) {
        if (!cancelled) {
          console.error('挑战战斗失败:', requestError);
          setError(
            requestError instanceof Error ? requestError.message : '挑战失败，请稍后重试',
          );
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
  }, [mutate, targetId]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-4 py-20">
        <div className="border-battle-rule-strong bg-[rgba(248,243,230,0.92)] max-w-md border border-dashed px-5 py-5 text-center">
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
      <ChallengeDirectEntryCard
        rank={directEntry.rank}
        onBack={() => navigate('/game/rankings')}
      />
    );
  }

  const isWin = rankingUpdate?.isWin;

  return (
    <BattlePageLayout
      title={`排行榜挑战 · ${battleResult ? `${playback.playerName} vs ${playback.opponentName}` : '加载中'}`}
      subtitle="这一战会直接影响你的榜单名次。"
      variant="immersive-battle"
      error={error}
      loading={loading}
      battleResult={battleResult}
    >
      <BattlePlaybackPanel battleResult={battleResult} playback={playback} />

      <CombatResultDialog
        key={`challenge-${battleResult?.turns}-${battleResult?.winner.id ?? 'unknown'}`}
        dialogKey={`challenge-${battleResult?.turns}-${battleResult?.winner.id ?? 'unknown'}`}
        open={!!battleResult && playback.isPlaybackFinished}
        title={isWin ? '挑战成功' : '挑战失利'}
        confirmLabel="返回排行榜"
        onConfirm={() => navigate('/game/rankings')}
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

export default function ChallengeBattlePage() {
  return (
    <Suspense fallback={<GameImmersiveLoading message="挑战战报推演中……" />}>
      <ChallengeBattlePageContent />
    </Suspense>
  );
}
