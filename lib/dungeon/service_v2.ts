import { enemyGenerator } from '@/engine/enemyGenerator';
import { object } from '@/utils/aiClient'; // AI client helper
import { calculateFinalAttributes } from '@/utils/cultivatorUtils';
import { randomUUID } from 'crypto';
import { BattleEngineResult } from '../../engine/battleEngine';
import { db } from '../drizzle/db';
import { dungeonHistories } from '../drizzle/schema';
import { getMapNode } from '../game/mapSystem';
import { redis } from '../redis';
import {
  getCultivatorByIdUnsafe,
  getInventory,
} from '../repositories/cultivatorRepository';
import {
  BattleSession,
  COST_TYPES,
  DungeonOptionCost,
  DungeonResourceGain,
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
- **选项 A (求稳)**：低风险、低收益。通常体现“韩立式谨慎”（如：布下匿踪阵观察、绕路而行）。消耗：灵石(spirit_stones_loss)、气血(hp_loss)、灵力(mp_loss)、材料损耗(material_loss)、陷入虚弱(weak)。
- **选项 B (弄险)**：高风险、高收益。体现“富贵险中求”。消耗：法宝损坏(artifact_damage)、材料损耗(material_loss)、遭遇战斗(battle)、寿元损耗(lifespan_loss)、修为损耗(exp_loss)。
- **选项 C (奇招)**：属性/道具/功法/命格触发。必须检索 player_info 中的 inventory 或 skills 或 fates。消耗：视情况而定，从COST_TYPES中选择合适的。

## 4. 输出约束
- 必须使用 JSON 输出。
- internal_danger_score: 0-100。本轮若选择危险路径，分值应上升；若选择稳健路径，分值微降或不变。
- internal_danger_score 的数值含义：
  - 0-30：相对安全，以寻宝、破禁为主，收获一般。
  - 31-70：很有挑战，如遭遇傀儡、妖兽，或者发现其他修士的踪迹，收获尚可。
  - 71-100：必死之局或绝境，必须通过极大的代价（燃血、自爆法宝）才能生还，但往往有丰厚的收获。
- costs: 必须严格使用规定的类型（COST_TYPES） ${COST_TYPES.map((cost) => `${cost.type}(${cost.name})`).join(', ')}，禁止自定义类型
- costs类型规定:
  - cost类型为battle: value为战斗难度系数(1-10),desc为敌人名称及特征，例如："二级顶阶傀儡，速度极快",metadata为敌人信息(enemy_name, is_boss, enemy_stage, enemy_realm)
  - cost类型为artifact_damage: value为法宝损坏程度(1-10),desc为法宝名称
  - cost类型为material_loss: value为材料消耗数量(1-5),desc为材料名称
  - cost类型为spirit_stones_loss: value为灵石消耗数量(1-10000)
  - cost类型为hp_loss: value为气血损耗程度(1-10)
  - cost类型为mp_loss: value为灵力损耗程度(1-10)
  - cost类型为exp_loss: value为修为损耗程度(1-10)
  - cost类型为lifespan_loss: value为寿元损耗年数(1-100)
  - cost类型为weak: value为虚弱程度(1-10)

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

    // 2. 初始状态
    const state: DungeonState = {
      ...context,
      currentRound: 1,
      maxRounds: 5, // 建议固定或根据地图设定
      history: [],
      dangerScore: 10,
      isFinished: false,
      cultivatorId: context.playerInfo.id!,
      theme: context.location.location,
      summary_of_sacrifice: [],
      status: 'EXPLORING',
    };

    // 3. 首次 AI 调用
    const roundData = await this.callAI(state);

    // 4. 更新历史并存入 Redis
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

    // 1. 校验并处理消耗
    const chosenOption = state.currentOptions?.find((o) => o.id === choiceId);
    if (chosenOption?.costs) {
      // 在这里进行硬核校验，比如灵石不够则报错
      await this.processResources(cultivatorId, chosenOption.costs, 'cost');
      state.summary_of_sacrifice?.push(...chosenOption.costs);

      // --- Battle Interception ---
      const battleCost = chosenOption.costs.find((c) => c.type === 'battle');
      if (battleCost) {
        state.history[state.history.length - 1].choice = choiceText;
        state.status = 'IN_BATTLE';

        const session = await this.createBattleSession(
          cultivatorId,
          getDungeonKey(cultivatorId),
          battleCost,
          state.playerInfo,
          state.summary_of_sacrifice || [],
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
    sacrificeSummary: DungeonOptionCost[],
  ): Promise<BattleSession> {
    console.log('[createBattleSession]', battleCost);
    const battleId = randomUUID();

    // Calculate current HP/MP based on sacrifices
    // This is a simplified view; ideally we track current HP in DungeonState if we want persistence across rounds
    // For now, we assume full HP minus accumulated loss
    let hpLoss = 0;
    let mpLoss = 0;

    sacrificeSummary.forEach((s) => {
      if (s.type === 'hp_loss') hpLoss += s.value * 30; // 30 per value
      if (s.type === 'mp_loss') mpLoss += s.value * 10; // 10 per value
    });

    // Add current round cost
    if (battleCost.type === 'hp_loss') hpLoss += battleCost.value * 30;

    const currentHp = Math.max(1, playerInfo.attributes.vitality * 5 - hpLoss); // Rough max HP formula
    const currentMp = Math.max(1, playerInfo.attributes.spirit * 10 - mpLoss); // Rough max MP formula

    // Check for "weak" status in sacrifices to apply debuffs?
    // For now we just lower HP/MP.

    const enemy = await enemyGenerator.generate(
      battleCost.metadata || {
        enemy_name: battleCost.desc,
        is_boss: false,
        enemy_stage: playerInfo.realm,
        enemy_realm: '中期',
      }, // Ensure metadata is passed safely
      battleCost.value,
      playerInfo,
    );

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
        currentHp: currentHp,
        currentMp: currentMp,
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
  ) {
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

    const outcomeText = isWin
      ? `历经 ${battleResult.turns} 个回合的苦战，你成功击败了 ${enemyName}。虽然负了些伤，但总算化险为夷。`
      : `你终究是不敌 ${enemyName}，在其重击下狼狈遁走，侥幸捡回一条命。`;

    lastHistory.outcome = outcomeText; // Update the pending outcome

    // Add implicit costs from battle (e.g. HP loss, consumables used)
    // For now, we just record "Battle" occurred.

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
  private async settleDungeon(state: DungeonState) {
    const settlementPrompt = `
# Role: 《凡人修仙传》天道平衡者

## 结算背景
玩家刚刚经历了一场艰难的历练。你需要根据其【付出】与【危险】给出最终评价。

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

    // 执行真正的资源变更
    await this.processResources(state.cultivatorId, realGains, 'gain');

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

  async processResources(
    cultivatorId: string,
    resources: DungeonResourceGain[] | DungeonOptionCost[],
    type: 'gain' | 'cost',
  ) {
    console.log('[processResources]', resources, type);
  }

  async generateRealRewards(rewardTier: string, realm: string) {
    console.log('[generateRealRewards]', rewardTier, realm);
    return [];
  }

  async archiveDungeon(state: DungeonState, settlement: DungeonSettlement) {
    // Archive to DB
    await db.insert(dungeonHistories).values({
      cultivatorId: state.cultivatorId,
      theme: state.theme,
      result: settlement, // jsonb
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

    // Retrieve state to log the abandonment
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
