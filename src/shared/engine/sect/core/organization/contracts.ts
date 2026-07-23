import type { PillSpec } from '@shared/types/consumable';
import type { Quality } from '@shared/types/constants';
import type { Cultivator } from '@shared/types/cultivator';
import type {
  SectDiscipleRank,
  SectRankRequirement,
} from '../domain/organization';

export type SectCapabilityKey = string;
/** @deprecated Use SectCapabilityKey. */
export type SectPermission = SectCapabilityKey;

export interface SectPermissionState {
  granted: boolean;
  requiredRank?: SectDiscipleRank;
  reason?: string;
  reasonCode?: 'rank_locked' | 'version_locked' | 'content_locked';
}

export interface SectCapabilityPolicy {
  keys(): readonly SectCapabilityKey[];
  minimumRank(permission: SectCapabilityKey): SectDiscipleRank | undefined;
  allows(rank: SectDiscipleRank, permission: SectCapabilityKey): boolean;
  snapshot(rank: SectDiscipleRank): Record<SectCapabilityKey, SectPermissionState>;
}

/** Opaque content identifier owned by each concrete sect module. */
export type SectOrganizationTaskId = string;

export type SectTaskExecutorKey = string;

export const SECT_CRAFT_CONTEXTS = {
  alchemy: 'sect.craft.alchemy',
  refinery: 'sect.craft.refinery',
} as const;
export type SectCraftContextKey =
  (typeof SECT_CRAFT_CONTEXTS)[keyof typeof SECT_CRAFT_CONTEXTS];

export interface SectTaskPresentationDefinition {
  title: string;
  description: string;
  rewardSummary: string;
  actionLabel: string;
}

export interface SectTaskAvailabilityContext {
  dateKey: string;
  weekKey: string;
}

export interface SectTaskAvailabilityDecision {
  executorKey: SectTaskExecutorKey;
  parameters?: Record<string, unknown>;
}

export interface SectTaskAvailabilityPolicy {
  /** Every executor this policy may resolve to; used for fail-fast plugin validation. */
  readonly executorKeys: readonly SectTaskExecutorKey[];
  resolve(context: SectTaskAvailabilityContext): SectTaskAvailabilityDecision;
}

export interface SectTaskCompletionRule {
  /** Open strategy key implemented by an application plugin. */
  strategy: string;
  input?: Record<string, unknown>;
}

export interface SectTaskProgressDefinition {
  /** Open progress strategy key implemented by an application plugin. */
  strategy: string;
  /** Signal emitted by completion settlement rules. */
  source: string;
}

export interface SectTaskDefinition {
  id: SectOrganizationTaskId;
  kind: 'daily' | 'weekly' | 'promotion';
  requiredCapability: SectCapabilityKey;
  contributionReward: number;
  executorKey: SectTaskExecutorKey;
  presentation: SectTaskPresentationDefinition;
  availability?: SectTaskAvailabilityPolicy;
  completion: readonly SectTaskCompletionRule[];
  completionTags?: readonly string[];
  progress?: SectTaskProgressDefinition;
  target: number;
}

export interface SectTaskCatalog {
  listDaily(): readonly SectTaskDefinition[];
  listWeekly(): readonly SectTaskDefinition[];
  listPromotion(): readonly SectTaskDefinition[];
  get(id: SectOrganizationTaskId): SectTaskDefinition | undefined;
  findByCompletionTag(tag: string): SectTaskDefinition | undefined;
}

export interface SectShopGrant {
  kind: string;
  name: string;
  quality?: Quality;
  description: string;
  type?: 'herb' | 'ore' | 'aux';
  element?: string;
  spec?: PillSpec;
  [key: string]: unknown;
}

export interface SectRewardGrantDefinition {
  quantity: number;
  grant: SectShopGrant;
}

export interface SectShopDefinition {
  id: string;
  requiredRank: SectDiscipleRank;
  price: number;
  stock: number;
  rotating: boolean;
  grant: SectShopGrant;
}

export interface SectDonationDemandDefinition {
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

export interface SectEconomyPolicy {
  readonly donationDailyCap: number;
  /** Exhaustive reward strategy kinds this policy may emit. */
  readonly rewardGrantKinds: readonly string[];
  /** Exhaustive donation specification kinds this policy may emit. */
  readonly donationKinds: readonly string[];
  shopItems(weekKey: string): readonly SectShopDefinition[];
  donationDemands(
    sectId: string,
    dateKey: string,
  ): readonly SectDonationDemandDefinition[];
  stipendBase(rank: SectDiscipleRank): number;
  stipendRewards(
    rank: SectDiscipleRank,
    gardenLevel: number,
  ): readonly SectRewardGrantDefinition[];
}

export interface SectConstructionPolicy {
  readonly facilities: readonly {
    key: string;
    initialLevel: number;
    maxLevel: number;
    upgradeable: boolean;
  }[];
  readonly facilityPriority: readonly string[];
  projectBaseTarget(targetLevel: number): number;
  nextProject(
    levels: ReadonlyMap<string, number>,
  ): { facilityKey: string; targetLevel: number } | null;
}

export interface SectOpponentFactoryContext {
  player: Cultivator;
  mirror: Cultivator | null;
  opponentId: string;
}

export interface SectOpponentFactoryResult {
  opponent: Cultivator;
  title: string;
}

export interface SectOpponentFactory {
  readonly prefersMemberMirror: boolean;
  create(context: SectOpponentFactoryContext): SectOpponentFactoryResult;
}

export interface SectBattleScenarioCatalog {
  get(taskId: SectOrganizationTaskId): SectOpponentFactory | undefined;
}

export interface SectRankPolicy {
  nextRank(rank: SectDiscipleRank): SectDiscipleRank | null;
  methodLevelCap(rank: SectDiscipleRank): number;
  requirement(
    rank: Exclude<SectDiscipleRank, 'registered'>,
  ): SectRankRequirement;
}

export interface SectBenefitMetric {
  key: string;
  label: string;
  value: number | string;
  format: 'percent' | 'number' | 'text';
}

export interface SectFacilityEffectSnapshot {
  renderer: string;
  summary: string;
  metrics: readonly SectBenefitMetric[];
}

export interface SectBenefitSnapshot {
  retreatMultiplier: number;
  craftDiscounts: Record<string, number>;
  facilityEffects: Record<string, SectFacilityEffectSnapshot>;
}

export interface SectBenefitPolicy {
  snapshot(
    levels: ReadonlyMap<string, number>,
    rank: SectDiscipleRank,
  ): SectBenefitSnapshot;
  archiveLevel(levels: ReadonlyMap<string, number>): number;
  methodLevelCap(levels: ReadonlyMap<string, number>): number;
  gardenLevel(levels: ReadonlyMap<string, number>): number;
  retreatMultiplier(
    levels: ReadonlyMap<string, number>,
    rank: SectDiscipleRank,
  ): number;
  craftDiscount(
    craftContext: SectCraftContextKey,
    levels: ReadonlyMap<string, number>,
    rank: SectDiscipleRank,
  ): { capability: SectCapabilityKey; discount: number };
  stipendMultiplier(levels: ReadonlyMap<string, number>): number;
}

export interface SectOrganizationModule {
  readonly capabilities: SectCapabilityPolicy;
  readonly ranks: SectRankPolicy;
  readonly tasks: SectTaskCatalog;
  readonly economy: SectEconomyPolicy;
  readonly construction: SectConstructionPolicy;
  readonly battles: SectBattleScenarioCatalog;
  readonly benefits: SectBenefitPolicy;
}
