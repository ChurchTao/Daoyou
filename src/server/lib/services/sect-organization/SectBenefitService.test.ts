import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findMembership: vi.fn(),
  listSectFacilities: vi.fn(),
}));

vi.mock('@server/lib/repositories/sectRepository', () => ({
  findMembership: mocks.findMembership,
}));
vi.mock('@server/lib/repositories/sectOrganizationRepository', () => ({
  listSectFacilities: mocks.listSectFacilities,
}));

import { SectBenefitService } from './SectBenefitService';

describe('SectBenefitService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listSectFacilities.mockResolvedValue([
      { facilityKey: 'archive', level: 3 },
      { facilityKey: 'cultivation_room', level: 5 },
      { facilityKey: 'workshop', level: 5 },
    ]);
  });

  it.each([
    ['registered', 1, 0],
    ['outer', 1.1, 0],
    ['inner', 1.1, 0.1],
    ['true', 1.1, 0.2],
  ] as const)(
    'applies facility benefits only after the %s permission gate',
    async (discipleRank, retreatMultiplier, craftDiscount) => {
      mocks.findMembership.mockResolvedValue({
        sectId: 'lingxiao',
        discipleRank,
      });
      const result = await new SectBenefitService().getBonuses(
        'cultivator-1',
        {} as never,
      );
      expect(result).toEqual({
        retreatMultiplier,
        craftDiscount,
        archiveLevel: 3,
      });
    },
  );
});
