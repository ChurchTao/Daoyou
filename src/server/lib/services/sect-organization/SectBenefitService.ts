import type { DbExecutor, DbTransaction } from '@server/lib/drizzle/db';
import * as organizationRepository from '@server/lib/repositories/sectOrganizationRepository';
import * as sectRepository from '@server/lib/repositories/sectRepository';
import type { SectOrganizationRepositoryPort } from '@server/lib/repositories/SectOrganizationRepositoryPort';
import {
  getSectCraftDiscount,
  getSectFacilityBonus,
  type SectDiscipleRank,
  type SectPermission,
} from '@shared/engine/sect';
import type { SectRuntime } from '@shared/engine/sect';
import { productionSectRuntime } from '@shared/engine/sect/content';
import { SectError } from '../SectError';

type Membership = NonNullable<
  Awaited<ReturnType<typeof sectRepository.findMembership>>
>;

export class SectBenefitService {
  constructor(
    readonly runtime: SectRuntime = productionSectRuntime,
    private readonly organization: SectOrganizationRepositoryPort =
      organizationRepository,
    private readonly memberships: typeof sectRepository = sectRepository,
  ) {}

  permissionSnapshot(membership: Membership) {
    return this.runtime.registry
      .require(membership.sectId)
      .organization.permissions.snapshot(
        membership.discipleRank as SectDiscipleRank,
      );
  }

  assertPermission(membership: Membership, permission: SectPermission): void {
    const policy = this.runtime.registry.require(membership.sectId).organization
      .permissions;
    const rank = membership.discipleRank as SectDiscipleRank;
    if (!policy.allows(rank, permission)) {
      const state = policy.snapshot(rank)[permission];
      throw new SectError(
        'SECT_ORGANIZATION_INVALID',
        state.reason ?? '当前弟子职阶尚无此权限',
        403,
      );
    }
  }

  async getBonuses(
    cultivatorId: string,
    q: DbExecutor | DbTransaction,
  ) {
    const membership = await this.memberships.findMembership(cultivatorId, q);
    if (!membership)
      return { retreatMultiplier: 1, craftDiscount: 0, archiveLevel: 1 };
    const facilities = await this.organization.listSectFacilities(
      membership.sectId,
      q,
    );
    const level = (key: string) =>
      facilities.find((item) => item.facilityKey === key)?.level ?? 1;
    const policy = this.runtime.registry.require(membership.sectId).organization
      .permissions;
    const rank = membership.discipleRank as SectDiscipleRank;
    const cultivationAllowed = policy.allows(rank, 'benefit.cultivation_room');
    const workshopAllowed = policy.allows(rank, 'benefit.workshop');
    return {
      retreatMultiplier: cultivationAllowed
        ? 1 +
          getSectFacilityBonus(
            'cultivation_room',
            level('cultivation_room'),
          )
        : 1,
      craftDiscount: workshopAllowed
        ? getSectCraftDiscount(rank, level('workshop'))
        : 0,
      archiveLevel: level('archive'),
    };
  }

  async applyCraftDiscount(
    cultivatorId: string,
    cost: number,
    q: DbExecutor | DbTransaction,
  ): Promise<number> {
    const { craftDiscount } = await this.getBonuses(cultivatorId, q);
    return Math.max(0, Math.floor(cost * (1 - craftDiscount)));
  }
}

export const sectBenefitService = new SectBenefitService();
