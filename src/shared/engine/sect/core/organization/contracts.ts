import type { PillSpec } from '@shared/types/consumable';
import type { Quality } from '@shared/types/constants';
import type {
  SectDiscipleRank,
  SectRankRequirement,
  UpgradeableSectFacilityKey,
} from '../domain/organization';

export const SECT_PERMISSIONS = [
  'scene.hall',
  'scene.affairs',
  'scene.archive',
  'scene.enlightenment_cliff',
  'scene.arena',
  'scene.treasury',
  'scene.industries',
  'scene.cultivation_room',
  'scene.alchemy',
  'scene.refinery',
  'scene.spirit_vein',
  'scene.herb_garden',
  'scene.cave',
  'scene.gate',
  'scene.formation',
  'task.pill_delivery',
  'task.artifact_delivery',
  'task.elder_trial',
  'benefit.cultivation_room',
  'benefit.workshop',
] as const;

export type SectPermission = (typeof SECT_PERMISSIONS)[number];

export interface SectPermissionState {
  granted: boolean;
  requiredRank: SectDiscipleRank;
  reason?: string;
}

export interface SectPermissionPolicy {
  minimumRank(permission: SectPermission): SectDiscipleRank;
  allows(rank: SectDiscipleRank, permission: SectPermission): boolean;
  snapshot(rank: SectDiscipleRank): Record<SectPermission, SectPermissionState>;
}

/** Opaque content identifier owned by each concrete sect module. */
export type SectOrganizationTaskId = string;

export type SectTaskExecutorKind =
  | 'sweep'
  | 'battle'
  | 'submit_pill'
  | 'submit_artifact'
  | 'submit_material'
  | 'progress';

export type SectTaskCompletionRole =
  | 'weekly_diligence'
  | 'promotion_tournament'
  | 'promotion_bounty'
  | 'promotion_elder_trial';

export interface SectTaskDefinition {
  id: SectOrganizationTaskId;
  name: string;
  description: string;
  kind: 'daily' | 'weekly' | 'promotion';
  requiredRank: SectDiscipleRank;
  contributionReward: number;
  executor: SectTaskExecutorKind;
  alternateExecutor?: SectTaskExecutorKind;
  rotation?: 'battle_material';
  completionRole?: SectTaskCompletionRole;
  target: number;
}

export interface SectTaskCatalog {
  listDaily(): readonly SectTaskDefinition[];
  listWeekly(): readonly SectTaskDefinition[];
  get(id: SectOrganizationTaskId): SectTaskDefinition | undefined;
  findByRole(role: SectTaskCompletionRole): SectTaskDefinition | undefined;
}

export type SectShopGrant =
  | {
      kind: 'material';
      name: string;
      type: 'herb' | 'ore' | 'aux';
      quality: Quality;
      element?: string;
      description: string;
    }
  | {
      kind: 'pill';
      name: string;
      quality: Quality;
      description: string;
      spec: PillSpec;
    };

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
  kind: 'spirit_stones' | 'material' | 'pill' | 'artifact';
  quantity: number;
  contribution: number;
  constructionPoints: number;
  minQuality?: string;
  pillFamily?: string;
}

export interface SectEconomyPolicy {
  readonly donationDailyCap: number;
  shopItems(weekKey: string): readonly SectShopDefinition[];
  donationDemands(
    sectId: string,
    dateKey: string,
  ): readonly SectDonationDemandDefinition[];
  stipendBase(rank: SectDiscipleRank): number;
  stipendRewards(rank: SectDiscipleRank, gardenLevel: number): {
    herbName: string;
    herbQuality: Quality;
    herbQuantity: number;
    bonusRewards: readonly string[];
    bonusPill?: Extract<SectShopGrant, { kind: 'pill' }>;
  };
}

export interface SectConstructionPolicy {
  readonly facilityPriority: readonly UpgradeableSectFacilityKey[];
  projectBaseTarget(targetLevel: number): number;
}

export type SectBattleScenarioKind =
  | 'scaled_npc'
  | 'member_mirror'
  | 'elder_projection';

export interface SectBattleScenarioDefinition {
  taskId: SectOrganizationTaskId;
  kind: SectBattleScenarioKind;
  opponentName: string;
  title: string;
  attributeMultiplier: number;
  fallback?: Omit<SectBattleScenarioDefinition, 'taskId' | 'fallback'>;
}

export interface SectBattleScenarioCatalog {
  get(taskId: SectOrganizationTaskId): SectBattleScenarioDefinition | undefined;
}

export interface SectRankPolicy {
  stipendBase(rank: SectDiscipleRank): number;
  methodLevelCap(rank: SectDiscipleRank): number;
  requirement(
    rank: Exclude<SectDiscipleRank, 'registered'>,
  ): SectRankRequirement;
}

export interface SectOrganizationModule {
  readonly permissions: SectPermissionPolicy;
  readonly ranks: SectRankPolicy;
  readonly tasks: SectTaskCatalog;
  readonly economy: SectEconomyPolicy;
  readonly construction: SectConstructionPolicy;
  readonly battles: SectBattleScenarioCatalog;
}
