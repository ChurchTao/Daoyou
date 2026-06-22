import type {
  BattleInitConfigV5,
} from '@shared/engine/battle-v5/setup/types';
import type { ResourceOperation } from '@shared/engine/resource/types';
import {
  ENEMY_RACE_VALUES,
  REALM_STAGE_VALUES,
} from '@shared/types/constants';
import { z } from 'zod';

// === AI Interaction Schemas ===

const DUNGEON_QUALITY_VALUES = [
  '凡品',
  '灵品',
  '玄品',
  '真品',
  '地品',
  '天品',
  '仙品',
] as const;

const DungeonBattleMetadataSchema = z.object({
  race: z.enum(ENEMY_RACE_VALUES).describe('敌人种族'),
  realm_stage: z.enum(REALM_STAGE_VALUES).describe('敌人境界阶段'),
  enemy_name: z.string().optional().describe('敌人名称'),
  background: z.string().optional().describe('敌人背景'),
  description: z.string().optional().describe('敌人描述'),
  is_boss: z.boolean().optional().describe('是否BOSS'),
});

const DungeonCostMetadataSchema = z
  .record(z.string(), z.unknown())
  .and(DungeonBattleMetadataSchema.partial());

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
  value: z.number().min(0).refine(Number.isFinite, '数量或强度必须为有限数').describe('数量或强度'),
  name: z.string().optional().describe('材料名称（material 类型需要，如果未知可省略留给系统匹配）'),
  required_quality: z.enum(DUNGEON_QUALITY_VALUES).optional().describe('模糊要求时：最低品质'),
  required_type: z.enum(['herb', 'ore', 'monster', 'tcdb', 'aux', 'gongfa_manual', 'skill_manual']).optional().describe('模糊要求时：材料类型'),
  desc: z.string().optional().describe('描述信息'),
  metadata: DungeonCostMetadataSchema.optional().describe('元数据（battle 类型需要 race/realm_stage；其他代价可记录系统反馈）'),
}).superRefine((cost, ctx) => {
  if (
    cost.type === 'battle' &&
    (!cost.metadata || !cost.metadata.race || !cost.metadata.realm_stage)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['metadata'],
      message: 'battle 类型必须提供 metadata',
    });
  }
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
  value: z.number().min(0).max(10_000_000).refine(Number.isFinite, '数量必须为有限数').describe('数量'),
  name: z.string().optional().describe('物品名称'),
  desc: z.string().optional().describe('描述信息'),
  data: z.any().optional().describe('完整物品数据'),
});

// Option provided by AI
export const DungeonOptionSchema = z.object({
  id: z.number(),
  text: z.string().describe('选项文本'),
  risk_level: z.enum(['low', 'medium', 'high']).describe('风险等级'),
  requirement: z.string().optional().describe('选项要求'),
  potential_cost: z.string().optional().describe('潜在成本(文本描述)'),
  costs: z.array(DungeonCostSchema).optional().describe('成本(结构化成本)'),
  costPreview: z.array(DungeonCostSchema).optional().describe('服务端归一化后的预计代价'),
});

// 奖励蓝图 Schema - AI 只生成创意内容，数值由程序计算
export const RewardBlueprintSchema = z.object({
  // material 类型专用字段
  name: z.string().optional().describe('物品名称（material类型必填）'),
  description: z.string().optional().describe('物品描述（material类型必填）'),
  // 材料类型 - 仅 material 类型需要
  material_type: z
    .enum([
      'herb',
      'ore',
      'monster',
      'tcdb',
      'aux',
      'gongfa_manual',
      'skill_manual',
    ])
    .optional()
    .describe(
      '材料类型：herb=草药, ore=矿石, monster=妖兽材料, tcdb=天材地宝, aux=辅助, gongfa_manual=功法典籍, skill_manual=神通秘术',
    ),
  // 元素 - 仅 material 类型需要
  element: z
    .enum(['金', '木', '水', '火', '土', '风', '雷', '冰'])
    .optional()
    .describe('元素'),
  quality_hint: z.any().optional().describe('已废弃，请使用 reward_score'), // 保持向后兼容性或作为过渡
  reward_score: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe(
      '稀有评分 (0-100)：衡量该材料在当前副本境界下的珍稀程度。0=寻常路货, 50=正品标配, 100=天大造化/极品。',
    ),
});

export type RewardBlueprint = z.infer<typeof RewardBlueprintSchema>;

// Response from AI for each round
export const DungeonRoundSchema = z.object({
  scene_description: z.string().describe('场景描述'),
  interaction: z
    .object({
      options: z.array(DungeonOptionSchema).length(3).describe('交互选项'),
    })
    .describe('交互'),
  acquired_items: z.array(RewardBlueprintSchema).optional().describe('当前轮次探索或战斗获得的战利品（仅在合理情况下发放，勿滥发）'),
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
      reward_blueprints: z
        .array(RewardBlueprintSchema)
        .max(5)
        .describe('奖励蓝图列表（需包含之前获取的物品，空手撤离时可为空）'),
      performance_tags: z
        .array(z.string())
        .describe('评价标签（如：收获颇丰、险象环生、九死一生、空手而归）'),
    }),
  })
  .describe('结算信息');

export const PlayerInfoSchema = z.object({
  id: z.string().optional(),
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
  inventory_summary: z.string().optional(),
  resourceCaps: z.object({
    maxHp: z.number(),
    maxMp: z.number(),
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
  gained_items?: string[];
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
  battleInit: BattleInitConfigV5;
}

export type DungeonRunStatus =
  | 'EXPLORING'
  | 'GENERATING_NEXT'
  | 'WAITING_BATTLE'
  | 'IN_BATTLE'
  | 'LOOTING'
  | 'SETTLING'
  | 'FINISHED'
  | 'RECOVERABLE_ERROR';

export type DungeonRecoverAction =
  | 'retry'
  | 'retry_continue'
  | 'retry_settle'
  | 'safe_retreat'
  | 'force_quit';

export interface DungeonCostLedgerEntry {
  actionId: string;
  round: number;
  choiceId?: number;
  choiceText?: string;
  costs: DungeonOptionCost[];
  committedAt: string;
}

export interface DungeonGainLedgerEntry {
  source: 'round' | 'settlement' | 'system';
  round?: number;
  gains: ResourceOperation[];
  committedAt: string;
}

export interface DungeonPendingAction {
  actionId: string;
  choiceId?: number;
  choiceText?: string;
  round: number;
  status: 'pending' | 'committed' | 'failed';
  costs: DungeonOptionCost[];
  error?: string;
  createdAt: string;
}

// === Internal State Management ===

export interface DungeonState {
  runId?: string;
  cultivatorId: string;
  mapNodeId: string;
  playerInfo: PlayerInfo;
  theme: string;
  currentRound: number;
  maxRounds: number;
  history: History[];
  status: DungeonRunStatus;
  statusReason?: string;
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
  costPreview?: DungeonOptionCost[];
  costLedger?: DungeonCostLedgerEntry[];
  gainLedger?: DungeonGainLedgerEntry[];
  pendingAction?: DungeonPendingAction;
  recoverableActions?: DungeonRecoverAction[];
  realGains?: ResourceOperation[];
  archiveHistoryCommittedAt?: string;
  accumulatedRewards: RewardBlueprint[];
  /** 当前轮次获得的物品 */
  currentRoundItems?: RewardBlueprint[];
  accumulatedHpLoss: number;
  accumulatedMpLoss: number;
}
