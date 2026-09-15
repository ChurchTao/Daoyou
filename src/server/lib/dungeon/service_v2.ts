import { createDomainEvent } from '@server/lib/mq/domainEventWriter';
import { publishTransactionalMessageBestEffort } from '@server/lib/mq/transactionalMessagePublisher';
import { renderPrompt } from '@server/lib/prompts';
import { findActiveCultivatorOwnerId } from '@server/lib/repositories/cultivatorRepository';
import { grantInventory } from '@server/lib/services/InventoryService';
import { assertCombatV6MutationAllowed } from '@server/lib/services/combat-v6/CombatV6MutationGuard';
import { readCraftReadinessFacts } from '@server/lib/services/cultivator/CultivatorFactsReader';
import { getPlayerIdentityCultivatorById } from '@server/lib/services/cultivator/CultivatorProfileRepository';
import { updateCultivator } from '@server/lib/services/cultivator/CultivatorStateRepository';
import { resourceEngine } from '@server/lib/services/resource/ResourceEngine';
import { generateAiObject } from '@server/utils/aiClient';
import { stableCompactStringify } from '@server/utils/llmPayload';
import { getRealmStageNaturalAttributeValue } from '@shared/config/realmProgression';
import { TYPE_DESCRIPTIONS } from '@shared/engine/material/creation/config';
import type {
  ResourceOperation,
  ResourceOperationResult,
  ResourceOperationSettlement,
} from '@shared/engine/resource/types';
import { itemDefinition } from '@shared/inventory';
import {
  calculateDungeonMaterialCost,
  calculateDungeonResourceCost,
  calculateDungeonStatLoss,
  DUNGEON_LIFESPAN_COST_MAX,
} from '@shared/lib/dungeon/costPolicy';
import type { SatelliteNode } from '@shared/lib/game/mapSystem';
import {
  canChallengeDungeonRealm,
  getMapNode,
  isSatelliteNode,
  resolveDungeonMapConfig,
} from '@shared/lib/game/mapSystem';
import { appendDungeonReward, dungeonReward } from '@shared/rewards/dungeon';
import type { CultivatorCondition } from '@shared/types/condition';
import {
  REALM_STAGE_VALUES,
  REALM_VALUES,
  RealmType,
  type RealmStage,
} from '@shared/types/constants';
import type { Cultivator } from '@shared/types/cultivator';
import { randomUUID } from 'crypto';
import { and, desc, eq, isNull, ne } from 'drizzle-orm';
import { z } from 'zod';
import { getExecutor, type DbTransaction } from '../drizzle/db';
import { dungeonHistories, dungeonRuns } from '../drizzle/schema';
import { redis } from '../redis';
import {
  isRedisLockContention,
  redisLockKeys,
  withRedisLock,
  type RedisLeaseContext,
} from '../redis/lock';
import { ConditionService } from '../services/ConditionService';
import { QiService } from '../services/QiService';
import {
  beginDungeonBattle,
  dungeonLevel,
  dungeonPlayer,
  getDungeonBattle,
  grantDungeonBeastExperience,
  prepareDungeonEncounter,
  type DungeonBattlePayload,
  type DungeonEncounterPayload,
} from './combatV6';
import { applyDungeonCosts, validateDungeonCosts } from './costs';
import { buildDungeonRoundLlmContext } from './llmContext';
import type { RewardBlueprint } from './reward';

import {
  createDungeonRoundLlmSchema,
  DungeonOptionCost,
  DungeonPendingAction,
  DungeonRecoverAction,
  DungeonRound,
  DungeonRoundLlmContext,
  DungeonRoundSchema,
  DungeonSettlement,
  DungeonSettlementLlmContext,
  DungeonState,
} from './types';

const REDIS_TTL = 3600; // 1 hour expiration for active sessions
const FLOW_LOCK_TTL_SECONDS = 180;
const RUN_TERMINAL_STATUSES = new Set(['FINISHED']);
export const DungeonFlowErrorCode = {
  NOT_FOUND: 'DUNGEON_NOT_FOUND',
  INVALID_STATE: 'DUNGEON_INVALID_STATE',
} as const;

export type DungeonFlowErrorCode =
  (typeof DungeonFlowErrorCode)[keyof typeof DungeonFlowErrorCode];

export class DungeonFlowError extends Error {
  constructor(
    public code: DungeonFlowErrorCode,
    message: string,
    public status: 404 | 409,
  ) {
    super(message);
    this.name = 'DungeonFlowError';
  }
}

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
  endDisposition?: DungeonSettlementLlmContext['endDisposition'];
  pendingAction?: DungeonPendingAction;
  deferPersistence?: boolean;
};

type DungeonFlowOptions = {
  materialSelections?: import('@shared/contracts/combatV6Dungeon').DungeonMaterialSelection[];
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

function appendRoundRewards(state: DungeonState): RewardBlueprint[] {
  if (state.rewardSeed === undefined) throw new Error('旧秘境会话需维护处理');
  const reward = dungeonReward(
    state.rewardSeed,
    `exploration:${state.currentRound}`,
    'exploration',
    dungeonLevel(state.mapNodeId),
  );
  const previous = state.v6Rewards ?? [];
  state.v6Rewards = appendDungeonReward(previous, reward);
  if (previous === state.v6Rewards) return [];
  const items = reward.items.map((item) => ({
    name: itemDefinition(item.definitionId).name,
  }));
  state.accumulatedRewards.push(...items);
  state.currentRoundItems = items;
  return items;
}

const DEFAULT_RECOVERABLE_ACTIONS: DungeonRecoverAction[] = [
  'safe_retreat',
  'force_quit',
];
const CONTINUE_RECOVERABLE_ACTIONS: DungeonRecoverAction[] = [
  'retry_continue',
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
const DUNGEON_MATERIAL_TYPE_GUIDE = Object.entries(TYPE_DESCRIPTIONS)
  .map(([key, desc]) => `${key}=${desc}`)
  .join('；');

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

// Helper to generate Redis key
function getDungeonKey(cultivatorId: string) {
  return `dungeon:active:${cultivatorId}`;
}

type DungeonBattleCachePayload = DungeonBattlePayload | DungeonEncounterPayload;

function isActiveRunStatus(status: string | null | undefined) {
  return Boolean(status && !RUN_TERMINAL_STATUSES.has(status));
}

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

export class DungeonService {
  private buildFallbackOption(
    state: Pick<DungeonState, 'currentRound' | 'maxRounds'>,
  ) {
    const isFinalRound = state.currentRound >= state.maxRounds;
    return {
      id: 1,
      text: isFinalRound
        ? '稳住心神，清点本轮所得并结束探索。'
        : '稳住心神，沿着当前线索继续探索。',
      risk_level: 'low' as const,
      costs: [],
      costPreview: [],
    };
  }

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

  private normalizeRoundOptions(
    roundData: DungeonRound,
    state: Pick<DungeonState, 'currentRound' | 'maxRounds'>,
  ) {
    roundData.interaction.options = roundData.interaction.options.map(
      (option) => {
        const costPreview = this.normalizeOptionCosts(option);
        return {
          ...option,
          costs: costPreview,
          costPreview,
        };
      },
    );
    if (roundData.interaction.options.length === 0) {
      roundData.interaction.options = [this.buildFallbackOption(state)];
    }
    return roundData;
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
    if (
      state.status === 'EXPLORING' &&
      (state.currentOptions?.length ?? 0) === 0
    ) {
      state.currentOptions = [this.buildFallbackOption(state)];
    }
    if (state.status === 'RECOVERABLE_ERROR') {
      state.recoverableActions ??= DEFAULT_RECOVERABLE_ACTIONS;
    }
    return state;
  }

  private async loadActiveRun(cultivatorId: string) {
    const rows = await getExecutor()
      .select()
      .from(dungeonRuns)
      .where(
        and(
          eq(dungeonRuns.cultivatorId, cultivatorId),
          isNull(dungeonRuns.endedAt),
        ),
      )
      .orderBy(desc(dungeonRuns.updatedAt))
      .limit(1);

    const row = rows[0];
    if (!row || !isActiveRunStatus(row.status)) return null;
    return row;
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
        await this.saveRedisState(cultivatorId, state);
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
      return await withRedisLock(
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

  private previewOptionResourceLoss(
    costs: DungeonOptionCost[],
    cultivator: {
      condition?: CultivatorCondition;
      caps: { maxHp: number; maxMp: number };
    },
  ) {
    const hpPercent = costs
      .filter((cost) => cost.type === 'hp_loss')
      .reduce((sum, cost) => sum + cost.value, 0);
    const mpPercent = costs
      .filter((cost) => cost.type === 'mp_loss')
      .reduce((sum, cost) => sum + cost.value, 0);

    if (hpPercent <= 0 && mpPercent <= 0) {
      return;
    }

    const preview = {
      rawHpLoss: Math.floor(cultivator.caps.maxHp * hpPercent),
      rawMpLoss: Math.floor(cultivator.caps.maxMp * mpPercent),
      hpLoss: Math.min(
        Math.max(0, (cultivator.condition?.resources.hp.current ?? 1) - 1),
        Math.floor(cultivator.caps.maxHp * hpPercent),
      ),
      mpLoss: Math.min(
        cultivator.condition?.resources.mp.current ?? 0,
        Math.floor(cultivator.caps.maxMp * mpPercent),
      ),
    };

    for (const cost of costs) {
      if (cost.type === 'hp_loss') {
        cost.metadata = {
          ...cost.metadata,
          rawLoss: preview.rawHpLoss,
          actualLoss: preview.hpLoss,
        };
      } else if (cost.type === 'mp_loss') {
        cost.metadata = {
          ...cost.metadata,
          rawLoss: preview.rawMpLoss,
          actualLoss: preview.mpLoss,
        };
      }
    }
  }

  private async previewRoundResourceLoss(
    roundData: DungeonRound,
    cultivatorId: string,
  ) {
    const hasResourceLoss = roundData.interaction.options.some((option) =>
      (option.costPreview ?? option.costs ?? []).some(
        (cost) => cost.type === 'hp_loss' || cost.type === 'mp_loss',
      ),
    );
    if (!hasResourceLoss) {
      return roundData;
    }

    const { player, caps } = await dungeonPlayer(cultivatorId);
    const cultivator = { condition: player.cultivator.condition, caps };

    roundData.interaction.options = roundData.interaction.options.map(
      (option) => {
        const costPreview = cloneCosts(option.costPreview ?? option.costs);
        this.previewOptionResourceLoss(costPreview, cultivator);
        return {
          ...option,
          costs: costPreview,
          costPreview,
        };
      },
    );

    return roundData;
  }

  /**
   * 计算境界差距
   * @param playerRealm 玩家境界字符串，如 "化神 中期"
   * @param mapRealm 地图要求境界
   * @returns 境界差距（正数表示玩家更强，负数表示地图更难）
   */
  private calculateRealmGap(playerRealm: string, mapRealm: RealmType): number {
    // 提取玩家境界（去掉阶段）
    const playerRealmName = playerRealm.split(' ')[0] as RealmType;

    const playerIndex = REALM_VALUES.indexOf(playerRealmName);
    const mapIndex = REALM_VALUES.indexOf(mapRealm);

    if (playerIndex === -1 || mapIndex === -1) {
      console.warn('[DungeonService] 无法识别境界:', { playerRealm, mapRealm });
      return 0;
    }

    return playerIndex - mapIndex;
  }

  // 核心配置：定义每个轮次对应的副本相位
  private getPhase(
    currentRound: number,
    maxRounds: number,
    realmGap: number,
  ): string {
    // 境界碾压场景：简化剧情，降低风险
    if (realmGap >= 2) {
      if (currentRound === 1) return '探索期：境界占优，宜顺势探查。';
      if (currentRound < maxRounds - 1) return '收获期：可稳取资源，代价宜轻。';
      if (currentRound === maxRounds - 1) return '收尾期：阻碍将尽，风险应低。';
      return '圆满期：可稳妥结局，满载而归。';
    }

    // 正常场景
    if (currentRound === 1) return '潜入期：先探环境、阵法与入口。';
    if (currentRound < maxRounds - 1) return '变局期：引入转折，开始消耗资源。';
    if (currentRound === maxRounds - 1)
      return '夺宝期：副本高潮，风险应显著抬升。';
    return '结尾期：根据前情收束结局与余波。';
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
      const existingSession = await this.loadActiveRun(cultivatorId);
      if (existingSession) {
        throw new Error('当前已有正在进行的副本，请先完成或放弃');
      }

      // 只有卫星地图节点可以进行副本挑战
      if (!isSatelliteNode(mapNodeId)) {
        throw new Error('只有秘境节点可以进行副本挑战');
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

      // 3. 首次 AI 调用
      const roundData = await this.previewRoundResourceLoss(
        this.normalizeRoundOptions(await this.callAI(state), state),
        cultivatorId,
      );

      // 4. 更新历史并存入 Redis
      const acceptedItems = appendRoundRewards(state);
      const gainedNames = acceptedItems.map((i) => i.name || '未知物品');
      state.history.push({
        round: 1,
        scene: roundData.scene_description,
        gained_items: gainedNames,
      });
      state.currentOptions = roundData.interaction.options;
      if (!options.deferPersistence) {
        await this.saveState(cultivatorId, state);
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
          roundData,
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
            await this.saveRedisState(cultivatorId, state);
          },
        };
      }

      return { state, roundData };
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

  /**
   * 处理玩家交互
   */
  async handleAction(
    cultivatorId: string,
    choiceId: number,
    actionId: string = randomUUID(),
    options: DungeonFlowOptions = {},
  ) {
    return this.withFlowLock(
      cultivatorId,
      'dungeon-action',
      () =>
        this.handleActionUnlocked(cultivatorId, choiceId, actionId, options),
      options.lease,
    );
  }

  private async handleActionUnlocked(
    cultivatorId: string,
    choiceId: number,
    actionId: string = randomUUID(),
    options: DungeonFlowOptions = {},
  ) {
    const state = await this.getState(cultivatorId);
    if (!state) throw new Error('副本已失效');
    if (this.hasCommittedAction(state, actionId)) {
      return { actionId, state, isFinished: state.isFinished };
    }
    if (
      state.status !== 'EXPLORING' &&
      !(
        state.status === 'RECOVERABLE_ERROR' &&
        state.pendingAction?.actionId === actionId
      )
    ) {
      throw new DungeonFlowError(
        DungeonFlowErrorCode.INVALID_STATE,
        '探索状态已变化，请刷新',
        409,
      );
    }

    // 1. 校验选项
    const chosenOption = state.currentOptions?.find((o) => o.id === choiceId);
    if (!chosenOption) {
      throw new Error(`无效的交互选项: ${choiceId}`);
    }

    const actionCosts = this.normalizeOptionCosts(chosenOption);
    const materialSelections = options.materialSelections ?? [];
    if (
      state.pendingAction?.actionId === actionId &&
      (state.pendingAction.choiceId !== choiceId ||
        stableCompactStringify(state.pendingAction.materialSelections ?? []) !==
          stableCompactStringify(materialSelections))
    ) {
      throw new DungeonFlowError(
        DungeonFlowErrorCode.INVALID_STATE,
        '原行动的提交物品已固定，请沿用原选择重试',
        409,
      );
    }

    const consumeActionCostsOrThrow = async (dryRun = false) => {
      // 获取 userId
      const userId = await findActiveCultivatorOwnerId(cultivatorId);
      if (!userId) {
        throw new Error('无法获取修真者所属用户');
      }

      if (dryRun)
        return validateDungeonCosts(
          userId,
          cultivatorId,
          actionCosts,
          materialSelections,
        );
      const result = await getExecutor().transaction(async (tx) => {
        const applied = await applyDungeonCosts(
          userId,
          cultivatorId,
          actionCosts,
          tx,
          materialSelections,
        );
        if (applied.success) {
          await this.applyConditionResourceLosses(
            cultivatorId,
            actionCosts,
            tx,
          );
        }
        return applied;
      });

      if (!result.success) {
        throw new Error(result.errors?.join('; ') || '资源消耗失败');
      }
    };

    await consumeActionCostsOrThrow(true);

    const pendingAction: DungeonPendingAction = {
      actionId,
      choiceId,
      choiceText: chosenOption.text,
      round: state.currentRound,
      status: 'pending',
      costs: actionCosts,
      materialSelections,
      createdAt: new Date().toISOString(),
    };
    state.pendingAction = pendingAction;
    state.costPreview = actionCosts;

    // 2. 推进状态
    state.history[state.history.length - 1].choice = chosenOption?.text;
    const battleCost = actionCosts.find((c) => c.type === 'battle');
    if (battleCost) {
      let battlePayload: DungeonEncounterPayload;
      try {
        battlePayload = await prepareDungeonEncounter(state);
      } catch (error) {
        const recoverable = await this.markRecoverable(
          cultivatorId,
          state,
          error instanceof Error ? error.message : '遭遇战生成失败',
          ACTION_RECOVERABLE_ACTIONS,
          options,
        );
        return options.deferPersistence
          ? {
              actionId,
              state: recoverable,
              isFinished: false,
              ...this.buildStateHooks(cultivatorId, recoverable),
            }
          : { actionId, state: recoverable, isFinished: false };
      }

      if (!options.deferPersistence) {
        try {
          await consumeActionCostsOrThrow();
        } catch (error) {
          state.pendingAction = {
            ...pendingAction,
            status: 'failed',
            error: error instanceof Error ? error.message : String(error),
          };
          state.costPreview = undefined;
          state.status = 'EXPLORING';
          await this.saveState(cultivatorId, state);
          throw error;
        }
      }

      this.commitCostsToState(state, pendingAction);
      state.pendingAction = undefined;
      state.costPreview = undefined;
      state.status = 'WAITING_BATTLE';
      state.encounter = battlePayload.preview;
      state.currentOptions = [];

      if (options.deferPersistence) {
        return {
          actionId,
          state,
          type: 'PREPARE_BATTLE',
          isFinished: false,
          persist: async (tx: DbTransaction) => {
            const userId = await findActiveCultivatorOwnerId(cultivatorId);
            if (!userId) {
              throw new Error('无法获取修真者所属用户');
            }
            const consumeResult = await applyDungeonCosts(
              userId,
              cultivatorId,
              actionCosts,
              tx,
              materialSelections,
            );
            if (!consumeResult.success) {
              throw new Error(
                consumeResult.errors?.join('; ') || '资源消耗失败',
              );
            }
            const condition: Cultivator['condition'] | undefined =
              (await this.applyConditionResourceLosses(
                cultivatorId,
                actionCosts,
                tx,
              )) ?? undefined;
            await this.persistStateRecord(
              cultivatorId,
              state,
              battlePayload,
              tx,
            );
            return mergeDungeonPersistenceSettlements(
              toDungeonPersistenceSettlement(consumeResult),
              condition ? { condition } : null,
            );
          },
          afterCommit: async () => {
            await this.saveRedisState(cultivatorId, state);
          },
        };
      }

      await this.saveState(cultivatorId, state, battlePayload);

      return {
        actionId,
        state,
        type: 'PREPARE_BATTLE',
        isFinished: false,
      };
    }

    if (state.currentRound >= state.maxRounds) {
      state.status = 'SETTLING';
      if (!options.deferPersistence) {
        await this.saveState(cultivatorId, state);
      }
      try {
        const result = await this.settleDungeon(state, {
          pendingAction,
          deferPersistence: options.deferPersistence,
        });
        return { actionId, ...result };
      } catch (error) {
        await this.markRecoverable(
          cultivatorId,
          state,
          error instanceof Error ? error.message : '结算生成失败',
          SETTLE_RECOVERABLE_ACTIONS,
        );
        throw error;
      }
    }

    state.status = 'GENERATING_NEXT';
    if (!options.deferPersistence) {
      await this.saveState(cultivatorId, state);
    }
    state.currentRound++;

    // 3. AI 生成下一轮
    let roundData: DungeonRound;
    try {
      roundData = await this.previewRoundResourceLoss(
        this.normalizeRoundOptions(await this.callAI(state), state),
        cultivatorId,
      );
    } catch (error) {
      state.currentRound--;
      const recoverable = await this.markRecoverable(
        cultivatorId,
        state,
        error instanceof Error ? error.message : '下一轮生成失败',
        ACTION_RECOVERABLE_ACTIONS,
        options,
      );
      return options.deferPersistence
        ? {
            actionId,
            state: recoverable,
            isFinished: false,
            ...this.buildStateHooks(cultivatorId, recoverable),
          }
        : { actionId, state: recoverable, isFinished: false };
    }

    // LLM 成功后再扣资源，避免“生成失败但资源已扣除”
    if (!options.deferPersistence) {
      try {
        await consumeActionCostsOrThrow();
      } catch (error) {
        state.currentRound--;
        state.status = 'EXPLORING';
        state.pendingAction = {
          ...pendingAction,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        };
        state.costPreview = undefined;
        await this.saveState(cultivatorId, state);
        throw error;
      }
    }
    this.commitCostsToState(state, pendingAction);
    state.pendingAction = undefined;
    state.costPreview = undefined;

    // 记录过程战利品
    const acceptedItems = appendRoundRewards(state);
    const gainedNames = acceptedItems.map((i) => i.name || '未知物品');

    // 4. 更新状态
    state.history.push({
      round: state.currentRound,
      scene: roundData.scene_description,
      gained_items: gainedNames,
    });
    state.currentOptions = roundData.interaction.options;
    state.dangerScore = roundData.status_update.internal_danger_score;
    state.status = 'EXPLORING';

    if (options.deferPersistence) {
      return {
        actionId,
        state,
        roundData,
        isFinished: false,
        persist: async (tx: DbTransaction) => {
          const userId = await findActiveCultivatorOwnerId(cultivatorId);
          if (!userId) {
            throw new Error('无法获取修真者所属用户');
          }
          const consumeResult = await applyDungeonCosts(
            userId,
            cultivatorId,
            actionCosts,
            tx,
            materialSelections,
          );
          if (!consumeResult.success) {
            throw new Error(consumeResult.errors?.join('; ') || '资源消耗失败');
          }
          const condition: Cultivator['condition'] | undefined =
            (await this.applyConditionResourceLosses(
              cultivatorId,
              actionCosts,
              tx,
            )) ?? undefined;
          await this.persistStateRecord(cultivatorId, state, undefined, tx);
          return mergeDungeonPersistenceSettlements(
            toDungeonPersistenceSettlement(consumeResult),
            condition ? { condition } : null,
          );
        },
        afterCommit: async () => {
          await this.saveRedisState(cultivatorId, state);
        },
      };
    }

    await this.saveState(cultivatorId, state);
    return { actionId, state, roundData, isFinished: false };
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
    const run = await this.loadActiveRun(cultivatorId);
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
    state.history[state.history.length - 1].outcome =
      battle.outcome === 'victory'
        ? `历经 ${battle.round} 回合，你击败了秘境守敌。`
        : '战斗结束，你离开了秘境。';
    if (battle.outcome !== 'victory')
      return this.settleDungeon(state, {
        endDisposition: 'retreated_after_battle',
        deferPersistence: options.deferPersistence,
      });
    state.status = 'LOOTING';
    state.currentRoundItems = (
      state.v6Rewards?.find((r) => r.key === `battle:${battleId}`)?.items ?? []
    ).map((item) => ({ name: itemDefinition(item.definitionId).name }));
    if (options.deferPersistence)
      return {
        state,
        isFinished: false,
        ...this.buildStateHooks(cultivatorId, state),
      };
    await this.saveState(cultivatorId, state);
    return { state, isFinished: false };
  }

  async continueFromLooting(
    cultivatorId: string,
    options: DungeonFlowOptions = {},
  ) {
    return this.withFlowLock(
      cultivatorId,
      'dungeon-looting-continue',
      () => this.continueFromLootingUnlocked(cultivatorId, options),
      options.lease,
    );
  }

  private async continueFromLootingUnlocked(
    cultivatorId: string,
    options: DungeonFlowOptions,
  ) {
    const state = await this.getState(cultivatorId);
    if (!state) {
      throw new DungeonFlowError(
        DungeonFlowErrorCode.NOT_FOUND,
        '副本已失效',
        404,
      );
    }
    if (state.status !== 'LOOTING') {
      throw new DungeonFlowError(
        DungeonFlowErrorCode.INVALID_STATE,
        '当前副本状态已变化，请刷新后重试',
        409,
      );
    }

    state.status = 'GENERATING_NEXT';
    state.statusReason = undefined;
    state.recoverableActions = undefined;
    state.currentRound++;

    if (state.currentRound > state.maxRounds) {
      return this.settleDungeon(state, {
        deferPersistence: options.deferPersistence,
      });
    }

    return this.generateRoundAfterLooting(cultivatorId, state, options);
  }

  private async generateRoundAfterLooting(
    cultivatorId: string,
    state: DungeonState,
    options: DungeonFlowOptions = {},
  ) {
    let roundData: DungeonRound;
    try {
      roundData = await this.previewRoundResourceLoss(
        this.normalizeRoundOptions(await this.callAI(state), state),
        cultivatorId,
      );
    } catch (error) {
      console.error('[DungeonService] 战后生成失败:', error);
      const recoverable = await this.markRecoverable(
        cultivatorId,
        state,
        error instanceof Error ? error.message : '战后继续推演失败',
        CONTINUE_RECOVERABLE_ACTIONS,
        options,
      );
      return options.deferPersistence
        ? {
            state: recoverable,
            isFinished: false,
            ...this.buildStateHooks(cultivatorId, recoverable),
          }
        : { state: recoverable, isFinished: false };
    }

    const acceptedItems = appendRoundRewards(state);
    const gainedNames = acceptedItems.map((i) => i.name || '未知物品');

    state.history.push({
      round: state.currentRound,
      scene: roundData.scene_description,
      gained_items: gainedNames,
    });
    state.currentOptions = roundData.interaction.options;
    state.dangerScore = roundData.status_update.internal_danger_score;
    state.status = 'EXPLORING';
    state.statusReason = undefined;
    state.recoverableActions = undefined;

    if (options.deferPersistence) {
      return {
        state,
        roundData,
        isFinished: false,
        ...this.buildStateHooks(cultivatorId, state),
      };
    }

    await this.saveState(cultivatorId, state);
    return { state, roundData, isFinished: false };
  }

  /**
   * 战后见好就收
   */
  async escapeFromLooting(
    cultivatorId: string,
    options: DungeonFlowOptions = {},
  ) {
    return this.withFlowLock(
      cultivatorId,
      'dungeon-looting-escape',
      () => this.escapeFromLootingUnlocked(cultivatorId, options),
      options.lease,
    );
  }

  private async escapeFromLootingUnlocked(
    cultivatorId: string,
    options: DungeonFlowOptions,
  ) {
    const state = await this.getState(cultivatorId);
    if (!state) {
      throw new DungeonFlowError(
        DungeonFlowErrorCode.NOT_FOUND,
        '副本已失效',
        404,
      );
    }
    if (state.status !== 'LOOTING') {
      throw new DungeonFlowError(
        DungeonFlowErrorCode.INVALID_STATE,
        '当前副本状态已变化，请刷新后重试',
        409,
      );
    }
    return this.settleDungeon(state, {
      abandonedBattle: true,
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
    if (endDisposition === 'completed')
      state.v6Rewards = appendDungeonReward(
        state.v6Rewards ?? [],
        dungeonReward(
          state.rewardSeed,
          'completion',
          'completion',
          dungeonLevel(state.mapNodeId),
        ),
      );
    const endingPrompt = renderPrompt('dungeon-settlement', {
      userContextJson: stableCompactStringify({
        history: state.history,
        endDisposition,
        rewards: state.v6Rewards,
      }),
    });
    const ending = state.settlement
      ? undefined
      : await generateAiObject({
          system: endingPrompt.system,
          prompt: endingPrompt.user,
          schema: z.object({
            narrative: z.string().min(12).max(600),
            rating: z.enum(['S', 'A', 'B', 'C', 'D']),
          }),
          name: 'DungeonSettlement',
          sceneId: 'dungeon-settlement',
        });
    const settlement: DungeonSettlement = state.settlement ?? {
      ending_narrative: ending!.output.narrative,
      settlement: {
        reward_tier:
          endDisposition === 'completed' ? ending!.output.rating : 'C',
        reward_blueprints: [],
        performance_tags:
          endDisposition === 'completed' ? ['功成身退'] : ['及时止损'],
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
        const result = await getExecutor().transaction(async (tx) => {
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
    const realGains = state.realGains ??
      committedSettlementGain?.gains ?? [
        {
          type: 'cultivation_exp' as const,
          value: (state.v6Rewards ?? []).reduce(
            (sum, r) => sum + r.experience,
            0,
          ),
        },
        {
          type: 'spirit_stones' as const,
          value: (state.v6Rewards ?? []).reduce(
            (sum, r) => sum + r.spiritStones,
            0,
          ),
        },
      ];
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
        const result = await getExecutor().transaction(async (tx) => {
          await this.assertTerminalRunCanCommit(tx, state);
          await grantInventory(
            state.cultivatorId,
            settlement.inventoryRewards ?? [],
            tx,
          );
          await grantDungeonBeastExperience(state, tx);
          const applied = await resourceEngine.applyInTransaction({
            userId,
            cultivatorId: state.cultivatorId,
            gain: realGains as ResourceOperation[],
            tx,
          });
          if (!applied.success) {
            throw new Error(applied.errors?.join('; ') || '资源获得失败');
          }
          if (applied.success && runId) {
            await tx
              .update(dungeonRuns)
              .set({
                runState: {
                  ...state,
                  gainLedger: nextGainLedger,
                  realGains,
                },
                gainLedger: nextGainLedger,
              })
              .where(eq(dungeonRuns.id, runId));
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
    const recordDungeonSettledEvent = async (tx: DbTransaction) => {
      if (!state.runId) throw new Error('副本结算缺少运行编号');
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
    };

    if (!deferPersistence) {
      await getExecutor().transaction(async (tx) => {
        await this.archiveDungeon(state, settlement, realGains, {
          tx,
          clearRedis: false,
        });
        await recordDungeonSettledEvent(tx);
      });
      await redis.del(getDungeonKey(state.cultivatorId));
      publishTransactionalMessageBestEffort(domainEventId, {
        source: 'dungeon_settlement',
        cultivatorId: state.cultivatorId,
        runId: state.runId,
      });
    }

    if (!deferPersistence) {
      return { isFinished: true, settlement, realGains };
    }

    return {
      isFinished: true,
      settlement,
      realGains,
      persist: async (tx) => {
        await this.assertTerminalRunCanCommit(tx, state);

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
          const gainResult = await resourceEngine.applyInTransaction({
            userId,
            cultivatorId: state.cultivatorId,
            gain: realGains as ResourceOperation[],
            tx,
          });
          if (gainResult.success && runId) {
            await tx
              .update(dungeonRuns)
              .set({
                runState: {
                  ...state,
                  gainLedger: nextGainLedger,
                  realGains,
                },
                gainLedger: nextGainLedger,
              })
              .where(eq(dungeonRuns.id, runId));
          }
          if (!gainResult.success) {
            throw new Error(gainResult.errors?.join('; ') || '资源获得失败');
          }
          gainedSettlement = toDungeonPersistenceSettlement(gainResult);
        }

        await this.archiveDungeon(state, settlement, realGains, {
          tx,
          clearRedis: false,
        });
        await recordDungeonSettledEvent(tx);
        return mergeDungeonPersistenceSettlements(
          consumedSettlement,
          gainedSettlement,
          condition ? { condition } : null,
        );
      },
      afterCommit: async () => {
        await redis.del(getDungeonKey(state.cultivatorId));
        publishTransactionalMessageBestEffort(domainEventId, {
          source: 'dungeon_settlement',
          cultivatorId: state.cultivatorId,
          runId: state.runId,
        });
      },
    };
  }

  /**
   * 内部工具：调用 AI 并处理上下文压缩
   */
  private async callAI(state: DungeonState): Promise<DungeonRound> {
    const mapNode = getMapNode(state.mapNodeId);
    const mapRealm =
      mapNode && 'realm_requirement' in mapNode
        ? (mapNode as SatelliteNode).realm_requirement
        : ('筑基' as RealmType);
    const mapConfig = mapNode
      ? resolveDungeonMapConfig(mapNode)
      : resolveDungeonMapConfig({
          id: 'fallback-dungeon-map',
          name: '未知秘境',
          parent_id: 'fallback',
          type: '秘境',
          realm_requirement: mapRealm,
          tags: [],
          description: '',
          connections: [],
          x: 0,
          y: 0,
        });
    const realmGap = this.calculateRealmGap(state.playerInfo.realm, mapRealm);
    const phase = this.getPhase(state.currentRound, state.maxRounds, realmGap);
    const userContext: DungeonRoundLlmContext = buildDungeonRoundLlmContext({
      state,
      mapConfig,
      realmGap,
      phase,
    });

    const { system: roundPrompt, user: roundUserPrompt } = renderPrompt(
      'dungeon-round',
      {
        materialTypeTable: DUNGEON_MATERIAL_TYPE_GUIDE,
        userContextJson: stableCompactStringify(userContext),
      },
    );
    const aiRes = await generateAiObject({
      system: roundPrompt,
      prompt: roundUserPrompt,
      schema: createDungeonRoundLlmSchema(0),
      name: 'DungeonRound',
      sceneId: 'dungeon-round',
    });

    return DungeonRoundSchema.parse({
      scene_description: aiRes.output.scene_description,
      interaction: {
        options: aiRes.output.options.map((option, index) => {
          const costs: DungeonOptionCost[] = [
            ...option.costs.resources.map((cost) => ({
              type: cost.type,
              value: calculateDungeonResourceCost({
                ...cost,
                realm: mapConfig.realmRequirement,
                difficulty: mapConfig.difficultyTier,
              }),
            })),
            ...option.costs.materials.map((cost) => {
              const resolved = calculateDungeonMaterialCost({
                realm: mapConfig.realmRequirement,
                difficulty: mapConfig.difficultyTier,
                rank: cost.rank,
              });
              return {
                type: 'material' as const,
                required_type: cost.required_type,
                required_quality: resolved.requiredQuality,
                value: resolved.value,
              };
            }),
            ...option.costs.stat_losses.map((cost) => ({
              type: cost.type,
              value: calculateDungeonStatLoss({
                realm: mapConfig.realmRequirement,
                difficulty: mapConfig.difficultyTier,
                rank: cost.rank,
              }),
            })),
            ...option.costs.battles.map((metadata) => ({
              type: 'battle' as const,
              value: 1,
              metadata,
            })),
          ];
          return {
            text: option.text,
            id: index + 1,
            risk_level: (['low', 'high', 'medium'] as const)[index] ?? 'medium',
            costs,
          };
        }),
      },
      acquired_items: [],
      status_update: {
        is_final_round: state.currentRound >= state.maxRounds,
        internal_danger_score: aiRes.output.internal_danger_score,
      },
    });
  }

  async saveState(
    cultivatorId: string,
    state: DungeonState,
    battlePayload?: DungeonBattleCachePayload,
  ) {
    this.normalizeState(state);
    await this.persistStateRecord(cultivatorId, state, battlePayload);
    await this.saveRedisState(cultivatorId, state);
  }

  private async persistStateRecord(
    cultivatorId: string,
    state: DungeonState,
    battlePayload?: DungeonBattleCachePayload,
    tx?: DbTransaction,
  ) {
    this.normalizeState(state);
    const values = {
      cultivatorId,
      mapNodeId: state.mapNodeId,
      status: state.status,
      currentRound: state.currentRound,
      maxRounds: state.maxRounds,
      dangerScore: state.dangerScore,
      runState: state,
      costLedger: state.costLedger ?? [],
      gainLedger: state.gainLedger ?? [],
      pendingAction: state.pendingAction ?? null,
      activeBattleId: state.activeBattleId ?? null,
      battlePayload: battlePayload ?? null,
    };
    const q = tx ?? getExecutor();

    if (state.runId) {
      await q
        .update(dungeonRuns)
        .set(values)
        .where(eq(dungeonRuns.id, state.runId));
    } else {
      const inserted = await q
        .insert(dungeonRuns)
        .values(values)
        .returning({ id: dungeonRuns.id });
      state.runId = inserted[0]?.id;
      if (state.runId) {
        await q
          .update(dungeonRuns)
          .set({ runState: state })
          .where(eq(dungeonRuns.id, state.runId));
      }
    }
  }

  private async assertTerminalRunCanCommit(
    tx: DbTransaction,
    state: DungeonState,
  ) {
    if (!state.runId) {
      return;
    }

    const claimed = await tx
      .update(dungeonRuns)
      .set({
        status: 'FINISHED',
        endedAt: new Date(),
      })
      .where(
        and(
          eq(dungeonRuns.id, state.runId),
          isNull(dungeonRuns.endedAt),
          ne(dungeonRuns.status, 'FINISHED'),
        ),
      )
      .returning({ id: dungeonRuns.id });

    if (claimed.length === 1) {
      return;
    }

    const [run] = await tx
      .select({ id: dungeonRuns.id })
      .from(dungeonRuns)
      .where(eq(dungeonRuns.id, state.runId))
      .limit(1);
    if (!run) {
      throw new DungeonFlowError(
        DungeonFlowErrorCode.NOT_FOUND,
        '副本已失效',
        404,
      );
    }

    throw new DungeonFlowError(
      DungeonFlowErrorCode.INVALID_STATE,
      '当前副本已完成，请刷新查看结算',
      409,
    );
  }

  private async saveRedisState(cultivatorId: string, state: DungeonState) {
    await redis.set(
      getDungeonKey(cultivatorId),
      JSON.stringify(state),
      'EX',
      REDIS_TTL,
    );
  }

  async getState(cultivatorId: string, runId?: string) {
    const key = getDungeonKey(cultivatorId);
    const run = runId
      ? (
          await getExecutor()
            .select()
            .from(dungeonRuns)
            .where(
              and(
                eq(dungeonRuns.id, runId),
                eq(dungeonRuns.cultivatorId, cultivatorId),
              ),
            )
            .limit(1)
        )[0]
      : await this.loadActiveRun(cultivatorId);
    let state: DungeonState | null;
    if (run) {
      state = run.runState as DungeonState;
      state.runId = run.id;
      state.status = run.status as DungeonState['status'];
      state.currentRound = run.currentRound;
      state.maxRounds = run.maxRounds;
      state.dangerScore = run.dangerScore;
      state.costLedger = (run.costLedger as DungeonState['costLedger']) ?? [];
      state.gainLedger = (run.gainLedger as DungeonState['gainLedger']) ?? [];
      state.pendingAction =
        (run.pendingAction as DungeonState['pendingAction']) ?? undefined;
      state.activeBattleId = run.activeBattleId ?? state.activeBattleId;
      this.normalizeState(state);
      if (!runId) await redis.set(key, JSON.stringify(state), 'EX', REDIS_TTL);
    } else {
      state = null;
    }
    if (!state) return null;
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

  async archiveDungeon(
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

    const archive = async (tx: DbTransaction) => {
      if (!state.archiveHistoryCommittedAt) {
        await tx.insert(dungeonHistories).values({
          cultivatorId: state.cultivatorId,
          theme: state.theme,
          result: settlement,
          log: state.history
            .map((h) => `[Round ${h.round}] ${h.scene} -> Choice: ${h.choice}`)
            .join('\n'),
          realGains: realGains ?? null,
        });
        state.archiveHistoryCommittedAt = new Date().toISOString();
      }

      if (state.runId) {
        await tx
          .update(dungeonRuns)
          .set({
            status: 'FINISHED',
            runState: this.normalizeState(state),
            costLedger: state.costLedger ?? [],
            gainLedger: state.gainLedger ?? [],
            pendingAction: null,
            activeBattleId: null,
            battlePayload: null,
            endedAt: new Date(),
          })
          .where(eq(dungeonRuns.id, state.runId));
      }
    };

    if (options.tx) {
      await archive(options.tx);
    } else {
      await getExecutor().transaction(archive);
    }

    if (options.clearRedis !== false) {
      await redis.del(getDungeonKey(state.cultivatorId));
    }
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
      state.status = 'GENERATING_NEXT';
      state.statusReason = undefined;
      state.recoverableActions = undefined;
      if (state.currentRound > state.maxRounds) {
        return this.settleDungeon(state, {
          deferPersistence: options.deferPersistence,
        });
      }
      return this.generateRoundAfterLooting(cultivatorId, state, options);
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
      const pending = state.pendingAction;
      if (!pending?.choiceId) {
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

      state.status = 'EXPLORING';
      state.statusReason = undefined;
      state.recoverableActions = undefined;
      state.pendingAction = undefined;
      state.costPreview = undefined;
      if (!options.deferPersistence) {
        await this.saveState(cultivatorId, state);
      }
      return this.handleActionUnlocked(
        cultivatorId,
        pending.choiceId,
        pending.actionId,
        { ...options, materialSelections: pending.materialSelections },
      );
    }

    throw new Error('未知的副本恢复动作');
  }

  async quitDungeon(cultivatorId: string, options: DungeonFlowOptions = {}) {
    const state = await this.getState(cultivatorId);
    if (!state) return { success: true };
    if (state.activeBattleId)
      throw new Error('请在战斗中使用逃跑指令，或完成战斗后离开');
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

export const dungeonService = new DungeonService();
