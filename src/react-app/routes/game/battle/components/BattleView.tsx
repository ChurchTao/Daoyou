import { BattlePageLayout } from '@app/components/feature/battle/BattlePageLayout';
import { CombatStatusHeader } from '@app/components/feature/battle/v5/CombatStatusHeader';
import { CombatActionLog } from '@app/components/feature/battle/v5/CombatActionLog';
import { CombatControlBar } from '@app/components/feature/battle/v5/CombatControlBar';
import { CombatResultDialog } from '@app/components/feature/battle/v5/CombatResultDialog';

import { useBattleViewModel } from '../hooks/useBattleViewModel';
import { useCombatPlayer } from '../hooks/useCombatPlayer';
import { useEffect, useState } from 'react';
import { CombatAttributeModal } from '@app/components/feature/battle/v5/CombatAttributeModal';
import type { UnitStateSnapshot } from '@shared/engine/battle-v5/systems/state/types';

/**
 * 战斗主视图组件
 */
export function BattleView() {
  const [selectedUnit, setSelectedUnit] = useState<UnitStateSnapshot | null>(null);

  const {
    player,
    opponent,
    battleResult,
    loading,
    battleEnd,
    isWin,
    opponentName,
    handleBattleAgain,
  } = useBattleViewModel();

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

  // 初始加载完成后自动播放
  useEffect(() => {
    if (battleResult && totalActions > 0 && !isPlaying && currentIndex === -1) {
      play();
    }
  }, [battleResult, totalActions, isPlaying, currentIndex, play]);

  // 加载中
  if (!player || !opponent) {
    return (
      <div className="bg-paper flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-ink">加载中...</p>
        </div>
      </div>
    );
  }

  // 计算当前双方单位的实时状态快照
  const playerUnitId = battleResult?.player || '';
  const opponentUnitId = battleResult?.opponent || '';

  const currentPlayerFrame = unitSnapshots[playerUnitId];
  const currentOpponentFrame = unitSnapshots[opponentUnitId];

  return (
    <BattlePageLayout
      title={`战斗 · ${player?.name} vs ${opponentName}`}
      subtitle="实时查看血量、技能状态和战斗日志。"
      backHref="/game"
      loading={loading}
      battleResult={battleResult}
      isStreaming={false}
      actions={{
        primary: {
          label: '返回主界',
          href: '/',
        },
        secondary: [
          {
            label: '再战',
            onClick: handleBattleAgain,
          },
        ],
      }}
    >
      <div className="flex flex-col gap-4 mb-8">
        {/* 顶部状态栏 */}
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

        {/* 结构化联动日志 */}
        {battleResult && (
          <CombatActionLog
            spans={battleResult.logSpans}
            currentIndex={currentIndex}
          />
        )}

      </div>

      {/* 详细属性弹窗 */}
      <CombatAttributeModal 
        unit={selectedUnit} 
        isOpen={!!selectedUnit} 
        onClose={() => setSelectedUnit(null)} 
      />

      <CombatResultDialog
        key={`battle-${battleResult?.turns}-${battleResult?.winner.id ?? 'unknown'}`}
        dialogKey={`battle-${battleResult?.turns}-${battleResult?.winner.id ?? 'unknown'}`}
        open={!!battleResult && battleEnd && currentIndex >= totalActions - 1}
        title={isWin ? '战斗胜利' : '战斗失败'}
        content={
          <p className="leading-8">
            {isWin
              ? `「${player?.name}」在第 ${battleResult?.turns} 回合击败了对手。`
              : `「${player?.name}」在第 ${battleResult?.turns} 回合力竭倒下。`}
          </p>
        }
      />
    </BattlePageLayout>
  );
}
