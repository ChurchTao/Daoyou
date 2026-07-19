import { productionSectRuntime } from '@shared/engine/sect/content';
import {
  SECT_CRAFT_CONTEXTS,
  StandardSectCapabilityPolicy,
  type SectDiscipleRank,
  type SectOrganizationModule,
} from '@shared/engine/sect';
import { FIXTURE_SECT_MODULE } from '@shared/engine/sect/testing/fixtures/FixtureSectModule';
import { describe, expect, it } from 'vitest';
import { SectBenefitService } from './SectBenefitService';
import type { SectBenefitQueryContext } from './ports';

function context(rank: SectDiscipleRank): SectBenefitQueryContext {
  return {
    memberships: {
      findByCultivator: async () => ({
        id: 'membership-1',
        cultivatorId: 'cultivator-1',
        sectId: 'lingxiao',
        discipleRank: rank,
        contribution: 0,
      }),
    },
    facilities: {
      list: async () => [
        { sectId: 'lingxiao', facilityKey: 'archive', level: 3, updatedAt: new Date(0) },
        { sectId: 'lingxiao', facilityKey: 'cultivation_room', level: 5, updatedAt: new Date(0) },
        { sectId: 'lingxiao', facilityKey: 'workshop', level: 5, updatedAt: new Date(0) },
      ],
    },
    modules: {
      require: (sectId) => productionSectRuntime.registry.require(sectId).organization,
    },
  };
}

describe('SectBenefitService', () => {
  it.each([
    ['registered', 1, 0],
    ['outer', 1.1, 0],
    ['inner', 1.1, 0.1],
    ['true', 1.1, 0.2],
  ] as const)(
    'applies facility benefits only after the %s capability gate',
    async (rank, retreatMultiplier, craftDiscount) => {
      expect(await new SectBenefitService().getBonuses('cultivator-1', context(rank)))
        .toMatchObject({
          retreatMultiplier,
          craftDiscounts: {
            'sect.craft.alchemy': craftDiscount,
            'sect.craft.refinery': craftDiscount,
          },
          archiveLevel: 3,
          methodLevelCap: 60,
        });
    },
  );

  it('evaluates alchemy and refinery benefits with their own capabilities', async () => {
    const fixture = FIXTURE_SECT_MODULE.organization;
    const organization: SectOrganizationModule = {
      ...fixture,
      capabilities: new StandardSectCapabilityPolicy({
        'sect.facility.alchemy.use': 'outer',
        'sect.facility.refinery.use': 'inner',
      }),
      benefits: {
        ...fixture.benefits,
        snapshot: () => ({
          retreatMultiplier: 1,
          craftDiscounts: {
            [SECT_CRAFT_CONTEXTS.alchemy]: 0.1,
            [SECT_CRAFT_CONTEXTS.refinery]: 0.2,
          },
          facilityEffects: {},
        }),
        craftDiscount: (craftContext) => ({
          capability:
            craftContext === SECT_CRAFT_CONTEXTS.alchemy
              ? 'sect.facility.alchemy.use'
              : 'sect.facility.refinery.use',
          discount: craftContext === SECT_CRAFT_CONTEXTS.alchemy ? 0.1 : 0.2,
        }),
      },
    };
    const splitContext: SectBenefitQueryContext = {
      memberships: {
        findByCultivator: async () => ({
          id: 'membership-1',
          cultivatorId: 'cultivator-1',
          sectId: 'fixture-sect',
          discipleRank: 'outer',
          contribution: 0,
        }),
      },
      facilities: { list: async () => [] },
      modules: { require: () => organization },
    };
    const service = new SectBenefitService();
    expect(await service.getBonuses('cultivator-1', splitContext)).toMatchObject({
      craftDiscounts: {
        'sect.craft.alchemy': 0.1,
        'sect.craft.refinery': 0,
      },
    });
    expect(
      await service.applyCraftDiscount(
        'cultivator-1',
        100,
        SECT_CRAFT_CONTEXTS.alchemy,
        splitContext,
      ),
    ).toBe(90);
    expect(
      await service.applyCraftDiscount(
        'cultivator-1',
        100,
        SECT_CRAFT_CONTEXTS.refinery,
        splitContext,
      ),
    ).toBe(100);
  });
});
