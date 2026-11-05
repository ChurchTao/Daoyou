import {
  REALM_STAGE_VALUES,
  REALM_VALUES,
  RealmType,
  type RealmStage,
} from '@daoyou/constants/realms';
import { DUNGEON_LIFESPAN_COST_MAX } from '@daoyou/game-content/dungeon/cost';
import {
  EXORCISM_REWARD_PACK,
  exorcismLineageForScene,
} from '@daoyou/game-content/dungeon/exorcism';
import { getMysteryFallbackCase } from '@daoyou/game-content/dungeon/scenarios';
import { getMapNode, isSatelliteNode } from '@daoyou/game-content/world/map';
import type { Cultivator } from '@daoyou/game-domain/character';
import type { DungeonEndDisposition } from '@daoyou/game-domain/dungeon';
import {
  EXORCISM_STAGE_COUNT,
  type ExorcismSupplyChoice,
} from '@daoyou/game-domain/dungeon/exorcism';
import { getRealmStageLevel } from '@daoyou/game-domain/progression';
import type {
  ResourceOperation,
  ResourceOperationResult,
  ResourceOperationSettlement,
} from '@daoyou/game-domain/resources';
import {
  applyExorcismSupply,
  createExorcismRun,
  exorcismBuildTags,
  exorcismEnding,
  exorcismIsCountered,
  planExorcismNemesisBonus,
  planExorcismSearchReward,
  planExorcismSettlement,
  retreatExorcism,
} from '@daoyou/game-rules/dungeon/exorcism';
import { getRealmStageNaturalAttributeValue } from '@daoyou/game-rules/progression/attributes';
import {
  appendDungeonReward,
  dungeonRewardItemName,
} from '@daoyou/game-rules/rewards/dungeon';
import {
  canChallengeDungeonRealm,
  resolveDungeonMapConfig,
} from '@daoyou/game-rules/world/dungeon';
import { assertCombatV6MutationAllowed } from '@server/combat/mutation-policy.js';
import { ConditionService } from '@server/cultivator/application/ConditionService.js';
import { QiService } from '@server/cultivator/application/QiService.js';
import { getPlayerIdentityCultivatorById } from '@server/cultivator/application/readers/CultivatorProfileRepository.js';
import { updateCultivator } from '@server/cultivator/application/readers/CultivatorStateRepository.js';
import { readCraftReadinessFacts } from '@server/cultivator/facts.js';
import {
  beginDungeonBattle,
  dungeonPlayer,
  getDungeonBattle,
  grantDungeonBeastExperience,
  prepareDungeonEncounter,
  prepareExorcismEncounter,
  type DungeonBattlePayload,
  type DungeonEncounterPayload,
} from '@server/dungeon/application/flow/combatV6.js';
import { applyDungeonCosts } from '@server/dungeon/application/flow/costs.js';
import { RewardFactory } from '@server/dungeon/application/flow/reward/index.js';
import {
  resolveDungeonReward,
  resolvePlanItems,
} from '@server/dungeon/application/flow/rewards.js';
import { grantInventory } from '@server/inventory/operations.js';
import type {
  DbClient,
  DbExecutor,
  DbTransaction,
} from '@server/lib/drizzle/db.js';
import { isBackgroundLlmEnabled } from '@server/lib/config/environment.js';
import { createDomainEvent } from '@server/lib/mq/domainEventWriter.js';
import { publishTransactionalMessageBestEffort } from '@server/lib/mq/transactionalMessagePublisher.js';
import {
  isRedisLockContention,
  redisLockKeys,
  type RedisLeaseContext,
  type withRedisLock,
} from '@server/lib/redis/lock.js';
import { findActiveCultivatorOwnerId } from '@server/lib/repositories/cultivatorRepository.js';
import type { ResourceEngine } from '@server/player/application/state/ResourceEngine.js';
import { queueAchievementRumor } from '@server/social/application/achievementRumor.js';
import { randomUUID } from 'crypto';
import type { generateDungeonEnding } from './DungeonSettlementGenerator.js';

import type {
  MysteryAction,
  MysteryAnswers,
  MysteryConfrontationOutcome,
  MysteryEvidence,
} from '@daoyou/game-domain/dungeon/mystery';
import {
  applyMysteryAction,
  applyMysteryDialogue,
  applyMysteryGuardBattle,
  checkMysteryAnswers,
  createMysteryRun,
  mysteryConfrontationTarget,
  mysteryFinalePortrait,
  mysteryGuardChallenge,
  mysteryNpcPresent,
  needsMysteryRestock,
  pickMysteryScenario,
  scoreMysteryRun,
} from '@daoyou/game-rules/dungeon/mystery';
import {
  DungeonOptionCost,
  DungeonPendingAction,
  DungeonRecoverAction,
  DungeonSettlement,
  DungeonState,
} from '@server/dungeon/application/flow/types.js';
import { textFilter } from '@server/social/application/textFilter.js';
import { normalizeFreeformLlmInput } from '@server/utils/llmPayload.js';
import { generateNpcReply } from '../mystery/MysteryDialogue.js';
import { isKeyClue, requireMysteryTemplate } from '../mystery/mysteryState.js';
import {
  insertScenario,
  loadScenarioCase,
  readScenarioLibrary,
  recordScenarioSettlement,
  recordScenarioStart,
  requestScenarioRestock,
  scenarioTemplatesForNode,
  wakeScenarioWorker,
} from '../mystery/ScenarioLibrary.js';
import type { DungeonRunStore } from './DungeonRunStore.js';
import { DungeonFlowError, DungeonFlowErrorCode } from './errors.js';

const FLOW_LOCK_TTL_SECONDS = 180;

/** 结尾对决的结算标签，按对手身份措辞。 */
function mysteryConfrontationTags(
  mystery: NonNullable<DungeonState['mystery']>,
): string[] {
  const outcome = mystery.result?.confrontation;
  const archetype = requireMysteryTemplate(mystery.templateId).archetype;
  if (archetype === 'unlock') {
    if (outcome === 'won') return ['通过试炼'];
    if (outcome === 'lost' || outcome === 'spared') return ['试炼未竟'];
    return [];
  }
  if (archetype === 'allegiance') {
    const side = mystery.caseFile.questions
      .find((q) => q.id === 'side')
      ?.options?.find((o) => o.id === mystery.result?.answers.side)?.label;
    return [
      ...(side ? [side.slice(0, 12)] : []),
      ...(outcome === 'won'
        ? ['力压对手']
        : outcome === 'lost' || outcome === 'spared'
          ? ['对手遁走']
          : []),
    ];
  }
  if (archetype === 'anomaly') {
    if (outcome === 'won') return ['镇灭异变'];
    if (outcome === 'lost' || outcome === 'spared') return ['异变未绝'];
    return [];
  }
  const rival = archetype === 'retrieval' ? '夺宝者' : '真凶';
  if (outcome === 'won') return [`擒下${rival}`];
  if (outcome === 'lost' || outcome === 'spared') return [`${rival}遁走`];
  return [];
}
export { DungeonFlowError, DungeonFlowErrorCode } from './errors.js';

class DungeonSettlementRecoverableError extends Error {
  constructor(
    message: string,
    public actions: DungeonRecoverAction[],
  ) {
    super(message);
    this.name = 'DungeonSettlementRecoverableError';
  }
}

type DungeonSettlementResult = {
  state?: DungeonState;
  settlement?: DungeonSettlement;
  isFinished: boolean;
  realGains?: ResourceOperation[];
  persist?: (tx: DbTransaction) => Promise<DungeonPersistenceSettlement | void>;
  afterCommit?: () => Promise<void>;
};

type DungeonSettlementOptions = {
  skipInjury?: boolean;
  abandonedBattle?: boolean;
  endDisposition?: DungeonEndDisposition;
  pendingAction?: DungeonPendingAction;
  deferPersistence?: boolean;
};

type DungeonFlowOptions = {
  materialSelections?: import('@daoyou/game-domain/dungeon').DungeonMaterialSelection[];
  deferPersistence?: boolean;
  lease?: RedisLeaseContext;
};

type DungeonPersistenceHooks = {
  persist: (tx: DbTransaction) => Promise<DungeonPersistenceSettlement | void>;
  afterCommit: () => Promise<void>;
};

export interface DungeonPersistenceSettlement {
  condition?: Cultivator['condition'];
  currency?: {
    spiritStones?: number;
    reputation?: number;
    qi?: number;
    qiLastRefreshedAt?: string | null;
  };
  progress?: Cultivator['cultivation_progress'];
  profile?: {
    lifespan?: number;
  };
  inventoryChanges?: ResourceOperationSettlement['inventoryChanges'];
}

function mergeDungeonPersistenceSettlements(
  ...settlements: Array<DungeonPersistenceSettlement | null | undefined>
): DungeonPersistenceSettlement {
  const merged: DungeonPersistenceSettlement = {};
  const inventoryChanges: ResourceOperationSettlement['inventoryChanges'] = [];
  for (const settlement of settlements) {
    if (!settlement) continue;
    if (settlement.condition !== undefined) {
      merged.condition = settlement.condition;
    }
    if (settlement.progress !== undefined) {
      merged.progress = settlement.progress;
    }
    if (settlement.currency) {
      merged.currency = { ...merged.currency, ...settlement.currency };
    }
    if (settlement.profile) {
      merged.profile = { ...merged.profile, ...settlement.profile };
    }
    inventoryChanges.push(...(settlement.inventoryChanges ?? []));
  }
  if (inventoryChanges.length > 0) {
    merged.inventoryChanges = inventoryChanges;
  }
  return merged;
}

function toDungeonPersistenceSettlement(
  result: ResourceOperationResult,
): DungeonPersistenceSettlement {
  const settlement: ResourceOperationSettlement | undefined = result.settlement;
  if (!settlement) return {};
  return {
    currency: {
      ...(settlement.spiritStones !== undefined
        ? { spiritStones: settlement.spiritStones }
        : {}),
      ...(settlement.reputation !== undefined
        ? { reputation: settlement.reputation }
        : {}),
    },
    ...(settlement.lifespan !== undefined
      ? { profile: { lifespan: settlement.lifespan } }
      : {}),
    ...(settlement.cultivationProgress
      ? { progress: settlement.cultivationProgress }
      : {}),
    inventoryChanges: settlement.inventoryChanges,
  };
}

/** 解谜模式以获得关键线索代替轮次作为探索收益的节点。 */
async function appendClueReward(state: DungeonState, clueId: string) {
  const reward = await resolveDungeonReward(
    state,
    `clue:${clueId}`,
    'exploration',
  );
  const previous = state.v6Rewards ?? [];
  state.v6Rewards = appendDungeonReward(previous, reward);
  if (previous === state.v6Rewards) return;
  state.accumulatedRewards.push(
    ...reward.items.map((item) => ({ name: dungeonRewardItemName(item) })),
  );
}

const DEFAULT_RECOVERABLE_ACTIONS: DungeonRecoverAction[] = [
  'safe_retreat',
  'force_quit',
];
const SETTLE_RECOVERABLE_ACTIONS: DungeonRecoverAction[] = [
  'retry_settle',
  'force_quit',
];
const ACTION_RECOVERABLE_ACTIONS: DungeonRecoverAction[] = [
  'retry',
  'safe_retreat',
  'force_quit',
];

function normalizeLegacySixAttributes(
  attributes: Record<string, unknown>,
  realm: string,
  stage: string,
) {
  const realmValue = REALM_VALUES.includes(realm as RealmType)
    ? (realm as RealmType)
    : REALM_VALUES[0];
  const stageValue = REALM_STAGE_VALUES.includes(stage as RealmStage)
    ? (stage as RealmStage)
    : REALM_STAGE_VALUES[0];
  const naturalValue = getRealmStageNaturalAttributeValue(
    realmValue,
    stageValue,
  );

  if (typeof attributes.strength !== 'number') {
    attributes.strength = naturalValue;
  }
  if (typeof attributes.endurance !== 'number') {
    attributes.endurance =
      typeof attributes.wisdom === 'number' ? attributes.wisdom : naturalValue;
  }
}

const COST_LIMITS: Partial<Record<DungeonOptionCost['type'], number>> = {
  spirit_stones: 10_000_000,
  lifespan: DUNGEON_LIFESPAN_COST_MAX,
  cultivation_exp: 1_000_000,
  comprehension_insight: 100,
  material: 999,
  hp_loss: 1,
  mp_loss: 1,
  battle: 100,
};

function assertDungeonRealmEligible(
  playerRealm: RealmType,
  dungeonRealm: RealmType,
) {
  if (!canChallengeDungeonRealm(playerRealm, dungeonRealm)) {
    throw new Error(
      `当前境界${playerRealm}不可挑战${dungeonRealm}副本，请先提升大境界`,
    );
  }
}

type DungeonBattleCachePayload = DungeonBattlePayload | DungeonEncounterPayload;

function cloneCosts(
  costs: DungeonOptionCost[] | undefined,
): DungeonOptionCost[] {
  return costs
    ? costs.map((cost) => ({
        ...cost,
        metadata: cost.metadata ? { ...cost.metadata } : undefined,
      }))
    : [];
}

export class DungeonFlowService {
  constructor(
    private readonly generateEnding: typeof generateDungeonEnding,
    private readonly database: DbClient,
    private readonly runs: DungeonRunStore,
    private readonly resources: ResourceEngine,
    private readonly withLock: typeof withRedisLock,
  ) {}

  private normalizeOptionCosts(option: { costs?: DungeonOptionCost[] }) {
    const costs = cloneCosts(option.costs)
      .map((cost) => {
        const max = COST_LIMITS[cost.type] ?? Number.MAX_SAFE_INTEGER;
        const rawValue = Number.isFinite(cost.value) ? cost.value : 0;
        const value =
          cost.type === 'hp_loss' || cost.type === 'mp_loss'
            ? Math.max(0, Math.min(max, rawValue))
            : Math.floor(Math.max(0, Math.min(max, rawValue)));
        return {
          ...cost,
          value,
        };
      })
      .filter((cost) => cost.value > 0 || cost.type === 'battle');

    const hasBattle = costs.some((cost) => cost.type === 'battle');
    let battleSeen = false;
    return costs.filter((cost) => {
      if (cost.type === 'battle') {
        if (battleSeen) return false;
        battleSeen = true;
        return true;
      }
      return !hasBattle || (cost.type !== 'hp_loss' && cost.type !== 'mp_loss');
    });
  }

  private normalizeState(state: DungeonState): DungeonState {
    const [realm = REALM_VALUES[0], stage = REALM_STAGE_VALUES[0]] =
      state.playerInfo.realm.trim().split(/\s+/);
    normalizeLegacySixAttributes(
      state.playerInfo.attributes as unknown as Record<string, unknown>,
      realm,
      stage,
    );
    state.costLedger = (state.costLedger ?? []).map((entry) => ({
      ...entry,
      costs: this.normalizeOptionCosts(entry),
    }));
    state.gainLedger ??= [];
    state.summary_of_sacrifice = state.costLedger.flatMap((entry) =>
      cloneCosts(entry.costs),
    );
    if (state.pendingAction) {
      state.pendingAction = {
        ...state.pendingAction,
        costs: this.normalizeOptionCosts(state.pendingAction),
      };
    }
    state.costPreview = this.normalizeOptionCosts({
      costs: state.costPreview,
    });
    state.currentOptions = state.currentOptions?.map((option) => {
      const costPreview = this.normalizeOptionCosts(option);
      return {
        ...option,
        costs: costPreview,
        costPreview,
      };
    });
    if (state.status === 'RECOVERABLE_ERROR') {
      state.recoverableActions ??= DEFAULT_RECOVERABLE_ACTIONS;
    }
    return state;
  }

  private async markRecoverable(
    cultivatorId: string,
    state: DungeonState,
    reason: string,
    actions: DungeonRecoverAction[] = DEFAULT_RECOVERABLE_ACTIONS,
    options: DungeonFlowOptions = {},
  ) {
    state.status = 'RECOVERABLE_ERROR';
    state.isFinished = false;
    state.statusReason = reason;
    state.recoverableActions = actions;
    if (state.pendingAction) {
      state.pendingAction.status = 'failed';
      state.pendingAction.error = reason;
    }
    if (!options.deferPersistence) {
      await this.saveState(cultivatorId, state);
    }
    return state;
  }

  private buildStateHooks(
    cultivatorId: string,
    state: DungeonState,
    battlePayload?: DungeonBattleCachePayload,
  ): DungeonPersistenceHooks {
    return {
      persist: async (tx) => {
        await this.persistStateRecord(cultivatorId, state, battlePayload, tx);
      },
      afterCommit: async () => {
        await this.runs.saveRedisState(cultivatorId, state);
      },
    };
  }

  private async withFlowLock<T>(
    cultivatorId: string,
    context: string,
    task: () => Promise<T>,
    lease?: RedisLeaseContext,
  ): Promise<T> {
    await assertCombatV6MutationAllowed(cultivatorId, 'dungeon');
    if (lease) {
      lease.assertHeld();
      const result = await task();
      lease.assertHeld();
      return result;
    }

    try {
      return await this.withLock(
        {
          key: redisLockKeys.dungeonCommand(cultivatorId),
          context,
          timeoutMs: FLOW_LOCK_TTL_SECONDS * 1000,
          retries: 0,
          delayMs: 50,
        },
        async (lease) => {
          const result = await task();
          lease.assertHeld();
          return result;
        },
      );
    } catch (error) {
      if (!isRedisLockContention(error)) {
        throw error;
      }
      throw new DungeonFlowError(
        DungeonFlowErrorCode.INVALID_STATE,
        '副本操作正在处理中，请稍后重试',
        409,
      );
    }
  }

  private hasCommittedAction(state: DungeonState, actionId: string) {
    return state.costLedger?.some((entry) => entry.actionId === actionId);
  }

  private commitCostsToState(
    state: DungeonState,
    action: DungeonPendingAction,
  ) {
    for (const cost of action.costs) {
      if (cost.type === 'hp_loss') {
        state.accumulatedHpLoss = Math.min(
          1,
          (state.accumulatedHpLoss ?? 0) + cost.value,
        );
      } else if (cost.type === 'mp_loss') {
        state.accumulatedMpLoss = Math.min(
          1,
          (state.accumulatedMpLoss ?? 0) + cost.value,
        );
      }
    }

    state.costLedger ??= [];
    state.costLedger.push({
      actionId: action.actionId,
      round: action.round,
      choiceId: action.choiceId,
      choiceText: action.choiceText,
      costs: cloneCosts(action.costs),
      materialSelections: action.materialSelections,
      committedAt: new Date().toISOString(),
    });
    state.summary_of_sacrifice = state.costLedger.flatMap((entry) =>
      cloneCosts(entry.costs),
    );
    state.pendingAction = {
      ...action,
      status: 'committed',
    };
  }

  private async applyConditionResourceLosses(
    cultivatorId: string,
    costs: DungeonOptionCost[],
    tx: DbTransaction,
  ) {
    const hpPercent = costs
      .filter((cost) => cost.type === 'hp_loss')
      .reduce((sum, cost) => sum + cost.value, 0);
    const mpPercent = costs
      .filter((cost) => cost.type === 'mp_loss')
      .reduce((sum, cost) => sum + cost.value, 0);

    if (hpPercent <= 0 && mpPercent <= 0) {
      return null;
    }

    const { player, caps } = await dungeonPlayer(cultivatorId, tx);
    const condition = player.cultivator.condition!;
    const nextCondition = ConditionService.applyCombatV6Resources(condition, {
      ...caps,
      hp: Math.max(
        1,
        condition.resources.hp.current - Math.floor(caps.maxHp * hpPercent),
      ),
      mp: Math.max(
        0,
        condition.resources.mp.current - Math.floor(caps.maxMp * mpPercent),
      ),
    });
    await updateCultivator(cultivatorId, { condition: nextCondition }, tx);
    return nextCondition;
  }

  /**
   * 初始化副本
   */
  async startDungeon(
    cultivatorId: string,
    mapNodeId: string,
    options: DungeonFlowOptions = {},
  ) {
    return this.withFlowLock(
      cultivatorId,
      'dungeon-start',
      () => this.startDungeonUnlocked(cultivatorId, mapNodeId, options),
      options.lease,
    );
  }

  private async startDungeonUnlocked(
    cultivatorId: string,
    mapNodeId: string,
    options: DungeonFlowOptions,
  ) {
    let qiActionInstanceId: string | null = null;
    let qiReservationOpen = false;

    try {
      const existingSession = await this.runs.loadActiveRun(cultivatorId);
      if (existingSession) {
        throw new Error('当前已有正在进行的副本，请先完成或放弃');
      }

      // 只有卫星地图节点可以进行副本挑战
      if (!isSatelliteNode(mapNodeId)) {
        throw new Error('只有秘境节点可以进行副本挑战');
      }

      // 云游探秘只剩解谜玩法：没有配置剧本的节点不能开局。
      const scenario = this.getMapNode(mapNodeId).dungeon_config?.scenario;
      if (!scenario) {
        throw new DungeonFlowError(
          DungeonFlowErrorCode.INVALID_ACTION,
          '此地暂无可探之谜',
          400,
        );
      }

      // 1. 获取玩家与地图数据 (逻辑同你之前)
      const context = await this.prepareDungeonContext(cultivatorId, mapNodeId);

      qiActionInstanceId = randomUUID();
      if (!options.deferPersistence) {
        await QiService.reserveQi({
          cultivatorId,
          action: 'dungeon_start',
          actionInstanceId: qiActionInstanceId,
          metadata: {
            mapNodeId,
          },
        });
        qiReservationOpen = true;
      }

      // 2. 初始状态
      const state: DungeonState = {
        ...context,
        rewardSeed: Math.floor(Math.random() * 0x100000000),
        v6Rewards: [],
        mapNodeId, // 保存地图节点ID
        currentRound: 1,
        maxRounds: 5, // 建议固定或根据地图设定
        history: [],
        dangerScore: 10,
        isFinished: false,
        cultivatorId: context.playerInfo.id!,
        theme: context.location.location,
        summary_of_sacrifice: [],
        costLedger: [],
        gainLedger: [],
        accumulatedRewards: [],
        status: 'EXPLORING',
        accumulatedHpLoss: 0, // 累积气血损失百分比 (0-1)
        accumulatedMpLoss: 0, // 累积法力损失百分比 (0-1)
      };

      // Qi is reserved in the deferred commit. Refuse before the first scene
      // so a shortfall does not spend a model call.
      await QiService.assertAffordable({
        cultivatorId,
        action: 'dungeon_start',
      });

      // 3. 从剧本库选本开局
      await this.initMystery(state);
      if (!options.deferPersistence) {
        await this.database.transaction((tx) =>
          this.persistMysteryStart(tx, state),
        );
        await this.saveState(cultivatorId, state);
        this.requestMysteryRestock(state);
      }

      if (!options.deferPersistence && qiActionInstanceId) {
        await QiService.commitReservation({
          actionInstanceId: qiActionInstanceId,
          metadata: {
            runId: state.runId,
            committedAt: new Date().toISOString(),
          },
        });
        qiReservationOpen = false;
      }

      if (options.deferPersistence) {
        return {
          state,
          persist: async (tx: DbTransaction) => {
            if (!qiActionInstanceId) {
              throw new Error('副本灵气预扣标识缺失');
            }
            const { player } = await dungeonPlayer(cultivatorId, tx);
            await updateCultivator(
              cultivatorId,
              { condition: player.cultivator.condition },
              tx,
            );
            const reservation = await QiService.reserveQi({
              cultivatorId,
              action: 'dungeon_start',
              actionInstanceId: qiActionInstanceId,
              metadata: {
                mapNodeId,
              },
              tx,
            });
            await this.persistMysteryStart(tx, state);
            await this.persistStateRecord(cultivatorId, state, undefined, tx);
            await QiService.commitReservation({
              actionInstanceId: qiActionInstanceId,
              metadata: {
                runId: state.runId,
                committedAt: new Date().toISOString(),
              },
              tx,
            });
            return {
              condition: player.cultivator.condition,
              currency: {
                qi: reservation.qiAfter,
                qiLastRefreshedAt: reservation.qiLastRefreshedAt,
              },
            } satisfies DungeonPersistenceSettlement;
          },
          afterCommit: async () => {
            await this.runs.saveRedisState(cultivatorId, state);
            this.requestMysteryRestock(state);
          },
        };
      }

      return { state };
    } catch (error) {
      if (qiReservationOpen && qiActionInstanceId) {
        try {
          await QiService.refundReservation({
            actionInstanceId: qiActionInstanceId,
            reason: 'dungeon_start_failed',
            metadata: {
              mapNodeId,
            },
          });
        } catch (refundError) {
          console.error('[DungeonService] 回滚灵气预扣失败:', refundError);
        }
      }
      throw error;
    }
  }

  /** 云游·除祟开局：不调用模型，也不依赖剧本库。局内状态入场回满，不看现实气血。 */
  async startExorcism(cultivatorId: string, mapNodeId: string) {
    const existing = await this.runs.loadActiveRun(cultivatorId);
    if (existing)
      throw new DungeonFlowError(
        DungeonFlowErrorCode.INVALID_STATE,
        '当前已有正在进行的副本，请先完成或放弃',
        409,
      );
    const scene = this.getMapNode(mapNodeId).dungeon_config?.scenario?.scene;
    if (!scene)
      throw new DungeonFlowError(
        DungeonFlowErrorCode.INVALID_ACTION,
        '此地没有可除之祟',
        400,
      );
    const context = await this.prepareDungeonContext(cultivatorId, mapNodeId);
    await QiService.assertAffordable({
      cultivatorId,
      action: 'exorcism_start',
    });
    const rewardSeed = Math.floor(Math.random() * 0x100000000);
    const { projection } = await dungeonPlayer(cultivatorId);
    const tags = exorcismBuildTags(projection.unit, projection.skills);
    const state: DungeonState = {
      ...context,
      exorcism: createExorcismRun({
        seed: rewardSeed,
        lineageId: exorcismLineageForScene(scene),
        recentBossIds: await this.runs.recentExorcismBosses(cultivatorId),
        isCountered: (bossId) => exorcismIsCountered(bossId, tags),
      }),
      rewardSeed,
      v6Rewards: [],
      mapNodeId,
      currentRound: 1,
      maxRounds: EXORCISM_STAGE_COUNT,
      history: [],
      dangerScore: 10,
      isFinished: false,
      cultivatorId: context.playerInfo.id!,
      theme: context.location.location,
      summary_of_sacrifice: [],
      costLedger: [],
      gainLedger: [],
      accumulatedRewards: [],
      status: 'WAITING_BATTLE',
      accumulatedHpLoss: 0,
      accumulatedMpLoss: 0,
    };
    const prepared = await prepareExorcismEncounter(state);
    state.encounter = prepared.preview;
    const actionInstanceId = randomUUID();
    return {
      state,
      persist: async (tx: DbTransaction) => {
        const { player } = await dungeonPlayer(cultivatorId, tx);
        await updateCultivator(
          cultivatorId,
          { condition: player.cultivator.condition },
          tx,
        );
        const reservation = await QiService.reserveQi({
          cultivatorId,
          action: 'exorcism_start',
          actionInstanceId,
          metadata: { mapNodeId },
          tx,
        });
        await this.persistStateRecord(cultivatorId, state, prepared, tx);
        await QiService.commitReservation({
          actionInstanceId,
          metadata: {
            runId: state.runId,
            committedAt: new Date().toISOString(),
          },
          tx,
        });
        return {
          condition: player.cultivator.condition,
          currency: {
            qi: reservation.qiAfter,
            qiLastRefreshedAt: reservation.qiLastRefreshedAt,
          },
        } satisfies DungeonPersistenceSettlement;
      },
      afterCommit: () => this.runs.saveRedisState(cultivatorId, state),
    };
  }

  /** 补给点：调息或搜寻，然后备好下一场。 */
  async supplyExorcism(cultivatorId: string, choice: ExorcismSupplyChoice) {
    const state = await this.getState(cultivatorId);
    if (!state?.exorcism || state.exorcism.phase !== 'supply')
      throw new DungeonFlowError(
        DungeonFlowErrorCode.INVALID_STATE,
        '当前不在补给阶段，请刷新',
        409,
      );
    if (choice === 'search') {
      const { context, level } = this.exorcismRewardContext(state);
      const planned = planExorcismSearchReward(
        state.rewardSeed!,
        state.exorcism.supplies.length,
        level,
        context,
      );
      state.v6Rewards = appendDungeonReward(state.v6Rewards ?? [], {
        key: planned.key,
        experience: planned.experience,
        spiritStones: planned.spiritStones,
        items: await resolvePlanItems(planned.plan),
      });
    }
    state.exorcism = applyExorcismSupply(state.exorcism, choice);
    const prepared = await prepareExorcismEncounter(state);
    state.encounter = prepared.preview;
    state.status = 'WAITING_BATTLE';
    state.currentRound = state.exorcism.wins + 1;
    return {
      state,
      isFinished: false,
      ...this.buildStateHooks(cultivatorId, state, prepared),
    };
  }

  /** 主动收手：按当前进度结算，不受败退折损。 */
  async retreatExorcismRun(
    cultivatorId: string,
    options: DungeonFlowOptions = {},
  ) {
    const state = await this.getState(cultivatorId);
    if (!state?.exorcism || state.exorcism.phase === 'finished')
      throw new DungeonFlowError(
        DungeonFlowErrorCode.INVALID_STATE,
        '当前无法收手，请刷新',
        409,
      );
    if (state.activeBattleId)
      throw new DungeonFlowError(
        DungeonFlowErrorCode.INVALID_STATE,
        '战斗中不能收手，请用逃跑指令',
        409,
      );
    state.encounter = undefined;
    const settled = await this.settleDungeon(state, {
      endDisposition: 'retreated_after_battle',
      deferPersistence: options.deferPersistence,
    });
    return { ...settled, state: settled.state ?? state };
  }

  private exorcismRewardContext(state: DungeonState) {
    const map = getMapNode(state.mapNodeId);
    if (!map || !('realm_requirement' in map)) throw new Error('秘境地图无效');
    const mapRealm = map.realm_requirement as RealmType;
    return {
      mapRealm,
      level: getRealmStageLevel(mapRealm, '初期'),
      context: {
        mapRealm,
        playerRealm: state.playerInfo.realm.split(' ')[0] as RealmType,
        difficultyTier: resolveDungeonMapConfig(map).difficultyTier,
      },
    };
  }

  /**
   * 写定除祟的结算：评级奖励、克星加掷、结局文案和实际收益。
   * 只执行一次（state.settlement 已存在时跳过），所以退出、恢复和重试都走同一份结果。
   */
  private async finalizeExorcism(state: DungeonState) {
    if (!state.exorcism || state.settlement) return;
    if (state.exorcism.phase !== 'finished')
      state.exorcism = retreatExorcism(state.exorcism);
    const run = state.exorcism;
    const { mapRealm, level, context } = this.exorcismRewardContext(state);
    let insight: 'full' | 'partial' | 'none' = 'none';
    if (run.grade) {
      const planned = planExorcismSettlement(
        state.rewardSeed!,
        run.grade,
        run.endReason!,
        level,
        context,
      );
      insight = planned.insight;
      state.v6Rewards = appendDungeonReward(state.v6Rewards ?? [], {
        key: planned.key,
        experience: planned.experience,
        spiritStones: planned.spiritStones,
        items: await resolvePlanItems(planned.plan),
      });
    }
    const beatNemesis = run.endReason === 'cleared' && run.countered;
    if (beatNemesis)
      state.v6Rewards = appendDungeonReward(state.v6Rewards ?? [], {
        key: 'exorcism:nemesis',
        experience: 0,
        spiritStones: 0,
        items: await resolvePlanItems(
          planExorcismNemesisBonus(state.rewardSeed!, level),
        ),
      });
    const sum = (key: 'experience' | 'spiritStones') =>
      (state.v6Rewards ?? []).reduce((total, r) => total + r[key], 0);
    const gains: ResourceOperation[] = [
      { type: 'cultivation_exp', value: sum('experience') },
      { type: 'spirit_stones', value: sum('spiritStones') },
    ];
    if (insight !== 'none') {
      const value = RewardFactory.rollInsight(
        mapRealm,
        insight === 'full' ? 'S' : 'A',
        state.dangerScore,
        context.difficultyTier,
      );
      gains.push({
        type: 'comprehension_insight',
        value: Math.max(
          1,
          Math.floor(value * EXORCISM_REWARD_PACK.insightFactor),
        ),
      });
    }
    state.realGains = gains;
    state.settlement = {
      ending_narrative: exorcismEnding(run),
      settlement: {
        reward_tier: run.grade ?? 'D',
        reward_blueprints: [],
        performance_tags: [
          run.endReason === 'cleared'
            ? '祟主伏诛'
            : run.endReason === 'retreated'
              ? '及时收手'
              : '败退而回',
          ...(beatNemesis ? ['逆命破局'] : []),
        ],
      },
    };
  }

  async beginBattle(
    cultivatorId: string,
    encounterId: string,
    options: DungeonFlowOptions = {},
  ) {
    const state = await this.getState(cultivatorId);
    if (!state || state.encounter?.id !== encounterId) {
      throw new DungeonFlowError(
        DungeonFlowErrorCode.INVALID_STATE,
        '遭遇已变化，请刷新秘境',
        409,
      );
    }
    if (state.status === 'IN_BATTLE' && state.activeBattleId)
      return { state, isFinished: false };
    if (state.status !== 'WAITING_BATTLE') {
      throw new DungeonFlowError(
        DungeonFlowErrorCode.INVALID_STATE,
        '当前无法迎战',
        409,
      );
    }
    const run = await this.runs.loadActiveRun(cultivatorId);
    const prepared = run?.battlePayload as DungeonEncounterPayload | undefined;
    if (!prepared?.encounter || prepared.preview.id !== encounterId)
      throw new Error('遭遇输入缺失');
    const payload = beginDungeonBattle(state, prepared);
    state.status = 'IN_BATTLE';
    state.activeBattleId = payload.session.battleId;
    if (options.deferPersistence)
      return {
        state,
        isFinished: false,
        ...this.buildStateHooks(cultivatorId, state, payload),
      };
    await this.saveState(cultivatorId, state, payload);
    return { state, isFinished: false };
  }

  async executeBattle(
    cultivatorId: string,
    battleId: string,
    options: DungeonFlowOptions = {},
  ) {
    const state = await this.getState(cultivatorId);
    if (!state || state.activeBattleId !== battleId)
      throw new Error('当前没有匹配的遭遇战');
    const battle = await getDungeonBattle(cultivatorId, battleId);
    if (!battle?.outcome) throw new Error('请先完成战斗');
    delete state.activeBattleId;
    if (state.exorcism) {
      state.encounter = undefined;
      if (state.exorcism.phase === 'finished') {
        const settled = await this.settleDungeon(state, {
          endDisposition:
            state.exorcism.endReason === 'cleared'
              ? 'completed'
              : 'retreated_after_battle',
          deferPersistence: options.deferPersistence,
        });
        return { ...settled, state: settled.state ?? state };
      }
      state.status = 'EXPLORING';
      state.currentRound = state.exorcism.wins + 1;
      return {
        state,
        isFinished: false,
        ...this.buildStateHooks(cultivatorId, state),
      };
    }
    if (state.mystery?.pendingGuard)
      return this.finishMysteryGuard(
        state,
        battle.outcome === 'victory',
        options,
      );
    if (state.mystery?.verdict)
      return this.finishMysteryConfrontation(
        state,
        battle.outcome === 'victory' ? 'won' : 'lost',
        options,
      );
    // 旧版回合制副本已退役：遗留的遭遇战打完即结算离开，战斗所得照常发放。
    const last = state.history.at(-1);
    if (last)
      last.outcome =
        battle.outcome === 'victory'
          ? `历经 ${battle.round} 回合，你击败了秘境守敌。`
          : '战斗结束，你离开了秘境。';
    return this.settleDungeon(state, {
      endDisposition: 'retreated_after_battle',
      deferPersistence: options.deferPersistence,
    });
  }

  /**
   * 战斗回调失败时的恢复路径。
   * 目标：确保不会卡在战斗中，后续结算失败也能进入可重试状态。
   */
  async settleDungeon(
    state: DungeonState,
    options?: DungeonSettlementOptions,
  ): Promise<DungeonSettlementResult> {
    state.status = 'SETTLING';
    state.statusReason = undefined;
    state.recoverableActions = undefined;

    try {
      return await this.performSettlement(state, options);
    } catch (error) {
      console.error('[DungeonSettlement] 结算失败，进入可恢复状态:', error);
      const recoverableActions =
        error instanceof DungeonSettlementRecoverableError
          ? error.actions
          : SETTLE_RECOVERABLE_ACTIONS;
      const recoverable = await this.markRecoverable(
        state.cultivatorId,
        state,
        error instanceof Error ? error.message : '副本结算失败',
        recoverableActions,
        { deferPersistence: options?.deferPersistence },
      );
      return options?.deferPersistence
        ? {
            state: recoverable,
            isFinished: false,
            ...this.buildStateHooks(state.cultivatorId, recoverable),
          }
        : { state: recoverable, isFinished: false };
    }
  }

  private async performSettlement(
    state: DungeonState,
    options?: DungeonSettlementOptions,
  ): Promise<DungeonSettlementResult> {
    const endDisposition =
      state.endDisposition ??
      options?.endDisposition ??
      (options?.abandonedBattle ? 'abandoned_before_battle' : 'completed');
    state.endDisposition = endDisposition;
    const deferPersistence = options?.deferPersistence === true;
    const pendingActionToCommit =
      options?.pendingAction &&
      !this.hasCommittedAction(state, options.pendingAction.actionId)
        ? options.pendingAction
        : undefined;
    if (state.rewardSeed === undefined) throw new Error('旧秘境会话需维护处理');
    await this.finalizeExorcism(state);
    if (endDisposition === 'completed' && !state.exorcism)
      state.v6Rewards = appendDungeonReward(
        state.v6Rewards ?? [],
        await resolveDungeonReward(state, 'completion', 'completion'),
      );
    const ending = state.settlement
      ? undefined
      : await this.generateEnding(state, endDisposition);
    const settlement: DungeonSettlement = state.settlement ?? {
      ending_narrative: ending!.narrative,
      settlement: {
        // 解谜模式的评级由规则评分决定，LLM 只写结局叙事。
        reward_tier:
          endDisposition === 'completed'
            ? (state.mystery?.result?.tier ?? ending!.rating)
            : 'C',
        reward_blueprints: [],
        performance_tags:
          endDisposition !== 'completed'
            ? ['及时止损']
            : state.mystery?.result
              ? [
                  Object.values(state.mystery.result.correct).every(Boolean)
                    ? '真相大白'
                    : '疑云未散',
                  ...mysteryConfrontationTags(state.mystery),
                ]
              : ['功成身退'],
      },
    };
    settlement.inventoryRewards = (state.v6Rewards ?? []).flatMap(
      (reward) => reward.items,
    );

    if (pendingActionToCommit) {
      const userId = await findActiveCultivatorOwnerId(state.cultivatorId);
      if (!userId) {
        throw new Error('无法获取修真者所属用户');
      }
      if (!deferPersistence) {
        const result = await this.database.transaction(async (tx) => {
          const applied = await applyDungeonCosts(
            userId,
            state.cultivatorId,
            pendingActionToCommit.costs,
            tx,
            pendingActionToCommit.materialSelections,
          );
          if (applied.success) {
            await this.applyConditionResourceLosses(
              state.cultivatorId,
              pendingActionToCommit.costs,
              tx,
            );
          }
          return applied;
        });
        if (!result.success) {
          state.status = 'EXPLORING';
          state.pendingAction = {
            ...pendingActionToCommit,
            status: 'failed',
            error: result.errors?.join('; ') || '资源消耗失败',
          };
          state.costPreview = undefined;
          await this.saveState(state.cultivatorId, state);
          throw new DungeonSettlementRecoverableError(
            result.errors?.join('; ') || '资源消耗失败',
            ACTION_RECOVERABLE_ACTIONS,
          );
        }
      }
      this.commitCostsToState(state, pendingActionToCommit);
      state.pendingAction = undefined;
      state.costPreview = undefined;
      if (!deferPersistence) {
        await this.saveState(state.cultivatorId, state);
      }
    }

    if (!state.settlement) {
      state.settlement = settlement;
      if (!deferPersistence) {
        await this.saveState(state.cultivatorId, state);
      }
    }

    const committedSettlementGain = state.gainLedger?.find(
      (entry) => entry.source === 'settlement',
    );
    const realGains =
      state.realGains ??
      committedSettlementGain?.gains ??
      (() => {
        const gains: ResourceOperation[] = [
          {
            type: 'cultivation_exp',
            value: (state.v6Rewards ?? []).reduce(
              (sum, r) => sum + r.experience,
              0,
            ),
          },
          {
            type: 'spirit_stones',
            value: (state.v6Rewards ?? []).reduce(
              (sum, r) => sum + r.spiritStones,
              0,
            ),
          },
        ];
        if (endDisposition !== 'completed') return gains;
        const mapNode = getMapNode(state.mapNodeId);
        if (!mapNode || !('realm_requirement' in mapNode))
          throw new Error('秘境地图无效');
        for (const reward of RewardFactory.generateBaseRewards(
          mapNode.realm_requirement as RealmType,
          settlement.settlement.reward_tier,
          state.dangerScore,
          state.playerInfo,
          resolveDungeonMapConfig(mapNode).difficultyTier,
        )) {
          const existing = gains.find((gain) => gain.type === reward.type);
          if (existing) existing.value += reward.value;
          else gains.push(reward);
        }
        return gains;
      })();
    state.realGains = realGains;
    if (!deferPersistence) {
      await this.saveState(state.cultivatorId, state);
    }

    // 获取 userId
    const userId = await findActiveCultivatorOwnerId(state.cultivatorId);
    if (!userId) {
      throw new Error('无法获取修真者所属用户');
    }

    let nextGainLedger = state.gainLedger ?? [];
    if (!committedSettlementGain) {
      // DungeonResourceGain 与 ResourceOperation 结构兼容
      // desc 字段在 ResourceEngine 中会被忽略
      nextGainLedger = [
        ...(state.gainLedger ?? []),
        {
          source: 'settlement' as const,
          gains: realGains,
          committedAt: new Date().toISOString(),
        },
      ];
      if (!deferPersistence) {
        const runId = state.runId;
        const result = await this.database.transaction(async (tx) => {
          await this.runs.assertTerminalRunCanCommit(tx, state);
          await grantInventory(
            state.cultivatorId,
            settlement.inventoryRewards ?? [],
            tx,
          );
          await grantDungeonBeastExperience(state, tx);
          const applied = await this.resources.applyInTransaction({
            userId,
            cultivatorId: state.cultivatorId,
            gain: realGains as ResourceOperation[],
            tx,
          });
          if (!applied.success) {
            throw new Error(applied.errors?.join('; ') || '资源获得失败');
          }
          if (applied.success && runId) {
            await this.runs.recordSettlementGain(
              tx,
              runId,
              state,
              nextGainLedger,
              realGains,
            );
          }
          return applied;
        });

        if (!result.success) {
          throw new Error(result.errors?.join('; ') || '资源获得失败');
        }
      }

      state.gainLedger = nextGainLedger;
      if (!deferPersistence) {
        await this.saveState(state.cultivatorId, state);
      }
    }

    let domainEventId: string | undefined;
    let rumorOutboxId: string | undefined;
    const persistSettlement = async (tx: DbTransaction) => {
      if (!state.runId) throw new Error('副本结算缺少运行编号');
      await this.archiveDungeon(state, settlement, realGains, {
        tx,
        clearRedis: false,
      });
      const event = await createDomainEvent(
        {
          type: 'dungeon.run.settled',
          aggregate: { type: 'dungeon-run', id: state.runId },
          data: {
            cultivatorId: state.cultivatorId,
            runId: state.runId,
            mapNodeId: state.mapNodeId,
            outcome: endDisposition,
          },
          deduplicationKey: `${state.cultivatorId}:dungeon:${state.runId}`,
        },
        tx,
      );
      domainEventId = event.id;
      const mystery = state.mystery;
      if (
        endDisposition === 'completed' &&
        mystery?.result &&
        mystery.result.total >= 96
      ) {
        const total = mystery.result.total;
        const score = total === 100 ? '满分' : ` ${total} 分`;
        rumorOutboxId = await queueAchievementRumor(tx, {
          text: `「${state.playerInfo.name}」在云游中勘破《${mystery.caseFile.title}》，以${score}结案。`,
        });
      }
    };
    const afterCommit = async () => {
      await this.runs.clearRedisState(state.cultivatorId);
      const context = {
        source: 'dungeon_settlement',
        cultivatorId: state.cultivatorId,
        runId: state.runId,
      };
      publishTransactionalMessageBestEffort(domainEventId, context);
      publishTransactionalMessageBestEffort(rumorOutboxId, context);
    };

    if (!deferPersistence) {
      await this.database.transaction(persistSettlement);
      await afterCommit();
      return { isFinished: true, settlement, realGains };
    }

    return {
      isFinished: true,
      settlement,
      realGains,
      persist: async (tx) => {
        await this.runs.assertTerminalRunCanCommit(tx, state);

        let consumedSettlement: DungeonPersistenceSettlement | undefined;
        let gainedSettlement: DungeonPersistenceSettlement | undefined;
        let condition: Cultivator['condition'] | undefined;
        if (pendingActionToCommit) {
          const consumeResult = await applyDungeonCosts(
            userId,
            state.cultivatorId,
            pendingActionToCommit.costs,
            tx,
            pendingActionToCommit.materialSelections,
          );
          if (!consumeResult.success) {
            throw new Error(consumeResult.errors?.join('; ') || '资源消耗失败');
          }
          condition =
            (await this.applyConditionResourceLosses(
              state.cultivatorId,
              pendingActionToCommit.costs,
              tx,
            )) ?? undefined;
          consumedSettlement = toDungeonPersistenceSettlement(consumeResult);
        }

        if (!committedSettlementGain) {
          const runId = state.runId;
          await grantInventory(
            state.cultivatorId,
            settlement.inventoryRewards ?? [],
            tx,
          );
          await grantDungeonBeastExperience(state, tx);
          const gainResult = await this.resources.applyInTransaction({
            userId,
            cultivatorId: state.cultivatorId,
            gain: realGains as ResourceOperation[],
            tx,
          });
          if (gainResult.success && runId) {
            await this.runs.recordSettlementGain(
              tx,
              runId,
              state,
              nextGainLedger,
              realGains,
            );
          }
          if (!gainResult.success) {
            throw new Error(gainResult.errors?.join('; ') || '资源获得失败');
          }
          gainedSettlement = toDungeonPersistenceSettlement(gainResult);
        }

        await persistSettlement(tx);
        return mergeDungeonPersistenceSettlements(
          consumedSettlement,
          gainedSettlement,
          condition ? { condition } : null,
        );
      },
      afterCommit,
    };
  }
  /**
   * 解谜开局：从全服剧本库选本，不调用 LLM；库里没有时用此地绑定的保底案卷，
   * 都没有就不开局。需要补货时记下请求，提交后投递。
   */
  private async initMystery(state: DungeonState) {
    const templateIds = scenarioTemplatesForNode(state.mapNodeId);
    if (templateIds.length === 0) throw new Error('秘境剧本配置无效');
    const library = await readScenarioLibrary(
      state.cultivatorId,
      state.mapNodeId,
      templateIds,
      this.database,
    );
    let pick = pickMysteryScenario({
      templateIds,
      ...library,
      random: Math.random,
    });
    const fromLibrary =
      pick.kind === 'scenario'
        ? await loadScenarioCase(pick.scenarioId, this.database)
        : null;
    if (pick.kind === 'scenario' && !fromLibrary)
      pick = { kind: 'empty', templateId: pick.templateId };
    const template = requireMysteryTemplate(pick.templateId);
    const restock = needsMysteryRestock(pick)
      ? {
          reason:
            pick.kind === 'empty'
              ? ('cold_start' as const)
              : pick.unplayedLeft === 0
                ? ('exhausted' as const)
                : ('low_stock' as const),
        }
      : undefined;

    if (pick.kind === 'scenario' && fromLibrary) {
      state.mystery = {
        templateId: pick.templateId,
        caseSource: 'library',
        caseFile: fromLibrary,
        run: createMysteryRun(fromLibrary, template.scale.action_budget),
        scenarioId: pick.scenarioId,
        replay: pick.replay,
        firstPlay: pick.firstPlay,
        ...(restock ? { restock } : {}),
      };
    } else {
      // 剧本全部由后台以高级模型生成、耗时较长，开局不再现场生成：库中没有时只用此地绑定的
      // 保底案卷；连保底也没有就不开局（灵气不扣），排队补货后请玩家稍后再来。
      const fallback = getMysteryFallbackCase(pick.templateId, state.mapNodeId);
      if (!fallback) {
        this.enqueueRestock(state, pick.templateId, 'cold_start');
        throw new DungeonFlowError(
          DungeonFlowErrorCode.INVALID_STATE,
          '此地的剧本还在推演，请稍后再来',
          409,
        );
      }
      state.mystery = {
        templateId: pick.templateId,
        caseSource: 'fallback',
        caseFile: fallback,
        run: createMysteryRun(fallback, template.scale.action_budget),
        ...(restock ? { restock } : {}),
      };
    }
    state.maxRounds = 1;
    state.history.push({
      round: 1,
      scene: state.mystery.caseFile.brief.opening,
    });
  }

  /** 开局提交：冷启动案卷入库，并写入游玩记录。须在保存运行态之前调用。 */
  private async persistMysteryStart(q: DbExecutor, state: DungeonState) {
    const mystery = state.mystery;
    if (!mystery?.scenarioId) return;
    if (mystery.insertScenario) {
      await insertScenario(q, {
        id: mystery.scenarioId,
        mapNodeId: state.mapNodeId,
        templateId: mystery.templateId,
        caseFile: mystery.caseFile,
        source: 'generated',
      });
      mystery.insertScenario = false;
    }
    await recordScenarioStart(q, {
      cultivatorId: state.cultivatorId,
      scenarioId: mystery.scenarioId,
      mapNodeId: state.mapNodeId,
      templateId: mystery.templateId,
      firstPlay: mystery.firstPlay ?? false,
    });
  }

  /** 开局提交后投递补货；被限流忽略或投递失败都不影响本局。 */
  private requestMysteryRestock(state: DungeonState) {
    const mystery = state.mystery;
    if (!mystery?.restock) return;
    this.enqueueRestock(state, mystery.templateId, mystery.restock.reason);
  }

  private enqueueRestock(
    state: DungeonState,
    templateId: string,
    reason: NonNullable<
      NonNullable<DungeonState['mystery']>['restock']
    >['reason'],
  ) {
    // 后台生成未开启时不排队，免得任务越积越多，日后一开启就成批烧模型费用。
    if (!isBackgroundLlmEnabled()) return;
    void requestScenarioRestock({
      mapNodeId: state.mapNodeId,
      templateId,
      reason,
      requestedBy: state.cultivatorId,
    })
      .then((decision) =>
        decision === 'enqueue' ? wakeScenarioWorker() : undefined,
      )
      .catch((error: unknown) =>
        console.warn('[DungeonMystery] 补货投递失败:', error),
      );
  }

  private requireMysteryState(
    state: DungeonState | null,
    runId: string,
  ): asserts state is DungeonState & {
    mystery: NonNullable<DungeonState['mystery']>;
  } {
    if (!state?.mystery || state.runId !== runId) {
      throw new DungeonFlowError(
        DungeonFlowErrorCode.INVALID_STATE,
        '探索状态已变化，请刷新',
        409,
      );
    }
  }

  private finishMysteryStep(
    cultivatorId: string,
    state: DungeonState,
    options: DungeonFlowOptions,
  ) {
    if (options.deferPersistence) {
      return {
        state,
        isFinished: false,
        ...this.buildStateHooks(cultivatorId, state),
      };
    }
    return this.saveState(cultivatorId, state).then(() => ({
      state,
      isFinished: false,
    }));
  }

  /** 解谜调查动作：只改变运行态，获得关键线索时累计探索收益。 */
  async actMystery(
    cultivatorId: string,
    input: {
      runId: string;
      actionId: string;
      turn: number;
      action: MysteryAction;
    },
    options: DungeonFlowOptions = {},
  ) {
    return this.withFlowLock(
      cultivatorId,
      'dungeon-mystery-act',
      async () => {
        const state = await this.getState(cultivatorId);
        this.requireMysteryState(state, input.runId);
        const mystery = state.mystery;
        if (mystery.run.lastActionId === input.actionId) {
          return { state, isFinished: state.isFinished };
        }
        if (
          state.status !== 'EXPLORING' ||
          mystery.result ||
          mystery.run.turn !== input.turn
        ) {
          throw new DungeonFlowError(
            DungeonFlowErrorCode.INVALID_STATE,
            '探索状态已变化，请刷新',
            409,
          );
        }
        const result = applyMysteryAction(
          mystery.caseFile,
          mystery.run,
          input.action,
        );
        if (!result.ok) {
          throw new DungeonFlowError(
            DungeonFlowErrorCode.INVALID_ACTION,
            result.error,
            400,
          );
        }
        mystery.run = { ...result.run, lastActionId: input.actionId };
        for (const clueId of result.newClues) {
          if (isKeyClue(mystery.caseFile, clueId))
            await appendClueReward(state, clueId);
        }
        return this.finishMysteryStep(cultivatorId, state, options);
      },
      options.lease,
    );
  }

  /**
   * 与人物自由对话：先做在场与行动力校验再调用模型，避免无效请求产生费用；
   * 模型失败不扣行动力。透露的线索经规则层过滤，关键线索照常累计探索收益。
   */
  async talkMystery(
    cultivatorId: string,
    input: {
      runId: string;
      actionId: string;
      turn: number;
      npcId: string;
      question: string;
    },
    options: DungeonFlowOptions = {},
  ) {
    return this.withFlowLock(
      cultivatorId,
      'dungeon-mystery-talk',
      async () => {
        const state = await this.getState(cultivatorId);
        this.requireMysteryState(state, input.runId);
        const mystery = state.mystery;
        if (mystery.run.lastActionId === input.actionId) {
          return { state, isFinished: state.isFinished };
        }
        if (
          state.status !== 'EXPLORING' ||
          mystery.result ||
          mystery.run.turn !== input.turn
        ) {
          throw new DungeonFlowError(
            DungeonFlowErrorCode.INVALID_STATE,
            '探索状态已变化，请刷新',
            409,
          );
        }
        const present = Boolean(
          mysteryNpcPresent(mystery.caseFile, mystery.run, input.npcId),
        );
        if (!present || mystery.run.actionsLeft <= 0) {
          throw new DungeonFlowError(
            DungeonFlowErrorCode.INVALID_ACTION,
            present ? '行动力已用完，只能提交推理了' : '此人不在这里',
            400,
          );
        }
        const question = textFilter
          .mask(normalizeFreeformLlmInput(input.question))
          .text.slice(0, 80);
        if (!question) {
          throw new DungeonFlowError(
            DungeonFlowErrorCode.INVALID_ACTION,
            '请说点什么',
            400,
          );
        }
        const answer = await generateNpcReply({
          caseFile: mystery.caseFile,
          run: mystery.run,
          npcId: input.npcId,
          question,
        }).catch((error: unknown) => {
          console.warn('[DungeonMystery] 人物对话生成失败:', error);
          throw new DungeonFlowError(
            DungeonFlowErrorCode.INVALID_STATE,
            '对方一时没有回应，请稍后再问',
            409,
          );
        });
        const result = applyMysteryDialogue(mystery.caseFile, mystery.run, {
          npcId: input.npcId,
          question,
          ...answer,
        });
        if (!result.ok) {
          throw new DungeonFlowError(
            DungeonFlowErrorCode.INVALID_ACTION,
            result.error,
            400,
          );
        }
        mystery.run = { ...result.run, lastActionId: input.actionId };
        for (const clueId of result.newClues) {
          if (isKeyClue(mystery.caseFile, clueId))
            await appendClueReward(state, clueId);
        }
        return this.finishMysteryStep(cultivatorId, state, options);
      },
      options.lease,
    );
  }

  /** 结案：规则评分后按完成通关结算，评分决定通关奖励档位。 */
  async deduceMystery(
    cultivatorId: string,
    input: {
      runId: string;
      answers: MysteryAnswers;
      evidence?: MysteryEvidence;
    },
    options: DungeonFlowOptions = {},
  ) {
    return this.withFlowLock(
      cultivatorId,
      'dungeon-mystery-deduce',
      async () => {
        const state = await this.getState(cultivatorId);
        this.requireMysteryState(state, input.runId);
        const mystery = state.mystery;
        if (state.status !== 'EXPLORING' || mystery.result) {
          throw new DungeonFlowError(
            DungeonFlowErrorCode.INVALID_STATE,
            '探索状态已变化，请刷新',
            409,
          );
        }
        const template = requireMysteryTemplate(mystery.templateId);
        const invalid = checkMysteryAnswers(
          mystery.caseFile,
          template,
          mystery.run,
          input.answers,
        );
        if (invalid) {
          throw new DungeonFlowError(
            DungeonFlowErrorCode.INVALID_ACTION,
            invalid,
            400,
          );
        }
        const culprit = mysteryConfrontationTarget(
          mystery.caseFile,
          template,
          input.answers,
          mystery.run,
        );
        if (culprit) {
          const encounter = await prepareDungeonEncounter(state, {
            enemyName: culprit.name,
            portrait: mysteryFinalePortrait(mystery.caseFile, culprit.id),
            description:
              template.archetype === 'retrieval'
                ? `禁制应声而开的一刻，${culprit.name}撕下伪装，出手抢夺遗珍——拦下此人，遗珍才能交到该得之人手里。`
                : template.archetype === 'unlock'
                  ? `主禁制应声而开的一刻，${culprit.name}拦在门前：“试炼的最后一关，是我。”`
                  : template.archetype === 'allegiance'
                    ? culprit.role === 'broker'
                      ? `你当众摊开密信，两方的怒火一齐落到${culprit.name}身上。${culprit.name}见挑拨败露，索性出手，要杀出一条路来。`
                      : `你表明了立场。${culprit.name}脸色一沉：“既然道不同——”话音未落，兵刃已至。`
                    : template.archetype === 'anomaly'
                      ? (mystery.caseFile.manifest?.description ??
                        `你按古法着手平息异变，${culprit.name}自源头扑出！`)
                      : `你当众点破了${culprit.name}的罪行。${culprit.name}见再无可辩，猝然发难，要夺路而逃——拦下此人，此案才算了结。`,
          }).catch((error: unknown) => {
            console.warn('[DungeonMystery] 对决准备失败:', error);
            throw new DungeonFlowError(
              DungeonFlowErrorCode.INVALID_STATE,
              '对决未能展开，请稍后再提交推理',
              409,
            );
          });
          mystery.verdict = {
            answers: input.answers,
            culpritId: culprit.id,
            ...(input.evidence ? { evidence: input.evidence } : {}),
          };
          state.status = 'WAITING_BATTLE';
          state.encounter = encounter.preview;
          if (options.deferPersistence) {
            return {
              state,
              isFinished: false,
              ...this.buildStateHooks(cultivatorId, state, encounter),
            };
          }
          await this.saveState(cultivatorId, state, encounter);
          return { state, isFinished: false };
        }
        mystery.result = scoreMysteryRun(
          mystery.caseFile,
          template,
          mystery.run,
          input.answers,
          'none',
          input.evidence,
        );
        const settled = await this.settleDungeon(state, {
          endDisposition: 'completed',
          deferPersistence: options.deferPersistence,
        });
        return { ...settled, state: settled.state ?? state };
      },
      options.lease,
    );
  }

  /** 强闯守卫：校验后进入遭遇战（精英强度），行动力在战斗结束时扣除。 */
  async challengeMysteryGuard(
    cultivatorId: string,
    input: { runId: string; actionId: string; turn: number; guardId: string },
    options: DungeonFlowOptions = {},
  ) {
    return this.withFlowLock(
      cultivatorId,
      'dungeon-mystery-guard',
      async () => {
        const state = await this.getState(cultivatorId);
        this.requireMysteryState(state, input.runId);
        const mystery = state.mystery;
        if (mystery.run.lastActionId === input.actionId) {
          return { state, isFinished: state.isFinished };
        }
        if (
          state.status !== 'EXPLORING' ||
          mystery.result ||
          mystery.run.turn !== input.turn
        ) {
          throw new DungeonFlowError(
            DungeonFlowErrorCode.INVALID_STATE,
            '探索状态已变化，请刷新',
            409,
          );
        }
        const check = mysteryGuardChallenge(
          mystery.caseFile,
          mystery.run,
          input.guardId,
        );
        if (!check.ok) {
          throw new DungeonFlowError(
            DungeonFlowErrorCode.INVALID_ACTION,
            check.error,
            400,
          );
        }
        mystery.pendingGuard = check.guard.id;
        const encounter = await prepareDungeonEncounter(state, {
          enemyName: check.guard.name,
          portrait: check.guard.portrait,
          description: check.guard.description,
        }).catch((error: unknown) => {
          console.warn('[DungeonMystery] 守卫遭遇战准备失败:', error);
          throw new DungeonFlowError(
            DungeonFlowErrorCode.INVALID_STATE,
            '遭遇战未能展开，请稍后再试',
            409,
          );
        });
        mystery.run = { ...mystery.run, lastActionId: input.actionId };
        state.status = 'WAITING_BATTLE';
        state.encounter = encounter.preview;
        if (options.deferPersistence) {
          return {
            state,
            isFinished: false,
            ...this.buildStateHooks(cultivatorId, state, encounter),
          };
        }
        await this.saveState(cultivatorId, state, encounter);
        return { state, isFinished: false };
      },
      options.lease,
    );
  }

  /** 守卫战结束：胜则进入其房间，败则退回原处；都消耗 1 点行动力并回到调查。 */
  private async finishMysteryGuard(
    state: DungeonState,
    won: boolean,
    options: DungeonFlowOptions,
  ): Promise<DungeonSettlementResult> {
    const mystery = state.mystery!;
    const result = applyMysteryGuardBattle(
      mystery.caseFile,
      mystery.run,
      mystery.pendingGuard!,
      won,
    );
    if (result.ok) mystery.run = result.run;
    mystery.pendingGuard = undefined;
    state.encounter = undefined;
    state.status = 'EXPLORING';
    return this.finishMysteryStep(state.cultivatorId, state, options);
  }

  /** 对决结束（胜、负或放走）：连同对决结果评分，按完成通关结算。 */
  private async finishMysteryConfrontation(
    state: DungeonState,
    outcome: MysteryConfrontationOutcome,
    options: DungeonFlowOptions,
  ) {
    const mystery = state.mystery!;
    const verdict = mystery.verdict!;
    mystery.result = scoreMysteryRun(
      mystery.caseFile,
      requireMysteryTemplate(mystery.templateId),
      mystery.run,
      verdict.answers,
      outcome,
      verdict.evidence,
    );
    mystery.verdict = undefined;
    state.encounter = undefined;
    const settled = await this.settleDungeon(state, {
      endDisposition: 'completed',
      deferPersistence: options.deferPersistence,
    });
    // 结算结果不含状态时补上，前端据此展示评分明细。
    return { ...settled, state: settled.state ?? state };
  }

  async saveState(
    cultivatorId: string,
    state: DungeonState,
    battlePayload?: DungeonBattleCachePayload,
  ) {
    this.normalizeState(state);
    await this.persistStateRecord(cultivatorId, state, battlePayload);
    await this.runs.saveRedisState(cultivatorId, state);
  }

  private persistStateRecord(
    cultivatorId: string,
    state: DungeonState,
    battlePayload?: DungeonBattleCachePayload,
    tx?: DbTransaction,
  ) {
    this.normalizeState(state);
    return this.runs.persistStateRecord(cultivatorId, state, battlePayload, tx);
  }

  async getState(cultivatorId: string, runId?: string) {
    const state = await this.runs.getState(cultivatorId, runId);
    if (!state) return null;
    this.normalizeState(state);
    if (!runId) await this.runs.saveRedisState(cultivatorId, state);
    return this.normalizeState(state);
  }

  async prepareDungeonContext(cultivatorId: string, mapNodeId: string) {
    const player = await this.getPlayer(cultivatorId);
    const mapNode = this.getMapNode(mapNodeId);
    assertDungeonRealmEligible(
      player.realm.split(' ')[0] as RealmType,
      mapNode.realm_requirement,
    );
    return {
      playerInfo: player,
      location: {
        location: mapNode.name,
        location_tags: mapNode.tags,
        location_description: mapNode.description,
      },
    };
  }

  async getPlayer(cultivatorId: string) {
    const userId = await findActiveCultivatorOwnerId(cultivatorId);
    if (!userId) throw new Error('角色不存在');
    const cultivatorBundle = await getPlayerIdentityCultivatorById(
      userId,
      cultivatorId,
    );
    if (!cultivatorBundle) throw new Error('未找到名为该道友的记录');
    const cultivator = cultivatorBundle;
    const { projection, caps } = await dungeonPlayer(cultivatorId);
    return {
      id: cultivator.id,
      name: cultivator.name,
      realm: `${cultivator.realm} ${cultivator.realm_stage}`,
      gender: cultivator.gender,
      age: cultivator.age,
      lifespan: cultivator.lifespan,
      personality: cultivator.personality || '普通',
      attributes: { ...cultivator.attributes },
      resourceCaps: {
        maxHp: caps.maxHp,
        maxMp: caps.maxMp,
      },
      spiritual_roots: cultivator.spiritual_roots.map(
        (root) => `${root.element}(${root.grade})`,
      ),
      fates: cultivator.pre_heaven_fates.map(
        (fate) => `${fate.name}(${fate.description})`,
      ),
      skills: projection.skills.map((skill) => skill.name),
      spirit_stones: (await readCraftReadinessFacts(cultivatorId)).spiritStones,
      background: cultivator.background || '',
      inventory_summary:
        '玩家拥有储物袋。如有需要特定材料的操作，请使用模糊类型与品质要求。',
    };
  }

  getMapNode(mapNodeId: string) {
    const mapNode = getMapNode(mapNodeId);
    if (!mapNode) throw new Error('无效的地图节点');
    return mapNode;
  }

  archiveDungeon(
    state: DungeonState,
    settlement: DungeonSettlement,
    realGains?: ResourceOperation[],
    options: { tx?: DbTransaction; clearRedis?: boolean } = {},
  ) {
    state.status = 'FINISHED';
    state.isFinished = true;
    state.settlement = settlement;
    state.realGains = realGains;
    state.pendingAction = undefined;
    state.costPreview = undefined;
    state.recoverableActions = undefined;
    state.activeBattleId = undefined;

    return this.recordMysterySettlement(state, options.tx).then(() =>
      this.runs.archiveDungeon(
        this.normalizeState(state),
        settlement,
        realGains,
        options,
      ),
    );
  }

  /**
   * 结算写入剧本库统计，与运行态归档同一事务；标记随运行态一起提交，
   * 重试时不会重复累计。结算本身与普通开局完全相同。
   */
  private async recordMysterySettlement(
    state: DungeonState,
    tx?: DbTransaction,
  ) {
    const mystery = state.mystery;
    if (!mystery?.scenarioId || mystery.statsRecorded) return;
    await recordScenarioSettlement(tx ?? this.database, {
      cultivatorId: state.cultivatorId,
      scenarioId: mystery.scenarioId,
      completed: Boolean(mystery.result),
      total: mystery.result?.total ?? null,
      replay: mystery.replay ?? false,
    });
    mystery.statsRecorded = true;
  }

  /**
   * Abandon the current dungeon
   */
  async recoverDungeon(
    cultivatorId: string,
    action: DungeonRecoverAction,
    options: DungeonFlowOptions = {},
  ) {
    return this.withFlowLock(
      cultivatorId,
      'dungeon-recover',
      () => this.recoverDungeonUnlocked(cultivatorId, action, options),
      options.lease,
    );
  }

  private async recoverDungeonUnlocked(
    cultivatorId: string,
    action: DungeonRecoverAction,
    options: DungeonFlowOptions = {},
  ) {
    const state = await this.getState(cultivatorId);
    if (!state) {
      throw new Error('副本已失效');
    }

    if (
      state.status !== 'RECOVERABLE_ERROR' ||
      !state.recoverableActions?.includes(action)
    ) {
      throw new DungeonFlowError(
        DungeonFlowErrorCode.INVALID_STATE,
        '当前状态不允许此恢复操作，请刷新',
        409,
      );
    }

    if (action === 'force_quit') {
      return this.quitDungeon(cultivatorId, options);
    }

    if (state.activeBattleId) throw new Error('请先完成或逃离当前战斗');

    if (action === 'safe_retreat') {
      delete state.activeBattleId;
      state.status = 'SETTLING';
      state.statusReason = '已选择安全撤退';
      state.recoverableActions = undefined;
      return this.settleDungeon(state, {
        abandonedBattle: true,
        endDisposition: 'retreated_after_battle',
        deferPersistence: options.deferPersistence,
      });
    }

    if (action === 'retry_continue') {
      if (
        state.status !== 'RECOVERABLE_ERROR' ||
        !state.recoverableActions?.includes('retry_continue')
      ) {
        throw new DungeonFlowError(
          DungeonFlowErrorCode.INVALID_STATE,
          '当前副本状态无法重试推进',
          409,
        );
      }
      // 旧版回合制已退役，无法再推进下一轮，改为结算离开。
      state.status = 'SETTLING';
      state.statusReason = undefined;
      state.recoverableActions = undefined;
      return this.settleDungeon(state, {
        endDisposition: 'retreated_after_battle',
        deferPersistence: options.deferPersistence,
      });
    }

    if (action === 'retry_settle') {
      if (
        state.status !== 'RECOVERABLE_ERROR' ||
        !state.recoverableActions?.includes('retry_settle')
      ) {
        throw new DungeonFlowError(
          DungeonFlowErrorCode.INVALID_STATE,
          '当前副本状态无法重试结算',
          409,
        );
      }
      state.status = 'SETTLING';
      state.statusReason = undefined;
      state.recoverableActions = undefined;
      delete state.activeBattleId;
      return this.settleDungeon(state, {
        pendingAction: state.pendingAction,
        deferPersistence: options.deferPersistence,
      });
    }

    if (action === 'retry') {
      // 回到调查；旧版回合制待执行的选项不再重放。
      state.status = 'EXPLORING';
      state.statusReason = undefined;
      state.recoverableActions = undefined;
      state.pendingAction = undefined;
      state.costPreview = undefined;
      if (options.deferPersistence) {
        return {
          state,
          isFinished: false,
          ...this.buildStateHooks(cultivatorId, state),
        };
      }
      await this.saveState(cultivatorId, state);
      return { state, isFinished: false };
    }

    throw new Error('未知的副本恢复动作');
  }

  async quitDungeon(cultivatorId: string, options: DungeonFlowOptions = {}) {
    const state = await this.getState(cultivatorId);
    if (!state) return { success: true };
    if (state.activeBattleId)
      throw new Error('请在战斗中使用逃跑指令，或完成战斗后离开');
    if (state.mystery?.verdict && state.status === 'WAITING_BATTLE')
      return this.finishMysteryConfrontation(state, 'spared', options);
    if (state.mystery?.pendingGuard && state.status === 'WAITING_BATTLE') {
      // 迎战前退回：不扣行动力，回到调查；清掉去重标记，稍后可再次强闯。
      state.mystery.pendingGuard = undefined;
      state.mystery.run = { ...state.mystery.run, lastActionId: undefined };
      state.encounter = undefined;
      state.status = 'EXPLORING';
      return this.finishMysteryStep(cultivatorId, state, options);
    }
    if (state.endDisposition)
      return this.settleDungeon(state, {
        pendingAction: state.pendingAction,
        deferPersistence: options.deferPersistence,
      });
    return this.settleDungeon(state, {
      endDisposition: 'retreated_after_battle',
      deferPersistence: options.deferPersistence,
    });
  }
}
