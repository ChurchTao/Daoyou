'use client';

import { BattlePageLayout } from '@/components/feature/battle/BattlePageLayout';
import { BattleReportViewer } from '@/components/feature/battle/BattleReportViewer';
import { BattleTimelineViewer } from '@/components/feature/battle/BattleTimelineViewer';
import Link from 'next/link';

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
    playerLoading,
    opponentLoading,
    opponentError,
    battleEnd,
    isWin,
    displayReport,
    opponentName,
    handleBattleAgain,
  } = useBattleViewModel();

  // 加载中
  if (playerLoading || opponentLoading) {
    return (
      <div className="bg-paper min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-ink">加载中...</p>
        </div>
      </div>
    );
  }

  // 未找到玩家
  if (!player) {
    return (
      <div className="bg-paper min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-ink">未找到角色信息</p>
          <Link href="/create" className="btn-primary">
            创建角色
          </Link>
        </div>
      </div>
    );
  }

  return (
    <BattlePageLayout
      title={`【战报 · ${player?.name} vs ${opponentName}】`}
      backHref="/"
      error={opponentError}
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
        (isStreaming || battleEnd) && (
          <BattleTimelineViewer
            battleResult={battleResult}
            playerName={player.name}
            opponentName={opponent.name}
          />
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
