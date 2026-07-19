import {
  SECT_CRAFT_CONTEXTS,
  type SectCapabilityKey,
  type SectCraftContextKey,
  type SectDiscipleRank,
  type SectOrganizationModule,
} from '@shared/engine/sect';
import { SectError } from '../SectError';
import type {
  SectBenefitQueryContext,
  SectMembershipRecord,
  SectModuleResolver,
} from './ports';

type BenefitMembership = Pick<SectMembershipRecord, 'sectId' | 'discipleRank'>;

export class SectBenefitService {
  permissionSnapshot(
    membership: BenefitMembership,
    modules: SectModuleResolver,
  ) {
    return modules
      .require(membership.sectId)
      .capabilities.snapshot(membership.discipleRank);
  }

  assertPermission(
    membership: BenefitMembership,
    capability: SectCapabilityKey,
    modules: SectModuleResolver,
  ): void {
    this.assertOrganizationPermission(
      modules.require(membership.sectId),
      membership.discipleRank,
      capability,
    );
  }

  assertOrganizationPermission(
    organization: SectOrganizationModule,
    rank: SectDiscipleRank,
    capability: SectCapabilityKey,
  ): void {
    if (organization.capabilities.allows(rank, capability)) return;
    const state = organization.capabilities.snapshot(rank)[capability];
    throw new SectError(
      'SECT_ORGANIZATION_INVALID',
      state?.reason ?? '当前弟子职阶尚无此权限',
      403,
    );
  }

  async getBonuses(cultivatorId: string, context: SectBenefitQueryContext) {
    const membership = await context.memberships.findByCultivator(cultivatorId);
    if (!membership)
      return {
        retreatMultiplier: 1,
        craftDiscounts: {
          [SECT_CRAFT_CONTEXTS.alchemy]: 0,
          [SECT_CRAFT_CONTEXTS.refinery]: 0,
        },
        archiveLevel: 1,
        methodLevelCap: 20,
      };
    const facilities = await context.facilities.list(membership.sectId);
    const levels = new Map(
      facilities.map((item) => [item.facilityKey, item.level]),
    );
    const organization = context.modules.require(membership.sectId);
    const rank = membership.discipleRank;
    return {
      retreatMultiplier: organization.capabilities.allows(
        rank,
        'sect.facility.cultivation.use',
      )
        ? organization.benefits.retreatMultiplier(levels, rank)
        : 1,
      craftDiscounts: Object.fromEntries(
        Object.values(SECT_CRAFT_CONTEXTS).map((craftContext) => {
          const benefit = organization.benefits.craftDiscount(
            craftContext,
            levels,
            rank,
          );
          return [
            craftContext,
            organization.capabilities.allows(rank, benefit.capability)
              ? benefit.discount
              : 0,
          ];
        }),
      ) as Record<SectCraftContextKey, number>,
      archiveLevel: organization.benefits.archiveLevel(levels),
      methodLevelCap: organization.benefits.methodLevelCap(levels),
    };
  }

  async applyCraftDiscount(
    cultivatorId: string,
    cost: number,
    craftContext: SectCraftContextKey,
    context: SectBenefitQueryContext,
  ): Promise<number> {
    const { craftDiscounts } = await this.getBonuses(cultivatorId, context);
    return Math.max(
      0,
      Math.floor(cost * (1 - craftDiscounts[craftContext])),
    );
  }
}
