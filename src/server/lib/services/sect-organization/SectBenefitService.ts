import {
  SECT_CRAFT_CONTEXTS,
  type SectCapabilityKey,
  type SectCraftContextKey,
  type SectDiscipleRank,
  type SectOrganizationModule,
} from '@shared/engine/sect';
import type {
  SectBenefitQueryContext,
  SectMembershipRecord,
  SectModuleResolver,
} from './ports';
import { SectCapabilityAuthorizer } from './SectCapabilityAuthorizer';

type BenefitMembership = Pick<SectMembershipRecord, 'sectId' | 'discipleRank'>;

export class SectBenefitService {
  constructor(
    private readonly authorizer = new SectCapabilityAuthorizer(),
  ) {}

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
    const organization = modules.require(membership.sectId);
    const rank = membership.discipleRank;
    const snapshot = organization.benefits.snapshot(levels, rank);
    const retreatGranted = organization.capabilities.allows(
      rank,
      'sect.facility.cultivation.use',
    );
    const craftDiscounts = Object.fromEntries(
      Object.values(SECT_CRAFT_CONTEXTS).map((craftContext) => {
        const benefit = organization.benefits.craftDiscount(
          craftContext,
          levels,
          rank,
        );
        return [
          craftContext,
          organization.capabilities.allows(rank, benefit.capability)
            ? snapshot.craftDiscounts[craftContext] ?? 0
            : 0,
        ];
      }),
    ) as Record<SectCraftContextKey, number>;
    return {
      retreatMultiplier: retreatGranted ? snapshot.retreatMultiplier : 1,
      craftDiscounts,
      facilityEffects: snapshot.facilityEffects,
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
