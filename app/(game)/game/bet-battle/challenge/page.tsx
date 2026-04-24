'use client';

import { BattlePageLayout } from '@/components/feature/battle/BattlePageLayout';
import { CombatStatusHeader } from '@/components/feature/battle/v5/CombatStatusHeader';
import { CombatActionLog } from '@/components/feature/battle/v5/CombatActionLog';
import { CombatControlBar } from '@/components/feature/battle/v5/CombatControlBar';
import { CombatAttributeModal } from '@/components/feature/battle/v5/CombatAttributeModal';
import { CombatResultDialog } from '@/components/feature/battle/v5/CombatResultDialog';
import { InkButton } from '@/components/ui/InkButton';
import { useCombatPlayer } from '../../battle/hooks/useCombatPlayer';
import type { UnitStateSnapshot } from '@/engine/battle-v5/systems/state/types';
import type { BattleRecord } from '@/lib/services/battleResult';
import type { Cultivator } from '@/types/cultivator';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

type SettlementState = {
  isWin: boolean;
  winnerId: string;
  battleId: string;
  battleRecordId: string;
  resultMessage: string;
};

function BetBattleChallengePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [player, setPlayer] = useState<Cultivator | null>(null);
  const [opponent, setOpponent] = useState<Cultivator | null>(null);
  const [battleResult, setBattleResult] = useState<BattleRecord>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [battleEnd, setBattleEnd] = useState(false);
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

  const hasBattleStarted = useRef(false);

  const battleId = searchParams.get('battleId');
  const stakeType = searchParams.get('stakeType');
  const spiritStones = Number(searchParams.get('spiritStones') ?? '0');
  const itemType = searchParams.get('itemType');
  const itemId = searchParams.get('itemId');
  const quantity = Number(searchParams.get('quantity') ?? '1');

  useEffect(() => {
    if (hasBattleStarted.current) return;
    hasBattleStarted.current = true;
    void handleChallengeBattle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (battleResult && totalActions > 0 && currentIndex === -1 && !isPlaying) {
      play();
    }
  }, [battleResult, totalActions, currentIndex, isPlaying, play]);

  const handleChallengeBattle = async () => {
    if (!battleId) {
      setError('缺少赌战ID，无法应战');
      return;
    }

    setLoading(true);
    setBattleResult(undefined);
    setError(undefined);
    setSettlement(null);
    setBattleEnd(false);

    try {
      const response = await fetch(`/api/bet-battles/${battleId}/challenge/v5`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stakeType,
          spiritStones: stakeType === 'spirit_stones' ? spiritStones : 0,
          stakeItem: stakeType === 'item' && itemType && itemId ? { itemType, itemId, quantity } : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '应战失败');
      }

      const data = await response.json();
      const result = data.battleResult as BattleRecord;
      setBattleResult(result);
      setSettlement(data.settlement);

      const isPlayerWin = result.winner.id === result.player;
      setPlayer(isPlayerWin ? result.winner : result.loser);
      setOpponent(isPlayerWin ? result.loser : result.winner);
      setBattleEnd(true);
    } catch (requestError) {
      console.error('应战赌战失败:', requestError);
      setError(requestError instanceof Error ? requestError.message : '应战失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="bg-paper flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-crimson mb-4">{error}</p>
          <InkButton onClick={() => router.push('/game/bet-battle')}>
            返回赌战台
          </InkButton>
        </div>
      </div>
    );
  }

  const playerUnitId = battleResult?.player;
  const opponentUnitId = battleResult?.opponent;
  const currentPlayerFrame = unitSnapshots[playerUnitId || ''];
  const currentOpponentFrame = unitSnapshots[opponentUnitId || ''];

  const opponentName = opponent?.name ?? '神秘对手';

  return (
    <BattlePageLayout
      title={`赌战 · ${!player ? '加载中' : `${player?.name} vs ${opponentName}`}`}
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
          onClick: () => router.push('/game/bet-battle'),
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
        open={!!battleResult && battleEnd && currentIndex >= totalActions - 1 && !!settlement}
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
