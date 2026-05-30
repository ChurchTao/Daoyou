import { renderPrompt } from '@server/lib/prompts';
import { simulateBattleV5 } from '@server/lib/services/simulateBattleV5';
import type { BattleRecord } from '@server/lib/services/battleResult';
import { object } from '@server/utils/aiClient'; // AI client helper
import { getCultivatorDisplayAttributes } from '@shared/engine/battle-v5/adapters/CultivatorDisplayAdapter';
import { enemyGenerator } from '@shared/engine/enemyGenerator';
import { TYPE_DESCRIPTIONS } from '@shared/engine/material/creation/config';
import { resourceEngine } from '@shared/engine/resource/ResourceEngine';
import type { ResourceOperation } from '@shared/engine/resource/types';
import { getMapNode, SatelliteNode } from '@shared/lib/game/mapSystem';
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
import { dungeonHistories } from '../drizzle/schema';
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
const DUNGEON_ENEMY_DIFFICULTY_COEFFICIENT = 0.6;
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

function scaleDungeonEnemyDifficulty(rawDifficulty: number) {
  return Math.max(
    0,
    Math.min(100, Math.round(rawDifficulty * DUNGEON_ENEMY_DIFFICULTY_COEFFICIENT)),
  );
}

interface DungeonBattleCachePayload {
  session: BattleSession;
  enemyObject: Cultivator;
}

export class DungeonService {
  private async getBattleContext(cultivatorId: string, battleId: string) {
    const state = await this.getState(cultivatorId);
    if (!state || state.activeBattleId !== battleId) {
      throw new Error('当前没有匹配的遭遇战');
    }

    const battleKey = getDungeonBattleKey(battleId);
    const battlePayload = parseRedisJson<DungeonBattleCachePayload>(
      await redis.get(battleKey),
      battleKey,
    );

    if (!battlePayload?.session || !battlePayload.enemyObject) {
      throw new Error('遭遇战数据不存在或已失效');
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

      const existingSession = await redis.get(activeKey);
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
        accumulatedRewards: [],
        status: 'EXPLORING',
        condition: hydratedCondition,
        accumulatedHpLoss: 0, // 累积气血损失百分比 (0-1)
        accumulatedMpLoss: 0, // 累积法力损失百分比 (0-1)
      };

      // 4. 首次 AI 调用
      const roundData = await this.callAI(state);

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
  async handleAction(cultivatorId: string, choiceId: number) {
    const state = await this.getState(cultivatorId);
    if (!state) throw new Error('副本已失效');
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

    let actionCosts = chosenOption.costs ?? [];

    const consumeActionCostsOrThrow = async () => {
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

      // DungeonOptionCost 与 ResourceOperation 结构兼容
      // desc 字段在 ResourceEngine 中会被忽略
      const result = await resourceEngine.consume(
        userId,
        cultivatorId,
        actionCosts as ResourceOperation[],
      );

      if (!result.success) {
        throw new Error(result.errors?.join('; ') || '资源消耗失败');
      }
    };

    if (chosenOption?.costs) {
      // 防御性编程：如果 AI 违规生成了 battle + hp_loss/mp_loss 组合，过滤掉冲突项
      const hasBattle = chosenOption.costs.some((c) => c.type === 'battle');
      if (hasBattle) {
        chosenOption.costs = chosenOption.costs.filter(
          (c) => c.type !== 'hp_loss' && c.type !== 'mp_loss',
        );
        actionCosts = chosenOption.costs;
      }

      state.summary_of_sacrifice?.push(...chosenOption.costs);

      // 1.1 累加气血/法力损失百分比
      for (const cost of chosenOption.costs) {
        if (cost.type === 'hp_loss') {
          const next = ConditionService.applyExternalResourceLoss(
            runtimeCultivator,
            state.condition,
            {
              hpPercent: cost.value,
            },
          );
          state.condition = next;
        } else if (cost.type === 'mp_loss') {
          const next = ConditionService.applyExternalResourceLoss(
            runtimeCultivator,
            state.condition,
            {
              mpPercent: cost.value,
            },
          );
          state.condition = next;
        } else if (cost.type === 'weak') {
          state.condition = ConditionService.addOrStackStatus(
            state.condition,
            'weakness',
            cost.value,
            'event',
          );
        }
      }

      // 1.3 Battle Interception (FIX: Prevent immediate AI call before battle)
      const battleCost = chosenOption.costs.find((c) => c.type === 'battle');
      if (battleCost) {
        // 战斗分支没有 LLM 步骤，先扣除真实资源再进入战斗
        await consumeActionCostsOrThrow();

        state.history[state.history.length - 1].choice = chosenOption.text;
        state.status = 'WAITING_BATTLE'; // Use intermediary state

        const session = await this.createBattleSession(
          cultivatorId,
          getDungeonKey(cultivatorId),
          battleCost,
          state.playerInfo,
          state,
        );

        state.activeBattleId = session.battleId;
        await this.saveState(cultivatorId, state);

        return {
          state,
          type: 'TRIGGER_BATTLE',
          battleId: session.battleId,
          isFinished: false,
        };
      }
    }

    // 2. 推进状态
    state.history[state.history.length - 1].choice = chosenOption?.text;
    state.history[state.history.length - 1].outcome =
      chosenOption?.potential_cost;

    if (state.currentRound >= state.maxRounds) {
      // 最后一轮直接结算，不走 LLM；此处仍需先扣资源
      await consumeActionCostsOrThrow();
      return this.settleDungeon(state);
    }

    state.currentRound++;

    // 3. AI 生成下一轮
    const roundData = await this.callAI(state);

    // LLM 成功后再扣资源，避免“生成失败但资源已扣除”
    await consumeActionCostsOrThrow();

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

    await this.saveState(cultivatorId, state);
    return { state, roundData, isFinished: false };
  }

  // --- Battle Integration ---

  /* Removed old generateEnemy in favor of enemyGenerator */

  private async createBattleSession(
    cultivatorId: string,
    dungeonStateKey: string,
    battleCost: DungeonOptionCost,
    playerInfo: PlayerInfo,
    dungeonState: DungeonState,
  ): Promise<BattleSession> {
    console.log('[createBattleSession]', battleCost);
    const battleId = randomUUID();

    // 获取地图节点的境界要求
    const mapNode = getMapNode(dungeonState.mapNodeId);
    if (!mapNode || !('realm_requirement' in mapNode)) {
      throw new Error('Invalid map node or missing realm_requirement');
    }
    const realmRequirement = (mapNode as { realm_requirement: string })
      .realm_requirement;
    const metadata = battleCost.metadata;
    if (!metadata?.race || !metadata.realm_stage) {
      throw new Error('Battle cost metadata must include race and realm_stage');
    }

    const enemyDifficulty = scaleDungeonEnemyDifficulty(battleCost.value);

    const draft = enemyGenerator.buildDraft({
      realm: realmRequirement as import('@shared/types/constants').RealmType,
      realmStage: metadata.realm_stage,
      race: metadata.race,
      difficulty: enemyDifficulty,
      name: metadata.enemy_name,
      background: metadata.background,
      description: metadata.description,
      isBoss: metadata.is_boss,
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

    return session;
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
    const { battleKey, state } = await this.getBattleContext(
      cultivatorId,
      battleId,
    );

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
      roundData = await this.callAI(state);
    } catch (error) {
      console.error('[DungeonService] 战后生成失败:', error);
      roundData = this.buildFallbackRoundAfterBattle(state, '先前强敌');
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
    const realmGap = this.calculateRealmGap(state.playerInfo.realm, mapRealm);
    const phase = this.getPhase(state.currentRound, state.maxRounds, realmGap);
    const userContext: DungeonRoundLlmContext = buildDungeonRoundLlmContext({
      state,
      mapRealm,
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

  async saveState(cultivatorId: string, state: DungeonState) {
    await redis.set(
      getDungeonKey(cultivatorId),
      JSON.stringify(state),
      'EX',
      REDIS_TTL,
    );
  }

  async getState(cultivatorId: string) {
    const key = getDungeonKey(cultivatorId);
    const state = parseRedisJson<DungeonState>(await redis.get(key), key);
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
    return state;
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

    // Clear Redis
    await redis.del(getDungeonKey(state.cultivatorId));
  }

  /**
   * Abandon the current dungeon
   */
  async quitDungeon(cultivatorId: string) {
    const key = getDungeonKey(cultivatorId);

    const state = parseRedisJson<DungeonState>(await redis.get(key), key);
    if (state) {
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
    }

    await redis.del(key);
    return { success: true };
  }
}

export const dungeonService = new DungeonService();
