import { BattlePageLayout } from '@app/components/feature/battle/BattlePageLayout';
import { BattlePlaybackPanel } from '@app/components/feature/battle/BattlePlaybackPanel';
import { useBattlePlaybackState } from '@app/components/feature/battle/useBattlePlaybackState';
import { CombatResultDialog } from '@app/components/feature/battle/v5/CombatResultDialog';
import { GameImmersiveLoading } from '@app/components/game-shell';
import { InkButton } from '@app/components/ui/InkButton';
import { fetchJsonCached } from '@app/lib/client/requestCache';
import type { BattleRecord } from '@shared/types/battle';
import { Suspense, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

type SettlementState = {
  isWin: boolean;
  winnerId: string;
  battleId: string;
  battleRecordV2Id: string;
  resultMessage: string;
};

function BetBattleChallengePageContent() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [battleResult, setBattleResult] = useState<BattleRecord>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [settlement, setSettlement] = useState<SettlementState | null>(null);
  const playback = useBattlePlaybackState(battleResult);

  const battleId = searchParams.get('battleId');
  const stakeType = searchParams.get('stakeType');
  const spiritStones = Number(searchParams.get('spiritStones') ?? '0');
  const itemType = searchParams.get('itemType');
  const itemId = searchParams.get('itemId');
  const quantity = Number(searchParams.get('quantity') ?? '1');
  const challengeRequestKey = [
    battleId ?? 'missing-battle',
    stakeType ?? 'no-stake',
    spiritStones,
    itemType ?? 'no-item-type',
    itemId ?? 'no-item-id',
    quantity,
  ].join(':');

  useEffect(() => {
    if (!battleId) return;

    let cancelled = false;

    const startBetBattle = async () => {
      setLoading(true);
      setError(undefined);
      setBattleResult(undefined);
      setSettlement(null);

      try {
        const data = await fetchJsonCached<{
          battleResult: BattleRecord;
          settlement: SettlementState;
        }>(`/api/bet-battles/${battleId}/challenge/v5`, {
          key: `bet-battles:challenge:${challengeRequestKey}`,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stakeType,
            spiritStones: stakeType === 'spirit_stones' ? spiritStones : 0,
            stakeItem:
              stakeType === 'item' && itemType && itemId
                ? { itemType, itemId, quantity }
                : null,
          }),
        });
        if (cancelled) return;

        setBattleResult(data.battleResult);
        setSettlement(data.settlement);
      } catch (requestError) {
        if (!cancelled) {
          console.error('应战赌战失败:', requestError);
          setError(
            requestError instanceof Error ? requestError.message : '应战失败，请稍后重试',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void startBetBattle();

    return () => {
      cancelled = true;
    };
  }, [battleId, challengeRequestKey, itemId, itemType, quantity, spiritStones, stakeType]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-4 py-20">
        <div className="border-battle-rule-strong bg-[rgba(248,243,230,0.92)] max-w-md border border-dashed px-5 py-5 text-center">
          <p className="text-crimson mb-4">{error}</p>
          <InkButton onClick={() => navigate('/game/bet-battle')}>
            返回赌战台
          </InkButton>
        </div>
      </div>
    );
  }

  return (
    <BattlePageLayout
      title={`赌战 · ${battleResult ? `${playback.playerName} vs ${playback.opponentName}` : '加载中'}`}
      subtitle="胜负将直接决定这场赌战的结果。"
      variant="immersive-battle"
      error={error}
      loading={loading}
      battleResult={battleResult}
    >
      <BattlePlaybackPanel battleResult={battleResult} playback={playback} />

      <CombatResultDialog
        key={`bet-${battleResult?.turns}-${battleResult?.winner.id ?? 'unknown'}`}
        dialogKey={`bet-${battleResult?.turns}-${battleResult?.winner.id ?? 'unknown'}`}
        open={!!battleResult && playback.isPlaybackFinished && !!settlement}
        title={settlement?.isWin ? '赌战胜利' : '赌战失败'}
        confirmLabel="返回赌战台"
        onConfirm={() => navigate('/game/bet-battle')}
        content={<p className="leading-8">{settlement?.resultMessage}</p>}
      />
    </BattlePageLayout>
  );
}

export default function BetBattleChallengePage() {
  return (
    <Suspense fallback={<GameImmersiveLoading message="赌战战报推演中……" />}>
      <BetBattleChallengePageContent />
    </Suspense>
  );
}
