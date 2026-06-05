import { renderPrompt } from '@server/lib/prompts';
import { simulateBattleV5 } from '@server/lib/services/simulateBattleV5';
import type { BattleRecord } from '@server/lib/services/battleResult';
import { object } from '@server/utils/aiClient'; // AI client helper
import { getCultivatorDisplayAttributes } from '@shared/engine/battle-v5/adapters/CultivatorDisplayAdapter';
import { enemyGenerator } from '@shared/engine/enemyGenerator';
import { TYPE_DESCRIPTIONS } from '@shared/engine/material/creation/config';
import { resourceEngine } from '@shared/engine/resource/ResourceEngine';
import type { ResourceOperation } from '@shared/engine/resource/types';
import {
  getMapNode,
  resolveDungeonMapConfig,
  scaleDungeonBattleDifficulty,
} from '@shared/lib/game/mapSystem';
import type { SatelliteNode } from '@shared/lib/game/mapSystem';
import {
  MaterialType,
  Quality,
  QUALITY_VALUES,
  REALM_VALUES,
  RealmType,
} from '@shared/types/constants';
import { randomUUID } from 'crypto';
import type { Cultivator } from '@shared/types/cultivator';
import { getExecutor } from '../drizzle/db';
import { dungeonHistories, dungeonRuns } from '../drizzle/schema';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { redis } from '../redis';
import { parseRedisJson } from '../redis/json';
import { stableCompactStringify } from '@server/utils/llmPayload';
import {
  getCultivatorByIdUnsafe,
  getCultivatorOwnerId,
  getPaginatedInventoryByType,
  updateCultivator,
} from '../services/cultivatorService';
import { ConditionService } from '../services/ConditionService';
import { TaskService } from '../services/TaskService';
import { buildDungeonBattleInit } from './battleInit';
import {
  buildDungeonRoundLlmContext,
  buildDungeonSettlementLlmContext,
} from './llmContext';
import { checkDungeonLimit, consumeDungeonLimit } from './dungeonLimiter';
import type { RewardBlueprint } from './reward';
import { RewardFactory } from './reward';
import {
  BattleSession,
  DungeonOptionCost,
  DungeonPendingAction,
  DungeonRecoverAction,
  DungeonRound,
  DungeonRoundLlmContext,
  DungeonRoundLlmSchema,
  DungeonRoundSchema,
  DungeonSettlement,
  DungeonSettlementLlmContext,
  DungeonSettlementLlmSchema,
  DungeonSettlementSchema,
  DungeonState,
  PlayerInfo,
} from './types';

const REDIS_TTL = 3600; // 1 hour expiration for active sessions
const START_LOCK_TTL_SECONDS = 180;
const RUN_TERMINAL_STATUSES = new Set(['FINISHED']);
const COST_LIMITS: Partial<Record<DungeonOptionCost['type'], number>> = {
  spirit_stones: 10_000_000,
  lifespan: 10_000,
  cultivation_exp: 1_000_000,
  comprehension_insight: 100,
  material: 999,
  hp_loss: 1,
  mp_loss: 1,
  weak: 10,
  battle: 100,
  artifact_damage: 100,
};
const DUNGEON_MATERIAL_TYPE_TABLE = Object.entries(TYPE_DESCRIPTIONS)
  .map(([key, desc]) => `| ${key} | ${desc} |`)
  .join('\n');

// Helper to generate Redis key
function getDungeonKey(cultivatorId: string) {
  return `dungeon:active:${cultivatorId}`;
}

function getDungeonStartLockKey(cultivatorId: string) {
  return `dungeon:starting:${cultivatorId}`;
}

function getDungeonBattleKey(battleId: string) {
  return `dungeon:battle:${battleId}`;
}

interface DungeonBattleCachePayload {
  session: BattleSession;
  enemyObject: Cultivator;
}

function isActiveRunStatus(status: string | null | undefined) {
  return Boolean(status && !RUN_TERMINAL_STATUSES.has(status));
}

function cloneCosts(costs: DungeonOptionCost[] | undefined): DungeonOptionCost[] {
  return costs ? costs.map((cost) => ({ ...cost, metadata: cost.metadata ? { ...cost.metadata } : undefined })) : [];
}

export class DungeonService {
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
    return hasBattle
      ? costs.filter((cost) => cost.type !== 'hp_loss' && cost.type !== 'mp_loss')
      : costs;
  }

  private normalizeRoundOptions(roundData: DungeonRound) {
    roundData.interaction.options = roundData.interaction.options.map((option) => {
      const costPreview = this.normalizeOptionCosts(option);
      return {
        ...option,
        costs: costPreview,
        costPreview,
      };
    });
    return roundData;
  }

  private normalizeState(state: DungeonState): DungeonState {
    state.costLedger ??= [];
    state.gainLedger ??= [];
    state.summary_of_sacrifice = state.costLedger.flatMap((entry) =>
      cloneCosts(entry.costs),
    );
    state.currentOptions = state.currentOptions?.map((option) => {
      const costPreview = this.normalizeOptionCosts(option);
      return {
        ...option,
        costs: costPreview,
        costPreview,
      };
    });
    if (state.status === 'RECOVERABLE_ERROR') {
      state.recoverableActions ??= ['retry', 'safe_retreat', 'force_quit'];
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
    actions: DungeonRecoverAction[] = ['retry', 'safe_retreat', 'force_quit'],
  ) {
    state.status = 'RECOVERABLE_ERROR';
    state.statusReason = reason;
    state.recoverableActions = actions;
    if (state.pendingAction) {
      state.pendingAction.status = 'failed';
      state.pendingAction.error = reason;
    }
    await this.saveState(cultivatorId, state);
    return state;
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

  private applyConditionCosts(
    state: DungeonState,
    runtimeCultivator: Cultivator,
    costs: DungeonOptionCost[],
  ) {
    for (const cost of costs) {
      if (cost.type === 'hp_loss') {
        state.condition = ConditionService.applyExternalResourceLoss(
          runtimeCultivator,
          state.condition,
          {
            hpPercent: cost.value,
          },
        );
      } else if (cost.type === 'mp_loss') {
        state.condition = ConditionService.applyExternalResourceLoss(
          runtimeCultivator,
          state.condition,
          {
            mpPercent: cost.value,
          },
        );
      } else if (cost.type === 'weak') {
        state.condition = ConditionService.addOrStackStatus(
          state.condition,
          'weakness',
          cost.value,
          'event',
        );
      }
    }
  }

  private async getBattleContext(cultivatorId: string, battleId: string) {
    const state = await this.getState(cultivatorId);
    if (!state || state.activeBattleId !== battleId) {
      throw new Error('当前没有匹配的遭遇战');
    }

    const battleKey = getDungeonBattleKey(battleId);
    let battlePayload = parseRedisJson<DungeonBattleCachePayload>(
      await redis.get(battleKey),
      battleKey,
    );

    if (!battlePayload?.session || !battlePayload.enemyObject) {
      const run = await this.loadActiveRun(cultivatorId);
      const persistedPayload = run?.battlePayload as
        | DungeonBattleCachePayload
        | null
        | undefined;
      if (
        persistedPayload?.session?.battleId === battleId &&
        persistedPayload.enemyObject
      ) {
        await redis.set(
          battleKey,
          JSON.stringify(persistedPayload),
          'EX',
          REDIS_TTL,
        );
        battlePayload = persistedPayload;
      }
    }

    if (!battlePayload?.session || !battlePayload.enemyObject) {
      await this.markRecoverable(
        cultivatorId,
        state,
        '遭遇战数据不存在或已失效',
        ['safe_retreat', 'force_quit'],
      );
      throw new Error('遭遇战数据不存在或已失效，可选择安全撤退或放弃副本');
    }

    if (battlePayload.session.cultivatorId !== cultivatorId) {
      throw new Error('无权访问该遭遇战');
    }

    return {
      state,
      battleKey,
      session: battlePayload.session,
      enemyObject: battlePayload.enemyObject,
    };
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
      if (currentRound === 1)
        return '探索期：境界占优，宜顺势探查。';
      if (currentRound < maxRounds - 1)
        return '收获期：可稳取资源，代价宜轻。';
      if (currentRound === maxRounds - 1)
        return '收尾期：阻碍将尽，风险应低。';
      return '圆满期：可稳妥结局，满载而归。';
    }

    // 正常场景
    if (currentRound === 1)
      return '潜入期：先探环境、阵法与入口。';
    if (currentRound < maxRounds - 1)
      return '变局期：引入转折，开始消耗资源。';
    if (currentRound === maxRounds - 1)
      return '夺宝期：副本高潮，风险应显著抬升。';
    return '结尾期：根据前情收束结局与余波。';
  }

  // 统一的 System Prompt 生成器
  private getSystemPrompt(): string {
    return (
      renderPrompt('dungeon-round', {
        materialTypeTable: DUNGEON_MATERIAL_TYPE_TABLE,
        userContextJson: '',
      }).system +
      `

### 成本(costs)规范:
- **必须使用指定类型**: spirit_stones, lifespan, cultivation_exp, comprehension_insight, material, hp_loss, mp_loss, weak, battle, artifact_damage。
- **数值范围**: hp_loss, mp_loss 必须是 0-1 之间的小数；其他类型为正整数。
- **材料(material)**: 禁止指定 name，必须提供 required_type 和 required_quality。
- **冲突禁止**: 若有 'battle'，严禁同时出现 'hp_loss' 或 'mp_loss'。
- **战斗元数据(battle.metadata)**: 必须提供 race 与 realm_stage；可选提供 enemy_name、background、description、is_boss。`
    );
  }

  /**
   * 初始化副本
   */
  async startDungeon(cultivatorId: string, mapNodeId: string) {
    const activeKey = getDungeonKey(cultivatorId);
    const startLockKey = getDungeonStartLockKey(cultivatorId);

    // 防并发：避免重复点击导致并行启动时重复扣次数
    const lockAcquired = await redis.set(
      startLockKey,
      '1',
      'EX',
      START_LOCK_TTL_SECONDS,
      'NX',
    );
    if (!lockAcquired) {
      throw new Error('副本正在启动中，请稍后重试');
    }

    try {
      // 0. 检查每日次数限制
      const limit = await checkDungeonLimit(cultivatorId);
      if (!limit.allowed) {
        throw new Error('今日探索次数已用尽（每日限 2 次）');
      }

      const existingSession = await this.loadActiveRun(cultivatorId);
      if (existingSession) {
        throw new Error('当前已有正在进行的副本，请先完成或放弃');
      }

      // 1. 获取玩家与地图数据 (逻辑同你之前)
      const context = await this.prepareDungeonContext(cultivatorId, mapNodeId);

      // 2. 加载持久状态和环境状态
      const cultivator = await getCultivatorByIdUnsafe(cultivatorId);
      if (!cultivator || !cultivator.cultivator) {
        throw new Error('未找到修真者数据');
      }

      const hydratedCondition = ConditionService.tickNaturalRecovery(
        cultivator.cultivator,
        cultivator.cultivator.condition,
      );

      // 3. 初始状态
      const state: DungeonState = {
        ...context,
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
        condition: hydratedCondition,
        accumulatedHpLoss: 0, // 累积气血损失百分比 (0-1)
        accumulatedMpLoss: 0, // 累积法力损失百分比 (0-1)
      };

      // 4. 首次 AI 调用
      const roundData = this.normalizeRoundOptions(await this.callAI(state));

      // 5. 更新历史并存入 Redis
      const gainedNames = roundData.acquired_items?.map(
        (i) => i.name || '未知物品',
      );
      state.history.push({
        round: 1,
        scene: roundData.scene_description,
        gained_items: gainedNames,
      });
      state.currentOptions = roundData.interaction.options;
      state.currentRoundItems = roundData.acquired_items || [];
      if (roundData.acquired_items?.length) {
        if (!state.accumulatedRewards) state.accumulatedRewards = [];
        state.accumulatedRewards.push(...roundData.acquired_items);
      }
      await this.saveState(cultivatorId, state);

      // 6. 仅在副本已成功初始化后再扣除次数
      try {
        await consumeDungeonLimit(cultivatorId);
      } catch (error) {
        // 扣次数失败时回滚活跃副本，避免“启动失败但次数异常”
        if (state.runId) {
          await getExecutor()
            .update(dungeonRuns)
            .set({ status: 'FINISHED', endedAt: new Date() })
            .where(eq(dungeonRuns.id, state.runId));
        }
        await redis.del(activeKey);
        throw error;
      }

      return { state, roundData };
    } finally {
      await redis.del(startLockKey);
    }
  }

  /**
   * 处理玩家交互
   */
  async handleAction(
    cultivatorId: string,
    choiceId: number,
    actionId: string = randomUUID(),
  ) {
    const state = await this.getState(cultivatorId);
    if (!state) throw new Error('副本已失效');
    if (this.hasCommittedAction(state, actionId)) {
      return { actionId, state, isFinished: state.isFinished };
    }
    const cultivatorBundle = await getCultivatorByIdUnsafe(cultivatorId);
    if (!cultivatorBundle?.cultivator) {
      throw new Error('未找到修真者数据');
    }
    const runtimeCultivator = {
      ...cultivatorBundle.cultivator,
      condition: state.condition,
    };

    // 1. 校验选项
    const chosenOption = state.currentOptions?.find((o) => o.id === choiceId);
    if (!chosenOption) {
      throw new Error(`无效的交互选项: ${choiceId}`);
    }

    const actionCosts = this.normalizeOptionCosts(chosenOption);

    const consumeActionCostsOrThrow = async (dryRun = false) => {
      if (actionCosts.length === 0) return;

      // 获取 userId
      const userId = await getCultivatorOwnerId(cultivatorId);
      if (!userId) {
        throw new Error('无法获取修真者所属用户');
      }

      // 动态匹配材料
      for (const cost of actionCosts) {
        if (cost.type === 'material' && !cost.name) {
          const reqType = cost.required_type as MaterialType;
          const reqQual = cost.required_quality as Quality;

          const requiredIndex = QUALITY_VALUES.indexOf(reqQual || '凡品');
          const validRanks = QUALITY_VALUES.slice(Math.max(0, requiredIndex));

          const matchPage = await getPaginatedInventoryByType(
            userId,
            cultivatorId,
            {
              type: 'materials',
              page: 1,
              pageSize: 10, // 获取前10个符合条件的材料
              materialTypes: reqType ? [reqType] : undefined,
              materialRanks:
                validRanks.length > 0 ? (validRanks as Quality[]) : undefined,
            },
          );

          if (matchPage.items.length === 0) {
            const typeStr = reqType
              ? TYPE_DESCRIPTIONS[reqType] || reqType
              : '材料';
            const qualStr = reqQual ? reqQual + '以上的' : '';
            throw new Error(
              `储物袋中没有符合条件的材料（需要：${qualStr}${typeStr}），请重新选择或退出副本。`,
            );
          }

          // 选择第一个符合条件的材料
          cost.name = matchPage.items[0].name;
        }
      }

      const result = await resourceEngine.consume(
        userId,
        cultivatorId,
        actionCosts as ResourceOperation[],
        undefined,
        dryRun,
      );

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
      createdAt: new Date().toISOString(),
    };
    state.pendingAction = pendingAction;
    state.costPreview = actionCosts;

    // 2. 推进状态
    state.history[state.history.length - 1].choice = chosenOption?.text;
    state.history[state.history.length - 1].outcome =
      chosenOption?.potential_cost;

    const battleCost = actionCosts.find((c) => c.type === 'battle');
    if (battleCost) {
      const session = await this.createBattleSession(
        cultivatorId,
        getDungeonKey(cultivatorId),
        battleCost,
        state.playerInfo,
        state,
      );

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

      this.applyConditionCosts(state, runtimeCultivator, actionCosts);
      this.commitCostsToState(state, pendingAction);
      state.pendingAction = undefined;
      state.costPreview = undefined;
      state.status = 'WAITING_BATTLE';
      state.activeBattleId = session.battleId;
      const { enemyObject, ...battleSession } = session;
      await this.saveState(cultivatorId, state, {
        session: battleSession,
        enemyObject,
      });

      return {
        actionId,
        state,
        type: 'TRIGGER_BATTLE',
        battleId: session.battleId,
        isFinished: false,
      };
    }

    if (state.currentRound >= state.maxRounds) {
      state.status = 'SETTLING';
      await this.saveState(cultivatorId, state);
      try {
        const result = await this.settleDungeon(state, {
          pendingAction,
          runtimeCultivator,
        });
        return { actionId, ...result };
      } catch (error) {
        await this.markRecoverable(
          cultivatorId,
          state,
          error instanceof Error ? error.message : '结算生成失败',
          ['retry', 'safe_retreat', 'force_quit'],
        );
        throw error;
      }
    }

    state.status = 'GENERATING_NEXT';
    await this.saveState(cultivatorId, state);
    state.currentRound++;

    // 3. AI 生成下一轮
    let roundData: DungeonRound;
    try {
      roundData = this.normalizeRoundOptions(await this.callAI(state));
    } catch (error) {
      state.currentRound--;
      await this.markRecoverable(
        cultivatorId,
        state,
        error instanceof Error ? error.message : '下一轮生成失败',
        ['retry', 'safe_retreat', 'force_quit'],
      );
      throw error;
    }

    // LLM 成功后再扣资源，避免“生成失败但资源已扣除”
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
    this.applyConditionCosts(state, runtimeCultivator, actionCosts);
    this.commitCostsToState(state, pendingAction);
    state.pendingAction = undefined;
    state.costPreview = undefined;

    // 记录过程战利品
    const gainedNames = roundData.acquired_items?.map(
      (i) => i.name || '未知物品',
    );
    state.currentRoundItems = roundData.acquired_items || [];
    if (roundData.acquired_items?.length) {
      if (!state.accumulatedRewards) state.accumulatedRewards = [];
      state.accumulatedRewards.push(...roundData.acquired_items);
    }

    // 4. 更新状态
    state.history.push({
      round: state.currentRound,
      scene: roundData.scene_description,
      gained_items: gainedNames,
    });
    state.currentOptions = roundData.interaction.options;
    state.dangerScore = roundData.status_update.internal_danger_score;
    state.status = 'EXPLORING';

    await this.saveState(cultivatorId, state);
    return { actionId, state, roundData, isFinished: false };
  }

  // --- Battle Integration ---

  /* Removed old generateEnemy in favor of enemyGenerator */

  private async createBattleSession(
    cultivatorId: string,
    dungeonStateKey: string,
    battleCost: DungeonOptionCost,
    playerInfo: PlayerInfo,
    dungeonState: DungeonState,
  ): Promise<BattleSession & { enemyObject: Cultivator }> {
    console.log('[createBattleSession]', battleCost);
    const battleId = randomUUID();

    // 获取地图节点的境界要求
    const mapNode = getMapNode(dungeonState.mapNodeId);
    if (!mapNode || !('realm_requirement' in mapNode)) {
      throw new Error('Invalid map node or missing realm_requirement');
    }
    const realmRequirement = (mapNode as { realm_requirement: string })
      .realm_requirement;
    const mapConfig = resolveDungeonMapConfig(mapNode);
    const metadata = battleCost.metadata;
    if (!metadata?.race || !metadata.realm_stage) {
      throw new Error('Battle cost metadata must include race and realm_stage');
    }

    const enemyDifficulty = scaleDungeonBattleDifficulty(
      battleCost.value,
      mapConfig,
    );

    const draft = enemyGenerator.buildDraft({
      realm: realmRequirement as import('@shared/types/constants').RealmType,
      realmStage: metadata.realm_stage,
      race: metadata.race,
      difficulty: enemyDifficulty,
      name: metadata.enemy_name,
      background: metadata.background,
      description: metadata.description,
      isBoss: mapConfig.allowBossLoadout && Boolean(metadata.is_boss),
    });
    const enemy = draft.cultivator;

    // 构建 BattleSession，传递状态快照和虚拟气血/法力损失百分比
    const session: BattleSession = {
      battleId,
      dungeonStateKey,
      cultivatorId,
      enemyData: {
        name: enemy.name,
        realm: enemy.realm,
        stage: enemy.realm_stage,
        level: `${enemy.realm} ${enemy.realm_stage}`,
        difficulty: enemyDifficulty,
      },
      battleInit: buildDungeonBattleInit(dungeonState),
    };

    // Save to Redis
    await redis.set(
      `dungeon:battle:${battleId}`,
      JSON.stringify({ session, enemyObject: enemy }),
      'EX',
      3600,
    );

    return {
      ...session,
      enemyObject: enemy,
    };
  }

  async handleBattleCallback(
    cultivatorId: string,
    battleResult: BattleRecord,
  ): Promise<{
    state?: DungeonState;
    roundData?: DungeonRound;
    isFinished: boolean;
    realGains?: ResourceOperation[];
    settlement?: DungeonSettlement;
  }> {
    const state = await this.getState(cultivatorId);
    if (!state) throw new Error('Dungeon state not found');

    const lastHistory = state.history[state.history.length - 1];

    // Update State
    state.status = 'EXPLORING';
    delete state.activeBattleId;

    // Construct Narrative
    const enemyName =
      battleResult.loser.name === state.playerInfo.name
        ? battleResult.winner.name
        : battleResult.loser.name;
    const isWin = battleResult.winner.name === state.playerInfo.name;
    const playerSnapshot = isWin
      ? battleResult.winnerSnapshot
      : battleResult.loserSnapshot;

    if (!playerSnapshot) {
      throw new Error('战斗终局缺少玩家状态快照');
    }

    const cultivatorBundle = await getCultivatorByIdUnsafe(cultivatorId);
    if (!cultivatorBundle?.cultivator) {
      throw new Error('未找到修真者数据');
    }

    const persistedBattleState = ConditionService.applyBattleOutcome(
      {
        ...cultivatorBundle.cultivator,
        condition: state.condition,
      },
      state.condition,
      playerSnapshot,
      'persistent_pve',
      !isWin,
    );
    state.condition = persistedBattleState;

    // 战斗失败处理：生成伤势状态
    if (!isWin) {
      const outcomeText = `你终究是不敵 ${enemyName}，在其重击下狼狈遁走，侮幸捡回一条命。但你已无力再战，只得退出副本。`;
      lastHistory.outcome = outcomeText;

      return this.settleDungeon(state, {
        endDisposition: 'retreated_after_battle',
      });
    }

    const outcomeText = `历经 ${battleResult.turns} 个回合的苦战，你成功击败了 ${enemyName}。虽然负了些伤，但总算化险为夷。`;
    lastHistory.outcome = outcomeText;

    // FIX: Instead of calling AI immediately, enter LOOTING state
    state.status = 'LOOTING';
    await this.saveState(cultivatorId, state);
    return { state, isFinished: false };
  }

  async probeBattleEnemy(cultivatorId: string, battleId: string) {
    const { enemyObject } = await this.getBattleContext(cultivatorId, battleId);
    return enemyObject;
  }

  async executeBattle(cultivatorId: string, battleId: string) {
    const { battleKey, enemyObject, session } = await this.getBattleContext(
      cultivatorId,
      battleId,
    );

    const cultivatorBundle = await getCultivatorByIdUnsafe(cultivatorId);
    if (!cultivatorBundle?.cultivator) {
      throw new Error('未找到修真者数据');
    }

    const battleResult = simulateBattleV5(
      cultivatorBundle.cultivator,
      enemyObject,
      session.battleInit,
    );

    try {
      const callbackData = await this.handleBattleCallback(
        cultivatorId,
        battleResult,
      );
      return {
        battleResult,
        ...callbackData,
      };
    } catch (error) {
      console.error('[DungeonService] 战斗回调失败，进入恢复路径:', error);
      const recovered = await this.recoverAfterBattleCallbackFailure(
        cultivatorId,
        battleResult,
        error instanceof Error ? error.message : undefined,
      );
      return {
        battleResult,
        ...recovered,
      };
    } finally {
      await redis.del(battleKey);
    }
  }

  async abandonBattle(cultivatorId: string, battleId: string) {
    const state = await this.getState(cultivatorId);
    if (!state || state.activeBattleId !== battleId) {
      throw new Error('当前没有匹配的遭遇战');
    }
    const battleKey = getDungeonBattleKey(battleId);

    delete state.activeBattleId;
    state.status = 'FINISHED';

    try {
      return await this.settleDungeon(state, {
        abandonedBattle: true,
        endDisposition: 'abandoned_before_battle',
      });
    } finally {
      await redis.del(battleKey);
    }
  }

  /**
   * 休整后继续探索 (触发 AI 生成下一轮)
   */
  async continueFromLooting(cultivatorId: string) {
    const state = await this.getState(cultivatorId);
    if (!state || state.status !== 'LOOTING')
      throw new Error('Dungeon state invalid or not in looting');

    state.status = 'EXPLORING';
    state.currentRound++;

    if (state.currentRound > state.maxRounds) {
      return this.settleDungeon(state);
    }

    let roundData: DungeonRound;
    try {
      roundData = this.normalizeRoundOptions(await this.callAI(state));
    } catch (error) {
      console.error('[DungeonService] 战后生成失败:', error);
      roundData = this.normalizeRoundOptions(
        this.buildFallbackRoundAfterBattle(state, '先前强敌'),
      );
    }

    const gainedNames = roundData.acquired_items?.map(
      (i) => i.name || '未知物品',
    );
    state.currentRoundItems = roundData.acquired_items || [];
    if (roundData.acquired_items?.length) {
      if (!state.accumulatedRewards) state.accumulatedRewards = [];
      state.accumulatedRewards.push(...roundData.acquired_items);
    }

    state.history.push({
      round: state.currentRound,
      scene: roundData.scene_description,
      gained_items: gainedNames,
    });
    state.currentOptions = roundData.interaction.options;
    state.dangerScore = roundData.status_update.internal_danger_score;

    await this.saveState(cultivatorId, state);
    return { state, roundData, isFinished: false };
  }

  /**
   * 战后见好就收
   */
  async escapeFromLooting(cultivatorId: string) {
    const state = await this.getState(cultivatorId);
    if (!state) throw new Error('Dungeon state not found');
    return this.settleDungeon(state, {
      abandonedBattle: true,
      endDisposition: 'retreated_after_battle',
    });
  }

  /**
   * 战斗回调失败时的强恢复路径（不依赖 LLM）
   * 目标：确保不会卡在 IN_BATTLE，且玩家可继续流程
   */
  async recoverAfterBattleCallbackFailure(
    cultivatorId: string,
    battleResult: BattleRecord,
    reason?: string,
  ): Promise<{
    state?: DungeonState;
    roundData?: DungeonRound;
    isFinished: boolean;
    settlement?: DungeonSettlement;
    realGains?: ResourceOperation[];
  }> {
    const state = await this.getState(cultivatorId);
    if (!state) {
      throw new Error('Dungeon state not found during recovery');
    }

    delete state.activeBattleId;

    const enemyName =
      battleResult.loser.name === state.playerInfo.name
        ? battleResult.winner.name
        : battleResult.loser.name;
    const isWin = battleResult.winner.name === state.playerInfo.name;
    const lastHistory = state.history[state.history.length - 1];

    if (!isWin) {
      const cultivatorBundle = await getCultivatorByIdUnsafe(cultivatorId);
      if (!cultivatorBundle?.cultivator) {
        throw new Error('未找到修真者数据');
      }
      const playerSnapshot =
        battleResult.winner.id === cultivatorId
          ? battleResult.winnerSnapshot
          : battleResult.loserSnapshot;
      if (playerSnapshot) {
        const persistedBattleState =
          ConditionService.applyBattleOutcome(
            {
              ...cultivatorBundle.cultivator,
              condition: state.condition,
            },
            state.condition,
            playerSnapshot,
            'persistent_pve',
            true,
          );
        state.condition = persistedBattleState;
      }

      if (lastHistory) {
        lastHistory.outcome = `你不敌 ${enemyName}，被迫退出秘境。${reason ? `（天机紊乱：${reason}）` : ''}`;
      }

      const fallbackSettlement: DungeonSettlement = {
        ending_narrative:
          '你在鏖战后力竭遁走，虽保住性命，却再无余力继续探查。',
        settlement: {
          reward_tier: 'D',
          reward_blueprints: [],
          performance_tags: ['鏖战失利', '仓皇遁走'],
        },
      };

      await this.archiveDungeon(state, fallbackSettlement, []);
      return {
        isFinished: true,
        settlement: fallbackSettlement,
        realGains: [],
      };
    }

    // 胜利但回调失败，强制进入 LOOTING 状态进行自我修复
    state.status = 'LOOTING';
    if (lastHistory) {
      lastHistory.outcome = `你击败了 ${enemyName}，但天机推演一时失序，需稳住心神。`;
    }
    await this.saveState(cultivatorId, state);
    return { state, isFinished: false };
  }

  /**
   * 战斗后兜底回合（用于 LLM 失败时避免副本卡死）
   */
  private buildFallbackRoundAfterBattle(
    state: DungeonState,
    enemyName: string,
  ): DungeonRound {
    const nextIsFinal = state.currentRound >= state.maxRounds;
    const danger = Math.min(100, Math.max(0, state.dangerScore + 5));

    return {
      scene_description: `你击退了${enemyName}，却因灵机紊乱一时难以推演天机。四周杀机暂缓，你得以短暂整顿气息，再作抉择。`,
      interaction: {
        options: [
          {
            id: 1,
            text: '就地调息，稳住道基后继续探查',
            risk_level: 'low',
            potential_cost: '进度放缓，但更稳妥',
            costs: [],
          },
          {
            id: 2,
            text: '强行追索残留气机，尝试抢先一步',
            risk_level: 'medium',
            potential_cost: '灵力额外消耗',
            costs: [
              {
                type: 'cultivation_exp',
                value: 20,
                desc: '强行推演天机导致修为损耗',
              },
            ],
          },
          {
            id: 3,
            text: nextIsFinal ? '见好就收，立即撤离结算' : '暂避锋芒，改道徐行',
            risk_level: 'low',
            potential_cost: '收获可能减少',
            costs: [],
          },
        ],
      },
      status_update: {
        is_final_round: nextIsFinal,
        internal_danger_score: danger,
      },
    };
  }

  /**
   * 结算副本：采用“AI评价 + 后端发放”模式
   */
  async settleDungeon(
    state: DungeonState,
    options?: {
      skipInjury?: boolean; // 跳过受伤逻辑
      abandonedBattle?: boolean; // 标记为主动放弃
      endDisposition?: DungeonSettlementLlmContext['endDisposition'];
      pendingAction?: DungeonPendingAction;
      runtimeCultivator?: Cultivator;
    },
  ): Promise<{
    state?: DungeonState;
    settlement: DungeonSettlement;
    isFinished: boolean;
    realGains: ResourceOperation[];
  }> {
    // --- 核心优化：使用 RewardFactory 将 AI 蓝图转化为真实奖励 ---
    // 获取地图境界门槛
    const mapNode = getMapNode(state.mapNodeId);
    const mapRealm =
      mapNode && 'realm_requirement' in mapNode
        ? (mapNode as SatelliteNode).realm_requirement
        : ('筑基' as RealmType);

    const endDisposition =
      options?.endDisposition ??
      (options?.abandonedBattle ? 'abandoned_before_battle' : 'completed');
    const settlementContext = buildDungeonSettlementLlmContext({
      state,
      mapRealm,
      endDisposition,
    });
    const { system: settlementPrompt, user: settlementUserPrompt } =
      renderPrompt('dungeon-settlement', {
        materialTypeTable: DUNGEON_MATERIAL_TYPE_TABLE,
        settlementContextJson: stableCompactStringify(settlementContext),
      });

    const aiRes = await object(settlementPrompt, settlementUserPrompt, {
      schema: DungeonSettlementSchema,
      llmSchema: DungeonSettlementLlmSchema,
      schemaName: 'DungeonSettlement',
      sceneId: 'dungeon-settlement',
    });

    const settlement = aiRes.object;

    if (options?.pendingAction) {
      const userId = await getCultivatorOwnerId(state.cultivatorId);
      if (!userId) {
        throw new Error('无法获取修真者所属用户');
      }
      const result = await resourceEngine.consume(
        userId,
        state.cultivatorId,
        options.pendingAction.costs as ResourceOperation[],
      );
      if (!result.success) {
        state.status = 'EXPLORING';
        state.pendingAction = {
          ...options.pendingAction,
          status: 'failed',
          error: result.errors?.join('; ') || '资源消耗失败',
        };
        state.costPreview = undefined;
        await this.saveState(state.cultivatorId, state);
        throw new Error(result.errors?.join('; ') || '资源消耗失败');
      }
      if (options.runtimeCultivator) {
        this.applyConditionCosts(
          state,
          options.runtimeCultivator,
          options.pendingAction.costs,
        );
      }
      this.commitCostsToState(state, options.pendingAction);
      state.pendingAction = undefined;
      state.costPreview = undefined;
    }

    const realGains = RewardFactory.generateAllRewards(
      settlement.settlement.reward_blueprints as RewardBlueprint[],
      mapRealm,
      settlement.settlement.reward_tier,
      state.dangerScore, // 传递危险分数用于奖励计算
      state.playerInfo, // 传递玩家信息用于修为计算
    );

    // 获取 userId
    const userId = await getCultivatorOwnerId(state.cultivatorId);
    if (!userId) {
      throw new Error('无法获取修真者所属用户');
    }

    // DungeonResourceGain 与 ResourceOperation 结构兼容
    // desc 字段在 ResourceEngine 中会被忽略
    const result = await resourceEngine.gain(
      userId,
      state.cultivatorId,
      realGains as ResourceOperation[],
    );

    if (!result.success) {
      console.error('[DungeonSettlement] 资源获得失败:', result.errors);
    }

    // 清理并存档 (逻辑同你之前)
    state.gainLedger ??= [];
    state.gainLedger.push({
      source: 'settlement',
      gains: realGains,
      committedAt: new Date().toISOString(),
    });
    await this.archiveDungeon(state, settlement, realGains);
    if (!options?.abandonedBattle) {
      try {
        await TaskService.recordDungeonCompletion(
          state.cultivatorId,
          state.mapNodeId,
        );
        await TaskService.recordTaskEvent(
          state.cultivatorId,
          'dungeon_completed',
        );
      } catch (taskError) {
        console.error('[DungeonSettlement] 同步任务进度失败:', taskError);
      }
    }

    return { isFinished: true, settlement, realGains };
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

    const aiRes = await object(
      this.getSystemPrompt(),
      stableCompactStringify(userContext),
      {
        schema: DungeonRoundSchema,
        llmSchema: DungeonRoundLlmSchema,
        schemaName: 'DungeonRound',
        sceneId: 'dungeon-round',
      },
    );

    return aiRes.object;
  }

  async saveState(
    cultivatorId: string,
    state: DungeonState,
    battlePayload?: DungeonBattleCachePayload,
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

    if (state.runId) {
      await getExecutor()
        .update(dungeonRuns)
        .set(values)
        .where(eq(dungeonRuns.id, state.runId));
    } else {
      const inserted = await getExecutor()
        .insert(dungeonRuns)
        .values(values)
        .returning({ id: dungeonRuns.id });
      state.runId = inserted[0]?.id;
      if (state.runId) {
        await getExecutor()
          .update(dungeonRuns)
          .set({ runState: state })
          .where(eq(dungeonRuns.id, state.runId));
      }
    }

    await redis.set(
      getDungeonKey(cultivatorId),
      JSON.stringify(state),
      'EX',
      REDIS_TTL,
    );
  }

  async getState(cultivatorId: string) {
    const key = getDungeonKey(cultivatorId);
    const run = await this.loadActiveRun(cultivatorId);
    let state: DungeonState | null = null;
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
      await redis.set(key, JSON.stringify(state), 'EX', REDIS_TTL);
    } else {
      state = parseRedisJson<DungeonState>(await redis.get(key), key);
    }
    if (!state) return null;
    if (!state.condition) {
      const cultivatorBundle = await getCultivatorByIdUnsafe(cultivatorId);
      if (cultivatorBundle?.cultivator) {
        const hydrated = ConditionService.tickNaturalRecovery(
          cultivatorBundle.cultivator,
          cultivatorBundle.cultivator.condition,
        );
        state.condition = hydrated;
      }
    }
    return this.normalizeState(state);
  }

  async prepareDungeonContext(cultivatorId: string, mapNodeId: string) {
    const player = await this.getPlayer(cultivatorId);
    const mapNode = this.getMapNode(mapNodeId);
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
    const cultivatorBundle = await getCultivatorByIdUnsafe(cultivatorId);
    if (!cultivatorBundle || !cultivatorBundle.cultivator)
      throw new Error('未找到名为该道友的记录');
    const cultivator = cultivatorBundle.cultivator;
    const { finalAttributes, attrs } =
      getCultivatorDisplayAttributes(cultivator);
    return {
      id: cultivator.id,
      name: cultivator.name,
      realm: `${cultivator.realm} ${cultivator.realm_stage}`,
      gender: cultivator.gender,
      age: cultivator.age,
      lifespan: cultivator.lifespan,
      personality: cultivator.personality || '普通',
      attributes: { ...finalAttributes },
      resourceCaps: {
        maxHp: attrs.maxHp,
        maxMp: attrs.maxMp,
      },
      spiritual_roots: cultivator.spiritual_roots.map(
        (root) => `${root.element}(${root.grade})`,
      ),
      fates: cultivator.pre_heaven_fates.map(
        (fate) => `${fate.name}(${fate.description})`,
      ),
      skills: cultivator.cultivations.map((skill) => skill.name),
      spirit_stones: cultivator.spirit_stones,
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
  ) {
    state.status = 'FINISHED';
    state.isFinished = true;
    state.settlement = settlement;
    state.realGains = realGains;
    state.pendingAction = undefined;
    state.costPreview = undefined;
    state.recoverableActions = undefined;
    state.activeBattleId = undefined;

    await updateCultivator(state.cultivatorId, {
      condition: state.condition,
    });

    // Archive to DB
    await getExecutor()
      .insert(dungeonHistories)
      .values({
        cultivatorId: state.cultivatorId,
        theme: state.theme,
        result: settlement,
        log: state.history
          .map((h) => `[Round ${h.round}] ${h.scene} -> Choice: ${h.choice}`)
          .join('\n'),
        realGains: realGains ?? null,
      });

    if (state.runId) {
      await getExecutor()
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

    // Clear Redis
    await redis.del(getDungeonKey(state.cultivatorId));
  }

  /**
   * Abandon the current dungeon
   */
  async recoverDungeon(cultivatorId: string, action: DungeonRecoverAction) {
    const state = await this.getState(cultivatorId);
    if (!state) {
      throw new Error('副本已失效');
    }

    if (action === 'force_quit') {
      return this.quitDungeon(cultivatorId);
    }

    if (action === 'safe_retreat') {
      delete state.activeBattleId;
      state.status = 'SETTLING';
      state.statusReason = '已选择安全撤退';
      state.recoverableActions = undefined;
      return this.settleDungeon(state, {
        abandonedBattle: true,
        endDisposition: 'retreated_after_battle',
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
        await this.saveState(cultivatorId, state);
        return { state, isFinished: false };
      }

      state.status = 'EXPLORING';
      state.statusReason = undefined;
      state.recoverableActions = undefined;
      state.pendingAction = undefined;
      state.costPreview = undefined;
      await this.saveState(cultivatorId, state);
      return this.handleAction(cultivatorId, pending.choiceId, pending.actionId);
    }

    throw new Error('未知的副本恢复动作');
  }

  async quitDungeon(cultivatorId: string) {
    const key = getDungeonKey(cultivatorId);

    const state = await this.getState(cultivatorId);
    if (state) {
      state.status = 'FINISHED';
      state.isFinished = true;
      state.pendingAction = undefined;
      state.costPreview = undefined;
      state.recoverableActions = undefined;
      state.activeBattleId = undefined;
      await updateCultivator(cultivatorId, {
        condition: state.condition,
      });
      await getExecutor()
        .insert(dungeonHistories)
        .values({
          cultivatorId: state.cultivatorId,
          theme: state.theme,
          result: {
            settlement: {
              reward_tier: '放弃',
              ending_narrative: '道友中途放弃了探索。',
            },
          },
          log:
            state.history
              .map(
                (h) => `[Round ${h.round}] ${h.scene} -> Choice: ${h.choice}`,
              )
              .join('\n') + '\n[ABANDONED]',
        });
      if (state.runId) {
        await getExecutor()
          .update(dungeonRuns)
          .set({
            status: 'FINISHED',
            runState: this.normalizeState(state),
            pendingAction: null,
            activeBattleId: null,
            battlePayload: null,
            endedAt: new Date(),
          })
          .where(eq(dungeonRuns.id, state.runId));
      }
    }

    await redis.del(key);
    return { success: true };
  }
}

export const dungeonService = new DungeonService();
