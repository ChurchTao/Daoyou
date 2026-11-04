import { GameSceneLoading } from '@app/components/game-shell';
import { InkButton } from '@app/components/ui/InkButton';
import { InkCard } from '@app/components/ui/InkCard';
import { InkNotice } from '@app/components/ui/InkNotice';
import type { BattleCallbackData } from '@app/lib/hooks/dungeon/types';
import { DungeonViewState } from '@app/lib/hooks/dungeon/useDungeonViewModel';
import { getMapNode } from '@daoyou/game-content/world/map';
import type { Cultivator } from '@daoyou/game-domain/character';
import type {
  DungeonRecoverAction,
  DungeonState,
} from '@daoyou/game-domain/dungeon';
import type {
  MysteryAction,
  MysteryAnswers,
  MysteryEvidence,
} from '@daoyou/game-domain/dungeon/mystery';
import { dungeonReadiness } from '@daoyou/game-rules/dungeon';
import { canChallengeDungeonRealm } from '@daoyou/game-rules/world/dungeon';
import { DungeonSceneScreen } from '../dungeonScene';
import {
  resolveDungeonSceneDescriptor,
  type DungeonSceneState,
} from '../dungeonSceneRegistry';
import { BattlePreparation } from './BattlePreparation';
import { DungeonBattle } from './DungeonBattle';
import { DungeonMapSelector } from './DungeonMapSelector';
import { DungeonMystery } from './DungeonMystery';
import type { DungeonDisplayResources } from './DungeonRunPanel';
import { DungeonSettlement } from './DungeonSettlement';

interface DungeonViewRendererProps {
  viewState: DungeonViewState;
  cultivator: Pick<
    Cultivator,
    'id' | 'realm' | 'attributes' | 'condition'
  > | null;
  displayResources?: DungeonDisplayResources;
  processing: boolean;
  actions: {
    beginBattle: () => Promise<void>;
    startDungeon: (nodeId: string) => Promise<void>;
    quitDungeon: () => Promise<boolean>;
    recoverDungeon: (action: DungeonRecoverAction) => Promise<void>;
    completeBattle: (data: BattleCallbackData | null) => void;
    mysteryAct: (action: MysteryAction) => Promise<void>;
    mysteryDeduce: (
      answers: MysteryAnswers,
      evidence: MysteryEvidence,
    ) => Promise<void>;
    mysteryTalk: (npcId: string, question: string) => Promise<boolean>;
    mysteryGuard: (guardId: string) => Promise<void>;
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

/** 出行前的状态：只列气血、法力，不足时去灵眼之泉恢复。 */
function TravelStatus({
  displayResources,
}: {
  displayResources: DungeonDisplayResources | undefined;
}) {
  if (!displayResources) return null;
  const { hp, mp } = displayResources;
  return (
    <div className="text-ink-secondary flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <span>
        气血{' '}
        <span className="text-ink font-mono font-semibold tracking-tight">
          {Math.floor(hp.current)}/{Math.floor(hp.max)}
        </span>
      </span>
      <span>
        法力{' '}
        <span className="text-ink font-mono font-semibold tracking-tight">
          {Math.floor(mp.current)}/{Math.floor(mp.max)}
        </span>
      </span>
      <InkButton href="/game/inn" variant="secondary">
        恢复状态
      </InkButton>
    </div>
  );
}

const HOW_TO = [
  {
    title: '调查',
    text: '点正文里带虚线的字：调查物件、与人交谈、前往别处，每步耗 1 点行动力。',
  },
  {
    title: '推理',
    text: '线索自动记进案情板，可以作为推理题的证据。',
  },
  {
    title: '结案',
    text: '行动力用尽前提交推理。答对且有线索为证，评分才高。',
  },
];

/** 秘境首页的玩法速览：调查、推理、结案三步。 */
function MysteryHowTo() {
  return (
    <section className="space-y-3">
      <h2 className="text-ink-secondary text-sm">怎么玩</h2>
      <ol className="space-y-3">
        {HOW_TO.map((step, index) => (
          <li key={step.title} className="flex gap-3 text-sm leading-7">
            <span className="text-crimson font-mono">{index + 1}</span>
            <span>
              <span className="font-semibold">{step.title}</span>
              <span className="text-ink-secondary"> · {step.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * 副本视图渲染器
 */
export function DungeonViewRenderer({
  viewState,
  cultivator,
  displayResources,
  processing,
  actions,
  onSettlementConfirm,
}: DungeonViewRendererProps) {
  if (viewState.type === 'loading') {
    const descriptor = resolveDungeonSceneDescriptor('loading');

    return (
      <DungeonSceneScreen descriptor={descriptor}>
        <GameSceneLoading message={descriptor.loadingMessage} />
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

  if (viewState.type === 'battle_preparation' && viewState.state.encounter) {
    return (
      <DungeonSceneScreen
        descriptor={{
          ...resolveDungeonRunSceneDescriptor(
            'battle_preparation',
            viewState.state,
          ),
          hideChrome: Boolean(viewState.state.mysteryView),
        }}
      >
        <BattlePreparation
          encounter={viewState.state.encounter}
          processing={processing}
          onBegin={actions.beginBattle}
          onQuit={actions.quitDungeon}
          mode={viewState.state.mysteryView?.pendingBattle}
          portrait={viewState.state.mysteryView?.pendingFoePortrait}
        />
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

  if (viewState.type === 'settlement') {
    return (
      <DungeonSceneScreen
        descriptor={resolveDungeonSceneDescriptor('settlement')}
      >
        <DungeonSettlement
          settlement={viewState.settlement}
          realGains={viewState.realGains}
          mysteryResult={viewState.mystery?.result}
          onConfirm={onSettlementConfirm}
        />
      </DungeonSceneScreen>
    );
  }

  if (viewState.type === 'recoverable_error') {
    const actionsAvailable =
      viewState.state.recoverableActions ??
      (['safe_retreat', 'force_quit'] satisfies DungeonRecoverAction[]);
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
            <h2 className="text-crimson mb-2 text-xl font-bold">
              秘境推演中断
            </h2>
            <p className="text-ink-secondary leading-7">
              {viewState.state.statusReason ||
                '本次探索尚可处理，请选择下方操作。'}
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

  if (viewState.type === 'mystery') {
    return (
      <DungeonSceneScreen
        descriptor={{
          ...resolveDungeonRunSceneDescriptor('exploring', viewState.state),
          hideChrome: true,
        }}
      >
        <DungeonMystery
          view={viewState.view}
          runId={viewState.state.runId}
          processing={processing}
          onAct={actions.mysteryAct}
          onTalk={actions.mysteryTalk}
          onGuard={actions.mysteryGuard}
          onDeduce={actions.mysteryDeduce}
          onQuit={actions.quitDungeon}
          scene={
            getMapNode(viewState.state.mapNodeId)?.dungeon_config?.scenario
              ?.scene
          }
        />
      </DungeonSceneScreen>
    );
  }

  if (viewState.type === 'legacy') {
    return (
      <DungeonSceneScreen
        descriptor={resolveDungeonRunSceneDescriptor(
          'exploring',
          viewState.state,
        )}
      >
        <InkCard className="space-y-4 p-6">
          <p className="text-ink leading-7">
            这是旧版云游留下的未完成探索。云游探秘已改为解谜玩法，旧探索无法继续推进；结束后此前已确定的收获照常带回。
          </p>
          <InkButton
            variant="primary"
            disabled={processing}
            onClick={() => void actions.quitDungeon()}
          >
            结束探索
          </InkButton>
        </InkCard>
      </DungeonSceneScreen>
    );
  }

  if (viewState.type === 'map_selection') {
    const selectedNode = viewState.preSelectedNodeId
      ? getMapNode(viewState.preSelectedNodeId)
      : null;
    const selectedNodeRealm =
      selectedNode && 'realm_requirement' in selectedNode
        ? selectedNode.realm_requirement
        : null;
    const realmBlockReason =
      cultivator &&
      selectedNodeRealm &&
      !canChallengeDungeonRealm(cultivator.realm, selectedNodeRealm)
        ? `当前为${cultivator.realm}，尚不能挑战要求${selectedNodeRealm}的秘境。`
        : null;
    const readiness =
      cultivator && displayResources
        ? dungeonReadiness({
            realm: cultivator.realm,
            selectedNodeRealm,
            hp: displayResources.hp,
            mp: displayResources.mp,
            firstVisit: false,
          })
        : null;

    return (
      <DungeonSceneScreen
        descriptor={resolveDungeonSceneDescriptor('map_selection')}
      >
        {/* 宽屏两栏：左侧选定的秘境与开局，右侧玩法与当前状态。 */}
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <DungeonMapSelector
            selectedNode={selectedNode ?? null}
            onStart={actions.startDungeon}
            isStarting={processing}
            readiness={readiness}
            realmBlockReason={realmBlockReason}
            playerRealm={cultivator?.realm}
          />
          <aside className="space-y-6">
            <MysteryHowTo />
            <TravelStatus displayResources={displayResources} />
            <InkButton href="/game/dungeon/history" variant="ghost">
              过往探秘记录
            </InkButton>
          </aside>
        </div>
      </DungeonSceneScreen>
    );
  }

  return null;
}
