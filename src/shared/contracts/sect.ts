import type {
  CultivatorSectState,
  SectConstructionProjectState,
  SectDefinition,
  SectDiscipleRank,
  SectFacilityState,
  SectPermission,
  SectPermissionState,
} from '@shared/engine/sect';
import type { BattleRecord } from '@shared/types/battle';
import { z } from 'zod';
import type { PlayerStateMutationResponse } from './player';

export const SectLevelTrainRequestSchema = z.object({
  targetLevel: z.number().int().positive(),
});
export const SectMethodTrainRequestSchema = SectLevelTrainRequestSchema;
export const SectMeridianLoadoutRequestSchema = z.object({
  nodeIds: z.array(z.string().min(1).max(64)).max(6),
});
export const SectAbilityLoadoutRequestSchema = z.object({
  abilityIds: z.array(z.string().min(1).max(64).nullable()).length(4),
});
export const SectTacticRequestSchema = z.object({
  tacticId: z.string().min(1).max(32),
});
export const SectDailyAcceptRequestSchema = z.object({
  taskId: z.string().min(1).max(64),
});
export const SectTaskSubmitRequestSchema = z.object({
  itemId: z.string().uuid(),
  quantity: z.number().int().positive().max(99).default(1),
});
export const SectSweepCompleteRequestSchema = z.object({
  sessionId: z.string().uuid(),
  rulesVersion: z.number().int().positive(),
  segments: z
    .array(
      z.object({
        ticks: z.number().int().min(1).max(1_200),
        direction: z.number().int().min(0).max(7).nullable(),
        sweeping: z.boolean(),
      }),
    )
    .min(1)
    .max(600),
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

export interface SectTaskOffer {
  id: SectTaskId;
  name: string;
  description: string;
  kind: 'daily' | 'weekly' | 'promotion';
  requiredRank: SectDiscipleRank;
  contributionReward: number;
  action:
    | 'sweep'
    | 'battle'
    | 'submit_pill'
    | 'submit_artifact'
    | 'submit_material'
    | 'progress';
  available: boolean;
  unavailableReason?: string;
}

export interface SectTaskRecordData {
  id: string;
  taskId: SectTaskId;
  kind: 'daily' | 'weekly' | 'promotion';
  periodKey: string;
  status: 'active' | 'completed';
  progress: number;
  target: number;
  completedAt?: string;
  payload?: Record<string, unknown>;
}

export interface SectTasksData {
  dateKey: string;
  weekKey: string;
  dailyOffers: SectTaskOffer[];
  dailyTask: SectTaskRecordData | null;
  weeklyTasks: SectTaskRecordData[];
  promotionTask: SectTaskRecordData | null;
}

export interface SectTaskChallengeData {
  task: SectTaskRecordData;
  battle: BattleRecord;
  won: boolean;
  challengeTitle: string;
  rewardGranted: boolean;
}

export interface SectSweepSessionData {
  sessionId: string;
  seed: string;
  rulesVersion: number;
  tickRate: number;
  maxTicks: number;
  expiresAt: string;
}

export type SectTaskChallengeResponse =
  PlayerStateMutationResponse<SectTaskChallengeData>;

export interface SectShopItemData {
  id: string;
  name: string;
  description: string;
  requiredRank: SectDiscipleRank;
  price: number;
  stock: number;
  purchased: number;
  kind: 'material' | 'pill';
  rotating: boolean;
}

export interface SectShopData {
  weekKey: string;
  contribution: number;
  items: SectShopItemData[];
}

export interface SectDonationDemandData {
  id: string;
  name: string;
  description: string;
  kind: 'spirit_stones' | 'material' | 'pill' | 'artifact';
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
    herbQuantity: number;
    bonusRewards: string[];
  };
  nextRank: SectDiscipleRank | null;
  promotionMissing: string[];
  permissions: Record<SectPermission, SectPermissionState>;
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
