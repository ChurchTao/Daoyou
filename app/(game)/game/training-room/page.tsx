'use client';

import { BattlePageLayout } from '@/components/feature/battle/BattlePageLayout';
import { CombatStatusHeader } from '@/components/feature/battle/v5/CombatStatusHeader';
import { CombatActionLog } from '@/components/feature/battle/v5/CombatActionLog';
import { CombatControlBar } from '@/components/feature/battle/v5/CombatControlBar';
import { InkButton } from '@/components/ui/InkButton';
import { InkCard } from '@/components/ui/InkCard';
import { simulateBattleV5 } from '@/lib/services/simulateBattleV5';
import { useCombatPlayer } from '../battle/hooks/useCombatPlayer';
import { useCultivator } from '@/lib/contexts/CultivatorContext';
import type { Cultivator } from '@/types/cultivator';
import type { BattleRecord } from '@/lib/services/battleResult';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';

/**
 * 练功房页面 - v5 重构版
 */
const DUMMY_HP = 1000000000;

export default function TrainingRoomPage() {
  const router = useRouter();
  const { cultivator, isLoading } = useCultivator();
  const [isFighting, setIsFighting] = useState(false);
  const [battleResult, setBattleResult] = useState<BattleRecord>();

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

    // 1. 定义 10 亿血量木桩
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

    // 2. 执行战斗模拟
    const result = simulateBattleV5(cultivator, mockDummy, {
      isTraining: true,
      opponentMaxHpOverride: DUMMY_HP,
    });

    setBattleResult(result);
  }, [cultivator, isFighting]);

  // 战斗结果产生后自动播放
  useEffect(() => {
    if (battleResult && totalActions > 0 && currentIndex === -1 && !isPlaying) {
      play();
    }
  }, [battleResult, totalActions, currentIndex, isPlaying, play]);

  const handleLeave = () => {
    if (isFighting && currentIndex < totalActions - 1) {
      if (!confirm('演武尚未结束，确定要强行离去吗？')) return;
    }
    router.push('/game');
  };

  if (isLoading) {
    return (
      <div className="bg-paper flex min-h screen items-center justify-center">
        <p className="text-ink/40 animate-pulse">识海构筑中...</p>
      </div>
    );
  }

  // 计算实时状态
  const playerUnitId = battleResult?.player || cultivator?.id;
  const opponentUnitId = battleResult?.opponent || 'dummy';

  const currentPlayerFrame = unitSnapshots[playerUnitId || ''];
  const currentOpponentFrame = unitSnapshots[opponentUnitId || ''];

  const isEnded = battleResult && currentIndex >= totalActions - 1;

  return (
    <div className="bg-paper min-h-screen">
      <div className="main-content mx-auto flex max-w-xl flex-col px-4 pt-8 pb-16">
        {/* 头部 */}
        <section className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-ma-shan-zheng text-ink text-2xl">【演武厅 · 练功房】</h1>
            <p className="text-ink/50 mt-1 text-xs">通过对战木桩测试功法威力</p>
          </div>
          <InkButton onClick={handleLeave} variant="ghost" className="text-sm">
            离开
          </InkButton>
        </section>

        {!battleResult && !isFighting ? (
          <InkCard padding="lg" className="text-center py-12">
            <p className="text-ink/60 mb-6 italic">此地宁静祥和，适合静心演武。</p>
            <InkButton onClick={handleStartTraining} variant="primary" className="px-12 py-3 text-lg">
              开始演武
            </InkButton>
          </InkCard>
        ) : (
          <div className="flex flex-col gap-4">
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
                onReset={reset}
              />
            )}

            {/* 结算 */}
            {isEnded && (
              <div className="mt-4 p-4 border border-ink-secondary bg-white/30 rounded-sm text-center animate-fade-in">
                <p className="text-ink text-lg font-bold mb-1">演武结束</p>
                <p className="text-ink/60 text-sm">
                  本次演武共造成 {(DUMMY_HP - (currentOpponentFrame?.hp.current || 0)).toLocaleString()} 点伤害
                </p>
                <InkButton onClick={() => { setIsFighting(false); setBattleResult(undefined); }} className="mt-4">
                  再次演武
                </InkButton>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
