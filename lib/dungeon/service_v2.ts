import { BattleEngineResult } from '@/engine/battle';
import type { BuffInstanceState } from '@/engine/buff/types';
import { CultivatorUnit } from '@/engine/cultivator';
import { enemyGenerator } from '@/engine/enemyGenerator';
import { TYPE_DESCRIPTIONS } from '@/engine/material/creation/config';
import { resourceEngine } from '@/engine/resource/ResourceEngine';
import type { ResourceOperation } from '@/engine/resource/types';
import { REALM_VALUES, RealmType } from '@/types/constants';
import { object } from '@/utils/aiClient'; // AI client helper
import { randomUUID } from 'crypto';
import { db } from '../drizzle/db';
import { dungeonHistories } from '../drizzle/schema';
import { getMapNode, SatelliteNode } from '../game/mapSystem';
import { redis } from '../redis';
import {
  getCultivatorByIdUnsafe,
  getCultivatorOwnerId,
  getInventory,
} from '../repositories/cultivatorRepository';
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

// Helper to generate Redis key
function getDungeonKey(cultivatorId: string) {
  return `dungeon:active:${cultivatorId}`;
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

    return `
# Role: 《凡人修仙传》副本演化天道 (Dungeon Engine)

${realmGuidance}

## 当前相位: ${phaseDesc}
你现在负责驱动一个${state.maxRounds}轮次的修仙副本。当前为第${state.currentRound}轮。

## 1. 核心叙事相位逻辑
你必须根据 currentRound 严格切换叙事逻辑，并结合上述境界差距指导调整难度。

## 2. 凡人流叙事准则
- **文风**：简练、冰冷、充满古意。
- **性格契合**：若玩家性格【谨慎】，选项1应有额外加成描述；若玩家【狂傲】，选项2成功率降低但收益提高。
- **因果律**：必须参考 history。若前一轮玩家损坏了法宝，本轮描述中应体现该法宝无法使用的窘境。

## 3. 强制选项模板 (必须生成3个选项)
- **选项 A (求稳)**：低风险、低收益。通常体现"韩立式谨慎"（如：布下匿踪阵观察、绕路而行）。
- **选项 B (弄险)**：高风险、高收益。体现"富贵险中求"。
- **选项 C (奇招/随机)**：
  - **60%概率**：需要特定道具/功法/命格（检索 player_info 中的 inventory/skills/fates）
  - **40%概率**：通用选项（不依赖玩家特定资源）
  
**重要约束**：
- **禁止所有选项都恰好匹配玩家的材料/命格**
- **至少1个选项应该是玩家当前无法满足或不适用的**（如需要玩家没有的材料，或不符合玩家性格的选择）
- 材料需求应该有一定的随机性，不总是玩家恰好拥有的

## 4. 输出约束
- 必须使用 JSON 输出。
- internal_danger_score: 0-100。本轮若选择危险路径，分值应上升；若选择稳健路径，分值微降或不变。
- internal_danger_score 的数值含义：
  - 0-30：相对安全，以寻宝、破禁为主，收获一般。
  - 31-70：很有挑战，如遭遇傀儡、妖兽，或者发现其他修士的踪迹，收获尚可。
  - 71-100：必死之局或绝境，必须通过极大的代价（燃血、自爆法宝）才能生还，但往往有丰厚的收获。
- costs: 必须严格使用规定的类型：spirit_stones(灵石), lifespan(寿元), cultivation_exp(修为), comprehension_insight(感悟值), material(材料), hp_loss(气血损耗), mp_loss(灵力损耗), weak(虚弱), battle(战斗), artifact_damage(法宝损坏)，禁止自定义类型
- costs类型规定（分为资源消耗类和副本特有类）:
  
  **资源消耗类**（会真实扣除玩家资源）:
  - type为spirit_stones: 灵石消耗，value为消耗数量(1-10000)，desc为消耗原因
  - type为lifespan: 寿元消耗，value为消耗年数(1-100)，desc为消耗原因，例如："强行催动法宝"
  - type为cultivation_exp: 修为消耗，value为消耗点数(1-1000)，desc为消耗原因，例如："逆转禁制"
  - type为material: 材料消耗，value为消耗数量(1-5)，name为材料名称（必须），desc为消耗原因，例如："破阵需要'破禁符'"
  
  **副本特有类**（虚拟损耗，不直接扣除资源，但会影响副本内状态和结算）:
  - type为battle: 遭遇战斗，value为战斗难度系数(1-10)，desc为敌人名称及特征，例如："二级顶阶傀儡，速度极快"，metadata必须包含(enemy_name, is_boss)
  - type为hp_loss: 气血损耗，value为损耗程度(1-10，每1点=10%最大气血)，desc为损耗原因，影响副本内战斗状态
  - type为mp_loss: 灵力损耗，value为损耗程度(1-10，每1点=10%最大灵力)，desc为损耗原因，影响副本内战斗状态
  - type为weak: 陷入虚弱，value为虚弱程度(1-10)，desc为虚弱原因，会累加到角色的weakness状态，结算后持久化
  - type为artifact_damage: 法宝损坏，value为损坏程度(1-10)，desc为法宝名称及损坏原因（注意：当前版本仅作记录，不真实处理）

**【严禁组合】**:
- 若选项包含 'battle' 类型代价，则**绝对禁止**同时包含 'hp_loss' 或 'mp_loss'
- 战斗代价自身已包含足够风险，额外扣血是不合理的惩罚
- 违反此规则将导致玩家进入战斗即死亡的灾难性 bug

## 5. 当前上下文摘要
- 地点：读取 location
- 地图境界要求：${mapRealm}
- 玩家境界：读取 playerInfo.realm
- 境界差距：${realmGap > 0 ? `玩家高出${realmGap}个大境界` : realmGap < 0 ? `玩家低${Math.abs(realmGap)}个大境界` : '实力相当'}
- 关键物品：读取 playerInfo.inventory
`;
  }

  /**
   * 初始化副本
   */
  async startDungeon(cultivatorId: string, mapNodeId: string) {
    // 0. 检查每日次数限制
    const limit = await checkDungeonLimit(cultivatorId);
    if (!limit.allowed) {
      throw new Error('今日探索次数已用尽（每日限 2 次）');
    }

    const activeKey = getDungeonKey(cultivatorId);
    const existingSession = await redis.get(activeKey);
    if (existingSession) {
      throw new Error('当前已有正在进行的副本，请先完成或放弃');
    }

    // 消耗次数（开始即消耗）
    await consumeDungeonLimit(cultivatorId);

    // 1. 获取玩家与地图数据 (逻辑同你之前)
    const context = await this.prepareDungeonContext(cultivatorId, mapNodeId);

    // 2. 加载持久状态和环境状态
    const cultivator = await getCultivatorByIdUnsafe(cultivatorId);
    if (!cultivator || !cultivator.cultivator) {
      throw new Error('未找到修真者数据');
    }

    // 从数据库加载持久状态（转换为 BuffInstanceState 格式）
    const rawStatuses = Array.isArray(cultivator.cultivator.persistent_statuses)
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
      status: 'EXPLORING',
      persistentBuffs,
      accumulatedHpLoss: 0, // 累积HP损失百分比 (0-1)
      accumulatedMpLoss: 0, // 累积MP损失百分比 (0-1)
    };

    // 4. 首次 AI 调用
    const roundData = await this.callAI(state);

    // 5. 更新历史并存入 Redis
    state.history.push({ round: 1, scene: roundData.scene_description });
    state.currentOptions = roundData.interaction.options;
    await this.saveState(cultivatorId, state);

    return { state, roundData };
  }

  /**
   * 处理玩家交互
   */
  async handleAction(cultivatorId: string, choiceId: number) {
    const state = await this.getState(cultivatorId);
    if (!state) throw new Error('副本已失效');

    // 1. 校验并处理消耗（成本校验前置）
    const chosenOption = state.currentOptions?.find((o) => o.id === choiceId);
    if (chosenOption?.costs) {
      // 防御性编程：如果 AI 违规生成了 battle + hp_loss/mp_loss 组合，过滤掉冲突项
      const hasBattle = chosenOption.costs.some((c) => c.type === 'battle');
      if (hasBattle) {
        chosenOption.costs = chosenOption.costs.filter(
          (c) => c.type !== 'hp_loss' && c.type !== 'mp_loss',
        );
      }

      // 获取 userId
      const userId = await getCultivatorOwnerId(cultivatorId);
      if (!userId) {
        throw new Error('无法获取修真者所属用户');
      }

      // DungeonOptionCost 与 ResourceOperation 结构兼容
      // desc 字段在 ResourceEngine 中会被忽略
      const result = await resourceEngine.consume(
        userId,
        cultivatorId,
        chosenOption.costs as ResourceOperation[],
      );

      if (!result.success) {
        throw new Error(result.errors?.join('; ') || '资源消耗失败');
      }

      state.summary_of_sacrifice?.push(...chosenOption.costs);

      // 1.1 累加 HP/MP 损失百分比
      for (const cost of chosenOption.costs) {
        if (cost.type === 'hp_loss') {
          // 每个 value 点转换为 10% HP 损失
          state.accumulatedHpLoss = Math.min(
            1,
            state.accumulatedHpLoss + cost.value * 0.1,
          );
        } else if (cost.type === 'mp_loss') {
          // 每个 value 点转换为 10% MP 损失
          state.accumulatedMpLoss = Math.min(
            1,
            state.accumulatedMpLoss + cost.value * 0.1,
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

      // 1.3 Battle Interception
      const battleCost = chosenOption.costs.find((c) => c.type === 'battle');
      if (battleCost) {
        state.history[state.history.length - 1].choice = chosenOption.text;
        state.status = 'IN_BATTLE';

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
      return this.settleDungeon(state);
    }

    state.currentRound++;

    // 3. AI 生成下一轮
    const roundData = await this.callAI(state);

    // 4. 更新状态
    state.history.push({
      round: state.currentRound,
      scene: roundData.scene_description,
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

    state.currentRound++;

    if (state.currentRound > state.maxRounds) {
      return this.settleDungeon(state);
    }

    // Resume AI
    const roundData = await this.callAI(state);
    state.history.push({
      round: state.currentRound,
      scene: roundData.scene_description,
    });
    state.currentOptions = roundData.interaction.options;
    state.dangerScore = roundData.status_update.internal_danger_score;

    await this.saveState(cultivatorId, state);
    return { state, roundData, isFinished: false };
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
      .map(([key, desc]) => `| ${key} | ${desc} |`)
      .join('\n');

    const settlementPrompt = `
# Role: 《凡人修仙传》天道平衡者 - 结算与奖励鉴定

## 核心职责
你需要根据玩家的【付出】与【危险】给出最终评价，并**创造性地设计材料奖励**。
${options?.abandonedBattle ? '\n> [!CAUTION] 玩家在战斗前主动放弃撤退，评价应为D级，奖励极少。' : ''}

## ⚠️ 重要：奖励生成规则

**灵石、修为、感悟值由程序自动计算**，你只需要设计材料奖励。

### 你需要生成的奖励类型

| 类型 | 说明 | 需要填写 |
|------|------|----------|
| material | 材料 | **必须**填写：name, description, material_type, element, quality_hint |

### 材料类型（material_type字段）

| 值 | 说明 |
|---|------|
${materialTypeTable}

### 元素（element字段）

**必须从以下8个元素中选1个**：
- 金、木、水、火、土、风、雷、冰

### 品质提示（quality_hint字段）

- lower: 下品（D/C级奖励用）
- medium: 中品（B级奖励用）
- upper: 上品（A/S级奖励用）

## 评价等级定义

| 等级 | 材料奖励数量 | 材料品质要求 | 自动附加奖励 |
|------|-------------|-------------|-------------|
| S | 2-3个材料 | quality_hint="upper" | 大量灵石+修为+感悟 |
| A | 1-2个材料 | quality_hint="medium"或"upper" | 中等灵石+修为 |
| B | 1-2个材料 | quality_hint="medium"或"lower" | 少量灵石+修为 |
| C | 0-1个材料 | quality_hint="lower" | 少量灵石 |
| D | 无材料 | - | 少量灵石 |

**程序会自动添加**：根据评级 S/A/B/C/D 自动附加不同数量的灵石、修为、感悟值，你不需要手动添加这些类型。

## 核心准则：等价交换
1. **惨烈补偿**：若玩家损失了法宝、消耗大量寿元或多次陷入死斗，结算等级严禁低于 B
2. **风险对冲**：危险分(danger_score)越高，材料品质越高
3. **凡人逻辑**：严禁出现"付出巨大却毫无所获"的结局

## 材料设计原则
1. **场景关联**：材料必须与副本场景/剧情/历程强关联
2. **剧情呼应**：如果副本中有特定经历，奖励应该反映这些经历
3. **自然合理**：不要给玩家突兀的感觉，材料获取应该有逻辑支撑
    `;

    const settlementContext = {
      history: state.history,
      danger_score: state.dangerScore,
      // 核心：明确告知 AI 玩家付出了什么
      summary_of_sacrifice: state.summary_of_sacrifice,
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

    // --- 核心优化：使用 RewardFactory 将 AI 蓝图转化为真实奖励 ---
    // 获取地图境界门槛
    const mapNode = getMapNode(state.mapNodeId);
    const mapRealm =
      mapNode && 'realm_requirement' in mapNode
        ? (mapNode as SatelliteNode).realm_requirement
        : ('筑基' as RealmType);

    const realGains = RewardFactory.generateAllRewards(
      settlement.settlement.reward_blueprints as RewardBlueprint[],
      mapRealm,
      settlement.settlement.reward_tier,
      state.dangerScore, // 传递危险分数用于奖励计算
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
    const inventory = await getInventory(
      cultivatorBundle.userId,
      cultivator.id!,
    );
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
      inventory: {
        artifacts: inventory.artifacts.map((artifact) => artifact.name),
        materials: inventory.materials.map((material) => {
          return {
            name: material.name,
            count: material.quantity,
          };
        }),
      },
    };
  }

  getMapNode(mapNodeId: string) {
    const mapNode = getMapNode(mapNodeId);
    if (!mapNode) throw new Error('无效的地图节点');
    return mapNode;
  }

  /**
   * 使用 RewardFactory 生成完整奖励（基础奖励 + 材料奖励）
   */
  generateRealRewards(
    blueprints: RewardBlueprint[],
    tier: string,
    mapRealm: RealmType,
    dangerScore: number,
  ): ResourceOperation[] {
    return RewardFactory.generateAllRewards(
      blueprints,
      mapRealm,
      tier,
      dangerScore,
    );
  }

  async archiveDungeon(
    state: DungeonState,
    settlement: DungeonSettlement,
    realGains?: ResourceOperation[],
  ) {
    // Archive to DB
    await db.insert(dungeonHistories).values({
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
      await db.insert(dungeonHistories).values({
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
            .map((h) => `[Round ${h.round}] ${h.scene} -> Choice: ${h.choice}`)
            .join('\n') + '\n[ABANDONED]',
      });
    }

    await redis.del(key);
    return { success: true };
  }
}

export const dungeonService = new DungeonService();
