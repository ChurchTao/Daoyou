import type {
  SectBenefitSnapshot,
  SectCraftContextKey,
  SectOrganizationModule,
} from '@daoyou/game-domain/sects/commands';
import type { SectDiscipleRank } from '../domain/index.js';
import { SECT_CRAFT_CONTEXTS } from '@daoyou/game-domain/sects/commands';

export type ResolvedSectBenefitSnapshot = SectBenefitSnapshot & {
  archiveLevel: number;
  methodLevelCap: number;
};

export function resolveSectBenefitSnapshot(
  organization: SectOrganizationModule,
  rank: SectDiscipleRank,
  levels: ReadonlyMap<string, number>,
): ResolvedSectBenefitSnapshot {
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
          ? (snapshot.craftDiscounts[craftContext] ?? 0)
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
