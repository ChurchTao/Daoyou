import { InkSection } from '@app/components/layout';
import { InkButton } from '@app/components/ui/InkButton';
import { InkCard } from '@app/components/ui/InkCard';
import { InkNotice } from '@app/components/ui/InkNotice';
import { DungeonOption } from '@shared/lib/dungeon/types';
import { getMapNode } from '@shared/lib/game/mapSystem';
import {
  getPillToxicityStage,
  isConditionStatusActive,
} from '@shared/lib/condition';
import { getConditionStatusTemplate } from '@shared/lib/conditionStatusRegistry';
import { REALM_ORDER } from '@shared/types/constants';
import { DungeonViewState } from '@app/lib/hooks/dungeon/useDungeonViewModel';
import { DungeonAbandonBattleResult } from '@app/lib/hooks/dungeon/useEnemyProbe';
import { Cultivator } from '@shared/types/cultivator';
import type { CultivatorDisplaySnapshot } from '@shared/engine/battle-v5/adapters/CultivatorDisplayAdapter';
import { evaluateNoviceReadiness } from '@shared/lib/noviceGuidance';
import type { TaskInstance } from '@shared/types/task';
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
  displayResources?: CultivatorDisplaySnapshot['resources'];
  tasks: TaskInstance[];
  processing: boolean;
  actions: {
    startDungeon: (nodeId: string) => Promise<void>;
    performAction: (option: DungeonOption) => Promise<void>;
    quitDungeon: () => Promise<boolean>;
    continueLooting: () => Promise<void>;
    escapeLooting: () => Promise<void>;
    recoverDungeon: (
      action: 'retry' | 'safe_retreat' | 'force_quit',
    ) => Promise<void>;
    startBattle: (enemyName: string) => void;
    abandonBattle: (result: DungeonAbandonBattleResult) => Promise<void>;
    completeBattle: (data: BattleCallbackData | null) => void;
  };
  onSettlementConfirm?: () => void;
}

function renderPreparationNotice(
  cultivator: Cultivator | null,
  selectedNode: ReturnType<typeof getMapNode> | null,
  readiness: ReturnType<typeof evaluateNoviceReadiness> | null,
) {
  if (!cultivator) return null;

  const activeStatuses = (cultivator.condition?.statuses ?? []).filter(
    (status) => isConditionStatusActive(status),
  );
  const statusNames = activeStatuses
    .slice(0, 2)
    .map((status) => getConditionStatusTemplate(status.key)?.name ?? status.key)
    .join('、');
  const toxicityStage = getPillToxicityStage(cultivator.condition);
  const nodeRealm = selectedNode?.realm_requirement;
  const realmRisk =
    nodeRealm && REALM_ORDER[nodeRealm] > REALM_ORDER[cultivator.realm]
      ? 'danger'
      : nodeRealm && REALM_ORDER[nodeRealm] === REALM_ORDER[cultivator.realm]
        ? 'warning'
        : 'info';
  const riskText =
    realmRisk === 'danger'
      ? `当前秘境要求${nodeRealm}，已高于你的${cultivator.realm}境界。`
      : realmRisk === 'warning'
        ? `当前秘境与 ${cultivator.realm} 境同阶，进场前务必确认气血和法力。`
        : selectedNode
          ? '当前秘境境界要求较低，适合用来熟悉查探、撤退和结算。'
          : '第一次探秘建议从地图选择低境界秘境，先学会查探和撤退。';
  const bodyWarnings = [
    statusNames ? `当前有${statusNames}状态` : null,
    toxicityStage.key !== 'none' ? `丹毒：${toxicityStage.label}` : null,
  ].filter(Boolean);

  return (
    <InkSection title="出行准备">
      <div className="space-y-3 text-sm leading-7">
        <InkNotice tone={realmRisk === 'danger' ? 'warning' : 'info'}>
          {riskText}
        </InkNotice>
        {bodyWarnings.length > 0 ? (
          <InkNotice tone="warning">
            {bodyWarnings.join('，')}。若是第一次云游，建议先去客栈调息或服用疗伤丹。
          </InkNotice>
        ) : (
          <p className="text-ink-secondary">
            遇敌后先点“神识查探”，看不稳就撤退；撤退不会受伤，失败战斗会影响道体状态。
          </p>
        )}
        {readiness?.shouldBlock ? (
          <div className="space-y-2">
            {readiness.reasons.map((reason) => (
              <InkNotice key={reason} tone="warning">
                {reason}
              </InkNotice>
            ))}
            {readiness.hints.length > 0 ? (
              <p className="text-ink-secondary text-xs leading-6">
                {readiness.hints.slice(0, 2).join(' ')}
              </p>
            ) : null}
          </div>
        ) : readiness?.hints.length ? (
          <InkNotice tone="info">
            {readiness.hints.slice(0, 2).join(' ')}
          </InkNotice>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <InkButton href="/game/inn" variant="secondary">
            去客栈调息
          </InkButton>
          <InkButton href="/game/training-room" variant="secondary">
            去练功房
          </InkButton>
          <InkButton href="/game/craft/alchemy" variant="secondary">
            去炼丹房
          </InkButton>
        </div>
      </div>
    </InkSection>
  );
}

/**
 * 副本视图渲染器
 */
export function DungeonViewRenderer({
  viewState,
  cultivator,
  displayResources,
  tasks,
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
          player={cultivator}
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

  if (viewState.type === 'recoverable_error') {
    const actionsAvailable = viewState.state.recoverableActions ?? [
      'retry',
      'safe_retreat',
      'force_quit',
    ];
    return (
      <DungeonSceneScreen descriptor={resolveDungeonSceneDescriptor('exploring')}>
        <InkCard className="space-y-4 p-6">
          <div>
            <h2 className="text-crimson mb-2 text-xl font-bold">秘境推演中断</h2>
            <p className="text-ink-secondary leading-7">
              {viewState.state.statusReason || '当前副本状态可恢复，请选择后续处理方式。'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {actionsAvailable.includes('retry') ? (
              <InkButton
                variant="primary"
                disabled={processing}
                onClick={() => actions.recoverDungeon('retry')}
              >
                重新推演
              </InkButton>
            ) : null}
            {actionsAvailable.includes('safe_retreat') ? (
              <InkButton
                variant="secondary"
                disabled={processing}
                onClick={() => actions.recoverDungeon('safe_retreat')}
              >
                安全撤退
              </InkButton>
            ) : null}
            {actionsAvailable.includes('force_quit') ? (
              <InkButton
                variant="ghost"
                disabled={processing}
                onClick={() => actions.recoverDungeon('force_quit')}
              >
                放弃副本
              </InkButton>
            ) : null}
          </div>
        </InkCard>
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
    const firstDungeonTask = tasks.find(
      (task) => task.definitionId === 'tutorial_first_dungeon',
    );
    const selectedNodeRealm =
      selectedNode && 'realm_requirement' in selectedNode
        ? selectedNode.realm_requirement
        : null;
    const readiness =
      cultivator && displayResources
        ? evaluateNoviceReadiness({
            cultivator,
            selectedNodeRealm,
            hp: displayResources.hp,
            mp: displayResources.mp,
            isFirstDungeonTutorialActive: Boolean(
              firstDungeonTask && !firstDungeonTask.snapshot.isCompleted,
            ),
          })
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
            readiness={readiness}
          />
        </InkSection>
        {renderPreparationNotice(cultivator, selectedNode ?? null, readiness)}
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
