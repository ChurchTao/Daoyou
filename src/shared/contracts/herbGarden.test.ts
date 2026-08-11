import {
  HERB_CATALOG,
  HERB_GARDEN_MAX_GROWTH_REDUCTION,
  HERB_GARDEN_MAX_STEAL_RATIO,
  HERB_GARDEN_MAX_YIELD_BONUS,
  HERB_SEED_QUALITY_CONFIG,
  HERB_SEED_QUALITY_VALUES,
  nextHerbQuality,
} from './herbGarden';

describe('herb garden economy invariants', () => {
  it('keeps seed quality bonuses monotonic without reaching global caps', () => {
    let previousGrowth = -1;
    let previousYield = -1;
    let previousMutation = -1;

    for (const quality of HERB_SEED_QUALITY_VALUES) {
      const config = HERB_SEED_QUALITY_CONFIG[quality];
      expect(config.growthReduction).toBeGreaterThanOrEqual(previousGrowth);
      expect(config.yieldBonus).toBeGreaterThanOrEqual(previousYield);
      expect(config.mutationBonus).toBeGreaterThanOrEqual(previousMutation);
      expect(config.growthReduction).toBeLessThan(HERB_GARDEN_MAX_GROWTH_REDUCTION);
      expect(config.yieldBonus).toBeLessThan(HERB_GARDEN_MAX_YIELD_BONUS);
      previousGrowth = config.growthReduction;
      previousYield = config.yieldBonus;
      previousMutation = config.mutationBonus;
    }
  });

  it('keeps friend harvest as a minority share and always protects owner yield', () => {
    for (const herb of HERB_CATALOG) {
      const stealLimit = Math.min(
        Math.floor(herb.baseYield * HERB_GARDEN_MAX_STEAL_RATIO),
        Math.max(0, herb.baseYield - 1),
      );
      expect(stealLimit).toBeGreaterThanOrEqual(0);
      expect(stealLimit).toBeLessThan(herb.baseYield);
      expect(herb.baseYield - stealLimit).toBeGreaterThanOrEqual(1);
    }
  });

  it('uses mutation as a one-step quality conversion', () => {
    expect(nextHerbQuality('玄品')).toBe('真品');
    expect(nextHerbQuality('真品')).toBe('地品');
    expect(nextHerbQuality('神品')).toBe('神品');
  });

  it('keeps seed return probabilities below guaranteed self-replication', () => {
    for (const herb of HERB_CATALOG) {
      expect(herb.seedReturnChance).toBeGreaterThan(0);
      expect(herb.seedReturnChance).toBeLessThan(1);
    }
  });
});
