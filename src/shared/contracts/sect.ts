import type {
  CultivatorSectState,
  SectBenefitSnapshot,
  SectConstructionProjectState,
  SectDefinition,
  SectDiscipleRank,
  SectFacilityState,
  SectPermissionState,
} from '@shared/engine/sect';
import { StandardSectRules } from '@shared/engine/sect';
import type { BattleRecord } from '@shared/types/battle';
import { z } from 'zod';
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
export const SectTaskActionRequestSchema = z.object({
  input: z.record(z.string(), z.unknown()).default({}),
});
export const SectShopPurchaseRequestSchema = z.object({
  itemId: z.string().min(1).max(64),
  quantity: z.number().int().positive().max(10).default(1),
});
export const SectDonationRequestSchema = z.object({
  demandId: z.string().min(1).max(64),
  itemId: z.string().uuid().optional(),
  quantity: z.number().int().positive().max(9999).default(1),
});
export const SectIdempotencyKeySchema = z.string().uuid();
export const SectMembersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

/** Opaque identifier supplied by the active sect's task catalog. */
export type SectTaskId = string;

export interface SectTaskViewData {
  id: string;
  definitionId: SectTaskId;
  kind: 'daily' | 'weekly' | 'promotion';
  state: 'offered' | 'active' | 'completed' | 'locked';
  periodKey: string;
  progress: { current: number; target: number };
  presentation: {
    title: string;
    description: string;
    contributionReward: number;
    rewardSummary: string;
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
  sections: {
    daily: SectTaskViewData[];
    weekly: SectTaskViewData[];
    promotion: SectTaskViewData[];
  };
}

export interface SectTaskActionOutcome {
  renderer: string;
  data: Record<string, unknown>;
}

export interface SectSweepSessionData {
  sessionId: string;
  seed: string;
  rulesVersion: number;
  tickRate: number;
  maxTicks: number;
  expiresAt: string;
}

export interface SectTaskActionData {
  task: SectTaskViewData;
  outcome: SectTaskActionOutcome;
}

export interface SectBattleOutcomeData {
  battle: BattleRecord;
  won: boolean;
  challengeTitle: string;
  rewardGranted: boolean;
}

export type SectTaskActionResponse =
  PlayerStateMutationResponse<SectTaskActionData>;

export interface SectShopItemData {
  id: string;
  name: string;
  description: string;
  requiredRank: SectDiscipleRank;
  price: number;
  stock: number;
  purchased: number;
  kind: string;
  rotating: boolean;
}

export interface SectShopData {
  weekKey: string;
  contribution: number;
  items: SectShopItemData[];
}

export interface SectRewardGrantData {
  kind: string;
  name: string;
  quantity: number;
  summary: string;
}

export interface SectDonationDemandData {
  id: string;
  name: string;
  description: string;
  kind: string;
  quantity: number;
  contribution: number;
  constructionPoints: number;
  minQuality?: string;
  pillFamily?: string;
}

export interface SectOverviewData {
  sect: CultivatorSectState;
  facilities: SectFacilityState[];
  project: SectConstructionProjectState | null;
  methodLevelCap: number;
  realmMethodLevelCap: number;
  stipend: {
    weekKey: string;
    claimed: boolean;
    spiritStones: number;
    rewards: SectRewardGrantData[];
  };
  nextRank: SectDiscipleRank | null;
  promotionMissing: string[];
  permissions: Record<string, SectPermissionState>;
  benefits: SectBenefitSnapshot;
}

export interface SectConstructionData {
  facilities: SectFacilityState[];
  project: SectConstructionProjectState | null;
  demands: SectDonationDemandData[];
  donatedContributionToday: number;
  dailyContributionCap: number;
  recentActivity: Array<{
    id: string;
    memberName: string;
    demandId: string;
    contribution: number;
    constructionPoints: number;
    createdAt: string;
  }>;
}

export interface SectMemberData {
  cultivatorId: string;
  name: string;
  realm: string;
  realmStage: string;
  discipleRank: SectDiscipleRank;
  office: CultivatorSectState['office'];
  joinedAt?: string;
}

export interface SectMembersData {
  items: SectMemberData[];
  page: number;
  pageSize: number;
  total: number;
}

export type SectCatalogEntry = {
  definition: SectDefinition;
  status?: CultivatorSectState['status'];
  experiencedAt?: string;
};

export type SectCatalogData = {
  playerRace: 'human';
  raceNarrative?: string;
  sects: SectCatalogEntry[];
  activeSectId?: string;
};

export type SectCurrentData = {
  playerRace: 'human';
  raceNarrative?: string;
  definition: SectDefinition | null;
  sect: CultivatorSectState | null;
  methodLevelCap: number;
  knownAbilityIds: string[];
  benefits?: SectBenefitSnapshot;
  overview?: SectOverviewData | null;
  commission?: never;
};

export type SectDetailData = {
  definition: SectDefinition;
  sect: CultivatorSectState | null;
  methodLevelCap: number;
  knownAbilityIds: string[];
};

export type SectExperienceResponse = PlayerStateMutationResponse<{
  sect: CultivatorSectState;
  battle: BattleRecord;
}>;
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
