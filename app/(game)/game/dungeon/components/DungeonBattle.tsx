import { BattlePageLayout } from '@/components/feature/battle/BattlePageLayout';
import { CombatStatusHeader } from '@/components/feature/battle/v5/CombatStatusHeader';
import { CombatActionLog } from '@/components/feature/battle/v5/CombatActionLog';
import { CombatControlBar } from '@/components/feature/battle/v5/CombatControlBar';
import { CombatAttributeModal } from '@/components/feature/battle/v5/CombatAttributeModal';
import { CombatResultDialog } from '@/components/feature/battle/v5/CombatResultDialog';
import type { UnitStateSnapshot } from '@/engine/battle-v5/systems/state/types';
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
    reset,
    totalActions,
    progress,
    unitSnapshots,
  } = useCombatPlayer(battleResult);

  const [battleSettlement, setBattleSettlement] =
    useState<BattleCallbackData | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<UnitStateSnapshot | null>(null);
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
  const playerUnitId = battleResult?.player || '';
  const opponentUnitId = battleResult?.opponent || '';
  const currentPlayerFrame = unitSnapshots[playerUnitId];
  const currentOpponentFrame = unitSnapshots[opponentUnitId];

  const isPlaybackFinished = battleEnd && currentIndex >= totalActions - 1;

  return (
    <BattlePageLayout
      title="副本战斗"
      subtitle="查看双方状态、技能变化和实时战斗日志。"
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

      {/* 详细属性弹窗 */}
      <CombatAttributeModal 
        unit={selectedUnit} 
        isOpen={!!selectedUnit} 
        onClose={() => setSelectedUnit(null)} 
      />

      <CombatResultDialog
        key={`dungeon-${battleResult?.turns}-${battleResult?.winner.id ?? 'unknown'}`}
        dialogKey={`dungeon-${battleResult?.turns}-${battleResult?.winner.id ?? 'unknown'}`}
        open={!!battleResult && isPlaybackFinished}
        title={battleResult?.winner.id === player.id ? '战斗胜利' : '战斗失败'}
        content={
          <p className="leading-8">
            {battleResult?.winner.id === player.id
              ? '你已经击败当前敌人，可以继续推进副本。'
              : '你在这场战斗中落败，本轮探索到此结束。'}
          </p>
        }
      />
    </BattlePageLayout>
  );
}
