import type { BuffInstanceState } from '@/engine/buff/types';
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

// 奖励蓝图 Schema - AI 只生成创意内容，数值由程序计算
export const RewardBlueprintSchema = z.object({
  type: z
    .enum([
      'spirit_stones',
      'material',
      'artifact',
      'consumable',
      'cultivation_exp',
      'comprehension_insight',
    ])
    .describe('奖励类型'),
  name: z.string().describe('物品名称（发挥创意，符合修仙世界观）'),
  description: z.string().describe('物品描述（50字以内）'),
  direction_tags: z
    .array(
      z.enum([
        'increase_vitality',
        'increase_spirit',
        'increase_wisdom',
        'increase_speed',
        'increase_willpower',
        'fire_affinity',
        'water_affinity',
        'wood_affinity',
        'metal_affinity',
        'earth_affinity',
        'thunder_affinity',
        'ice_affinity',
        'wind_affinity',
        'critical_boost',
        'defense_boost',
        'healing_boost',
        'lifespan_boost',
        'cultivation_boost',
      ]),
    )
    .describe('方向性标签（1-3个）'),
  quality_hint: z.enum(['lower', 'medium', 'upper']).describe('品质提示'),
});

// Settlement info from AI
export const DungeonSettlementSchema = z
  .object({
    ending_narrative: z.string().describe('结局叙述'),
    settlement: z.object({
      reward_tier: z.enum(['S', 'A', 'B', 'C', 'D']).describe('奖励等级'),
      reward_blueprints: z
        .array(RewardBlueprintSchema)
        .min(1)
        .max(5)
        .describe('奖励蓝图列表（根据评级1-5个）'),
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
    /** 持久 Buff 状态（使用新格式） */
    persistentBuffs: BuffInstanceState[];
    /** HP 损失百分比 */
    hpLossPercent: number;
    /** MP 损失百分比 */
    mpLossPercent: number;
  };
}

// === Internal State Management ===

export interface DungeonState {
  cultivatorId: string;
  mapNodeId: string;
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
  /** 持久 Buff 状态（使用新格式） */
  persistentBuffs: BuffInstanceState[];
}
