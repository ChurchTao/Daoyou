import type { BattleRecord } from '@shared/types/battle';
import type {
  Cultivator,
  Material,
} from '@shared/types/cultivator';
import type { RealmStage, RealmType } from '@shared/types/constants';
import type { PillSpec } from '@shared/types/consumable';
import type { Quality } from '@shared/types/constants';
import type {
  SectDiscipleRank,
  CultivatorSectState,
  SectOffice,
  SectOrganizationModule,
  SectDefinition,
  SectAbilitySlots,
  SectTrainingCost,
} from '@shared/engine/sect';

export interface Clock {
  now(): Date;
  dateKey(now?: Date): string;
  weekKey(now?: Date): string;
}

export interface IdGenerator {
  next(): string;
}

export interface SectAdmissionMembershipRecord {
  id: string;
  sectId: string;
  status: string;
}

export interface SectStateRepository {
  load(cultivatorId: string): Promise<CultivatorSectState | undefined>;
  loadForSect(cultivatorId: string, sectId: string): Promise<CultivatorSectState | undefined>;
  listMemberships(cultivatorId: string): Promise<readonly SectAdmissionMembershipRecord[]>;
}

export interface SectAdmissionRepository extends SectStateRepository {
  findActiveMembership(cultivatorId: string): Promise<SectAdmissionMembershipRecord | null>;
  findMembershipForSect(cultivatorId: string, sectId: string): Promise<SectAdmissionMembershipRecord | null>;
  ensureMembershipCandidate(
    cultivatorId: string,
    sectId: string,
    configVersion: number,
  ): Promise<SectAdmissionMembershipRecord>;
  activateMembership(membershipId: string, definition: SectDefinition): Promise<void>;
  ensureFacilities(
    sectId: string,
    facilities: readonly { key: string; initialLevel: number }[],
  ): Promise<void>;
}

export interface SectTrainingResourceSnapshot {
  realm: RealmType;
  stage: RealmStage;
  stones: number;
  cultivationExp: number;
  comprehensionInsight: number;
  playerRace: 'human';
}

export interface SectTrainingResourceGateway {
  load(cultivatorId: string): Promise<SectTrainingResourceSnapshot | null>;
  spend(cultivatorId: string, cost: SectTrainingCost): Promise<boolean>;
  methodLevelCap(cultivatorId: string): Promise<number>;
}

export interface SectTraditionRepository extends SectStateRepository {
  setMethodLevel(membershipId: string, methodId: string, level: number): Promise<void>;
  createPathWithFirstLayer(
    membershipId: string,
    pathId: string,
    tacticId: string,
    layerId: string,
  ): Promise<boolean>;
  appendUnlockedPathLayer(
    membershipId: string,
    pathId: string,
    layerId: string,
    expectedUnlockedCount: number,
  ): Promise<boolean>;
  activatePathIfNone(membershipId: string, pathId: string): Promise<void>;
  activatePath(membershipId: string, pathId: string): Promise<boolean>;
  replaceMeridianLoadout(
    membershipId: string,
    pathId: string,
    slot: number,
    nodeIds: string[],
  ): Promise<void>;
  activateMeridianLoadout(membershipId: string, pathId: string, slot: number): Promise<void>;
  replaceAbilityLoadout(membershipId: string, slots: SectAbilitySlots): Promise<void>;
  setPathTactic(membershipId: string, pathId: string, tacticId: string): Promise<void>;
}

export interface SectMembershipRecord {
  id: string;
  sectId: string;
  cultivatorId: string;
  discipleRank: SectDiscipleRank;
  contribution: number;
}

export interface SectTaskRecord {
  id: string;
  membershipId: string;
  taskId: string;
  kind: 'daily' | 'weekly' | 'promotion';
  periodKey: string;
  status: 'active' | 'completed';
  progress: number;
  payload: Record<string, unknown>;
  completedAt?: Date;
}

export interface SectMembershipReadRepository {
  findByCultivator(cultivatorId: string): Promise<SectMembershipRecord | null>;
  countCompletedDailyTasks(membershipId: string): Promise<number>;
  hasCompletedTask(membershipId: string, taskId: string): Promise<boolean>;
}

export interface SectMembershipQueryRepository extends SectMembershipReadRepository {
  loadState(cultivatorId: string): Promise<CultivatorSectState | undefined>;
  listMembers(sectId: string, page: number, pageSize: number): Promise<{
    rows: SectMemberRecord[];
    total: number;
  }>;
}

export interface SectMembershipRepository extends SectMembershipQueryRepository {
  promote(membershipId: string, rank: SectDiscipleRank): Promise<boolean>;
}

export interface SectMemberRecord {
  cultivatorId: string;
  name: string;
  realm: string;
  realmStage: string;
  discipleRank: SectDiscipleRank;
  office: SectOffice;
  joinedAt: Date | null;
}

export interface SectTaskReadRepository {
  list(membershipId: string): Promise<SectTaskRecord[]>;
  find(membershipId: string, periodKey: string, taskId: string): Promise<SectTaskRecord | null>;
  findDaily(membershipId: string, dateKey: string): Promise<SectTaskRecord | null>;
  countCompletedDailySince(membershipId: string, periodKey: string): Promise<number>;
}

export interface SectTaskRepository extends SectTaskReadRepository {
  create(input: {
    membershipId: string;
    taskId: string;
    kind: 'daily' | 'weekly' | 'promotion';
    periodKey: string;
    progress?: number;
    payload?: Record<string, unknown>;
  }): Promise<SectTaskRecord>;
  complete(id: string, progress: number): Promise<SectTaskRecord | null>;
  updatePayload(id: string, payload: Record<string, unknown>): Promise<SectTaskRecord | null>;
  upsertProgress(input: {
    membershipId: string;
    taskId: string;
    kind: 'weekly' | 'promotion';
    periodKey: string;
    progress: number;
    target: number;
    completed: boolean;
    payload?: Record<string, unknown>;
  }): Promise<SectTaskRecord>;
}

export interface SectOwnedMaterial {
  id: string;
  name: string;
  type: string;
  rank: string;
  quantity: number;
}

export interface SectOwnedConsumable {
  id: string;
  name: string;
  quality: string;
  quantity: number;
  spec: unknown;
}

export interface SectOwnedArtifact {
  id: string;
  name: string;
  quality: string;
  isEquipped: boolean;
}

export interface SectInventoryGateway {
  findMaterial(cultivatorId: string, itemId: string): Promise<SectOwnedMaterial | null>;
  findConsumable(cultivatorId: string, itemId: string): Promise<SectOwnedConsumable | null>;
  findArtifact(cultivatorId: string, itemId: string): Promise<SectOwnedArtifact | null>;
  consumeMaterial(itemId: string, quantity: number): Promise<boolean>;
  consumeConsumable(itemId: string, quantity: number): Promise<boolean>;
  consumeArtifact(itemId: string): Promise<boolean>;
}

export interface SectCultivatorGateway {
  loadRuntime(cultivatorId: string): Promise<Cultivator | null>;
  findMirrorCultivatorId(sectId: string, excludeCultivatorId: string): Promise<string | null>;
  loadProgress(cultivatorId: string): Promise<{
    realm: RealmType;
    stage: RealmStage;
  } | null>;
}

export interface SectBattleGateway {
  simulate(player: Cultivator, opponent: Cultivator, seed: string): BattleRecord;
}

export interface SectRewardGateway {
  grantContribution(
    membershipId: string,
    amount: number,
    reason: string,
    referenceId: string,
  ): Promise<void>;
  grantSpiritStones(cultivatorId: string, amount: number): Promise<void>;
  grantCultivationExp(userId: string, cultivatorId: string, amount: number): Promise<void>;
  grantMaterial(
    cultivatorId: string,
    input: Pick<
      Material,
      'name' | 'type' | 'rank' | 'element' | 'description' | 'details' | 'quantity'
    >,
  ): Promise<void>;
  grantPill(userId: string, cultivatorId: string, input: {
    id: string;
    name: string;
    quality: Quality;
    description: string;
    prompt: string;
    spec: PillSpec;
    quantity: number;
  }): Promise<void>;
}

export interface SectFacilityRecord {
  sectId: string;
  facilityKey: string;
  level: number;
  updatedAt: Date;
}

export interface SectFacilityReadRepository {
  list(sectId: string): Promise<SectFacilityRecord[]>;
}

export interface SectFacilityRepository extends SectFacilityReadRepository {
  ensure(sectId: string): Promise<void>;
}

export interface SectEconomyReadRepository {
  purchasedQuantity(membershipId: string, weekKey: string, itemId: string): Promise<number>;
  hasClaimedStipend(membershipId: string, weekKey: string): Promise<boolean>;
}

export interface SectEconomyRepository extends SectEconomyReadRepository {
  spendContribution(
    membershipId: string,
    amount: number,
    reason: string,
    referenceId: string,
  ): Promise<boolean>;
  recordPurchase(
    membershipId: string,
    weekKey: string,
    itemId: string,
    quantity: number,
  ): Promise<boolean>;
  recordStipendClaim(input: {
    membershipId: string;
    weekKey: string;
    spiritStones: number;
    rewards: unknown[];
  }): Promise<boolean>;
  spendSpiritStones(cultivatorId: string, amount: number): Promise<boolean>;
}

export interface SectConstructionProjectRecord {
  id: string;
  sectId: string;
  facilityKey: string;
  targetLevel: number;
  progress: number;
  target: number;
  status: 'active' | 'completed';
  startedWeekKey: string;
  completedAt: Date | null;
}

export interface SectDonationActivityRecord {
  id: string;
  memberName: string;
  demandId: string;
  contribution: number;
  constructionPoints: number;
  createdAt: Date;
}

export interface SectConstructionReadRepository {
  findActiveProject(sectId: string): Promise<SectConstructionProjectRecord | null>;
  findLatestCompletedProject(sectId: string): Promise<SectConstructionProjectRecord | null>;
  countRecentlyActiveMembers(sectId: string, since: Date): Promise<number>;
  donatedContribution(membershipId: string, dateKey: string): Promise<number>;
  listRecentDonations(sectId: string, limit: number): Promise<SectDonationActivityRecord[]>;
}

export interface SectConstructionRepository extends SectConstructionReadRepository {
  createProject(input: {
    sectId: string;
    facilityKey: string;
    targetLevel: number;
    target: number;
    startedWeekKey: string;
  }): Promise<SectConstructionProjectRecord | null>;
  saveProjectProgress(
    projectId: string,
    progress: number,
  ): Promise<SectConstructionProjectRecord | null>;
  completeProject(
    projectId: string,
    completedAt: Date,
  ): Promise<SectConstructionProjectRecord | null>;
  upgradeFacility(sectId: string, facilityKey: string, level: number): Promise<boolean>;
  recordDonation(input: {
    id: string;
    membershipId: string;
    projectId: string;
    dateKey: string;
    demandId: string;
    contribution: number;
    constructionPoints: number;
    itemSnapshot: Record<string, unknown>;
  }): Promise<{ id: string } | null>;
  grantContribution(
    membershipId: string,
    amount: number,
    reason: string,
    referenceId: string,
  ): Promise<void>;
}

export interface SectModuleResolver {
  require(sectId: string): SectOrganizationModule;
}

export interface SectCommandContext {
  memberships: SectMembershipReadRepository;
  tasks: SectTaskRepository;
  inventory: SectInventoryGateway;
  cultivators: SectCultivatorGateway;
  battle: SectBattleGateway;
  rewards: SectRewardGateway;
  modules: SectModuleResolver;
  clock: Clock;
  ids: IdGenerator;
}

export interface SectQueryContext {
  memberships: SectMembershipReadRepository;
  tasks: SectTaskReadRepository;
  modules: SectModuleResolver;
  clock: Clock;
}

export interface SectMembershipQueryContext {
  memberships: SectMembershipQueryRepository;
  facilities: SectFacilityReadRepository;
  economy: Pick<SectEconomyReadRepository, 'hasClaimedStipend'>;
  construction: Pick<SectConstructionReadRepository, 'findActiveProject'>;
  modules: SectModuleResolver;
  clock: Clock;
}

export interface SectMembershipCommandContext extends SectMembershipQueryContext {
  memberships: SectMembershipRepository;
}

export interface SectEconomyQueryContext {
  memberships: SectMembershipReadRepository;
  economy: SectEconomyReadRepository;
  facilities: SectFacilityReadRepository;
  modules: SectModuleResolver;
  clock: Clock;
}

export interface SectEconomyCommandContext extends SectEconomyQueryContext {
  economy: SectEconomyRepository;
  facilities: SectFacilityRepository;
  rewards: SectRewardGateway;
  ids: IdGenerator;
}

export interface SectConstructionQueryContext {
  memberships: SectMembershipReadRepository;
  facilities: SectFacilityReadRepository;
  construction: SectConstructionReadRepository;
  modules: SectModuleResolver;
  clock: Clock;
}

export interface SectConstructionCommandContext extends SectConstructionQueryContext {
  facilities: SectFacilityRepository;
  construction: SectConstructionRepository;
  economy: Pick<SectEconomyRepository, 'spendSpiritStones'>;
  inventory: SectInventoryGateway;
  ids: IdGenerator;
}

export interface SectBenefitQueryContext {
  memberships: Pick<SectMembershipReadRepository, 'findByCultivator'>;
  facilities: SectFacilityReadRepository;
  modules: SectModuleResolver;
}
