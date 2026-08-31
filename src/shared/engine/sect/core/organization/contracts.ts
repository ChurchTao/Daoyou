import type { DailyTaskDifficulty } from '@shared/engine/cultivation/exp-gain-strategies/types';
import type { CultivatorCombatInput } from '@shared/engine/battle-v5/adapters/CultivatorCombatAdapter';
import type { BattleStateStrategyId } from '@shared/engine/battle-v5/setup/types';
import type { RealmType } from '@shared/types/constants';
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
  snapshot(
    rank: SectDiscipleRank,
  ): Record<SectCapabilityKey, SectPermissionState>;
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

export type SectTaskDialogueEmphasis =
  'quantity' | 'quality' | 'effect' | 'appearance' | 'warning';

export interface SectTaskDialogueSegment {
  text: string;
  emphasis?: SectTaskDialogueEmphasis;
}

export interface SectTaskDialogueInstructionDefinition {
  text: string;
  requirementPrefix?: string;
  requirementSuffix?: string;
}

export interface SectTaskDialogueDefinition {
  offeredReply: string;
  activeReply: string;
  claimableReply: string;
  claimedReply: string;
  instruction: SectTaskDialogueInstructionDefinition;
}

export interface SectTaskDialoguePresentation {
  offeredReply: string;
  activeReply: string;
  claimableReply: string;
  claimedReply: string;
  instruction: readonly SectTaskDialogueSegment[];
}

export interface SectTaskPresentationDefinition {
  title: string;
  description: string;
  actionLabel: string;
  dialogue: SectTaskDialogueDefinition;
}

export interface SectTaskExecutionLocationDefinition {
  key: string;
  travelReply: string;
}

export interface SectTaskExecutionLocationParameters extends Record<
  string,
  unknown
> {
  executionLocation: SectTaskExecutionLocationDefinition;
}

export interface SectTaskAvailabilityContext {
  dateKey: string;
  weekKey: string;
}

export interface SectTaskAvailabilityDecision {
  key: string;
  executorKey: SectTaskExecutorKey;
  offer?: SectTaskOfferPolicyDefinition;
}

export interface SectTaskAvailabilityPolicy {
  /** Exhaustive variants used for fail-fast executor and offer validation. */
  readonly variants: readonly SectTaskAvailabilityDecision[];
  resolve(context: SectTaskAvailabilityContext): string;
}

export interface SectTaskFulfillmentRule {
  /** Open strategy key implemented by an application plugin. */
  strategy: string;
  input?: Record<string, unknown>;
}

export interface SectTaskOfferPolicyDefinition {
  policy: string;
  input?: Record<string, unknown>;
}

export interface SectTaskRewardPolicyDefinition {
  policy: string;
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
  enrollment: 'manual' | 'automatic';
  requiredCapability: SectCapabilityKey;
  executorKey: SectTaskExecutorKey;
  /** Task-wide difficulty floor; generated offer difficulty may only raise it. */
  minimumDifficulty?: DailyTaskDifficulty;
  executionLocation?: SectTaskExecutionLocationDefinition;
  presentation: SectTaskPresentationDefinition;
  availability?: SectTaskAvailabilityPolicy;
  offer?: SectTaskOfferPolicyDefinition;
  reward?: SectTaskRewardPolicyDefinition;
  fulfillment: readonly SectTaskFulfillmentRule[];
  completionTags?: readonly string[];
  progress?: SectTaskProgressDefinition;
  target: number;
}

export function resolveSectTaskExecutionLocationParameters(
  definition: SectTaskDefinition,
): SectTaskExecutionLocationParameters | undefined {
  const location = definition.executionLocation;
  if (!location) return undefined;
  return {
    executionLocation: {
      key: location.key,
      travelReply: location.travelReply,
    },
  };
}

export interface SectTaskCatalog {
  listDaily(): readonly SectTaskDefinition[];
  listWeekly(): readonly SectTaskDefinition[];
  listPromotion(): readonly SectTaskDefinition[];
  get(id: SectOrganizationTaskId): SectTaskDefinition | undefined;
  listByCompletionTag(tag: string): readonly SectTaskDefinition[];
}

export interface SectEconomyPolicy {
  stipendBase(rank: SectDiscipleRank, realm: RealmType): number;
}

export interface SectConstructionPolicy {
  readonly facilities: readonly {
    key: string;
    initialLevel: number;
    maxLevel: number;
    upgradeable: boolean;
  }[];
  upgradeTarget(currentLevel: number): number | null;
}

export interface SectOpponentFactoryContext {
  player: CultivatorCombatInput;
  target: CultivatorCombatInput | null;
  sectId: string;
  opponentId: string;
}

export interface SectOpponentFactoryResult {
  opponent: CultivatorCombatInput;
  title: string;
  presetId?: string;
  description: string;
}

export type SectBattleTargetAcquisition =
  | 'preset'
  | 'same-sect'
  | 'other-sect';

export type SectBattleStateStrategy = Extract<
  BattleStateStrategyId,
  'standard_full' | 'persistent_world'
>;

export interface SectOpponentFactory {
  readonly acquisition: SectBattleTargetAcquisition;
  readonly stateStrategy: SectBattleStateStrategy;
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
