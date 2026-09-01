import {
  type SectDiscipleRank,
  type SectFacilityState,
  type SectOrganizationModule,
} from '@shared/engine/sect';
import type { RealmType } from '@shared/types/constants';
import { SectError } from '../SectError';
import type {
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

export function mapFacilities(
  rows: readonly SectFacilityRecord[],
  organization: SectOrganizationModule,
): SectFacilityState[] {
  return rows.map((row) => {
    const definition = organization.construction.facilities.find(
      (facility) => facility.key === row.facilityKey,
    );
    if (!definition)
      organizationError(`宗门设施配置不存在：${row.facilityKey}`, 500);
    return {
      key: row.facilityKey,
      level: row.level,
      progress: row.progress,
      target:
        definition.upgradeable && row.level < definition.maxLevel
          ? organization.construction.upgradeTarget(row.level)
          : null,
      maxLevel: definition.maxLevel,
      upgradeable: definition.upgradeable,
      updatedAt: row.updatedAt?.toISOString(),
    };
  });
}

export interface SectStipendQuote {
  spiritStones: number;
}

/** Builds the spirit-stone snapshot used by overview, audit and settlement. */
export function quoteSectStipend(
  organization: SectOrganizationModule,
  rank: SectDiscipleRank,
  realm: RealmType,
  facilityLevels: ReadonlyMap<string, number>,
): SectStipendQuote {
  const spiritStones = Math.floor(
    organization.economy.stipendBase(rank, realm) *
      organization.benefits.stipendMultiplier(facilityLevels),
  );
  return { spiritStones };
}
