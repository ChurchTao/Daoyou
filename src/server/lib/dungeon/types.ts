import type { ResourceOperation } from '@shared/engine/resource/types';
import { DUNGEON_COST_RANK_VALUES } from '@shared/lib/dungeon/costPolicy';
import type { DungeonEndDisposition } from '@shared/lib/dungeon/settlementPolicy';
import { ENEMY_RACE_VALUES, REALM_STAGE_VALUES } from '@shared/types/constants';
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

const ShortTextSchema = z.string().trim().min(2).max(60);

const NarrativeSchema = z.string().trim().min(12).max(240);

const RoundNarrativeSchema = z.string().trim().min(300).max(900);

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
export const DungeonCostSchema = z
  .object({
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
      'battle',
    ]),
    value: z
      .number()
      .min(0)
      .refine(Number.isFinite, '数量或强度必须为有限数')
      .describe('数量或强度'),
    name: z
      .string()
      .optional()
      .describe('材料名称（material 类型需要，如果未知可省略留给系统匹配）'),
    required_quality: z
      .enum(DUNGEON_QUALITY_VALUES)
      .optional()
      .describe('模糊要求时：最低品质'),
    required_type: z
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
      .describe('模糊要求时：材料类型'),
    desc: z.string().optional().describe('描述信息'),
    metadata: DungeonCostMetadataSchema.optional().describe(
      '元数据（battle 类型需要 race/realm_stage；其他代价可记录系统反馈）',
    ),
  })
  .superRefine((cost, ctx) => {
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
  value: z
    .number()
    .min(0)
    .max(10_000_000)
    .refine(Number.isFinite, '数量必须为有限数')
    .describe('数量'),
  name: z.string().optional().describe('物品名称'),
  desc: z.string().optional().describe('描述信息'),
  data: z.any().optional().describe('完整物品数据'),
});

// Option provided by AI
export const DungeonOptionSchema = z.object({
  id: z.number(),
  text: z.string().describe('选项文本'),
  risk_level: z.enum(['low', 'medium', 'high']).describe('风险等级'),
  costs: z.array(DungeonCostSchema).optional().describe('成本(结构化成本)'),
  costPreview: z
    .array(DungeonCostSchema)
    .optional()
    .describe('服务端归一化后的预计代价'),
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

const RewardBlueprintLlmSchema = z.object({
  name: ShortTextSchema.max(24).describe('面向玩家的材料名称'),
  description: NarrativeSchema.max(100).describe('材料外观、性质与用途描述'),
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
    .describe('材料内部分类枚举'),
  element: z
    .enum(['金', '木', '水', '火', '土', '风', '雷', '冰'])
    .optional()
    .describe('材料属性明确时填写的可选元素枚举'),
  reward_score: z
    .number()
    .min(0)
    .max(100)
    .describe('材料本身的稀有度评分，不是副本表现评分'),
});

// Response from AI for each round
export const DungeonRoundSchema = z.object({
  scene_description: z.string().describe('场景描述'),
  interaction: z
    .object({
      options: z.array(DungeonOptionSchema).length(3).describe('交互选项'),
    })
    .describe('交互'),
  acquired_items: z
    .array(RewardBlueprintSchema)
    .max(10)
    .optional()
    .describe('当前轮次探索或战斗获得的战利品（仅在合理情况下发放，勿滥发）'),
  status_update: z
    .object({
      is_final_round: z.boolean(),
      internal_danger_score: z.number().min(0).max(100),
    })
    .describe('状态更新'),
});

const DungeonBattleMetadataLlmSchema = z.object({
  race: z.enum(ENEMY_RACE_VALUES).describe('敌人种族内部枚举'),
  realm_stage: z
    .enum(REALM_STAGE_VALUES)
    .describe('敌人境界阶段，不包含炼气、筑基等境界名称'),
  enemy_name: ShortTextSchema.max(20).describe('面向玩家的敌人名称'),
  background: NarrativeSchema.max(80)
    .optional()
    .describe('可选的敌人来历，用于生成战斗叙事'),
  description: NarrativeSchema.max(80)
    .optional()
    .describe('可选的敌人外观与战斗特点'),
  is_boss: z.boolean().optional().describe('只有副本首领才为 true'),
});

const DungeonResourceCostLlmSchema = z.object({
  type: z
    .enum([
      'spirit_stones',
      'lifespan',
      'cultivation_exp',
      'comprehension_insight',
    ])
    .describe('资源代价的内部枚举'),
  rank: z
    .enum(DUNGEON_COST_RANK_VALUES)
    .describe('代价强度，程序将据此计算实际数量'),
});

const DungeonMaterialCostLlmSchema = z.object({
  required_type: z
    .enum([
      'herb',
      'ore',
      'monster',
      'tcdb',
      'aux',
      'gongfa_manual',
      'skill_manual',
    ])
    .describe('被消耗材料的类别'),
  rank: z
    .enum(DUNGEON_COST_RANK_VALUES)
    .describe('代价强度，程序将据此计算材料品质与数量'),
});

const DungeonStatLossLlmSchema = z.object({
  type: z.enum(['hp_loss', 'mp_loss']).describe('气血或法力损失'),
  rank: z
    .enum(DUNGEON_COST_RANK_VALUES)
    .describe('代价强度，程序将据此计算损失比例'),
});

const DungeonCostsLlmSchema = z
  .object({
    resources: z
      .array(DungeonResourceCostLlmSchema)
      .max(2)
      .describe('灵石、寿元、修为或悟性代价；没有则为空数组'),
    materials: z
      .array(DungeonMaterialCostLlmSchema)
      .max(2)
      .describe('材料代价；没有则为空数组'),
    stat_losses: z
      .array(DungeonStatLossLlmSchema)
      .max(2)
      .describe('气血或法力损失；没有则为空数组'),
    battles: z
      .array(DungeonBattleMetadataLlmSchema)
      .max(1)
      .describe('必然触发的单场战斗；没有则为空数组'),
  })
  .superRefine((costs, ctx) => {
    const total =
      costs.resources.length +
      costs.materials.length +
      costs.stat_losses.length +
      costs.battles.length;
    if (total > 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '每个选项最多包含两项代价',
      });
    }
  });

const DungeonOptionLlmSchema = z.object({
  text: ShortTextSchema.describe('面向玩家的行动、手段与目的'),
  costs: DungeonCostsLlmSchema.describe(
    '选择该行动后真实触发的分类代价；四个数组都必须输出',
  ),
});

export function createDungeonRoundLlmSchema(maxRewardCount: number) {
  return z
    .object({
      scene_description:
        RoundNarrativeSchema.describe('承接前情并推进到本轮抉择点的剧情正文'),
      options: z
        .array(DungeonOptionLlmSchema)
        .length(3)
        .describe('依次为低风险、高风险、中风险的三个行动'),
      acquired_items: z
        .array(RewardBlueprintLlmSchema)
        .max(Math.max(0, maxRewardCount))
        .optional(),
      internal_danger_score: z
        .number()
        .int()
        .min(0)
        .max(100)
        .describe('进入本轮剧情后的累计危险值'),
    })
    .superRefine((round, ctx) => {
      const highRiskCosts = round.options[1]?.costs;
      const highRiskCostCount = highRiskCosts
        ? highRiskCosts.resources.length +
          highRiskCosts.materials.length +
          highRiskCosts.stat_losses.length +
          highRiskCosts.battles.length
        : 0;
      if (highRiskCostCount === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['options', 1, 'costs'],
          message: '高风险选项必须包含至少一项真实代价',
        });
      }
    });
}

// Settlement info from AI
export const DungeonSettlementSchema = z
  .object({
    ending_narrative: z.string().describe('结局叙述'),
    settlement: z.object({
      reward_tier: z.enum(['S', 'A', 'B', 'C', 'D']).describe('奖励等级'),
      reward_blueprints: z
        .array(RewardBlueprintSchema)
        .max(6)
        .describe('奖励蓝图列表（需包含之前获取的物品，空手撤离时可为空）'),
      performance_tags: z
        .array(z.string())
        .max(10)
        .describe('评价标签（如：收获颇丰、险象环生、九死一生、空手而归）'),
    }),
  })
  .describe('结算信息');

export function createDungeonSettlementLlmSchema(args: {
  remainingRewardSlots: number;
  endDisposition: DungeonEndDisposition;
}) {
  const rewardTierSchema =
    args.endDisposition === 'abandoned_before_battle'
      ? z.literal('D')
      : args.endDisposition === 'retreated_after_battle'
        ? z.enum(['C', 'D'])
        : z.enum(['S', 'A', 'B', 'C', 'D']);

  return z.object({
    ending_narrative:
      NarrativeSchema.describe('只收束已发生历程的面向玩家结局叙事'),
    reward_tier: rewardTierSchema.describe('本次副本的内部评级枚举'),
    reward_blueprints: z
      .array(RewardBlueprintLlmSchema)
      .max(Math.max(0, args.remainingRewardSlots))
      .describe('仅包含结算阶段新增且有剧情依据的材料'),
  });
}

export const DungeonSettlementGeneratedSchema = z.object({
  ending_narrative: NarrativeSchema,
  reward_tier: z.enum(['S', 'A', 'B', 'C', 'D']),
  reward_blueprints: z.array(RewardBlueprintLlmSchema).max(6),
});

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
    strength: z.number(),
    spirit: z.number(),
    endurance: z.number(),
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
  'retry' | 'retry_continue' | 'retry_settle' | 'safe_retreat' | 'force_quit';

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

export interface DungeonRoundLlmContext {
  progress: {
    round: number;
    totalRounds: number;
    dangerScore: number;
    phase: string;
  };
  setting: {
    name: string;
    realmRequirement: string;
    difficulty: string;
    realmGap: number;
    allowedEnemyRealmStages: string[];
    tags: string[];
    descriptionSummary: string;
  };
  player: {
    name: string;
    realm: string;
    age: number;
    lifespan: number;
    traits: string[];
    combatStyle: string;
  };
  recentHistory: Array<{
    round: number;
    sceneSummary: string;
    choice?: string;
    outcomeSummary?: string;
    gainedItemNames?: string[];
  }>;
  pendingChoice?: {
    text: string;
    costs: Array<{
      type: DungeonOptionCost['type'];
      value: number;
      requiredQuality?: string;
      requiredType?: string;
    }>;
  };
  battleAftermath?: string;
  securedRewardNames: string[];
}

export interface DungeonSettlementLlmContext {
  setting: {
    name: string;
    realmRequirement: string;
  };
  player: {
    name: string;
    realm: string;
  };
  journey: string[];
  dangerScore: number;
  committedCosts: Array<{
    type: DungeonOptionCost['type'];
    count: number;
    totalValue: number;
    sample?: string;
  }>;
  securedRewards: Array<{
    name?: string;
    material_type?: RewardBlueprint['material_type'];
    reward_score?: number;
  }>;
  remainingExtraRewardSlots: number;
  endDisposition:
    'completed' | 'retreated_after_battle' | 'abandoned_before_battle';
}
