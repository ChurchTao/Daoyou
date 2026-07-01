import { GameSceneSection } from '@app/components/game-shell';
import { InkSection } from '@app/components/layout';
import { InkButton } from '@app/components/ui/InkButton';
import { InkCard } from '@app/components/ui/InkCard';
import { InkNotice } from '@app/components/ui/InkNotice';
import type {
  DungeonOption,
  DungeonRecoverAction,
  DungeonState,
} from '@shared/lib/dungeon/types';
import { canChallengeDungeonRealm, getMapNode } from '@shared/lib/game/mapSystem';
import { isConditionStatusActive } from '@shared/lib/condition';
import { getConditionStatusTemplate } from '@shared/lib/conditionStatusRegistry';
import { DungeonViewState } from '@app/lib/hooks/dungeon/useDungeonViewModel';
import { DungeonAbandonBattleResult } from '@app/lib/hooks/dungeon/useEnemyProbe';
import { Cultivator } from '@shared/types/cultivator';
import type { CultivatorDisplaySnapshot } from '@shared/engine/battle-v5/adapters/CultivatorDisplayAdapter';
import { evaluateNoviceReadiness } from '@shared/lib/noviceGuidance';
import type { TaskInstance } from '@shared/types/task';
import { DungeonSceneScreen } from '../dungeonScene';
import {
  resolveDungeonSceneDescriptor,
  type DungeonSceneState,
} from '../dungeonSceneRegistry';
import { BattlePreparation } from './BattlePreparation';
import { BattleCallbackData, DungeonBattle } from './DungeonBattle';
import { DungeonExploring } from './DungeonExploring';
import { DungeonMapSelector } from './DungeonMapSelector';
import { DungeonSettlement } from './DungeonSettlement';
import { DungeonLooting } from './DungeonLooting';
import { DungeonRunPanel } from './DungeonRunPanel';

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
      action: DungeonRecoverAction,
    ) => Promise<void>;
    startBattle: (enemyName: string) => void;
    abandonBattle: (result: DungeonAbandonBattleResult) => Promise<void>;
    completeBattle: (data: BattleCallbackData | null) => void;
  };
  onSettlementConfirm?: () => void;
}

function resolveDungeonRunSceneDescriptor(
  sceneState: DungeonSceneState,
  state: DungeonState,
) {
  const descriptor = resolveDungeonSceneDescriptor(sceneState);
  const mapNode = getMapNode(state.mapNodeId);

  if (!mapNode?.name) return descriptor;

  return {
    ...descriptor,
    sceneLabel: mapNode.name,
  };
}

function renderPreparationNotice(
  cultivator: Cultivator | null,
  displayResources: CultivatorDisplaySnapshot['resources'] | undefined,
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
  const hp = displayResources?.hp;
  const mp = displayResources?.mp;
  const hpPercent = Math.max(0, Math.min(100, Math.round(hp?.percent ?? 0)));
  const mpPercent = Math.max(0, Math.min(100, Math.round(mp?.percent ?? 0)));
  const nodeRealm = selectedNode?.realm_requirement;
  const realmRisk =
    nodeRealm && !canChallengeDungeonRealm(cultivator.realm, nodeRealm)
      ? 'danger'
      : nodeRealm === cultivator.realm
        ? 'warning'
        : 'info';
  const reminder =
    readiness?.shouldBlock
      ? readiness.reasons[0]
      : realmRisk === 'danger'
        ? `秘境要求${nodeRealm}，高于当前${cultivator.realm}境界。`
        : statusNames
          ? `当前有${statusNames}状态，出行前可先调息。`
          : hpPercent < 60 || mpPercent < 60
            ? '气血或法力偏低，出行前可先补足。'
            : '状态平稳，可以出行；遇险时优先查探再决断。';

  return (
    <GameSceneSection
      title="出行准备"
      help={{
        title: '秘境探索说明',
        content: (
          <div className="space-y-3 text-sm leading-7">
            <p>秘境推进以当前轮次、选项代价、危险度和结算结果为准。</p>
            <p>气血、法力、异常状态用于出行前判断，不作为探索选项的通过条件。</p>
            <p>遭遇强敌时可先查探；撤退会进入结算或离开流程，继续深入会提高风险与收益预期。</p>
            <p>丹药仍通过储物袋等通用入口使用，不写入当前副本进度。</p>
          </div>
        ),
      }}
    >
      <div className="border-ink/20 bg-paper/80 space-y-4 border border-dashed p-4 text-sm leading-7">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="mb-1 flex items-center justify-between gap-3 text-xs">
              <span className="text-ink-secondary">气血</span>
              <span className="text-ink tabular-nums">
                {Math.floor(hp?.current ?? 0)}/{Math.floor(hp?.max ?? 0)}
              </span>
            </div>
            <div className="bg-ink/10 h-1.5 overflow-hidden">
              <div
                className="bg-crimson h-full"
                style={{ width: `${hpPercent}%` }}
              />
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between gap-3 text-xs">
              <span className="text-ink-secondary">法力</span>
              <span className="text-ink tabular-nums">
                {Math.floor(mp?.current ?? 0)}/{Math.floor(mp?.max ?? 0)}
              </span>
            </div>
            <div className="bg-ink/10 h-1.5 overflow-hidden">
              <div
                className="bg-[var(--color-tier-xuan)] h-full"
                style={{ width: `${mpPercent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <p>异常：{statusNames || '无'}</p>
          <p>
            秘境：
            {realmRisk === 'danger'
              ? '越阶'
              : realmRisk === 'warning'
                ? '同阶'
                : selectedNode
                  ? '稳妥'
                  : '待选'}
          </p>
        </div>

        <p className={realmRisk === 'danger' || readiness?.shouldBlock ? 'text-crimson' : 'text-ink-secondary'}>
          {reminder}
        </p>

        <div className="flex flex-wrap gap-2">
          <InkButton href="/game/map" variant="secondary">
            {selectedNode ? '重选秘境' : '前往地图'}
          </InkButton>
          <InkButton href="/game/inn" variant="secondary">
            去灵眼之泉
          </InkButton>
          <InkButton href="/game/craft/alchemy" variant="secondary">
            去炼丹房
          </InkButton>
        </div>
      </div>
    </GameSceneSection>
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
        descriptor={resolveDungeonRunSceneDescriptor(
          'in_battle',
          viewState.state,
        )}
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
      <DungeonSceneScreen
        descriptor={resolveDungeonRunSceneDescriptor(
          'battle_preparation',
          viewState.state,
        )}
      >
        <div className="pb-28">
          <DungeonRunPanel
            state={viewState.state}
            cultivator={cultivator}
            displayResources={displayResources}
            onQuit={actions.quitDungeon}
          />
          <BattlePreparation
            battleId={viewState.state.activeBattleId!}
            player={cultivator}
            onStart={actions.startBattle}
            onAbandon={actions.abandonBattle}
          />
        </div>
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
      <DungeonSceneScreen
        descriptor={resolveDungeonRunSceneDescriptor('looting', viewState.state)}
      >
        <DungeonLooting
          state={viewState.state}
          cultivator={cultivator}
          displayResources={displayResources}
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
      'safe_retreat',
      'force_quit',
    ] satisfies DungeonRecoverAction[];
    const recoverActionLabels: Record<DungeonRecoverAction, string> = {
      retry: '重新推演',
      retry_continue: '重试推进',
      retry_settle: '重试结算',
      safe_retreat: '安全撤退',
      force_quit: '放弃副本',
    };
    const recoverActionVariants: Record<
      DungeonRecoverAction,
      'primary' | 'secondary' | 'ghost'
    > = {
      retry: 'primary',
      retry_continue: 'primary',
      retry_settle: 'primary',
      safe_retreat: 'secondary',
      force_quit: 'ghost',
    };
    return (
      <DungeonSceneScreen
        descriptor={resolveDungeonRunSceneDescriptor(
          'exploring',
          viewState.state,
        )}
      >
        <InkCard className="space-y-4 p-6">
          <div>
            <h2 className="text-crimson mb-2 text-xl font-bold">秘境推演中断</h2>
            <p className="text-ink-secondary leading-7">
              {viewState.state.statusReason || '当前副本状态可恢复，请选择后续处理方式。'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {actionsAvailable.map((action) => (
              <InkButton
                key={action}
                variant={recoverActionVariants[action]}
                disabled={processing}
                onClick={() => actions.recoverDungeon(action)}
              >
                {recoverActionLabels[action]}
              </InkButton>
            ))}
          </div>
        </InkCard>
      </DungeonSceneScreen>
    );
  }

  if (viewState.type === 'exploring') {
    return (
      <DungeonSceneScreen
        descriptor={resolveDungeonRunSceneDescriptor(
          'exploring',
          viewState.state,
        )}
      >
        <DungeonExploring
          state={viewState.state}
          lastRound={viewState.lastRound}
          cultivator={cultivator}
          displayResources={displayResources}
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
    const realmBlockReason =
      cultivator &&
      selectedNodeRealm &&
      !canChallengeDungeonRealm(cultivator.realm, selectedNodeRealm)
        ? `当前境界${cultivator.realm}不可挑战${selectedNodeRealm}副本，请先提升大境界。`
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
            hasRecoveryPill: null,
          })
        : null;

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
            realmBlockReason={realmBlockReason}
            playerRealm={cultivator?.realm}
          />
        </InkSection>
        {renderPreparationNotice(
          cultivator,
          displayResources,
          selectedNode ?? null,
          readiness,
        )}
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
