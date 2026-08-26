import type { DomainEventWriter } from '@server/lib/mq/domainEventWriter';
import type {
  DbExecutor,
  DbTransaction,
} from '@server/lib/drizzle/db';
import type {
  ResourceChangeDescriptor,
  ResourceDataMap,
} from '@shared/contracts/resources';
import type { SectTaskSettlementData } from '@shared/contracts/sect';
import type { CultivatorCombatInput } from '@shared/engine/battle-v5/adapters/CultivatorCombatAdapter';
import type { SectBattleStateStrategy } from '@shared/engine/sect';
import type { CultivatorCondition } from '@shared/types/condition';
import type {
  CultivatorSectState,
  SectAbilitySlots,
  SectDefinition,
  SectDiscipleRank,
  SectOffice,
  SectOrganizationModule,
  SectSubmissionItemFacts,
  SectSubmissionItemKind,
  SectTaskRecordPayload,
  SectTrainingCost,
} from '@shared/engine/sect';
import type { BattleRecordV3 } from '@shared/types/battle';
import type { Quality, RealmStage, RealmType } from '@shared/types/constants';
import type { Material } from '@shared/types/cultivator';
import type { SectCommandEffects } from './SectCommandEffects';

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
  loadForSect(
    cultivatorId: string,
    sectId: string,
  ): Promise<CultivatorSectState | undefined>;
  listMemberships(
    cultivatorId: string,
  ): Promise<readonly SectAdmissionMembershipRecord[]>;
}

export interface SectAdmissionRepository extends SectStateRepository {
  findActiveMembership(
    cultivatorId: string,
  ): Promise<SectAdmissionMembershipRecord | null>;
  findMembershipForSect(
    cultivatorId: string,
    sectId: string,
  ): Promise<SectAdmissionMembershipRecord | null>;
  ensureMembershipCandidate(
    cultivatorId: string,
    sectId: string,
    configVersion: number,
  ): Promise<SectAdmissionMembershipRecord>;
  activateMembership(
    membershipId: string,
    definition: SectDefinition,
  ): Promise<void>;
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
  resourceProgress: ResourceDataMap['player.progress'];
  playerRace: 'human';
}

export interface SectTrainingResourceGateway {
  load(cultivatorId: string): Promise<SectTrainingResourceSnapshot | null>;
  spend(cultivatorId: string, cost: SectTrainingCost): Promise<boolean>;
  methodLevelCap(cultivatorId: string): Promise<number>;
}

export interface SectTraditionRepository extends SectStateRepository {
  setMethodLevel(
    membershipId: string,
    methodId: string,
    level: number,
  ): Promise<void>;
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
  activateMeridianLoadout(
    membershipId: string,
    pathId: string,
    slot: number,
  ): Promise<void>;
  replaceAbilityLoadout(
    membershipId: string,
    slots: SectAbilitySlots,
  ): Promise<void>;
  setPathTactic(
    membershipId: string,
    pathId: string,
    tacticId: string,
  ): Promise<void>;
}

export interface SectMembershipRecord {
  id: string;
  sectId: string;
  cultivatorId: string;
  discipleRank: SectDiscipleRank;
  contribution: number;
  lifetimeContribution: number;
}

export interface SectTaskRecord {
  id: string;
  membershipId: string;
  taskId: string;
  kind: 'daily' | 'weekly' | 'promotion';
  periodKey: string;
  status: 'active' | 'completed' | 'abandoned';
  attempt: number;
  progress: number;
  payload: SectTaskRecordPayload;
  createdAt: Date;
  completedAt?: Date;
  claimedAt?: Date;
}

export interface SectMembershipReadRepository {
  findByCultivator(cultivatorId: string): Promise<SectMembershipRecord | null>;
  countCompletedDailyTasks(membershipId: string): Promise<number>;
  hasCompletedTask(membershipId: string, taskId: string): Promise<boolean>;
}

export interface SectMembershipQueryRepository extends SectMembershipReadRepository {
  loadState(cultivatorId: string): Promise<CultivatorSectState | undefined>;
  listMembers(
    sectId: string,
    page: number,
    pageSize: number,
  ): Promise<{
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
  lastActiveAt?: Date | null;
}

export interface SectTaskReadRepository {
  list(
    membershipId: string,
    periodKeys: readonly string[],
  ): Promise<SectTaskRecord[]>;
  find(
    membershipId: string,
    periodKey: string,
    taskId: string,
  ): Promise<SectTaskRecord | null>;
  countCompletedDailySince(
    membershipId: string,
    periodKey: string,
  ): Promise<number>;
}

export interface SectTaskRepository extends SectTaskReadRepository {
  nextAttempt(
    membershipId: string,
    periodKey: string,
    taskId: string,
  ): Promise<number>;
  create(input: {
    membershipId: string;
    taskId: string;
    kind: 'daily' | 'weekly' | 'promotion';
    periodKey: string;
    attempt?: number;
    progress?: number;
    payload: SectTaskRecordPayload;
  }): Promise<SectTaskRecord>;
  complete(id: string, progress: number): Promise<SectTaskRecord | null>;
  abandon(id: string, acceptedBefore: Date): Promise<boolean>;
  claim(id: string, claimedAt: Date): Promise<SectTaskRecord | null>;
  updatePayload(
    id: string,
    payload: SectTaskRecordPayload,
  ): Promise<SectTaskRecord | null>;
  upsertProgress(input: {
    membershipId: string;
    taskId: string;
    kind: 'weekly' | 'promotion';
    periodKey: string;
    progress: number;
    target: number;
    completed: boolean;
    payload: SectTaskRecordPayload;
  }): Promise<SectTaskRecord>;
}

export interface SectInventorySettlementResult {
  consumed: boolean;
  change?: ResourceChangeDescriptor<
    'inventory.artifacts' | 'inventory.materials' | 'inventory.consumables'
  >;
  settlement?: SectTaskSettlementData['inventory'][number];
}

export interface SectSubmissionInventoryReadGateway {
  listSubmissionItemsPage(input: {
    cultivatorId: string;
    kind: SectSubmissionItemKind;
    page: number;
    pageSize: number;
  }): Promise<{ items: SectSubmissionItemFacts[]; total: number }>;
  findSubmissionItem(
    cultivatorId: string,
    kind: SectSubmissionItemKind,
    itemId: string,
  ): Promise<SectSubmissionItemFacts | null>;
}

export interface SectSubmissionInventoryGateway extends SectSubmissionInventoryReadGateway {
  consumeSubmissionItem(input: {
    cultivatorId: string;
    kind: SectSubmissionItemKind;
    itemId: string;
    quantity: number;
  }): Promise<SectInventorySettlementResult>;
}

export interface SectCultivatorGateway {
  loadRuntime(cultivatorId: string): Promise<CultivatorCombatInput | null>;
  findBattleTargetCandidate(input: {
    requesterSectId: string;
    excludeCultivatorId: string;
    realms: readonly RealmType[];
    relation: 'same-sect' | 'other-sect';
  }): Promise<{
    cultivatorId: string;
    sectId: string;
    sectName: string;
  } | null>;
  loadProgress(cultivatorId: string): Promise<{
    realm: RealmType;
    stage: RealmStage;
  } | null>;
  saveCondition(
    cultivatorId: string,
    condition: CultivatorCondition,
  ): Promise<void>;
}

export interface SectRewardMaterialCandidate {
  libraryItemId: string;
  name: string;
  quality: Quality;
  type: 'ore';
  element?: string;
  description: string;
}

export interface SectRewardMaterialCatalogGateway {
  sampleOre(
    preferredQualities: readonly Quality[],
    seed: string,
  ): Promise<SectRewardMaterialCandidate | null>;
}

export interface SectBattleGateway {
  execute(
    player: CultivatorCombatInput,
    opponent: CultivatorCombatInput,
    strategy: SectBattleStateStrategy,
    seed: string,
  ): {
    battleResult: BattleRecordV3;
    nextCondition?: CultivatorCondition;
  };
}

export interface SectRewardGateway {
  grantContribution(
    membershipId: string,
    amount: number,
    reason: string,
    referenceId: string,
  ): Promise<{
    value: number;
    lifetimeContribution: number;
    effects: SectCommandEffects;
  }>;
  grantSpiritStones(
    cultivatorId: string,
    amount: number,
    source?: 'sect_task' | 'sect_stipend',
  ): Promise<{ value: number; effects: SectCommandEffects }>;
  grantCultivationExp(
    userId: string,
    cultivatorId: string,
    amount: number,
  ): Promise<{
    value: ResourceDataMap['player.progress'];
    effects: SectCommandEffects;
  }>;
  grantMaterial(
    cultivatorId: string,
    input: Pick<
      Material,
      | 'name'
      | 'type'
      | 'rank'
      | 'element'
      | 'description'
      | 'details'
      | 'quantity'
    >,
  ): Promise<SectCommandEffects>;
}

export interface SectFacilityRecord {
  sectId: string;
  facilityKey: string;
  level: number;
  progress: number;
  updatedAt: Date;
}

export interface SectFacilityReadRepository {
  list(sectId: string): Promise<SectFacilityRecord[]>;
}

export interface SectFacilityRepository extends SectFacilityReadRepository {
  ensure(sectId: string): Promise<void>;
}

export interface SectEconomyReadRepository {
  hasClaimedStipend(membershipId: string, weekKey: string): Promise<boolean>;
}

export interface SectEconomyRepository extends SectEconomyReadRepository {
  spendContribution(
    membershipId: string,
    amount: number,
    reason: string,
    referenceId: string,
  ): Promise<{
    contribution: number;
    lifetimeContribution: number;
  } | null>;
  recordStipendClaim(input: {
    membershipId: string;
    weekKey: string;
    spiritStones: number;
  }): Promise<boolean>;
  spendSpiritStones(
    cultivatorId: string,
    amount: number,
  ): Promise<{ spent: boolean; balance?: number }>;
}

export interface SectConstructionRepository {
  grantContribution(
    membershipId: string,
    amount: number,
    reason: string,
    referenceId: string,
  ): Promise<{ contribution: number; lifetimeContribution: number }>;
}

export interface SectModuleResolver {
  require(sectId: string): SectOrganizationModule;
}

export interface SectCommandContext {
  memberships: SectMembershipReadRepository;
  tasks: SectTaskRepository;
  submissionInventory: SectSubmissionInventoryGateway;
  cultivators: SectCultivatorGateway;
  battle: SectBattleGateway;
  rewards: SectRewardGateway;
  rewardMaterials: SectRewardMaterialCatalogGateway;
  modules: SectModuleResolver;
  clock: Clock;
  ids: IdGenerator;
}

export interface SectQueryContext {
  memberships: SectMembershipReadRepository;
  tasks: SectTaskReadRepository;
  submissionInventory: SectSubmissionInventoryReadGateway;
  modules: SectModuleResolver;
  clock: Clock;
}

export interface SectMembershipQueryContext {
  memberships: SectMembershipQueryRepository;
  facilities: SectFacilityReadRepository;
  economy: Pick<SectEconomyReadRepository, 'hasClaimedStipend'>;
  modules: SectModuleResolver;
  clock: Clock;
}

export interface SectMembershipCommandContext extends SectMembershipQueryContext {
  memberships: SectMembershipRepository;
}

export interface SectEconomyQueryContext {
  q: DbExecutor | DbTransaction;
  memberships: SectMembershipReadRepository;
  economy: SectEconomyReadRepository;
  facilities: SectFacilityReadRepository;
  modules: SectModuleResolver;
  clock: Clock;
}

export interface SectEconomyCommandContext extends SectEconomyQueryContext {
  q: DbTransaction;
  economy: SectEconomyRepository;
  facilities: SectFacilityRepository;
  rewards: SectRewardGateway;
}

export interface SectConstructionQueryContext {
  memberships: SectMembershipReadRepository;
  facilities: SectFacilityReadRepository;
  modules: SectModuleResolver;
  clock: Clock;
}

export interface SectConstructionCommandContext extends SectConstructionQueryContext {
  facilities: SectFacilityReadRepository &
    Pick<SectFacilityRepository, 'ensure'>;
  construction: SectConstructionRepository;
  events: DomainEventWriter;
  economy: Pick<SectEconomyRepository, 'spendSpiritStones'>;
}

export interface SectBenefitQueryContext {
  memberships: Pick<SectMembershipReadRepository, 'findByCultivator'>;
  facilities: SectFacilityReadRepository;
  modules: SectModuleResolver;
}
