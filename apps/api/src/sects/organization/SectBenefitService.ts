import {
  SECT_CRAFT_CONTEXTS,
  resolveSectBenefitSnapshot,
  type SectCapabilityKey,
  type SectCraftContextKey,
  type SectDiscipleRank,
  type SectOrganizationModule,
} from '@daoyou/game-rules/sect-organization';
import type {
  SectBenefitQueryContext,
  SectMembershipRecord,
  SectModuleResolver,
} from '@server/sects/organization/ports.js';
import { SectCapabilityAuthorizer } from '@server/sects/organization/SectCapabilityAuthorizer.js';

type BenefitMembership = Pick<SectMembershipRecord, 'sectId' | 'discipleRank'>;

export class SectBenefitService {
  constructor(private readonly authorizer = new SectCapabilityAuthorizer()) {}

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
    this.authorizer.assert(membership, capability, modules);
  }

  assertOrganizationPermission(
    organization: SectOrganizationModule,
    rank: SectDiscipleRank,
    capability: SectCapabilityKey,
  ): void {
    this.authorizer.assertOrganization(organization, rank, capability);
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
        facilityEffects: {},
      };
    const facilities = await context.facilities.list(membership.sectId);
    const levels = new Map(
      facilities.map((item) => [item.facilityKey, item.level]),
    );
    return this.snapshotForMembership(membership, levels, context.modules);
  }

  snapshotForMembership(
    membership: BenefitMembership,
    levels: ReadonlyMap<string, number>,
    modules: SectModuleResolver,
  ) {
    return resolveSectBenefitSnapshot(
      modules.require(membership.sectId),
      membership.discipleRank,
      levels,
    );
  }

  async applyCraftDiscount(
    cultivatorId: string,
    cost: number,
    craftContext: SectCraftContextKey,
    context: SectBenefitQueryContext,
  ): Promise<number> {
    const { craftDiscounts } = await this.getBonuses(cultivatorId, context);
    return Math.max(0, Math.floor(cost * (1 - craftDiscounts[craftContext])));
  }
}
