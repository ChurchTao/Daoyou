import { BattlePageLayout } from '@app/components/feature/battle/BattlePageLayout';
import { CombatStatusHeader } from '@app/components/feature/battle/v5/CombatStatusHeader';
import { CombatActionLog } from '@app/components/feature/battle/v5/CombatActionLog';
import { CombatControlBar } from '@app/components/feature/battle/v5/CombatControlBar';
import { CombatAttributeModal } from '@app/components/feature/battle/v5/CombatAttributeModal';
import { CombatResultDialog } from '@app/components/feature/battle/v5/CombatResultDialog';
import { InkButton } from '@app/components/ui/InkButton';
import { fetchJsonCached } from '@app/lib/client/requestCache';
import { useCombatPlayer } from '../../battle/hooks/useCombatPlayer';
import type { UnitStateSnapshot } from '@shared/engine/battle-v5/systems/state/types';
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
  const [selectedUnit, setSelectedUnit] = useState<UnitStateSnapshot | null>(null);

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
    if (battleResult && totalActions > 0 && currentIndex === -1 && !isPlaying) {
      play();
    }
  }, [battleResult, totalActions, currentIndex, isPlaying, play]);

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
      <div className="bg-paper flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-crimson mb-4">{error}</p>
          <InkButton onClick={() => navigate('/game/bet-battle')}>
            返回赌战台
          </InkButton>
        </div>
      </div>
    );
  }

  const playerUnitId = battleResult?.player;
  const opponentUnitId = battleResult?.opponent;
  const getUnitName = (unitId: string) => {
    if (battleResult?.winner.id === unitId) return battleResult.winner.name;
    if (battleResult?.loser.id === unitId) return battleResult.loser.name;
    return '神秘对手';
  };
  const playerName = playerUnitId ? getUnitName(playerUnitId) : '加载中';
  const opponentName = opponentUnitId ? getUnitName(opponentUnitId) : '神秘对手';
  const currentPlayerFrame = unitSnapshots[playerUnitId || ''];
  const currentOpponentFrame = unitSnapshots[opponentUnitId || ''];

  return (
    <BattlePageLayout
      title={`赌战 · ${battleResult ? `${playerName} vs ${opponentName}` : '加载中'}`}
      subtitle="胜负将直接决定这场赌战的结果。"
      backHref="/game/bet-battle"
      backLabel="返回赌战台"
      error={error}
      loading={loading}
      battleResult={battleResult}
      isStreaming={false}
      actions={{
        primary: {
          label: '返回赌战台',
          onClick: () => navigate('/game/bet-battle'),
        },
      }}
    >
      <div className="flex flex-col gap-4 mb-8">
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
        key={`bet-${battleResult?.turns}-${battleResult?.winner.id ?? 'unknown'}`}
        dialogKey={`bet-${battleResult?.turns}-${battleResult?.winner.id ?? 'unknown'}`}
        open={!!battleResult && currentIndex >= totalActions - 1 && !!settlement}
        title={settlement?.isWin ? '赌战胜利' : '赌战失败'}
        content={<p className="leading-8">{settlement?.resultMessage}</p>}
      />
    </BattlePageLayout>
  );
}


export default function BetBattleChallengePage() {
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
      <BetBattleChallengePageContent />
    </Suspense>
  );
}
