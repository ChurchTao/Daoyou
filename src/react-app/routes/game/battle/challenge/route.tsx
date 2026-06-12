import { BattlePageLayout } from '@app/components/feature/battle/BattlePageLayout';
import { BattlePlaybackPanel } from '@app/components/feature/battle/BattlePlaybackPanel';
import { useBattlePlaybackState } from '@app/components/feature/battle/useBattlePlaybackState';
import { CombatResultDialog } from '@app/components/feature/battle/v5/CombatResultDialog';
import { GameImmersiveLoading } from '@app/components/game-shell';
import { InkButton } from '@app/components/ui/InkButton';
import { usePlayerStateActions } from '@app/lib/player-state/store';
import type { BattleRecord } from '@shared/types/battle';
import type { RealmType } from '@shared/types/constants';
import { Suspense, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

type ChallengeBattleResponse =
  | {
      type: 'direct_entry';
      realm: RealmType;
      rank: number;
      remainingChallenges: number;
    }
  | {
      type: 'battle_result';
      battleResult: BattleRecord;
      rankingUpdate: {
        isWin: boolean;
        realm: RealmType;
        affectsRanking: boolean;
        challengerRank: number | null;
        targetRank: number | null;
        remainingChallenges: number;
        rankChangeType: 'challenge_win' | 'vacancy_entry' | null;
      };
    };

type ChallengeMutate = <T>(
  request: Promise<Response>,
  options?: { deferRecovery?: boolean },
) => Promise<T>;

const challengeExecutionRequests = new Map<
  string,
  Promise<ChallengeBattleResponse>
>();
const challengeExecutionResults = new Map<string, ChallengeBattleResponse>();

function getChallengeExecutionKey(targetId: string | null, realm: string | null) {
  return `${realm?.trim() || 'default'}:${targetId?.trim() || 'direct-entry'}`;
}

function clearChallengeExecutionCache(key: string) {
  challengeExecutionRequests.delete(key);
  challengeExecutionResults.delete(key);
}

async function executeChallengeBattleOnce(
  key: string,
  targetId: string | null,
  realm: string | null,
  mutate: ChallengeMutate,
) {
  const cached = challengeExecutionResults.get(key);
  if (cached) {
    return cached;
  }

  const inFlight = challengeExecutionRequests.get(key);
  if (inFlight) {
    return inFlight;
  }

  const request = mutate<ChallengeBattleResponse>(
    fetch('/api/rankings/challenge-battle/v5', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetId: targetId?.trim() || null,
        realm: realm?.trim() || undefined,
      }),
    }),
    { deferRecovery: true },
  )
    .then((data) => {
      challengeExecutionResults.set(key, data);
      return data;
    })
    .catch((error) => {
      clearChallengeExecutionCache(key);
      throw error;
    })
    .finally(() => {
      challengeExecutionRequests.delete(key);
    });

  challengeExecutionRequests.set(key, request);
  return request;
}

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
    realm: RealmType;
    affectsRanking: boolean;
    challengerRank: number | null;
    targetRank: number | null;
    remainingChallenges: number;
    rankChangeType: 'challenge_win' | 'vacancy_entry' | null;
  } | null>(null);
  const [directEntry, setDirectEntry] = useState<{
    rank: number;
  } | null>(null);
  const playback = useBattlePlaybackState(battleResult);
  const { mutate } = usePlayerStateActions();

  const targetId = searchParams.get('targetId');
  const realm = searchParams.get('realm');
  const challengeKey = getChallengeExecutionKey(targetId, realm);

  const backToRankings = () => {
    clearChallengeExecutionCache(challengeKey);
    navigate(
      realm
        ? `/game/rankings?realm=${encodeURIComponent(realm)}`
        : '/game/rankings',
    );
  };

  useEffect(() => {
    let cancelled = false;

    const startChallengeBattle = async () => {
      setLoading(true);
      setError(undefined);
      setDirectEntry(null);
      setBattleResult(undefined);
      setRankingUpdate(null);

      try {
        const data = await executeChallengeBattleOnce(
          challengeKey,
          targetId,
          realm,
          mutate,
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
  }, [challengeKey, mutate, realm, targetId]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-4 py-20">
        <div className="border-battle-rule-strong bg-[rgba(248,243,230,0.92)] max-w-md border border-dashed px-5 py-5 text-center">
          <p className="text-crimson mb-4">{error}</p>
          <InkButton onClick={backToRankings}>
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
        onBack={backToRankings}
      />
    );
  }

  const isWin = rankingUpdate?.isWin;

  return (
    <BattlePageLayout
      title={`排行榜挑战 · ${battleResult ? `${playback.playerName} vs ${playback.opponentName}` : '加载中'}`}
      subtitle={
        rankingUpdate?.affectsRanking === false
          ? '越境切磋只记胜负，不改榜单名次。'
          : '这一战会直接影响你的榜单名次。'
      }
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
        onConfirm={backToRankings}
        content={
          <div className="space-y-1 leading-8">
            {rankingUpdate?.challengerRank != null && isWin && (
              <p>你的排名已更新为第 {rankingUpdate.challengerRank} 名。</p>
            )}
            {rankingUpdate?.rankChangeType === 'vacancy_entry' &&
              rankingUpdate.challengerRank != null && (
                <p>榜单尚有席位，你已补入第 {rankingUpdate.challengerRank} 名。</p>
              )}
            {rankingUpdate?.affectsRanking === false && (
              <p>此战为越境切磋，不改变{rankingUpdate.realm}榜名次。</p>
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
