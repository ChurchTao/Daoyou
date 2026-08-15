import type {
  CultivatorSectState,
  SectBattleTargetSummary,
  SectDefinition,
  SectDeliveryRequirement,
  SectDeliveryViolation,
  SectDiscipleRank,
  SectFacilityState,
  SectPermissionState,
  SectSubmissionItemFacts,
  SectTaskDialoguePresentation,
  SectTaskRewardSnapshot,
} from '@shared/engine/sect';
import { StandardSectRules } from '@shared/engine/sect';
import type { BattleRecordV3 } from '@shared/types/battle';
import type { CultivationProgress } from '@shared/types/cultivator';
import { z } from 'zod';
import { MAX_PLAYER_ITEM_QUANTITY } from '@shared/config/itemQuantity';
import type { PlayerStateMutationResponse } from './player';

export const SectLevelTrainRequestSchema = z.object({
  targetLevel: z.number().int().positive(),
});
export const SectMethodTrainRequestSchema = SectLevelTrainRequestSchema;
export const SectMeridianLoadoutRequestSchema = z.object({
  nodeIds: z
    .array(z.string().min(1).max(64))
    .max(StandardSectRules.meridianNodeTransportLimit),
});
export const SectAbilityLoadoutRequestSchema = z.object({
  abilityIds: z
    .array(z.string().min(1).max(64).nullable())
    .length(StandardSectRules.activeAbilitySlotCount),
});
export const SectTacticRequestSchema = z.object({
  tacticId: z.string().min(1).max(32),
});
export const SectTaskActionRequestSchema = z
  .object({
    input: z.record(z.string(), z.json()).default({}),
  })
  .strict();
export const SectTaskSubmissionInputSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            itemId: z.string().uuid(),
            quantity: z
              .number()
              .int()
              .positive()
              .max(MAX_PLAYER_ITEM_QUANTITY),
          })
          .strict(),
      )
      .min(1)
      .max(99)
      .refine(
        (items) =>
          new Set(items.map((item) => item.itemId)).size === items.length,
        '同一份道具不能重复选择',
      ),
  })
  .strict();
export type SectTaskSubmissionInput = z.infer<
  typeof SectTaskSubmissionInputSchema
>;
export const SectSubmissionCandidatesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(30),
  eligible: z.enum(['all', 'yes', 'no']).default('all'),
});
export const SectDonationRequestSchema = z
  .object({
    facilityKey: z.string().min(1).max(32),
    spiritStones: z.union([
      z.literal(10_000),
      z.literal(50_000),
      z.literal(100_000),
      z.literal(200_000),
      z.literal(400_000),
    ]),
  })
  .strict();
export const SectIdempotencyKeySchema = z.string().uuid();
export const SectMembersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const SectMemberActivityStateSchema = z.enum([
  'online',
  'active_today',
  'active_7d',
  'inactive',
]);

export type SectMemberActivityState = z.infer<
  typeof SectMemberActivityStateSchema
>;

export const SectContributionRankingEntrySchema = z
  .object({
    rank: z.number().int().positive(),
    cultivatorId: z.string().uuid(),
    name: z.string(),
    discipleRank: z.enum(['registered', 'outer', 'inner', 'true']),
    office: z.enum(['none', 'steward', 'protector', 'elder']),
    contribution: z.number().int().nonnegative(),
  })
  .strict();

export const SectContributionRankingDataSchema = z
  .object({
    metric: z.literal('current_balance'),
    generatedAt: z.string(),
    entries: z.array(SectContributionRankingEntrySchema).max(20),
    currentMember: SectContributionRankingEntrySchema,
  })
  .strict();

export type SectContributionRankingEntry = z.infer<
  typeof SectContributionRankingEntrySchema
>;
export type SectContributionRankingData = z.infer<
  typeof SectContributionRankingDataSchema
>;

/** Opaque identifier supplied by the active sect's task catalog. */
export type SectTaskId = string;

export interface SectTaskViewData {
  id: string;
  definitionId: SectTaskId;
  kind: 'daily' | 'weekly' | 'promotion';
  state: 'offered' | 'active' | 'claimable' | 'claimed' | 'locked';
  periodKey: string;
  progress: { current: number; target: number };
  difficulty?: 'easy' | 'normal' | 'hard' | 'elite';
  requirement?: SectDeliveryRequirement;
  reward?: SectTaskRewardSnapshot;
  battleTarget?: SectBattleTargetSummary;
  presentation: {
    title: string;
    description: string;
    dialogue: SectTaskDialoguePresentation;
  };
  actions: Array<{
    key: string;
    renderer: string;
    label: string;
    enabled: boolean;
    disabledReason?: string;
    parameters?: Record<string, unknown>;
  }>;
}

export interface SectTasksData {
  dateKey: string;
  weekKey: string;
  items: SectTaskViewData[];
}

export interface SectTaskActionOutcome {
  renderer: string;
  data: Record<string, unknown>;
}

export interface SectSweepSessionData {
  sessionId: string;
  seed: string;
  rulesVersion: number;
  expiresAt: string;
}

export interface SectMiningSessionData {
  sessionId: string;
  seed: string;
  rulesVersion: number;
  startedAt: string;
  expiresAt: string;
  durationMs: number;
}

export interface SectMiningResultData {
  score: number;
  maxScore: number;
  ratio: number;
  tier?: 'D' | 'C' | 'B' | 'A' | 'S';
  qualified: boolean;
  collected: number;
  destroyed: number;
  clearedAll: boolean;
  ores: Array<{
    kind: 'spirit_crystal' | 'copper_ore' | 'dark_iron' | 'earth_essence';
    count: number;
    score: number;
  }>;
  rewardSummary?: string[];
}

export interface SectTaskActionData {
  primaryTask: SectTaskViewData;
  changedTasks: SectTaskViewData[];
  outcome: SectTaskActionOutcome;
  settlement: SectTaskSettlementData;
}

export interface SectTaskSettlementData {
  contribution?: number;
  spiritStones?: number;
  cultivationProgress?: CultivationProgress;
  inventory: Array<{
    topic:
      'inventory.artifacts' | 'inventory.materials' | 'inventory.consumables';
    itemId: string;
    remainingQuantity: number;
    removed: boolean;
  }>;
}

export interface SectBattleOutcomeData {
  battle: BattleRecordV3;
  won: boolean;
  challengeTitle: string;
  taskFulfilled: boolean;
}

export interface SectTaskRewardReceipt {
  taskRecordId: string;
  claimedAt: string;
  rewards: {
    contribution: number;
    cultivationExp: number;
    spiritStones: number;
  };
  lines: string[];
}

export interface SectSubmissionCandidateData {
  item: SectSubmissionItemFacts;
  eligible: boolean;
  violations: SectDeliveryViolation[];
}

export interface SectSubmissionCandidatesData {
  requirement: SectDeliveryRequirement;
  items: SectSubmissionCandidateData[];
  page: number;
  pageSize: number;
  total: number;
}

export type SectTaskActionResponse =
  PlayerStateMutationResponse<SectTaskActionData>;

export type {
  SectShopData,
  SectShopItemData,
} from './sectShop';

export interface SectInfrastructureData {
  facilities: SectFacilityState[];
}

export interface SectContextData {
  sectId: string;
  membershipId: string;
  status: CultivatorSectState['status'];
  joinedAt?: string;
  discipleRank: SectDiscipleRank;
  contribution: number;
  office: CultivatorSectState['office'];
  promotedAt?: string;
  permissions: Record<string, SectPermissionState>;
  configVersion: number;
}

export interface SectProgressionData {
  activePathId?: CultivatorSectState['activePathId'];
  methods: CultivatorSectState['methods'];
  paths: CultivatorSectState['paths'];
  abilityLoadout: CultivatorSectState['abilityLoadout'];
}

export interface SectStipendData {
  weekKey: string;
  claimed: boolean;
  spiritStones: number;
}

export const SectStipendDataSchema: z.ZodType<SectStipendData> = z
  .object({
    weekKey: z.string(),
    claimed: z.boolean(),
    spiritStones: z.number(),
  })
  .strict();

export interface SectPromotionEvaluationData {
  nextRank: SectDiscipleRank | null;
  missing: string[];
  allowed: boolean;
}

export const SectPromotionEvaluationDataSchema: z.ZodType<SectPromotionEvaluationData> =
  z
    .object({
      nextRank: z.enum(['registered', 'outer', 'inner', 'true']).nullable(),
      missing: z.array(z.string()),
      allowed: z.boolean(),
    })
    .strict();

export interface SectConstructionMemberData {
  dateKey: string;
  constructedToday: boolean;
  facilityKey?: string;
  spiritStones?: number;
  constructionPoints?: number;
  contribution?: number;
}

export interface SectMemberData {
  cultivatorId: string;
  name: string;
  realm: string;
  realmStage: string;
  discipleRank: SectDiscipleRank;
  office: CultivatorSectState['office'];
  joinedAt?: string;
  activityState: SectMemberActivityState;
}

export interface SectMembersData {
  items: SectMemberData[];
  page: number;
  pageSize: number;
  total: number;
}

export type SectCatalogEntry = {
  id: string;
  name: string;
  description: string;
};

export type SectCatalogData = {
  sects: SectCatalogEntry[];
};

export type SectDetailData = {
  definition: SectDefinition;
  sect: CultivatorSectState | null;
  methodLevelCap: number;
  knownAbilityIds: string[];
};

export type SectMutationResponse = PlayerStateMutationResponse<{
  sect: CultivatorSectState;
}>;
export type SectTrainResponse = PlayerStateMutationResponse<{
  sect: CultivatorSectState;
  methodId?: string;
  pathId?: string;
  layerId?: string;
  targetLevel?: number;
  cost: {
    cultivationExp: number;
    comprehensionInsight: number;
    spiritStones: number;
  };
}>;
