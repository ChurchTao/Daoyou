'use client';

import { BattlePageLayout } from '@/components/feature/battle/BattlePageLayout';
import { BattleReportViewer } from '@/components/feature/battle/BattleReportViewer';
import { BattleTimelineViewer } from '@/components/feature/battle/BattleTimelineViewer';

import { useBattleViewModel } from '../hooks/useBattleViewModel';

/**
 * 战斗主视图组件
 */
export function BattleView() {
  const {
    player,
    opponent,
    battleResult,
    isStreaming,
    loading,
    battleEnd,
    isWin,
    displayReport,
    opponentName,
    handleBattleAgain,
  } = useBattleViewModel();

  // 加载中
  if (!player || !opponent) {
    return (
      <div className="bg-paper min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-ink">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <BattlePageLayout
      title={`【战报 · ${player?.name} vs ${opponentName}】`}
      backHref="/game"
      loading={loading}
      battleResult={battleResult}
      isStreaming={isStreaming}
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
          {
            label: '分享战报',
            onClick: () => {
              alert('分享功能开发中...');
            },
          },
        ],
      }}
    >
      {/* 数值战斗回放 */}
      {battleResult?.timeline &&
        battleResult.timeline.length > 0 &&
        opponent &&
        player &&
        (isStreaming || battleEnd) && (
          <BattleTimelineViewer battleResult={battleResult} />
        )}

      {/* 战斗播报 */}
      <BattleReportViewer
        displayReport={displayReport}
        isStreaming={isStreaming}
        battleResult={battleResult}
        player={player}
        isWin={isWin}
      />
    </BattlePageLayout>
  );
}
