import type { ResourceOperation } from '@shared/engine/resource/types';
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
      'weak',
      'battle',
      'artifact_damage',
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
  exploration_target: z
    .string()
    .max(30)
    .optional()
    .describe('该选项实际探索的地点或线索'),
  action_mode: z
    .string()
    .max(20)
    .optional()
    .describe('对探索目标采取的方式，如安抚、炼化或破除'),
  exploration_lead_id: z.string().optional(),
  exploration_is_revisit: z.boolean().optional(),
  requirement: z.string().optional().describe('选项要求'),
  potential_cost: z.string().optional().describe('潜在成本(文本描述)'),
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

const REWARD_PLACEHOLDER_NAME_PATTERN =
  /^(?:无|暂无|无奖励|未获得新物品|未知材料|未知物品|神秘物品)$/u;
const REWARD_TECHNICAL_NAME_PATTERN = /[A-Za-z_]/u;

const RewardBlueprintLlmSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .refine(
      (name) => !REWARD_PLACEHOLDER_NAME_PATTERN.test(name),
      '奖励名称不能使用占位词',
    )
    .refine((name) => /\p{Script=Han}/u.test(name), '奖励名称必须包含中文名称')
    .refine(
      (name) => !REWARD_TECHNICAL_NAME_PATTERN.test(name),
      '奖励名称不能使用英文或下划线技术标识',
    ),
  description: z.string().trim().min(8).max(500),
  material_type: z.enum([
    'herb',
    'ore',
    'monster',
    'tcdb',
    'aux',
    'gongfa_manual',
    'skill_manual',
  ]),
  element: z.enum(['金', '木', '水', '火', '土', '风', '雷', '冰']),
  reward_score: z.number().int().min(0).max(100),
});

// Response from AI for each round
export const DungeonRoundSchema = z.object({
  scene_description: z.string().describe('场景描述'),
  action_outcome: z
    .string()
    .optional()
    .describe('上一项抉择实际发生的结果；首轮可以为空'),
  interaction: z
    .object({
      options: z
        .array(DungeonOptionSchema)
        .max(3)
        .describe('两层探索各有3个选项，分支结果轮没有选项'),
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
  race: z.enum(ENEMY_RACE_VALUES),
  realm_stage: z.enum(REALM_STAGE_VALUES),
  enemy_name: z.string().optional(),
  background: z.string().optional(),
  description: z.string().optional(),
  is_boss: z.boolean().optional(),
});

const CONDITIONAL_COST_DESCRIPTION_PATTERN =
  /若失败|失败则|若成功|成功则|可能扣除|可能损失|有概率|视情况/u;
const DungeonCostDescriptionLlmSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .refine(
    (description) => !CONDITIONAL_COST_DESCRIPTION_PATTERN.test(description),
    'costs 是确定扣除的代价，描述不得包含成功或失败条件',
  )
  .optional();
const DungeonPositiveIntegerCostValueSchema = z
  .number()
  .int()
  .positive()
  .refine(Number.isFinite, '数量或强度必须为有限数');
const DungeonPercentCostValueSchema = z
  .number()
  .positive()
  .max(1)
  .refine(Number.isFinite, '百分比必须为 0 到 1 之间的有限数');

const DungeonCostLlmSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.enum([
      'spirit_stones',
      'lifespan',
      'cultivation_exp',
      'comprehension_insight',
    ]),
    value: DungeonPositiveIntegerCostValueSchema,
    desc: DungeonCostDescriptionLlmSchema,
  }),
  z.object({
    type: z.enum(['hp_loss', 'mp_loss']),
    value: DungeonPercentCostValueSchema,
    desc: DungeonCostDescriptionLlmSchema,
  }),
  z.object({
    type: z.enum(['weak', 'artifact_damage']),
    value: DungeonPositiveIntegerCostValueSchema,
    desc: DungeonCostDescriptionLlmSchema,
  }),
  z.object({
    type: z.literal('material'),
    value: DungeonPositiveIntegerCostValueSchema,
    required_quality: z.enum(DUNGEON_QUALITY_VALUES),
    required_type: z.enum([
      'herb',
      'ore',
      'monster',
      'tcdb',
      'aux',
      'gongfa_manual',
      'skill_manual',
    ]),
    desc: DungeonCostDescriptionLlmSchema,
  }),
  z.object({
    type: z.literal('battle'),
    value: DungeonPositiveIntegerCostValueSchema,
    desc: DungeonCostDescriptionLlmSchema,
    metadata: DungeonBattleMetadataLlmSchema,
  }),
]);

const DungeonOptionLlmSchema = z.object({
  text: z.string(),
  risk_level: z.enum(['low', 'medium', 'high']),
  exploration_target: z.string().trim().min(1).max(30),
  action_mode: z.string().trim().min(1).max(20),
  requirement: z.string().optional(),
  potential_cost: z.string().optional(),
  costs: z.array(DungeonCostLlmSchema).optional(),
});

export function createDungeonRoundLlmSchema(maxRewardCount: number) {
  const eventRewardCount = maxRewardCount > 0 ? 1 : 0;
  return z.object({
    scene_description: z.string(),
    action_outcome: z.string().max(500),
    options: z.array(DungeonOptionLlmSchema).max(3),
    acquired_items: z.array(RewardBlueprintLlmSchema).length(eventRewardCount),
    internal_danger_score: z.number().int().min(0).max(100),
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
        .max(5)
        .describe('奖励蓝图列表（需包含之前获取的物品，空手撤离时可为空）'),
      performance_tags: z
        .array(z.string())
        .max(10)
        .describe('评价标签（如：收获颇丰、险象环生、九死一生、空手而归）'),
    }),
  })
  .describe('结算信息');

const SettlementPerformanceTagLlmSchema = z.string().trim().min(1).max(24);

export function createDungeonSettlementLlmSchema(maxRewardCount: number) {
  return z.object({
    ending_narrative: z.string(),
    reward_tier: z.enum(['S', 'A', 'B', 'C', 'D']),
    reward_blueprints: z
      .array(RewardBlueprintLlmSchema)
      .max(Math.max(0, maxRewardCount)),
    performance_tags: z.array(SettlementPerformanceTagLlmSchema).max(4),
  });
}

export const DungeonSettlementGeneratedSchema = z.object({
  ending_narrative: z.string(),
  settlement: z.object({
    reward_tier: z.enum(['S', 'A', 'B', 'C', 'D']),
    reward_blueprints: z.array(RewardBlueprintLlmSchema).max(20),
    performance_tags: z.array(SettlementPerformanceTagLlmSchema).max(4),
  }),
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
  actual_costs?: string[];
  gained_items?: string[];
}

export interface DungeonExplorationRecord {
  id: string;
  target: string;
  sourceRound: number;
  completedRound: number;
  isBranchChoice: boolean;
  createdCheckpointId?: string;
}

export type DungeonBranchStage = 'root' | 'branch' | 'resolution' | 'explore';

export interface DungeonBranchCheckpoint {
  id: string;
  sourceRound: number;
  sourceTarget: string;
  options: DungeonOption[];
}

export interface DungeonBranchFlowState {
  stage: DungeonBranchStage;
  rootOptions: DungeonOption[];
  completedRootLeadIds: string[];
  activeRootOption?: DungeonOption;
  pendingBranches?: DungeonBranchCheckpoint[];
  mode?: 'adaptive';
  /** 旧版运行中的副本无法还原首轮完整分支，只安全收尾当前分支。 */
  legacy?: boolean;
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
  exploration?: DungeonExplorationRecord;
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
  branchFlow?: DungeonBranchFlowState;
  exploredExplorationLeads?: DungeonExplorationRecord[];
  /** 已在本次秘境中确认击败的敌人；后续场景不得将其重新作为存活敌人。 */
  defeatedEnemyNames?: string[];
  settlement?: DungeonSettlement;
  /** 本次探索的终止方式；用于结算失败重试时保持原判定。 */
  settlementEndDisposition?:
    'completed' | 'retreated_after_battle' | 'abandoned_before_battle';
  /** 是否因战斗失败而结束；服务端据此丢弃本回奖励并禁止追加战利品。 */
  battleDefeated?: boolean;
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
  /** 当前轮次暂存的物品；若本轮战斗失败则从累计奖励中撤销。 */
  currentRoundItems?: RewardBlueprint[];
  accumulatedHpLoss: number;
  accumulatedMpLoss: number;
}

export interface DungeonRoundLlmContext {
  round: number;
  maxRounds: number;
  dangerScore: number;
  phase: string;
  realmGap: number;
  map: {
    name: string;
    realmRequirement: string;
    difficultyTier: string;
    difficultyLabel: string;
    enemyDifficulty: number;
    allowedEnemyRealmStages: string[];
    tags: string[];
    descriptionSummary: string;
  };
  player: {
    name: string;
    realm: string;
    age: number;
    lifespan: number;
    coreTraits: string[];
    rootsSummary: string[];
    fatesSummary: string[];
    techniqueNames: string[];
    combatStyleSummary: string;
    resources?: {
      hpPercent: number;
      mpPercent: number;
    };
  };
  history: Array<{
    round: number;
    sceneSummary: string;
    choice?: string;
    outcomeSummary?: string;
    gainedItemNames?: string[];
  }>;
  lastAction?: {
    target: string;
    choice: string;
    sourceRound: number;
  };
  battleAftermath?: string;
  defeatedEnemyNames: string[];
  accumulatedRewardNames: string[];
  flow: {
    stage: DungeonBranchStage;
    requiredOptionCount: 'up_to_three';
    eventIndex: number;
    totalEvents: number;
    pendingBranchCount: number;
    activeRootTarget?: string;
  };
}

export interface DungeonSettlementLlmContext {
  map: {
    name: string;
    realmRequirement: string;
  };
  player: {
    name: string;
    realm: string;
  };
  finalAction?: {
    target: string;
    choice: string;
    sourceRound: number;
  };
  journeySummary: string[];
  dangerScore: number;
  sacrificeSummary: Array<{
    type: DungeonOptionCost['type'];
    count: number;
    totalValue: number;
    sample?: string;
  }>;
  accumulatedRewards: Array<{
    name?: string;
    description?: string;
    material_type?: RewardBlueprint['material_type'];
    element?: RewardBlueprint['element'];
    reward_score?: number;
  }>;
  rewardBlueprintLimit: number;
  accumulatedRewardCount: number;
  remainingExtraRewardSlots: number;
  endDisposition:
    'completed' | 'retreated_after_battle' | 'abandoned_before_battle';
}
