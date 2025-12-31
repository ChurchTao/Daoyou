import { InkPageShell, InkSection } from '@/components/layout';
import { InkCard, InkNotice } from '@/components/ui';
import { DungeonOption } from '@/lib/dungeon/types';
import { getMapNode } from '@/lib/game/mapSystem';
import { DungeonViewState } from '@/lib/hooks/dungeon/useDungeonViewModel';
import { Cultivator } from '@/types/cultivator';
import { BattlePreparation } from './BattlePreparation';
import { BattleCallbackData, DungeonBattle } from './DungeonBattle';
import { DungeonExploring } from './DungeonExploring';
import { DungeonMapSelector } from './DungeonMapSelector';
import { DungeonSettlement } from './DungeonSettlement';

interface DungeonViewRendererProps {
  viewState: DungeonViewState;
  cultivator: Cultivator | null;
  processing: boolean;
  actions: {
    startDungeon: (nodeId: string) => Promise<void>;
    performAction: (option: DungeonOption) => Promise<void>;
    quitDungeon: () => Promise<boolean>;
    startBattle: (enemyName: string) => void;
    abandonBattle: () => Promise<void>;
    completeBattle: (data: BattleCallbackData | null) => void;
  };
  onSettlementConfirm?: () => void;
}

/**
 * 副本视图渲染器
 *
 * 职责：
 * 根据 viewState 渲染对应的视图组件
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
        onConfirm={onSettlementConfirm}
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

    return (
      <InkPageShell title="云游探秘" backHref="/" subtitle="寻找上古机缘">
        <InkCard className="p-6 mb-6">
          <div className="text-center space-y-4">
            <div className="text-6xl my-4">🏔️</div>
            <p>
              修仙界广袤无垠，机缘与危机并存。
              <br />
              道友可愿前往，体悟一段未知的旅程？
            </p>
          </div>
        </InkCard>
        <InkSection title="选择秘境">
          <DungeonMapSelector
            selectedNode={selectedNode ?? null}
            onStart={actions.startDungeon}
            isStarting={processing}
          />
        </InkSection>
        <p className="text-center text-xs text-ink-secondary mt-2">
          * 每日仅可探索一次（体验版，不会消耗材料、获得奖励）
        </p>
      </InkPageShell>
    );
  }

  // 不应该到达这里
  return null;
}
