import { InkPageShell, InkSection } from '@/components/layout';
import { InkButton } from '@/components/ui/InkButton';
import { InkCard } from '@/components/ui/InkCard';
import { InkNotice } from '@/components/ui/InkNotice';
import { DungeonOption } from '@/lib/dungeon/types';
import { getMapNode } from '@/lib/game/mapSystem';
import { DungeonViewState } from '@/lib/hooks/dungeon/useDungeonViewModel';
import { Cultivator } from '@/types/cultivator';
import { BattlePreparation } from './BattlePreparation';
import { BattleCallbackData, DungeonBattle } from './DungeonBattle';
import { DungeonExploring } from './DungeonExploring';
import { DungeonMapSelector } from './DungeonMapSelector';
import { DungeonSettlement } from './DungeonSettlement';
import { DungeonLooting } from './DungeonLooting';

interface DungeonViewRendererProps {
  viewState: DungeonViewState;
  cultivator: Cultivator | null;
  processing: boolean;
  actions: {
    startDungeon: (nodeId: string) => Promise<void>;
    performAction: (option: DungeonOption) => Promise<void>;
    quitDungeon: () => Promise<boolean>;
    continueLooting: () => Promise<void>;
    escapeLooting: () => Promise<void>;
    startBattle: (enemyName: string) => void;
    abandonBattle: () => Promise<void>;
    completeBattle: (data: BattleCallbackData | null) => void;
  };
  onSettlementConfirm?: () => void;
}

/**
 * 副本视图渲染器
 */
export function DungeonViewRenderer({
  viewState,
  cultivator,
  processing,
  actions,
  onSettlementConfirm,
}: DungeonViewRendererProps) {
  // 加载状态
  if (viewState.type === 'loading') {
    return (
      <InkPageShell title="推演中...">
        <div className="flex justify-center p-12">
          <p className="animate-pulse">天机混沌，正在解析...</p>
        </div>
      </InkPageShell>
    );
  }

  // 未认证
  if (viewState.type === 'not_authenticated') {
    return (
      <InkPageShell title="单人副本">
        <InkNotice tone="warning">请先登录或创建角色</InkNotice>
      </InkPageShell>
    );
  }

  // 战斗中
  if (viewState.type === 'in_battle' && cultivator) {
    return (
      <DungeonBattle
        battleId={viewState.battleId}
        player={cultivator}
        onBattleComplete={actions.completeBattle}
      />
    );
  }

  // 战斗准备
  if (viewState.type === 'battle_preparation' && cultivator) {
    return (
      <BattlePreparation
        battleId={viewState.state.activeBattleId!}
        onStart={actions.startBattle}
        onAbandon={actions.abandonBattle}
      />
    );
  }

  // 结算
  if (viewState.type === 'settlement') {
    return (
      <DungeonSettlement
        settlement={viewState.settlement}
        realGains={viewState.realGains}
        onConfirm={onSettlementConfirm}
      />
    );
  }

  // 战后休整
  if (viewState.type === 'looting') {
    return (
      <DungeonLooting
        state={viewState.state}
        onContinue={actions.continueLooting}
        onEscape={actions.escapeLooting}
        onQuit={actions.quitDungeon}
        processing={processing}
      />
    );
  }

  // 探索中
  if (viewState.type === 'exploring') {
    return (
      <DungeonExploring
        state={viewState.state}
        lastRound={viewState.lastRound}
        onAction={actions.performAction}
        onQuit={actions.quitDungeon}
        processing={processing}
      />
    );
  }

  // 地图选择
  if (viewState.type === 'map_selection') {
    const selectedNode = viewState.preSelectedNodeId
      ? getMapNode(viewState.preSelectedNodeId)
      : null;

    const renderLimitHint = () => {
      if (viewState.limitLoading) {
        return <p className="text-ink-secondary mt-2 text-center text-xs">查询中...</p>;
      }
      if (!viewState.limitInfo) return null;
      const { remaining, dailyLimit } = viewState.limitInfo;
      if (remaining === 0) return <p className="text-crimson mt-2 text-center text-sm">今日探索次数已用尽，明日再来</p>;
      const textColor = remaining === 1 ? 'text-amber-600' : 'text-ink';
      return <p className={`text-center text-xs ${textColor} mt-2`}>今日剩余探索次数：{remaining}/{dailyLimit}</p>;
    };

    return (
      <InkPageShell title="云游探秘" backHref="/game" subtitle="寻找上古机缘">
        <InkCard className="mb-6 p-6">
          <div className="space-y-4 text-center">
            <div className="my-4 text-6xl">🏔️</div>
            <p>修仙界广袄无垠，机缘与危机并存。<br />道友可愿前往，体悟一段未知的旅程？</p>
          </div>
        </InkCard>
        <InkSection title="选择秘境">
          <DungeonMapSelector
            selectedNode={selectedNode ?? null}
            onStart={actions.startDungeon}
            isStarting={processing}
          />
        </InkSection>
        {renderLimitHint()}
        <div className="mt-4 text-center">
          <InkButton href="/game/dungeon/history" variant="ghost">📖 查看历史记录</InkButton>
        </div>
      </InkPageShell>
    );
  }

  return null;
}
