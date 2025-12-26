import { REALM_STAGE_VALUES, REALM_VALUES } from '@/types/constants';
import { z } from 'zod';

// === AI Interaction Schemas ===

const COST_TYPES_VALUES = [
  'weak',
  'artifact_damage',
  'material_loss',
  'spirit_stones_loss',
  'hp_loss',
  'mp_loss',
  'exp_loss',
  'lifespan_loss',
  'battle',
] as const;

export const COST_TYPES = [
  { type: 'weak', name: '陷入虚弱(value影响虚弱百分比)' },
  { type: 'artifact_damage', name: '法宝损坏' },
  { type: 'material_loss', name: '材料损耗' },
  { type: 'spirit_stones_loss', name: '灵石损耗' },
  { type: 'hp_loss', name: '气血损耗' },
  { type: 'mp_loss', name: '灵力损耗' },
  { type: 'exp_loss', name: '修为损耗' },
  { type: 'lifespan_loss', name: '寿元损耗' },
  { type: 'battle', name: '遭遇战斗' },
] as const;

export const GAIN_TYPES_VALUES = [
  'artifact_gain',
  'material_gain',
  'consumable_gain',
  'spirit_stones_gain',
  'exp_gain',
  'lifespan_gain',
] as const;

export const GAIN_TYPES = [
  { type: 'artifact_gain', name: '法宝获得' },
  { type: 'material_gain', name: '材料获得' },
  { type: 'consumable_gain', name: '消耗品获得' },
  { type: 'spirit_stones_gain', name: '灵石获得' },
  { type: 'exp_gain', name: '修为获得' },
  { type: 'lifespan_gain', name: '寿元获得' },
] as const;

// Resource Types
export const ResourceTypeEnum = z.enum(COST_TYPES_VALUES);

// todo，区分获得的类型，目前和获得用的是同一个schema，强化战斗的可能性
export const ResourceLossSchema = z.object({
  type: ResourceTypeEnum,
  value: z.number(), // 战斗难度系数 (1-10)
  desc: z.string().optional(), // 敌人名称及特征
  metadata: z
    .object({
      enemy_name: z.string().optional().describe('敌人名称'),
      enemy_realm: z.enum(REALM_VALUES).optional().describe('敌人境界'), // e.g. "筑基"
      enemy_stage: z
        .enum(REALM_STAGE_VALUES)
        .optional()
        .describe('敌人境界阶段'), // e.g. "后期"
      is_boss: z.boolean().optional().describe('是否BOSS'),
    })
    .optional(),
});

export const ResourceGainSchema = z.object({
  type: z.enum(GAIN_TYPES_VALUES),
  value: z.number(), // Positive = gain, Negative = loss (for settlement), Positive = cost (for options usually)
  desc: z.string().optional(), // Description for UI e.g. "损耗寿元10年"
});

// Option provided by AI
export const DungeonOptionSchema = z.object({
  id: z.number(),
  text: z.string().describe('选项文本'), // Display text for the user
  content: z.string().optional().describe('选项内容'), // Internal note or expanded description
  risk_level: z.enum(['low', 'medium', 'high']).describe('风险等级'),
  requirement: z.string().optional().describe('选项要求'), // e.g. "Fire Spirit Root", "Sword Attribute"
  potential_cost: z.string().optional().describe('潜在成本(文本描述)'), // Legacy text description
  costs: z.array(ResourceLossSchema).optional().describe('成本(结构化成本)'), // Structured costs
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
export type DungeonOptionCost = z.infer<typeof ResourceLossSchema>;
export type DungeonResourceGain = z.infer<typeof ResourceGainSchema>;
export interface History {
  round: number;
  scene: string;
  choice?: string;
  outcome?: string; // Narrative outcome of the choice? (maybe next scene covers this)
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
  dungeonStateKey: string; // Redis key for the dungeon
  cultivatorId: string;
  enemyData: {
    name: string;
    realm: string;
    stage: string;
    level: string; // Specific realm + stage for stats
    difficulty: number;
  };
  playerSnapshot: {
    currentHp: number;
    currentMp: number;
    persistentStatuses: PersistentStatusSnapshot[]; // 持久状态快照
    environmentalStatuses: PersistentStatusSnapshot[]; // 环境状态快照
    hpLossPercent: number; // 虚拟HP损失百分比
    mpLossPercent: number; // 虚拟MP损失百分比
  };
}
// === Internal State Management ===

export interface DungeonState {
  cultivatorId: string;
  playerInfo: PlayerInfo;
  theme: string;
  currentRound: number;
  maxRounds: number;
  history: History[];
  status: 'EXPLORING' | 'IN_BATTLE' | 'FINISHED'; // Added status field
  activeBattleId?: string; // If in battle
  dangerScore: number;
  isFinished: boolean;
  currentOptions?: DungeonOption[]; // Store active options to validate choice and process costs
  settlement?: DungeonSettlement;
  location: {
    location: string;
    location_tags: string[];
    location_description: string;
  };
  summary_of_sacrifice?: DungeonOptionCost[];

  // 新增字段：状态系统集成
  accumulatedHpLoss: number; // 累积HP损失百分比 (0-1)
  accumulatedMpLoss: number; // 累积MP损失百分比 (0-1)
  persistentStatuses: PersistentStatusSnapshot[]; // 持久状态快照
  environmentalStatuses: PersistentStatusSnapshot[]; // 环境状态快照
}
