import { BattleEngineResult } from '@/engine/battle';
import type { BuffInstanceState } from '@/engine/buff/types';
import { CultivatorUnit } from '@/engine/cultivator';
import { enemyGenerator } from '@/engine/enemyGenerator';
import { TYPE_DESCRIPTIONS } from '@/engine/material/creation/config';
import { resourceEngine } from '@/engine/resource/ResourceEngine';
import type { ResourceOperation } from '@/engine/resource/types';
import {
  MaterialType,
  Quality,
  QUALITY_VALUES,
  REALM_VALUES,
  RealmType,
} from '@/types/constants';
import { object } from '@/utils/aiClient'; // AI client helper
import { randomUUID } from 'crypto';
import { getExecutor } from '../drizzle/db';
import { dungeonHistories } from '../drizzle/schema';
import { getMapNode, SatelliteNode } from '../game/mapSystem';
import { redis } from '../redis';
import {
  getCultivatorByIdUnsafe,
  getCultivatorOwnerId,
  getPaginatedInventoryByType,
} from '../services/cultivatorService';
import { checkDungeonLimit, consumeDungeonLimit } from './dungeonLimiter';
import type { RewardBlueprint } from './reward';
import { RewardFactory } from './reward';
import {
  BattleSession,
  DungeonOptionCost,
  DungeonRound,
  DungeonRoundSchema,
  DungeonSettlement,
  DungeonSettlementSchema,
  DungeonState,
  PlayerInfo,
} from './types';

const REDIS_TTL = 3600; // 1 hour expiration for active sessions
const START_LOCK_TTL_SECONDS = 180;

// Helper to generate Redis key
function getDungeonKey(cultivatorId: string) {
  return `dungeon:active:${cultivatorId}`;
}

function getDungeonStartLockKey(cultivatorId: string) {
  return `dungeon:starting:${cultivatorId}`;
}

export class DungeonService {
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

  /**
   * 根据境界差距生成叙事指导
   */
  private getRealmGuidance(realmGap: number): string {
    if (realmGap >= 2) {
      return `
> [!IMPORTANT] 境界碾压场景
> 玩家境界远超此地图要求（差距${realmGap}个大境界）。叙事应体现**轻松应对、游刃有余**的状态：
> - 剧情避免使用"险象环生"、"巨大代价"、"死里逃生"等词汇
> - 风险选项的危险程度应大幅降低
> - 代价（costs）应极少或轻微（如少量灵力消耗）
> - 战斗难度系数（battle.value）不应超过3
> - 整体危险分（danger_score）应保持在30以下
`;
    } else if (realmGap === 1) {
      return `
> 境界优势场景：玩家境界略高于地图要求。应体现**有一定优势但不至于碾压**的状态。风险和代价适中偏低。
`;
    } else if (realmGap === 0) {
      return `
> 实力相当场景：玩家与地图境界匹配。应体现**正常挑战难度**，风险和代价中等。
`;
    } else {
      return `
> 挑战场景：玩家境界低于地图要求。应体现**高风险高挑战**，但仍有机会通过谨慎操作成功。
`;
    }
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
        return '**【Phase 1: 探索期】**: 凭借境界优势，轻松探查环境。选项应偏向顺利推进。';
      if (currentRound < maxRounds - 1)
        return '**【Phase 2: 收获期】**: 以实力碾压，顺利获取资源。轻微消耗即可。';
      if (currentRound === maxRounds - 1)
        return '**【Phase 3: 收尾期】**: 轻松解决最后的阻碍。风险和代价极低。';
      return '**【Phase 4: 圆满期】**: 毫无悬念地完成探索，满载而归。';
    }

    // 正常场景
    if (currentRound === 1)
      return '**【Phase 1: 潜入期】(Round 1)**: 侧重环境描写。发现阵法、禁制或古修遗迹入口。选项应偏向探测与尝试。';
    if (currentRound < maxRounds - 1)
      return '**【Phase 2: 变局期】(Round 2-3)**: 引入转折。遭遇残存傀儡、禁制反弹、或发现同道斗法留下的血迹。开始消耗资源。';
    if (currentRound === maxRounds - 1)
      return '**【Phase 3: 夺宝/死战期】(Round 4)**: 副本高潮。面对核心守护者或最强禁制。选项必须包含极高风险或巨量消耗';
    return '**【Phase 4: 结尾期】(Round 5)**: 禁制崩塌或取宝后的逃亡。评估玩家之前的行为，决定最终的狼狈程度或圆满程度';
  }

  // 统一的 System Prompt 生成器
  private getSystemPrompt(state: DungeonState): string {
    // 获取地图境界要求
    const mapNode = getMapNode(state.mapNodeId);
    const mapRealm =
      mapNode && 'realm_requirement' in mapNode
        ? (mapNode as SatelliteNode).realm_requirement
        : ('筑基' as RealmType); // 默认筑基

    // 计算境界差距
    const realmGap = this.calculateRealmGap(state.playerInfo.realm, mapRealm);
    const realmGuidance = this.getRealmGuidance(realmGap);
    const phaseDesc = this.getPhase(
      state.currentRound,
      state.maxRounds,
      realmGap,
    );

    // 动态生成材料类型描述表格（从 config.ts 统一获取）
    const materialTypeTable = Object.entries(TYPE_DESCRIPTIONS)
      .filter(([key]) => key !== 'manual')
      .map(([key, desc]) => `| ${key} | ${desc} |`)
      .join('\n');

    return `
# Role: 《凡人修仙传》副本演化天道 (Dungeon Engine)

${realmGuidance}

## 当前相位: ${phaseDesc}
你现在负责驱动一个${state.maxRounds}轮次的修仙副本。当前为第${state.currentRound}轮。

## 1. 核心叙事相位逻辑
你必须根据 currentRound 严格切换叙事逻辑，并结合上述境界差距指导调整难度。

## 2. 凡人流叙事准则
- **文风**：简练、冰冷、充满古意。
- **因果律**：参考历史，确保逻辑自洽。若前轮损坏法宝，本轮应体现。

## 3. 奖励类型规范 (acquired_items)
在生成奖励时，你必须根据物品性质严格分类，**严禁**将所有珍贵物品都归类为 \`tcdb\`：
${materialTypeTable}

**分类准则：**
- **功法/秘籍** (如：玉简、残卷、古书、拓片)：必须使用 \`gongfa_manual\` 类型。
- **神通/法术** (如：秘术咒语、斗法心得)：必须使用 \`skill_manual\` 类型。
- **天材地宝** (如：万年石乳、九曲灵参、天地奇珍)：必须使用 \`tcdb\` 类型。
- **普通资源** (如：灵草、矿石、妖兽肢体)：根据性质选择 \`herb\`, \`ore\`, \`monster\`。

## 4. 强制选项模板 (必须生成3个对象组成的数组)
- **选项 1 (求稳)**：低风险。
- **选项 2 (弄险)**：高风险。
- **选项 3 (变数)**：依赖玩家资源或环境随机。

## 5. 输出约束 (核心：严禁 Markdown)
你必须直接输出原始 JSON 字符串。
- **严禁** 使用 \`\`\`json 等 Markdown 代码块包裹。
- **严禁** 输出任何解释文字或前言后语。
- **必须** 确保输出是一个单一的、合法的 JSON 对象。

### 结构规范与字段要求：
- **scene_description**: 字符串。
- **status_update**: 对象。
  - **internal_danger_score**: 0-100 整数。
  - **is_final_round**: 布尔值。若当前轮次(${state.currentRound}) == ${state.maxRounds}，则为 true。
- **interaction**: 对象。
  - **options**: 数组，固定包含3个对象，每个对象必须包含 [id, text, risk_level, costs] 字段。
- **acquired_items**: 可选数组，元素为奖励对象。**奖励应在玩家获得阶段发放（如击败敌人后或探索成功后进入的新场景中）。**

### 完整示例 (直接输出此类结构的原始 JSON):
{
  "scene_description": "描述文本...",
  "status_update": {
    "internal_danger_score": 30,
    "is_final_round": false
  },
  "interaction": {
    "options": [
      { "id": 1, "text": "...", "risk_level": "low", "costs": [] },
      { "id": 2, "text": "...", "risk_level": "medium", "costs": [{ "type": "hp_loss", "value": 0.2, "desc": "气血受损" }] },
      { "id": 3, "text": "...", "risk_level": "high", "costs": [{ "type": "material", "required_type": "herb", "required_quality": "灵品", "value": 1, "desc": "消耗灵草破阵" }] }
    ]
  },
  "acquired_items": []
}

### 成本(costs)规范:
- **必须使用指定类型**: spirit_stones, lifespan, cultivation_exp, comprehension_insight, material, hp_loss, mp_loss, weak, battle, artifact_damage。
- **数值范围**: hp_loss, mp_loss 必须是 0-1 之间的小数；其他类型为正整数。
- **材料(material)**: 禁止指定 name，必须提供 required_type 和 required_quality。
- **冲突禁止**: 若有 'battle'，严禁同时出现 'hp_loss' 或 'mp_loss'。

## 6. 当前上下文摘要
- 地点：${state.location.location}
- 地图境界要求：${mapRealm}
- 玩家境界：${state.playerInfo.realm}
- 境界差距：${realmGap > 0 ? `玩家高出${realmGap}个大境界` : realmGap < 0 ? `玩家低${Math.abs(realmGap)}个大境界` : '实力相当'}
- 历史参考：${JSON.stringify(state.history.slice(-2))}
`;
  }

  /**
   * 初始化副本
   */
  async startDungeon(cultivatorId: string, mapNodeId: string) {
    const activeKey = getDungeonKey(cultivatorId);
    const startLockKey = getDungeonStartLockKey(cultivatorId);

    // 防并发：避免重复点击导致并行启动时重复扣次数
    const lockAcquired = await redis.set(startLockKey, '1', {
      nx: true,
      ex: START_LOCK_TTL_SECONDS,
    });
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

      // 从数据库加载持久状态（转换为 BuffInstanceState 格式）
      const rawStatuses = Array.isArray(
        cultivator.cultivator.persistent_statuses,
      )
        ? cultivator.cultivator.persistent_statuses
        : [];
      const persistentBuffs: BuffInstanceState[] = rawStatuses.map(
        (s: {
          statusKey?: string;
          configId?: string;
          potency?: number;
          currentStacks?: number;
          createdAt?: number;
        }) => ({
          instanceId: '',
          configId: s.statusKey || s.configId || '',
          currentStacks: s.potency || s.currentStacks || 1,
          remainingTurns: -1,
          createdAt: s.createdAt || Date.now(),
        }),
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
        persistentBuffs,
        accumulatedHpLoss: 0, // 累积HP损失百分比 (0-1)
        accumulatedMpLoss: 0, // 累积MP损失百分比 (0-1)
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

      // 1.1 累加 HP/MP 损失百分比
      for (const cost of chosenOption.costs) {
        if (cost.type === 'hp_loss') {
          // 直接累加百分比小数
          state.accumulatedHpLoss = Math.min(
            1,
            state.accumulatedHpLoss + cost.value,
          );
        } else if (cost.type === 'mp_loss') {
          // 直接累加百分比小数
          state.accumulatedMpLoss = Math.min(
            1,
            state.accumulatedMpLoss + cost.value,
          );
        } else if (cost.type === 'weak') {
          // 1.2 weak 成本映射为 weakness 状态
          const weaknessPotency = cost.value;
          const existingWeakness = state.persistentBuffs.find(
            (b) => b.configId === 'weakness',
          );
          if (existingWeakness) {
            existingWeakness.currentStacks = Math.min(
              10,
              existingWeakness.currentStacks + weaknessPotency,
            );
          } else {
            state.persistentBuffs.push({
              instanceId: '',
              configId: 'weakness',
              currentStacks: weaknessPotency,
              remainingTurns: -1,
              createdAt: Date.now(),
            });
          }
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

    // 生成敌人（传入境界门槛）
    const enemy = await enemyGenerator.generate(
      battleCost.metadata || {
        enemy_name: battleCost.desc,
        is_boss: false,
      },
      battleCost.value,
      realmRequirement as import('@/types/constants').RealmType,
    );

    // 构建 BattleSession，传递状态快照和虚拟 HP/MP 损失百分比
    const session: BattleSession = {
      battleId,
      dungeonStateKey,
      cultivatorId,
      enemyData: {
        name: enemy.name,
        realm: enemy.realm,
        stage: enemy.realm_stage,
        level: `${enemy.realm} ${enemy.realm_stage}`,
        difficulty: battleCost.value,
      },
      playerSnapshot: {
        persistentBuffs: dungeonState.persistentBuffs,
        hpLossPercent: dungeonState.accumulatedHpLoss,
        mpLossPercent: dungeonState.accumulatedMpLoss,
      },
    };

    // Save to Redis
    await redis.set(
      `dungeon:battle:${battleId}`,
      JSON.stringify({ session, enemyObject: enemy }),
      { ex: 3600 },
    );

    return session;
  }

  async handleBattleCallback(
    cultivatorId: string,
    battleResult: BattleEngineResult,
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

    // 战斗失败处理：生成伤势状态
    if (!isWin) {
      // 根据当前伤势状态升级：minor_wound → major_wound → near_death
      const hasMinorWound = state.persistentBuffs.find(
        (b) => b.configId === 'minor_wound',
      );
      const hasMajorWound = state.persistentBuffs.find(
        (b) => b.configId === 'major_wound',
      );
      const hasNearDeath = state.persistentBuffs.find(
        (b) => b.configId === 'near_death',
      );

      if (hasNearDeath) {
        hasNearDeath.currentStacks = Math.min(
          10,
          hasNearDeath.currentStacks + 1,
        );
      } else if (hasMajorWound) {
        state.persistentBuffs = state.persistentBuffs.filter(
          (b) => b.configId !== 'major_wound',
        );
        state.persistentBuffs.push({
          instanceId: '',
          configId: 'near_death',
          currentStacks: 1,
          remainingTurns: -1,
          createdAt: Date.now(),
        });
      } else if (hasMinorWound) {
        state.persistentBuffs = state.persistentBuffs.filter(
          (b) => b.configId !== 'minor_wound',
        );
        state.persistentBuffs.push({
          instanceId: '',
          configId: 'major_wound',
          currentStacks: 1,
          remainingTurns: -1,
          createdAt: Date.now(),
        });
      } else {
        state.persistentBuffs.push({
          instanceId: '',
          configId: 'minor_wound',
          currentStacks: 1,
          remainingTurns: -1,
          createdAt: Date.now(),
        });
      }

      const outcomeText = `你终究是不敵 ${enemyName}，在其重击下狼狈遁走，侮幸捡回一条命。但你已无力再战，只得退出副本。`;
      lastHistory.outcome = outcomeText;

      return this.settleDungeon(state);
    }

    const outcomeText = `历经 ${battleResult.turns} 个回合的苦战，你成功击败了 ${enemyName}。虽然负了些伤，但总算化险为夷。`;
    lastHistory.outcome = outcomeText;

    // 从战斗结果中同步持久状态
    if (battleResult.playerPersistentBuffs) {
      state.persistentBuffs = battleResult.playerPersistentBuffs;
    }

    // FIX: Instead of calling AI immediately, enter LOOTING state
    state.status = 'LOOTING';
    await this.saveState(cultivatorId, state);
    return { state, isFinished: false };
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
    return this.settleDungeon(state, { abandonedBattle: true });
  }

  /**
   * 战斗回调失败时的强恢复路径（不依赖 LLM）
   * 目标：确保不会卡在 IN_BATTLE，且玩家可继续流程
   */
  async recoverAfterBattleCallbackFailure(
    cultivatorId: string,
    battleResult: BattleEngineResult,
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
    },
  ): Promise<{
    state?: DungeonState;
    settlement: DungeonSettlement;
    isFinished: boolean;
    realGains: ResourceOperation[];
  }> {
    // 动态生成材料类型描述表格（从 config.ts 统一获取）
    const materialTypeTable = Object.entries(TYPE_DESCRIPTIONS)
      .filter(([key]) => key !== 'manual')
      .map(([key, desc]) => `| ${key} | ${desc} |`)
      .join('\n');

    // --- 核心优化：使用 RewardFactory 将 AI 蓝图转化为真实奖励 ---
    // 获取地图境界门槛
    const mapNode = getMapNode(state.mapNodeId);
    const mapRealm =
      mapNode && 'realm_requirement' in mapNode
        ? (mapNode as SatelliteNode).realm_requirement
        : ('筑基' as RealmType);

    const settlementPrompt = `
# Role: 《凡人修仙传》天道平衡者 - 结算与奖励鉴定

## 核心职责
根据道友的付出、历程与最终危险分给出评价，并设计材料奖励。
${options?.abandonedBattle ? '\n> [!CAUTION] 玩家在战斗前主动放弃撤退，评价应为D级，奖励极少。' : ''}

## ⚠️ 奖励生成规则
- **因果律**：材料必须与剧情强关联。
- **强制继承**：玩家在副本过程中已获物品（已获蓝图）**必须全部包含**在 \`reward_blueprints\` 中！
- **珍稀度**：使用 \`reward_score\` (0-100) 衡量在当前境界下的珍稀度。

## 材料类型 (Material Type)
${materialTypeTable}

**分类准则：**
- **功法/秘籍** (如：玉简、残卷、古书、拓片)：必须使用 \`gongfa_manual\` 类型。
- **神通/法术** (如：秘术咒语、斗法心得)：必须使用 \`skill_manual\` 类型。
- **天材地宝** (如：万年石乳、九曲灵参、天地奇珍)：必须使用 \`tcdb\` 类型。
- **普通资源** (如：灵草、矿石、妖兽肢体)：根据性质选择 \`herb\`, \`ore\`, \`monster\`。

## 评价等级 (Reward Tier)
| 等级 | 材料数量限制 | 逻辑 |
|------|-------------|------|
| S | 已获物品 + 2-3个额外材料 | 历经九死一生，或达成圆满。 |
| A | 已获物品 + 1-2个额外材料 | 表现出色，获取核心资源。 |
| B | 已获物品 + 1个额外材料 | 平稳探索，中规中矩。 |
| C | 仅已获物品 | 表现平庸，或中途被迫撤离。 |
| D | 仅已获物品 | 仓皇逃窜，一无所获。 |

## 输出约束 (核心：严禁 Markdown)
直接输出原始 JSON，不含 \`\`\`json 标签，不含解释。

### 结构示例:
{
  "ending_narrative": "结局描述...",
  "settlement": {
    "reward_tier": "B",
    "reward_blueprints": [
      { "name": "...", "description": "...", "material_type": "ore", "element": "金", "reward_score": 50 }
    ],
    "performance_tags": ["收获颇丰"]
  }
}

## 结算数据参考
- 最终危险分: ${state.dangerScore}
- 牺牲/付出: ${JSON.stringify(state.summary_of_sacrifice)}
- 已获蓝图: ${JSON.stringify(state.accumulatedRewards)}
- 地图/玩家境界: ${mapRealm} / ${state.playerInfo.realm}
    `;

    const settlementContext = {
      history: state.history,
      danger_score: state.dangerScore,
      // 核心：明确告知 AI 玩家付出了什么
      summary_of_sacrifice: state.summary_of_sacrifice,
      accumulatedRewards: state.accumulatedRewards,
      location: state.location,
      playerInfo: state.playerInfo,
    };

    const aiRes = await object(
      settlementPrompt,
      JSON.stringify(settlementContext),
      {
        schema: DungeonSettlementSchema,
        schemaName: 'DungeonSettlement',
      },
    );

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

    return { isFinished: true, settlement, realGains };
  }

  /**
   * 内部工具：调用 AI 并处理上下文压缩
   */
  private async callAI(state: DungeonState): Promise<DungeonRound> {
    // 压缩历史，只给 AI 看关键节点，节省 Token 且提高稳定性
    const compressedHistory = state.history.map((h) => ({
      ...h,
      scene: h.scene.substring(0, 100) + '...', // 摘要
    }));

    const userContext: DungeonState = {
      ...state,
      history: compressedHistory,
    };

    const aiRes = await object(
      this.getSystemPrompt(state),
      JSON.stringify(userContext),
      {
        schema: DungeonRoundSchema,
        schemaName: 'DungeonRound',
      },
    );

    return aiRes.object;
  }

  async saveState(cultivatorId: string, state: DungeonState) {
    await redis.set(getDungeonKey(cultivatorId), JSON.stringify(state), {
      ex: REDIS_TTL,
    });
  }

  async getState(cultivatorId: string) {
    const state = await redis.get<DungeonState>(getDungeonKey(cultivatorId));
    if (!state) return null;
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
    const unit = new CultivatorUnit(cultivator);
    const finalAttributes = unit.getFinalAttributes();

    return {
      id: cultivator.id,
      name: cultivator.name,
      realm: `${cultivator.realm} ${cultivator.realm_stage}`,
      gender: cultivator.gender,
      age: cultivator.age,
      lifespan: cultivator.lifespan,
      personality: cultivator.personality || '普通',
      attributes: { ...finalAttributes },
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

    const state = await redis.get<DungeonState>(key);
    if (state) {
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
