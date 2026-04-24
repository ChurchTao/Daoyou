import { BattlePageLayout } from '@/components/feature/battle/BattlePageLayout';
import { CombatStatusHeader } from '@/components/feature/battle/v5/CombatStatusHeader';
import { CombatActionLog } from '@/components/feature/battle/v5/CombatActionLog';
import { CombatControlBar } from '@/components/feature/battle/v5/CombatControlBar';
import { useCombatPlayer } from '../../battle/hooks/useCombatPlayer';
import type { ResourceOperation } from '@/engine/resource/types';
import {
  DungeonRound,
  DungeonSettlement,
  DungeonState,
} from '@/lib/dungeon/types';
import { useBattle } from '@/lib/hooks/dungeon/useBattle';
import { Cultivator } from '@/types/cultivator';
import { useEffect, useRef, useState } from 'react';

export interface BattleCallbackData {
  isFinished: boolean;
  settlement?: DungeonSettlement;
  realGains?: ResourceOperation[];
  dungeonState?: DungeonState;
  roundData?: DungeonRound;
}

interface DungeonBattleProps {
  battleId: string;
  player: Cultivator;
  onBattleComplete: (data: BattleCallbackData | null) => void;
}

/**
 * 副本战斗组件
 * 处理战斗执行和展示
 */
export function DungeonBattle({
  battleId,
  player,
  onBattleComplete,
}: DungeonBattleProps) {
  const {
    battleResult,
    battleEnd,
    loading,
    executeBattle,
  } = useBattle();

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

  const [battleSettlement, setBattleSettlement] =
    useState<BattleCallbackData | null>(null);
  const hasExecuted = useRef(false);

  useEffect(() => {
    if (hasExecuted.current) return;
    hasExecuted.current = true;

    const runBattle = async () => {
      const result = await executeBattle(battleId);
      if (result?.callbackData) {
        setBattleSettlement(result.callbackData);
      }
    };

    runBattle();
  }, [battleId, executeBattle]);

  // 自动播放
  useEffect(() => {
    if (battleResult && totalActions > 0 && currentIndex === -1 && !isPlaying) {
      play();
    }
  }, [battleResult, totalActions, currentIndex, isPlaying, play]);

  // 计算快照
  const playerUnitId = battleResult?.player;
  const opponentUnitId = battleResult?.opponent;
  const initialPlayerFrame = battleResult?.stateTimeline?.frames[0]?.units[playerUnitId || ''];
  const initialOpponentFrame = battleResult?.stateTimeline?.frames[0]?.units[opponentUnitId || ''];
  const currentPlayerFrame = currentFrames?.find(f => f.units[playerUnitId || ''])?.units[playerUnitId || ''] || initialPlayerFrame;
  const currentOpponentFrame = currentFrames?.find(f => f.units[opponentUnitId || ''])?.units[opponentUnitId || ''] || initialOpponentFrame;

  const isPlaybackFinished = battleEnd && currentIndex >= totalActions - 1;

  return (
    <BattlePageLayout
      title={`【激战 · 副本探索】`}
      backHref="#"
      loading={loading && !battleResult}
      battleResult={battleResult}
      isStreaming={false}
      actions={{
        primary: {
          label: battleSettlement?.isFinished
            ? '查看结算'
            : isPlaybackFinished
              ? '继续探险'
              : '战斗中...',
          onClick: () => {
            if (battleSettlement) {
              onBattleComplete(battleSettlement);
            } else if (battleEnd) {
              onBattleComplete(null);
            }
          },
          disabled: !isPlaybackFinished && !battleSettlement,
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

      {/* 胜负汇总 */}
      {isPlaybackFinished && (
        <div className="mt-4 p-4 border border-crimson/30 bg-crimson/5 rounded-sm text-center animate-fade-in">
          <p className="text-crimson text-xl font-heading mb-1">
            {battleResult?.winner.id === player.id ? '捷报！' : '力战而竭...'}
          </p>
        </div>
      )}
    </BattlePageLayout>
  );
}

