import { db } from '@/lib/drizzle/db'; // Assuming db export exists
import { dungeonHistories } from '@/lib/drizzle/schema';
import { getMapNode } from '@/lib/game/mapSystem';
import { redis } from '@/lib/redis';
import { object } from '@/utils/aiClient'; // AI client helper
import { calculateFinalAttributes } from '@/utils/cultivatorUtils';
import { z } from 'zod';
import {
  getCultivatorByIdUnsafe,
  getInventory,
} from '../repositories/cultivatorRepository';
import {
  COST_TYPES,
  DungeonRoundSchema,
  DungeonSettlementSchema,
  DungeonState,
  ResourceChangeSchema,
} from './types';

const DUNGEON_MAX_ROUNDS = 3;
const REDIS_TTL = 3600; // 1 hour expiration for active sessions

// Helper to generate Redis key
function getDungeonKey(cultivatorId: string) {
  return `dungeon:active:${cultivatorId}`;
}

// Loot Tables (Simplified for now)
export const LOOT_TABLE = {
  S: {
    spirit_stones: [500, 1000],
    material_rank: '仙品',
    chance_artifact: 0.5,
  },
  A: { spirit_stones: [200, 500], material_rank: '极品', chance_artifact: 0.3 },
  B: { spirit_stones: [50, 200], material_rank: '上品', chance_artifact: 0.1 },
  C: { spirit_stones: [10, 50], material_rank: '中品', chance_artifact: 0.05 },
  D: { spirit_stones: [0, 10], material_rank: '凡品', chance_artifact: 0 },
};

export class DungeonService {
  /**
   * Start a new dungeon session
   */
  async startDungeon(cultivatorId: string, mapNodeId: string) {
    const cultivatorBundle = await getCultivatorByIdUnsafe(cultivatorId);

    if (!cultivatorBundle || !cultivatorBundle.cultivator)
      throw new Error('未找到名为该道友的记录');

    // Fetch Map Node Data
    const mapNode = getMapNode(mapNodeId);
    if (!mapNode) throw new Error('无效的地图节点');

    const cultivator = cultivatorBundle.cultivator;
    const finalAttributes = calculateFinalAttributes(cultivator);
    const inventory = await getInventory(
      cultivatorBundle.userId,
      cultivator.id!,
    );
    const context = {
      player_info: {
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
        cultivations: cultivator.cultivations.map(
          (cultivation) => cultivation.name,
        ),
        skills: cultivator.skills.map(
          (skill) => `${skill.name}(${skill.description})`,
        ),
        spirit_stones: cultivator.spirit_stones,
        background: cultivator.background || '',
        inventory: {
          artifacts: inventory.artifacts.map(
            (artifact) => `${artifact.name}(${artifact.description})`,
          ),
          materials: inventory.materials.map(
            (material) => `${material.name}(${material.description})`,
          ),
        },
      },
      dungeon_context: {
        location: mapNode.name,
        location_tags: mapNode.tags,
        location_description: mapNode.description,
        current_round: 1,
        max_rounds: DUNGEON_MAX_ROUNDS,
        history: [],
      },
    };

    const systemPrompt = `
# Role: 《凡人修仙传》副本演化天道

你是一个基于《凡人修仙传》小说逻辑的文字游戏副本驱动引擎。你负责根据玩家信息生成充满危机、转折与机缘的副本叙事。

## 核心叙事准则

1. **凡人流风格**：强调修仙界的残酷与资源匮乏。主角并非无敌，每一次选择都可能导致重伤甚至陨落。描述需简练、有古意，注重环境描写（如：禁制波动、药香、阴冷气息）。
   - **环境权重**：生成的副本场景必须高度契合 \`dungeon_context\` 中的【location_tags】和【location_description】。
2. **逻辑判定**：
   - 依据玩家的【境界】判断其实力上限。
   - 依据玩家的【性格/命格】触发特殊文本（如：性格谨慎者更易发现陷阱）。
   - 依据玩家的【道具/法宝】提供特定选项（如：拥有噬金虫则可吞噬阵法）。
3. **互动结构**：副本固定为${DUNGEON_MAX_ROUNDS}轮。
   - 前期：潜入、破禁、遭遇小危机。
   - 中期：博弈、转折、选择（如：是否与同行修士反目）。
   - 后期：最终考验、取宝、逃亡。
4. **资源损耗**：选项应包含实质性代价，如“损耗百年寿元”、“法宝受损”、“消耗大量灵石”、“陷入虚弱(value影响虚弱百分比)”。
   - 资源损耗(costs中的type)类型必须是给定中的一种: ${COST_TYPES.map((cost) => `${cost.type}(${cost.name})`).join(', ')}，禁止自定义
   - 资源损耗如果为battle(遭遇战斗)，则在desc中描述敌人信息

## 约束条件
- 严禁输出超出《凡人》世界观的内容。
- 必须以 JSON 格式输出，以便系统解析。
- 结局必须根据玩家在过程中的选择（稳健度、危险度）给出评价。

## 交互逻辑
- 每一轮，你需要提供环境描述和3个逻辑迥异的选项。
- 选项1：稳健/低收益（符合韩立风格）。
- 选项2：激进/高风险。
- 选项3：特定法宝/属性触发的奇招（必须关联玩家道具栏或特质）。

请输出符合 DungeonRound Schema 的 JSON。
`;

    const aiRes = await object(systemPrompt, JSON.stringify(context), {
      schema: DungeonRoundSchema,
      schemaName: 'DungeonRound',
    });

    const roundData = aiRes.object;

    // Update State (Initial)
    const state: DungeonState = {
      cultivatorId,
      theme: mapNode.name,
      playerInfo: context.player_info,
      currentRound: 1,
      maxRounds: DUNGEON_MAX_ROUNDS,
      history: [
        {
          round: 1,
          scene: roundData.scene_description,
        },
      ],
      dangerScore: roundData.status_update.internal_danger_score,
      isFinished: false,
      currentOptions: roundData.interaction.options,
    };

    await redis.set(getDungeonKey(cultivatorId), JSON.stringify(state), {
      ex: REDIS_TTL,
    });

    return { state, roundData };
  }

  /**
   * Handle player choice and proceed to next round
   */
  async handleAction(
    cultivatorId: string,
    choiceId: number,
    choiceText: string,
  ) {
    const key = getDungeonKey(cultivatorId);
    const rawState = await redis.get<string>(key);
    if (!rawState) throw new Error('副本会话已过期，请重新开始');

    const state = rawState as unknown as DungeonState;

    // Validate Choice & Process Costs
    const chosenOption = state.currentOptions?.find((o) => o.id === choiceId);
    if (chosenOption) {
      if (chosenOption.costs && chosenOption.costs.length > 0) {
        // Process cost deduction
        await this.processResources(cultivatorId, chosenOption.costs, 'cost');
      }
    }

    // Update History
    state.history[state.history.length - 1].choice = choiceText;

    if (state.currentRound >= state.maxRounds) {
      return this.settleDungeon(state);
    }

    state.currentRound++;

    // Call AI
    const context = {
      player_info: state.playerInfo,
      dungeon_context: {
        current_round: state.currentRound,
        max_rounds: state.maxRounds,
        history: state.history,
        internal_danger_score: state.dangerScore,
      },
      last_choice: { id: choiceId, text: choiceText },
    };

    const systemPrompt = `
# Role: 《凡人修仙传》副本演化天道 (Story Engine)

你负责根据上文继续生成副本剧情。

## 要求:
1. **风格**: 保持《凡人》风格（残酷、资源匮乏、谨慎）。
2. **逻辑**: 根据玩家的选择（last_choice）推进剧情。如果玩家选择了高风险选项，应增加后续的危机感或给予高回报的机会（但伴随代价）。
3. **输出**: 必须严格遵守 DungeonRound JSON 格式。
4. **代价**: 在 DungeonOption 中，如果选项涉及资源消耗（如“燃烧寿元”），必须在 \`costs\` 字段中明确列出（type: 'lifespan', value: 10）。

请生成下一轮剧情，并输出符合 DungeonRound Schema 的 JSON。
`;
    const aiRes = await object(systemPrompt, JSON.stringify(context), {
      schema: DungeonRoundSchema,
      schemaName: 'DungeonRound',
    });

    const roundData = aiRes.object;

    // Update State
    state.history.push({
      round: state.currentRound,
      scene: roundData.scene_description,
    });
    state.dangerScore = roundData.status_update.internal_danger_score;
    state.currentOptions = roundData.interaction.options;

    await redis.set(key, JSON.stringify(state), { ex: REDIS_TTL });

    return {
      state,
      roundData,
      isFinished: false,
    };
  }

  async settleDungeon(state: DungeonState) {
    // Call AI for final settlement
    const context = {
      history: state.history,
      final_danger_score: state.dangerScore,
    };

    const aiRes = await object(
      `请总结本次副本历练，并决定结算奖励。
      **要求**：
      1. 用中文输出。
      2. **重要**：如果历练中有具体的资源损耗或获取（如灵石、气血、寿元、修为等），请务必在 JSON 的 \`gains\`（获取）和 \`losses\`（损耗）数组中清晰列出。`,
      JSON.stringify(context),
      { schema: DungeonSettlementSchema, schemaName: 'DungeonSettlement' },
    );

    const settlement = aiRes.object;

    // Process Structured Settlement Changes
    if (settlement.settlement.gains) {
      await this.processResources(
        state.cultivatorId,
        settlement.settlement.gains,
        'gain',
      );
    }
    if (settlement.settlement.losses) {
      await this.processResources(
        state.cultivatorId,
        settlement.settlement.losses,
        'loss',
      );
    }

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

    return {
      isFinished: true,
      settlement,
    };
  }

  /**
   * Get current state (for page reload)
   */
  async getState(cultivatorId: string) {
    const key = getDungeonKey(cultivatorId);
    const data = await redis.get(key);
    if (!data) return null;
    return typeof data === 'string' ? JSON.parse(data) : data;
  }

  /**
   * Process resource changes (cost, gain, loss)
   * Interface definition for future implementation
   */
  private async processResources(
    cultivatorId: string,
    changes: z.infer<typeof ResourceChangeSchema>[],
    mode: 'cost' | 'gain' | 'loss',
  ) {
    // TODO: Implement actual resource modification logic
    // This will likely involve:
    // 1. Fetching current attributes/inventory
    // 2. Calculating new values
    // 3. Updating DB
    // 4. Logging the transaction
    console.log(
      `[ResourceSystem] Processing ${mode} for ${cultivatorId}:`,
      changes,
    );
  }
}

export const dungeonService = new DungeonService();
