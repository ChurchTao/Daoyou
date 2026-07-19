import {
  type SectConstructionProjectState,
  type SectFacilityState,
  type SectDiscipleRank,
  type SectOrganizationModule,
  type SectRewardGrantDefinition,
} from '@shared/engine/sect';
import { SectError } from '../SectError';
import type {
  SectConstructionProjectRecord,
  SectFacilityRecord,
  SectMembershipReadRepository,
  SectMembershipRecord,
  SectModuleResolver,
} from './ports';

export function organizationError(message: string, status = 409): never {
  throw new SectError('SECT_ORGANIZATION_INVALID', message, status);
}

export async function requireMembership(
  cultivatorId: string,
  memberships: Pick<SectMembershipReadRepository, 'findByCultivator'>,
): Promise<SectMembershipRecord> {
  const membership = await memberships.findByCultivator(cultivatorId);
  if (!membership) organizationError('尚未拜入宗门');
  return membership;
}

export function organizationFor(
  modules: SectModuleResolver,
  sectId: string,
): SectOrganizationModule {
  return modules.require(sectId);
}

export function assertDeclaredRewardKind(
  organization: SectOrganizationModule,
  kind: string,
): void {
  if (!organization.economy.rewardGrantKinds.includes(kind))
    organizationError(`宗门经济策略返回未声明的奖励类型：${kind}`, 500);
}

export function assertDeclaredDonationKind(
  organization: SectOrganizationModule,
  kind: string,
): void {
  if (!organization.economy.donationKinds.includes(kind))
    organizationError(`宗门经济策略返回未声明的捐献类型：${kind}`, 500);
}

export function mapFacilities(rows: readonly SectFacilityRecord[]): SectFacilityState[] {
  return rows.map((row) => ({
    key: row.facilityKey,
    level: row.level,
    updatedAt: row.updatedAt?.toISOString(),
  }));
}

export function mapProject(
  row: SectConstructionProjectRecord | null,
): SectConstructionProjectState | null {
  if (!row) return null;
  return {
    ...row,
    completedAt: row.completedAt?.toISOString(),
  };
}

export interface SectStipendQuote {
  spiritStones: number;
  rewards: readonly SectRewardGrantDefinition[];
}

/** Builds the single reward package used by overview, audit and settlement. */
export function quoteSectStipend(
  organization: SectOrganizationModule,
  rank: SectDiscipleRank,
  facilityLevels: ReadonlyMap<string, number>,
): SectStipendQuote {
  const spiritStones = Math.floor(
    organization.economy.stipendBase(rank) *
      organization.benefits.stipendMultiplier(facilityLevels),
  );
  const rewards = [
    {
      quantity: spiritStones,
      grant: {
          kind: 'sect.reward.spirit-stones',
        name: '灵石',
        description: '宗门按弟子职阶与灵脉等级发放的周俸。',
      },
    },
    ...organization.economy.stipendRewards(
      rank,
      organization.benefits.gardenLevel(facilityLevels),
    ),
  ];
  for (const reward of rewards)
    assertDeclaredRewardKind(organization, reward.grant.kind);
  return {
    spiritStones,
    rewards,
  };
}

export function stipendRewardView(reward: SectRewardGrantDefinition) {
  return {
    kind: reward.grant.kind,
    name: reward.grant.name,
    quantity: reward.quantity,
    summary: `${reward.grant.name} ×${reward.quantity}`,
  };
}
