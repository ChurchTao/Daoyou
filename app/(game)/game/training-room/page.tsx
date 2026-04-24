'use client';

import { BattlePageLayout } from '@/components/feature/battle/BattlePageLayout';
import { CombatActionLog } from '@/components/feature/battle/v5/CombatActionLog';
import { CombatAttributeModal } from '@/components/feature/battle/v5/CombatAttributeModal';
import { CombatControlBar } from '@/components/feature/battle/v5/CombatControlBar';
import { CombatResultDialog } from '@/components/feature/battle/v5/CombatResultDialog';
import { CombatStatusHeader } from '@/components/feature/battle/v5/CombatStatusHeader';
import { InkButton } from '@/components/ui/InkButton';
import type { UnitStateSnapshot } from '@/engine/battle-v5/systems/state/types';
import { useCultivator } from '@/lib/contexts/CultivatorContext';
import type { BattleRecord } from '@/lib/services/battleResult';
import { simulateBattleV5 } from '@/lib/services/simulateBattleV5';
import type { Cultivator } from '@/types/cultivator';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { useCombatPlayer } from '../battle/hooks/useCombatPlayer';

const DUMMY_HP = 10000000;

export default function TrainingRoomPage() {
  const router = useRouter();
  const { cultivator, isLoading } = useCultivator();
  const [isFighting, setIsFighting] = useState(false);
  const [battleResult, setBattleResult] = useState<BattleRecord>();
  const [selectedUnit, setSelectedUnit] = useState<UnitStateSnapshot | null>(
    null,
  );

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

  const handleStartTraining = useCallback(() => {
    if (!cultivator || isFighting) return;

    setIsFighting(true);
    setBattleResult(undefined);

    const mockDummy: Cultivator = {
      id: 'dummy',
      name: '木桩',
      age: 0,
      lifespan: 9999,
      attributes: {
        vitality: 10,
        spirit: 10,
        wisdom: 10,
        speed: 10,
        willpower: 10,
      },
      spiritual_roots: [],
      pre_heaven_fates: [],
      cultivations: [],
      skills: [],
      inventory: { artifacts: [], consumables: [], materials: [] },
      equipped: { weapon: null, armor: null, accessory: null },
      max_skills: 0,
      spirit_stones: 0,
      gender: '男',
      realm: '炼气',
      realm_stage: '初期',
    };

    const result = simulateBattleV5(cultivator, mockDummy, {
      isTraining: true,
      opponentMaxHpOverride: DUMMY_HP,
    });

    setBattleResult(result);
  }, [cultivator, isFighting]);

  useEffect(() => {
    if (battleResult && totalActions > 0 && currentIndex === -1 && !isPlaying) {
      play();
    }
  }, [battleResult, totalActions, currentIndex, isPlaying, play]);

  const handleLeave = () => {
    if (isFighting && currentIndex < totalActions - 1) {
      if (!confirm('训练尚未结束，确定要离开吗？')) return;
    }
    router.push('/game');
  };

  if (isLoading) {
    return (
      <div className="bg-paper flex min-h-screen items-center justify-center">
        <p className="text-ink/40 animate-pulse">识海构筑中...</p>
      </div>
    );
  }

  const playerUnitId = battleResult?.player || cultivator?.id;
  const opponentUnitId = battleResult?.opponent || 'dummy';
  const currentPlayerFrame = unitSnapshots[playerUnitId || ''];
  const currentOpponentFrame = unitSnapshots[opponentUnitId || ''];
  const isEnded = !!battleResult && currentIndex >= totalActions - 1;

  return (
    <BattlePageLayout
      title="练功房"
      subtitle="和木桩切磋，测试伤害、耗蓝和技能节奏。"
      backHref="/game"
      backLabel="离开"
      onBack={handleLeave}
      loading={isFighting && !battleResult}
    >
      {!battleResult ? (
        <div className="py-16 text-center">
          <p className="battle-caption mb-3 text-xs">练功说明</p>
          <p className="text-battle-muted mx-auto max-w-2xl text-sm leading-8 md:text-base">
            这里不会消耗实战机会，适合反复测试技能伤害、灵力消耗和出手顺序。
          </p>
          <div className="mt-6">
            <InkButton
              onClick={handleStartTraining}
              variant="primary"
              className="text-base md:text-lg"
            >
              开始训练
            </InkButton>
          </div>
        </div>
      ) : (
        <div className="mb-8 flex flex-col gap-4">
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

          <CombatActionLog
            spans={battleResult.logSpans}
            currentIndex={currentIndex}
          />
        </div>
      )}

      <CombatAttributeModal
        unit={selectedUnit}
        isOpen={!!selectedUnit}
        onClose={() => setSelectedUnit(null)}
      />

      <CombatResultDialog
        key={`training-${battleResult?.turns}-${currentOpponentFrame?.hp.current ?? 0}`}
        dialogKey={`training-${battleResult?.turns}-${currentOpponentFrame?.hp.current ?? 0}`}
        open={isEnded}
        title="本次训练结束"
        content={
          <p className="leading-8">
            本次训练共造成{' '}
            {(
              DUMMY_HP - (currentOpponentFrame?.hp.current || 0)
            ).toLocaleString()}{' '}
            点伤害。
          </p>
        }
        confirmLabel="再来一次"
        cancelLabel="先看看"
        onConfirm={() => {
          setIsFighting(false);
          setBattleResult(undefined);
        }}
      />
    </BattlePageLayout>
  );
}
