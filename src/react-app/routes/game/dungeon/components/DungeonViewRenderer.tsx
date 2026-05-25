import { InkSection } from '@app/components/layout';
import { InkButton } from '@app/components/ui/InkButton';
import { InkCard } from '@app/components/ui/InkCard';
import { InkNotice } from '@app/components/ui/InkNotice';
import { DungeonOption } from '@shared/lib/dungeon/types';
import { getMapNode } from '@shared/lib/game/mapSystem';
import { DungeonViewState } from '@app/lib/hooks/dungeon/useDungeonViewModel';
import { DungeonAbandonBattleResult } from '@app/lib/hooks/dungeon/useEnemyProbe';
import { Cultivator } from '@shared/types/cultivator';
import { DungeonSceneScreen } from '../dungeonScene';
import { resolveDungeonSceneDescriptor } from '../dungeonSceneRegistry';
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
    abandonBattle: (result: DungeonAbandonBattleResult) => Promise<void>;
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
  if (viewState.type === 'loading') {
    const descriptor = resolveDungeonSceneDescriptor('loading');

    return (
      <DungeonSceneScreen descriptor={descriptor}>
        <div className="text-center">
          <p className="loading-tip">{descriptor.loadingMessage}</p>
        </div>
      </DungeonSceneScreen>
    );
  }

  if (viewState.type === 'not_authenticated') {
    const descriptor = resolveDungeonSceneDescriptor('not_authenticated');

    return (
      <DungeonSceneScreen descriptor={descriptor}>
        <div className="mx-auto w-full max-w-xl">
          <InkNotice tone="warning">请先登录或创建角色</InkNotice>
        </div>
      </DungeonSceneScreen>
    );
  }

  if (viewState.type === 'in_battle' && cultivator) {
    return (
      <DungeonSceneScreen
        descriptor={resolveDungeonSceneDescriptor('in_battle')}
        className="h-full"
      >
        <DungeonBattle
          battleId={viewState.battleId}
          player={cultivator}
          onBattleComplete={actions.completeBattle}
        />
      </DungeonSceneScreen>
    );
  }

  if (viewState.type === 'battle_preparation' && cultivator) {
    return (
      <DungeonSceneScreen descriptor={resolveDungeonSceneDescriptor('battle_preparation')}>
        <BattlePreparation
          battleId={viewState.state.activeBattleId!}
          onStart={actions.startBattle}
          onAbandon={actions.abandonBattle}
        />
      </DungeonSceneScreen>
    );
  }

  if (viewState.type === 'settlement') {
    return (
      <DungeonSceneScreen descriptor={resolveDungeonSceneDescriptor('settlement')}>
        <DungeonSettlement
          settlement={viewState.settlement}
          realGains={viewState.realGains}
          onConfirm={onSettlementConfirm}
        />
      </DungeonSceneScreen>
    );
  }

  if (viewState.type === 'looting') {
    return (
      <DungeonSceneScreen descriptor={resolveDungeonSceneDescriptor('looting')}>
        <DungeonLooting
          state={viewState.state}
          onContinue={actions.continueLooting}
          onEscape={actions.escapeLooting}
          onQuit={actions.quitDungeon}
          processing={processing}
        />
      </DungeonSceneScreen>
    );
  }

  if (viewState.type === 'exploring') {
    return (
      <DungeonSceneScreen descriptor={resolveDungeonSceneDescriptor('exploring')}>
        <DungeonExploring
          state={viewState.state}
          lastRound={viewState.lastRound}
          onAction={actions.performAction}
          onQuit={actions.quitDungeon}
          processing={processing}
        />
      </DungeonSceneScreen>
    );
  }

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
      const textColor = remaining === 1 ? 'text-wood' : 'text-ink';
      return <p className={`text-center text-xs ${textColor} mt-2`}>今日剩余探索次数：{remaining}/{dailyLimit}</p>;
    };

    return (
      <DungeonSceneScreen descriptor={resolveDungeonSceneDescriptor('map_selection')}>
        <InkCard className="mb-6 p-6">
          <div className="space-y-4 text-center">
            <div className="my-4 text-6xl">🏔️</div>
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
        {renderLimitHint()}
        <div className="mt-4 text-center">
          <InkButton href="/game/dungeon/history" variant="ghost">
            📖 查看历史记录
          </InkButton>
        </div>
      </DungeonSceneScreen>
    );
  }

  return null;
}
