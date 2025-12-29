import { REALM_STAGE_VALUES, REALM_VALUES } from '@/types/constants';
import { z } from 'zod';

// === AI Interaction Schemas ===

/**
 * 副本代价 Schema - 直接使用资源引擎类型
 */
export const DungeonCostSchema = z.object({
  type: z.enum([
    // 资源类型
    'spirit_stones',
    'lifespan',
    'cultivation_exp',
    'comprehension_insight',
    'material',
    // 副本特有类型
    'hp_loss',
    'mp_loss',
    'weak',
    'battle',
    'artifact_damage',
  ]),
  value: z.number().describe('数量或强度'),
  name: z.string().optional().describe('材料名称（material 类型需要）'),
  desc: z.string().optional().describe('描述信息'),
  metadata: z
    .object({
      enemy_name: z.string().optional().describe('敌人名称'),
      enemy_realm: z.enum(REALM_VALUES).optional().describe('敌人境界'),
      enemy_stage: z
        .enum(REALM_STAGE_VALUES)
        .optional()
        .describe('敌人境界阶段'),
      is_boss: z.boolean().optional().describe('是否BOSS'),
    })
    .optional()
    .describe('元数据（battle 类型需要）'),
});

/**
 * 副本奖励 Schema
 */
export const DungeonGainSchema = z.object({
  type: z.enum([
    'spirit_stones',
    'lifespan',
    'cultivation_exp',
    'comprehension_insight',
    'material',
    'artifact',
    'consumable',
  ]),
  value: z.number().describe('数量'),
  name: z.string().optional().describe('物品名称'),
  desc: z.string().optional().describe('描述信息'),
  data: z.any().optional().describe('完整物品数据'),
});

// Option provided by AI
export const DungeonOptionSchema = z.object({
  id: z.number(),
  text: z.string().describe('选项文本'),
  content: z.string().optional().describe('选项内容'),
  risk_level: z.enum(['low', 'medium', 'high']).describe('风险等级'),
  requirement: z.string().optional().describe('选项要求'),
  potential_cost: z.string().optional().describe('潜在成本(文本描述)'),
  costs: z.array(DungeonCostSchema).optional().describe('成本(结构化成本)'),
});

// Response from AI for each round
export const DungeonRoundSchema = z.object({
  scene_description: z.string().describe('场景描述'),
  interaction: z
    .object({
      options: z.array(DungeonOptionSchema).describe('交互选项'),
    })
    .describe('交互'),
  status_update: z
    .object({
      is_final_round: z.boolean(),
      internal_danger_score: z.number(),
    })
    .describe('状态更新'),
});

// Settlement info from AI
export const DungeonSettlementSchema = z
  .object({
    ending_narrative: z.string().describe('结局叙述'),
    settlement: z.object({
      reward_tier: z.enum(['S', 'A', 'B', 'C', 'D']).describe('奖励等级'),
      potential_items: z
        .array(z.string())
        .describe('可能获得的物品（如：法宝、材料、消耗品等）'),
      performance_tags: z
        .array(z.string())
        .describe('评价标签（如：收获颇丰、险象环生、九死一生、空手而归）'),
    }),
  })
  .describe('结算信息');

export const PlayerInfoSchema = z.object({
  name: z.string(),
  realm: z.string(),
  gender: z.string(),
  age: z.number(),
  lifespan: z.number(),
  personality: z.string(),
  attributes: z.object({
    vitality: z.number(),
    spirit: z.number(),
    wisdom: z.number(),
    speed: z.number(),
    willpower: z.number(),
  }),
  spiritual_roots: z.array(z.string()),
  fates: z.array(z.string()),
  skills: z.array(z.string()),
  spirit_stones: z.number(),
  background: z.string(),
  inventory: z.object({
    artifacts: z.array(z.string()),
    materials: z.array(
      z.object({
        name: z.string(),
        count: z.number(),
      }),
    ),
  }),
});

export type PlayerInfo = z.infer<typeof PlayerInfoSchema>;
export type DungeonOption = z.infer<typeof DungeonOptionSchema>;
export type DungeonRound = z.infer<typeof DungeonRoundSchema>;
export type DungeonSettlement = z.infer<typeof DungeonSettlementSchema>;
export type DungeonOptionCost = z.infer<typeof DungeonCostSchema>;
export type DungeonResourceGain = z.infer<typeof DungeonGainSchema>;

export interface History {
  round: number;
  scene: string;
  choice?: string;
  outcome?: string;
}

// 持久状态快照类型（用于序列化到Redis和数据库）
export interface PersistentStatusSnapshot {
  statusKey: string;
  potency: number;
  createdAt: number;
  metadata: Record<string, unknown>;
}

export interface BattleSession {
  battleId: string;
  dungeonStateKey: string;
  cultivatorId: string;
  enemyData: {
    name: string;
    realm: string;
    stage: string;
    level: string;
    difficulty: number;
  };
  playerSnapshot: {
    persistentStatuses: PersistentStatusSnapshot[];
    environmentalStatuses: PersistentStatusSnapshot[];
    hpLossPercent: number;
    mpLossPercent: number;
  };
}

// === Internal State Management ===

export interface DungeonState {
  cultivatorId: string;
  mapNodeId: string; // 地图节点ID，用于获取境界门槛
  playerInfo: PlayerInfo;
  theme: string;
  currentRound: number;
  maxRounds: number;
  history: History[];
  status: 'EXPLORING' | 'IN_BATTLE' | 'FINISHED';
  activeBattleId?: string;
  dangerScore: number;
  isFinished: boolean;
  currentOptions?: DungeonOption[];
  settlement?: DungeonSettlement;
  location: {
    location: string;
    location_tags: string[];
    location_description: string;
  };
  summary_of_sacrifice?: DungeonOptionCost[];
  accumulatedHpLoss: number;
  accumulatedMpLoss: number;
  persistentStatuses: PersistentStatusSnapshot[];
  environmentalStatuses: PersistentStatusSnapshot[];
}
