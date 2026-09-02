import {
  ALCHEMY_ALLOWED_MATERIAL_TYPES,
  type AlchemyMaterialType,
} from '@shared/config/alchemyConfig';
import {
  MATERIAL_ESSENCE_BY_QUALITY,
  MATERIAL_ESSENCE_TYPE_MULTIPLIER,
  MAX_ALCHEMY_EFFECTIVE_ESSENCE_MULTIPLIER,
  PILL_UNIT_ESSENCE_BY_QUALITY,
} from '@shared/config/alchemyEssenceConfig';
import {
  BASE_PRICES,
  TYPE_MULTIPLIERS,
} from '@shared/engine/material/creation/config';
import { QUALITY_VALUES, type Quality } from '@shared/types/constants';
import { describe, expect, it } from 'vitest';
import {
  rollAlchemyYieldProfile,
  type AlchemyYieldFactors,
} from './alchemyYield';
import {
  calculateMinimumMaterialAnchorCostPerEssence,
  calculatePillRecycleEconomicAnchor,
  calculatePillRecycleUnitPrice,
  calculateSpiritFruitRecycleUnitPrice,
} from './pillRecyclePrice';
import { PILL_QUALITY_BASE_SCORE } from './pillScore';

describe('calculatePillRecycleUnitPrice', () => {
  const expectedByQuality: Record<Quality, number> = {
    凡品: 62,
    灵品: 350,
    玄品: 750,
    真品: 2062,
    地品: 5789,
    天品: 21634,
    仙品: 58064,
    神品: 173076,
  };

  it.each(QUALITY_VALUES)('按材料单位药蕴成本锚定%s丹药回收价', (quality) => {
    expect(
      calculatePillRecycleUnitPrice(quality, PILL_QUALITY_BASE_SCORE[quality]),
    ).toBe(expectedByQuality[quality]);
  });

  it.each(QUALITY_VALUES)('使用%s材料中最低的单位原始药蕴成本', (quality) => {
    const costs = ALCHEMY_ALLOWED_MATERIAL_TYPES.map(
      (type) =>
        (BASE_PRICES[quality] * TYPE_MULTIPLIERS[type]) /
        (MATERIAL_ESSENCE_BY_QUALITY[quality] *
          MATERIAL_ESSENCE_TYPE_MULTIPLIER[type]),
    );
    expect(calculateMinimumMaterialAnchorCostPerEssence(quality)).toBe(
      Math.min(...costs),
    );
  });

  it('按最大药蕴效率折减经济锚点', () => {
    expect(calculatePillRecycleEconomicAnchor('玄品')).toBe(
      (PILL_UNIT_ESSENCE_BY_QUALITY.玄品 *
        calculateMinimumMaterialAnchorCostPerEssence('玄品')) /
        MAX_ALCHEMY_EFFECTIVE_ESSENCE_MULTIPLIER,
    );
  });

  it('将低评分修正限制在 0.75 倍', () => {
    expect(calculatePillRecycleUnitPrice('玄品', 0)).toBe(562);
  });

  it('将高评分和完美品相限制在安全上限内', () => {
    expect(calculatePillRecycleUnitPrice('神品', 9999, 'perfect')).toBe(
      expectedByQuality.神品,
    );
  });

  it('对非有限评分按最低修正估价', () => {
    expect(calculatePillRecycleUnitPrice('灵品', Number.NaN)).toBe(262);
  });

  it('is monotonic by quality at the standard score', () => {
    const prices = QUALITY_VALUES.map((quality) =>
      calculatePillRecycleUnitPrice(quality, PILL_QUALITY_BASE_SCORE[quality]),
    );
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it.each(QUALITY_VALUES)(
    'keeps every score and appearance quote within the 40%-60% safe anchor band for %s',
    (quality) => {
      const economicAnchor = calculatePillRecycleEconomicAnchor(quality);
      for (const score of [0, PILL_QUALITY_BASE_SCORE[quality], 999999]) {
        for (const appearance of [
          'low',
          'middle',
          'high',
          'perfect',
        ] as const) {
          const price = calculatePillRecycleUnitPrice(
            quality,
            score,
            appearance,
          );
          expect(price).toBeGreaterThanOrEqual(
            Math.floor(economicAnchor * 0.4),
          );
          expect(price).toBeLessThanOrEqual(Math.floor(economicAnchor * 0.6));
        }
      }
    },
  );
});

describe('calculateSpiritFruitRecycleUnitPrice', () => {
  it.each(QUALITY_VALUES)(
    '按同品质标准丹药回收价的 80%% 估算%s灵果',
    (quality) => {
      const pillPrice = calculatePillRecycleUnitPrice(
        quality,
        PILL_QUALITY_BASE_SCORE[quality],
      );
      expect(calculateSpiritFruitRecycleUnitPrice(quality)).toBe(
        Math.max(1, Math.floor(pillPrice * 0.8)),
      );
    },
  );

  it('随品质单调递增', () => {
    const prices = QUALITY_VALUES.map(calculateSpiritFruitRecycleUnitPrice);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });
});

describe('pill recycle anti-arbitrage invariant', () => {
  const factorScenarios: AlchemyYieldFactors[] = [
    {
      conflictScore: 1,
      fitMultiplier: 0.85,
      stability: 15,
      purity: 0.1,
      focusMode: 'focused',
    },
    { stability: 60, purity: 0.5 },
    {
      synergyScore: 1,
      conflictScore: 0,
      fitMultiplier: 1.15,
      stability: 100,
      purity: 0.98,
      masteryLevel: 20,
      focusMode: 'risky',
    },
  ];

  function materialAnchorCost(
    quality: Quality,
    type: AlchemyMaterialType,
    dose: number,
  ): number {
    return BASE_PRICES[quality] * TYPE_MULTIPLIERS[type] * dose;
  }

  function recycleTotal(
    profile: ReturnType<typeof rollAlchemyYieldProfile>,
  ): number {
    return profile.lots.reduce(
      (sum, lot) =>
        sum +
        lot.quantity *
          calculatePillRecycleUnitPrice(lot.quality, 999999, lot.appearance),
      0,
    );
  }

  it('keeps all 1-999 native doses at maximum furnace efficiency below 60% of material cost', () => {
    const maximumEfficiencyFactors = factorScenarios[2]!;
    for (const quality of QUALITY_VALUES) {
      for (const type of ALCHEMY_ALLOWED_MATERIAL_TYPES) {
        for (let dose = 1; dose <= 999; dose += 1) {
          const profile = rollAlchemyYieldProfile({
            materials: [{ rank: quality, type, dose }],
            factors: { ...maximumEfficiencyFactors, minQuality: quality },
            rng: () => 0.999999,
          });
          const inputCost = materialAnchorCost(quality, type, dose);
          expect(recycleTotal(profile)).toBeLessThanOrEqual(
            Math.floor(inputCost * 0.6),
          );
        }
      }
    }
  });

  it('keeps mixed-quality and one-step degraded output below 60% of material cost', () => {
    const batches = [
      [
        { rank: '真品' as const, type: 'herb' as const, dose: 6 },
        { rank: '玄品' as const, type: 'monster' as const, dose: 17 },
      ],
      [
        { rank: '神品' as const, type: 'tcdb' as const, dose: 2 },
        { rank: '天品' as const, type: 'aux' as const, dose: 31 },
        { rank: '凡品' as const, type: 'ore' as const, dose: 999 },
      ],
      QUALITY_VALUES.map((rank, index) => ({
        rank,
        type: ALCHEMY_ALLOWED_MATERIAL_TYPES[
          index % ALCHEMY_ALLOWED_MATERIAL_TYPES.length
        ],
        dose: 7 + index * 13,
      })),
    ];

    for (const materials of batches) {
      for (const factors of factorScenarios) {
        const profile = rollAlchemyYieldProfile({
          materials,
          factors,
          rng: () => 0.999999,
        });
        const inputCost = materials.reduce(
          (sum, material) =>
            sum +
            materialAnchorCost(material.rank, material.type, material.dose),
          0,
        );
        expect(recycleTotal(profile)).toBeLessThanOrEqual(
          Math.floor(inputCost * 0.6),
        );
      }
    }
  });
});
