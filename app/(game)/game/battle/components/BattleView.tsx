'use client';

import { BattlePageLayout } from '@/components/feature/battle/BattlePageLayout';
import { CombatStatusHeader } from '@/components/feature/battle/v5/CombatStatusHeader';
import { CombatActionLog } from '@/components/feature/battle/v5/CombatActionLog';
import { CombatControlBar } from '@/components/feature/battle/v5/CombatControlBar';

import { useBattleViewModel } from '../hooks/useBattleViewModel';
import { useCombatPlayer } from '../hooks/useCombatPlayer';
import { useEffect } from 'react';

/**
 * 战斗主视图组件
 */
export function BattleView() {
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
      title={`【决战 · ${player?.name} vs ${opponentName}】`}
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
          />
        )}

        {/* 结构化联动日志 */}
        {battleResult && (
          <CombatActionLog 
            spans={battleResult.logSpans} 
            currentIndex={currentIndex} 
          />
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

      </div>

      {/* 战斗结果汇总（播放结束后显示） */}
      {battleEnd && currentIndex >= totalActions - 1 && (
        <div className="mt-4 p-4 border border-crimson/30 bg-crimson/5 rounded-sm text-center animate-fade-in">
          <p className="text-crimson text-xl font-heading mb-2">
            {isWin ? '大获全胜！' : '惜败于此...'}
          </p>
          <p className="text-ink/80 text-sm italic">
            {isWin ? `「${player?.name}」在第 ${battleResult?.turns} 回合击败了对手` : `「${player?.name}」在第 ${battleResult?.turns} 回合力竭倒下`}
          </p>
        </div>
      )}
    </BattlePageLayout>
  );
}

