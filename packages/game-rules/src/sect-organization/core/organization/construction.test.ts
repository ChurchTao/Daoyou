import {
  applySectFacilityConstruction,
  getSectFacilityUpgradeTarget,
  quoteSectConstructionDonation,
  SECT_CONSTRUCTION_DONATION_OPTIONS,
} from './construction.js';

describe('sect facility construction', () => {
  it('quotes the five fixed spirit stone tiers', () => {
    expect(SECT_CONSTRUCTION_DONATION_OPTIONS).toEqual([
      { spiritStones: 10_000, constructionPoints: 1, contribution: 1 },
      { spiritStones: 50_000, constructionPoints: 5, contribution: 3 },
      { spiritStones: 100_000, constructionPoints: 10, contribution: 5 },
      { spiritStones: 200_000, constructionPoints: 20, contribution: 10 },
      { spiritStones: 400_000, constructionPoints: 40, contribution: 20 },
    ]);
    expect(() => quoteSectConstructionDonation(30_000)).toThrow(
      '建设灵石档位无效',
    );
  });

  it('uses the fixed level targets', () => {
    expect(
      [1, 2, 3, 4, 5].map((level) => getSectFacilityUpgradeTarget(level)),
    ).toEqual([250, 500, 900, 1_500, null]);
  });

  it('carries overflow progress into the next level', () => {
    expect(
      applySectFacilityConstruction({
        level: 1,
        progress: 245,
        maxLevel: 5,
        upgradeable: true,
        constructionPoints: 40,
      }),
    ).toEqual({ level: 2, progress: 35, upgraded: true });
  });

  it('clears overflow when reaching max level', () => {
    expect(
      applySectFacilityConstruction({
        level: 4,
        progress: 1_490,
        maxLevel: 5,
        upgradeable: true,
        constructionPoints: 40,
      }),
    ).toEqual({ level: 5, progress: 0, upgraded: true });
  });

  it('rejects locked and max-level facilities', () => {
    expect(() =>
      applySectFacilityConstruction({
        level: 0,
        progress: 0,
        maxLevel: 0,
        upgradeable: false,
        constructionPoints: 1,
      }),
    ).toThrow('该设施不可建设');
    expect(() =>
      applySectFacilityConstruction({
        level: 5,
        progress: 0,
        maxLevel: 5,
        upgradeable: true,
        constructionPoints: 1,
      }),
    ).toThrow('该设施已满级');
  });
});
