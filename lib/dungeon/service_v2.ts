import { BattleEngineResult } from '@/engine/battle';
import { enemyGenerator } from '@/engine/enemyGenerator';
import { resourceEngine } from '@/engine/resource/ResourceEngine';
import type { ResourceOperation } from '@/engine/resource/types';
import { object } from '@/utils/aiClient'; // AI client helper
import { calculateFinalAttributes } from '@/utils/cultivatorUtils';
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
import {
  BattleSession,
  DungeonOptionCost,
  DungeonResourceGain,
  DungeonRound,
  DungeonRoundSchema,
  DungeonSettlement,
  DungeonSettlementSchema,
  DungeonState,
  PersistentStatusSnapshot,
  PlayerInfo,
} from './types';

const REDIS_TTL = 3600; // 1 hour expiration for active sessions

// Helper to generate Redis key
function getDungeonKey(cultivatorId: string) {
  return `dungeon:active:${cultivatorId}`;
}

export class DungeonService {
  // 核心配置：定义每个轮次对应的副本相位
  private getPhase(currentRound: number, maxRounds: number): string {
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
    const phaseDesc = this.getPhase(state.currentRound, state.maxRounds);

    return `
# Role: 《凡人修仙传》副本演化天道 (Dungeon Engine)

## 当前相位: ${phaseDesc}
你现在负责驱动一个${state.maxRounds}轮次的修仙副本。当前为第${state.currentRound}轮。

## 1. 核心叙事相位逻辑
你必须根据 currentRound 严格切换叙事逻辑：
- **【Phase 1: 潜入期】(Round 1)**: 侧重环境描写。如：发现阵法、禁制或古修遗迹入口。选项应偏向探测与尝试。
- **【Phase 2: 变局期】(Round 2-3)**: 引入转折。如：遭遇残存傀儡、禁制反弹、或发现同道斗法留下的血迹。开始消耗资源。
- **【Phase 3: 夺宝/死战期】(Round 4)**: 副本高潮。如：面对核心守护者或最强禁制。选项必须包含极高风险或巨量消耗。
- **【Phase 4: 结尾期】(Round 5)**: 副本结尾。如：禁制崩塌或取宝后的逃亡。评估玩家之前的行为，决定最终的狼狈程度或圆满程度。

## 2. 凡人流叙事准则
- **文风**：简练、冰冷、充满古意。
- **性格契合**：若玩家性格【谨慎】，选项1应有额外加成描述；若玩家【狂傲】，选项2成功率降低但收益提高。
- **因果律**：必须参考 history。若前一轮玩家损坏了法宝，本轮描述中应体现该法宝无法使用的窘境。

## 3. 强制选项模板 (必须生成3个选项)
- **选项 A (求稳)**：低风险、低收益。通常体现“韩立式谨慎”（如：布下匿踪阵观察、绕路而行）。
- **选项 B (弄险)**：高风险、高收益。体现“富贵险中求”。
- **选项 C (奇招)**：属性/道具/功法/命格触发。必须检索 player_info 中的 inventory 或 skills 或 fates。

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
  - type为battle: 遭遇战斗，value为战斗难度系数(1-10)，desc为敌人名称及特征，例如："二级顶阶傀儡，速度极快"，metadata必须包含(enemy_name, is_boss, enemy_stage, enemy_realm)
  - type为hp_loss: 气血损耗，value为损耗程度(1-10，每1点=10%最大气血)，desc为损耗原因，影响副本内战斗状态
  - type为mp_loss: 灵力损耗，value为损耗程度(1-10，每1点=10%最大灵力)，desc为损耗原因，影响副本内战斗状态
  - type为weak: 陷入虚弱，value为虚弱程度(1-10)，desc为虚弱原因，会累加到角色的weakness状态，结算后持久化
  - type为artifact_damage: 法宝损坏，value为损坏程度(1-10)，desc为法宝名称及损坏原因（注意：当前版本仅作记录，不真实处理）

## 5. 当前上下文摘要
- 地点：读取 location
- 玩家境界：读取 playerInfo.realm
- 关键物品：读取 playerInfo.inventory
`;
  }

  /**
   * 初始化副本
   */
  async startDungeon(cultivatorId: string, mapNodeId: string) {
    const activeKey = getDungeonKey(cultivatorId);
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

    // 从数据库加载持久状态
    const persistentStatuses: PersistentStatusSnapshot[] = Array.isArray(
      cultivator.cultivator.persistent_statuses,
    )
      ? (cultivator.cultivator
          .persistent_statuses as PersistentStatusSnapshot[])
      : [];

    // 从地图节点获取环境状态
    const environmentalStatuses: PersistentStatusSnapshot[] = [];
    const mapNode = getMapNode(mapNodeId);
    if (mapNode && 'environmental_status' in mapNode) {
      const satellite = mapNode as SatelliteNode;
      if (satellite.environmental_status) {
        // 添加环境状态到数组
        environmentalStatuses.push({
          statusKey: satellite.environmental_status,
          potency: 1, // 环境状态默认强度为1
          createdAt: Date.now(),
          metadata: { source: 'environment', location: mapNode.name },
        });
      }
    }

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
      // 新增字段：状态和累积损失
      persistentStatuses,
      environmentalStatuses,
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
  async handleAction(
    cultivatorId: string,
    choiceId: number,
    choiceText: string,
  ) {
    const state = await this.getState(cultivatorId);
    if (!state) throw new Error('副本已失效');

    // 1. 校验并处理消耗（成本校验前置）
    const chosenOption = state.currentOptions?.find((o) => o.id === choiceId);
    if (chosenOption?.costs) {
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
          const weaknessPotency = cost.value; // value 即为虚弱程度
          // 添加或更新 weakness 状态
          const existingWeakness = state.persistentStatuses.find(
            (s) => s.statusKey === 'weakness',
          );
          if (existingWeakness) {
            // 更新现有虚弱状态的强度
            existingWeakness.potency = Math.min(
              10,
              existingWeakness.potency + weaknessPotency,
            );
            existingWeakness.metadata = {
              ...existingWeakness.metadata,
              lastUpdated: Date.now(),
              source: 'dungeon_sacrifice',
            };
          } else {
            // 添加新的虚弱状态
            state.persistentStatuses.push({
              statusKey: 'weakness',
              potency: weaknessPotency,
              createdAt: Date.now(),
              metadata: { source: 'dungeon_sacrifice' },
            });
          }
        }
      }

      // 1.3 Battle Interception
      const battleCost = chosenOption.costs.find((c) => c.type === 'battle');
      if (battleCost) {
        state.history[state.history.length - 1].choice = choiceText;
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
    state.history[state.history.length - 1].choice = choiceText;
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
        persistentStatuses: dungeonState.persistentStatuses, // 持久状态快照
        environmentalStatuses: dungeonState.environmentalStatuses, // 环境状态快照
        hpLossPercent: dungeonState.accumulatedHpLoss, // 虚拟 HP 损失百分比
        mpLossPercent: dungeonState.accumulatedMpLoss, // 虚拟 MP 损失百分比
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
      const hasMinorWound = state.persistentStatuses.find(
        (s) => s.statusKey === 'minor_wound',
      );
      const hasMajorWound = state.persistentStatuses.find(
        (s) => s.statusKey === 'major_wound',
      );
      const hasNearDeath = state.persistentStatuses.find(
        (s) => s.statusKey === 'near_death',
      );

      if (hasNearDeath) {
        // 已经是 near_death，增加强度
        hasNearDeath.potency = Math.min(10, hasNearDeath.potency + 1);
        hasNearDeath.metadata = {
          ...hasNearDeath.metadata,
          lastUpdated: Date.now(),
          source: 'dungeon_battle_defeat',
        };
      } else if (hasMajorWound) {
        // 从 major_wound 升级到 near_death
        state.persistentStatuses = state.persistentStatuses.filter(
          (s) => s.statusKey !== 'major_wound',
        );
        state.persistentStatuses.push({
          statusKey: 'near_death',
          potency: 1,
          createdAt: Date.now(),
          metadata: {
            source: 'dungeon_battle_defeat',
            upgradedFrom: 'major_wound',
          },
        });
      } else if (hasMinorWound) {
        // 从 minor_wound 升级到 major_wound
        state.persistentStatuses = state.persistentStatuses.filter(
          (s) => s.statusKey !== 'minor_wound',
        );
        state.persistentStatuses.push({
          statusKey: 'major_wound',
          potency: 1,
          createdAt: Date.now(),
          metadata: {
            source: 'dungeon_battle_defeat',
            upgradedFrom: 'minor_wound',
          },
        });
      } else {
        // 添加 minor_wound
        state.persistentStatuses.push({
          statusKey: 'minor_wound',
          potency: 1,
          createdAt: Date.now(),
          metadata: { source: 'dungeon_battle_defeat' },
        });
      }

      // 战斗失败后立即触发副本结算
      const outcomeText = `你终究是不敵 ${enemyName}，在其重击下狼狈遁走，侮幸捡回一条命。但你已无力再战，只得退出副本。`;
      lastHistory.outcome = outcomeText;

      // 立即触发结算
      return this.settleDungeon(state);
    }

    // 战斗胜利处理
    const outcomeText = `历经 ${battleResult.turns} 个回合的苦战，你成功击败了 ${enemyName}。虽然负了些伤，但总算化险为夷。`;
    lastHistory.outcome = outcomeText;

    // 从战斗结果中同步持久状态（如果有）
    if (battleResult.playerPersistentStatuses) {
      state.persistentStatuses = battleResult.playerPersistentStatuses;
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
    const settlementPrompt = `
# Role: 《凡人修仙传》天道平衡者

## 结算背景
玩家刚刚经历了一场艰难的历练。你需要根据其【付出】与【危险】给出最终评价。
${options?.abandonedBattle ? '\n**特别注意**: 玩家在战斗前主动放弃撤退，未完成副本，评价应该更低（D或更低），奖励应该极少或无。' : ''}

## 核心准则：等价交换
1. **惨烈补偿**：若玩家在历练中损失了法宝、消耗了大量寿元或多次陷入死斗（参考 summary_of_sacrifice），结算等级严禁低于 B。
2. **风险对冲**：危险分 (danger_score) 越高，最终获得的【潜在奖励】品阶必须越高。
3. **凡人逻辑**：即使是韩立，在丢弃法宝后也必然会收获关键材料。严禁出现“付出巨大却毫无所获”的结局。

## 评价等级定义 (Strict Standard):
- **S (九死一生)**: 经历了 2 次及以上战斗，或损失了高价值法宝，或危险分 > 80。奖励如：古修传承、玄天残片、顶级功法。
- **A (险象环生)**: 有明显的资源损耗且顺利通关。奖励如：稀有材料、精进修为的古丹药。
- **B (劳苦功高)**: 损耗一般，有少量损耗。奖励如：基础灵石、寻常材料、普通丹药。
- **C (稳扎稳打)**: 损耗一般，以稳健为主。奖励如：基础灵石、寻常材料。
- **D (空手而归)**: 玩家在初期就选择了放弃，或未遭遇任何危险。奖励如：基础灵石

## 输出要求
请综合 summary_of_sacrifice，给出一个让玩家感到“虽然损失惨重，但机缘惊人”或“代价沉重但物有所值”的叙事结局。
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

    // --- 核心优化：后端根据 AI 的 reward_tier 匹配真正的奖励池 ---
    // 防止 AI 随意发放极品法宝
    const realGains = await this.generateRealRewards(
      settlement.settlement.reward_tier,
      state.playerInfo.realm,
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
    await this.archiveDungeon(state, settlement);

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
    const finalAttributes = calculateFinalAttributes(cultivator);
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
      attributes: { ...finalAttributes.final },
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
   * 生成真实奖励（根据评级和境界）
   */
  async generateRealRewards(
    rewardTier: string,
    realm: string,
  ): Promise<DungeonResourceGain[]> {
    const gains: DungeonResourceGain[] = [];

    // TODO: 从 utils/dungeonRewards.ts 中获取配置
    // 根据 rewardTier 和 realm 生成奖励
    // 这里先返回基础灵石奖励

    const tierMultiplier: Record<string, number> = {
      S: 2.0,
      A: 1.5,
      B: 1.0,
      C: 0.7,
      D: 0.5,
    };

    const realmBase: Record<string, number> = {
      炼气期: 20,
      筑基期: 75,
      金丹期: 300,
      元婴期: 1500,
      化神期: 7500,
    };

    const mult = tierMultiplier[rewardTier] || 1.0;
    const base = realmBase[realm] || 20;
    const spiritStones = Math.floor(base * mult);

    gains.push({
      type: 'spirit_stones',
      value: spiritStones,
      desc: `灵石 x${spiritStones}`,
    });

    return gains;
  }

  async archiveDungeon(state: DungeonState, settlement: DungeonSettlement) {
    // Archive to DB
    await db.insert(dungeonHistories).values({
      cultivatorId: state.cultivatorId,
      theme: state.theme,
      result: settlement,
      log: state.history
        .map((h) => `[Round ${h.round}] ${h.scene} -> Choice: ${h.choice}`)
        .join('\n'),
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
