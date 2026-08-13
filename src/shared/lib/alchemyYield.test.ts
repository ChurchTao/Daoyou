import { describe, expect, it } from 'vitest';
import {
  calculateAlchemyQiCost,
  buildAlchemyYieldPreview,
  calculateEssenceBuckets,
  calculateRawEssence,
  rollAlchemyYieldProfile,
} from './alchemyYield';
import { PILL_UNIT_ESSENCE_BY_QUALITY } from '@shared/config/alchemyEssenceConfig';
import { QUALITY_ORDER } from '@shared/types/constants';

describe('alchemy yield engine', () => {
  it('charges one qi per 200 raw essence within the 1 to 20 limit', () => {
    expect(calculateAlchemyQiCost([])).toBe(1);
    expect(
      calculateAlchemyQiCost([{ rank: '凡品', type: 'herb', dose: 25 }]),
    ).toBe(1);
    expect(
      calculateAlchemyQiCost([{ rank: '凡品', type: 'herb', dose: 26 }]),
    ).toBe(2);
    expect(
      calculateAlchemyQiCost([{ rank: '神品', type: 'tcdb', dose: 999 }]),
    ).toBe(20);
  });

  it('scales raw essence by material dose and type', () => {
    expect(
      calculateRawEssence([
        { rank: '玄品', type: 'herb', dose: 20 },
        { rank: '神品', type: 'tcdb', dose: 1 },
      ]),
    ).toBe(13800);
  });

  it('creates bounded multi-lot output with deterministic rng', () => {
    const options = {
      materials: [
        { rank: '天品' as const, type: 'herb', dose: 20 },
        { rank: '仙品' as const, type: 'aux', dose: 2 },
      ],
      factors: { synergyScore: 0.8, stability: 85, purity: 0.9 },
      rng: () => 0.5,
    };
    const result = rollAlchemyYieldProfile(options);
    expect(result.lots.length).toBeLessThanOrEqual(8);
    expect(result.totalQuantity).toBeGreaterThan(0);
    expect(result.lots.every((lot) => lot.quantity > 0)).toBe(true);
    expect(result.wastedEssence).toBeGreaterThanOrEqual(0);
    expect(result).toEqual(rollAlchemyYieldProfile(options));
  });

  it('returns no output when the effective essence cannot form a pill', () => {
    const result = rollAlchemyYieldProfile({
      materials: [{ rank: '凡品', type: 'herb', dose: 1 }],
      factors: { conflictScore: 1, stability: 15 },
      rng: () => 0,
    });
    expect(result.totalQuantity).toBe(0);
    expect(result.lots).toHaveLength(0);
  });

  it('allocates mixed-quality essence into distinct quality budgets', () => {
    const result = rollAlchemyYieldProfile({
      materials: [
        { rank: '玄品', type: 'herb', dose: 20 },
        { rank: '神品', type: 'tcdb', dose: 1 },
      ],
      factors: { stability: 70, purity: 0.8 },
      rng: () => 0.5,
    });
    expect(result.primaryQuality).toBe('神品');
    expect(result.lots.some((lot) => lot.quality === '神品')).toBe(true);
    expect(result.lots.some((lot) => lot.quality === '玄品')).toBe(true);
  });

  it('keeps quality material share visible to the internal budget allocator', () => {
    const buckets = calculateEssenceBuckets([
      { rank: '玄品', type: 'herb', dose: 20 },
      { rank: '神品', type: 'tcdb', dose: 1 },
    ]);
    const xuanBucket = buckets.find((bucket) => bucket.quality === '玄品');
    const shenBucket = buckets.find((bucket) => bucket.quality === '神品');
    expect(xuanBucket?.rawEssence).toBe(800);
    expect(shenBucket?.rawEssence).toBe(13000);
    expect((shenBucket?.share ?? 0)).toBeGreaterThan(xuanBucket?.share ?? 0);
  });

  it('preserves high-quality output when the high-quality essence supports it', () => {
    const result = rollAlchemyYieldProfile({
      materials: [
        { rank: '玄品', type: 'herb', dose: 20 },
        { rank: '神品', type: 'herb', dose: 1 },
      ],
      factors: { stability: 60, purity: 0.7 },
      rng: () => 0.5,
    });
    expect(result.lots.some((lot) => lot.quality === '玄品')).toBe(true);
    expect(result.lots.some((lot) => lot.quality === '神品')).toBe(true);
  });

  it('splits a quality batch into appearance lots while preserving quantity and essence budget', () => {
    let cursor = 0;
    const rolls = [0.01, 0.99, 0.4, 0.8, 0.2, 0.7, 0.1, 0.95];
    const result = rollAlchemyYieldProfile({
      materials: [{ rank: '仙品', type: 'herb', dose: 20 }],
      factors: { stability: 75, purity: 0.75 },
      rng: () => rolls[cursor++ % rolls.length],
    });
    const appearances = new Set(result.lots.map((lot) => `${lot.quality}:${lot.appearance}`));
    expect(appearances.size).toBeGreaterThan(1);
    expect(result.lots.reduce((sum, lot) => sum + lot.quantity, 0)).toBe(result.totalQuantity);
    expect(result.lots.reduce((sum, lot) => sum + lot.essenceSpent, 0)).toBeLessThanOrEqual(
      result.essence.effectiveEssence,
    );
  });

  it('converts native remainder into at most one lower quality', () => {
    const result = rollAlchemyYieldProfile({
      materials: [{ rank: '真品', type: 'herb', dose: 6 }],
      factors: { stability: 60, purity: 0.75 },
      rng: () => 0.5,
    });
    expect(result.lots.some((lot) => lot.quality === '真品')).toBe(true);
    expect(result.lots.some((lot) => lot.quality === '玄品')).toBe(true);
    expect(result.lots.every((lot) => lot.quality !== '灵品')).toBe(true);
  });

  it('never uses a lower-quality fallback when no native pool can form a pill', () => {
    const result = rollAlchemyYieldProfile({
      materials: [
        { rank: '真品', type: 'herb', dose: 1 },
        { rank: '玄品', type: 'herb', dose: 1 },
      ],
      factors: { stability: 60, purity: 0.75 },
      rng: () => 0.5,
    });
    expect(result.totalQuantity).toBe(0);
    expect(result.lots).toHaveLength(0);
  });

  it('keeps total quantity when appearance lots are split', () => {
    const result = rollAlchemyYieldProfile({
      materials: [{ rank: '神品', type: 'herb', dose: 20 }],
      factors: { stability: 75, purity: 0.75 },
      rng: () => 0.5,
    });
    expect(result.lots.reduce((sum, lot) => sum + lot.quantity, 0)).toBe(result.totalQuantity);
    expect(result.lots.length).toBeLessThanOrEqual(8);
    expect(result.lots.reduce((sum, lot) => sum + lot.essenceSpent, 0)).toBe(
      result.lots.reduce(
        (sum, lot) => sum + lot.quantity * PILL_UNIT_ESSENCE_BY_QUALITY[lot.quality],
        0,
      ),
    );
  });

  it('caps lots without merging different effects and exposes the remainder as loss', () => {
    const result = rollAlchemyYieldProfile({
      materials: [{ rank: '神品', type: 'herb', dose: 999 }],
      factors: { stability: 100, purity: 0.98 },
      rng: () => 0.5,
    });
    expect(result.lots.length).toBeLessThanOrEqual(8);
    expect(result.totalQuantity).toBeGreaterThan(0);
    const spent = result.lots.reduce((sum, lot) => sum + lot.essenceSpent, 0);
    expect(spent).toBeLessThanOrEqual(result.essence.effectiveEssence);
    expect(result.wastedEssence).toBe(result.essence.effectiveEssence - spent);
  });

  it('never creates quantity beyond the allocated essence budget', () => {
    const result = rollAlchemyYieldProfile({
      materials: [{ rank: '神品', type: 'herb', dose: 999 }],
      factors: { stability: 100, purity: 0.98 },
      // 最大随机值曾经会把数量放大到超过单位药蕴预算。
      rng: () => 0.999999,
    });
    for (const lot of result.lots) {
      expect(lot.essenceSpent).toBe(lot.quantity * PILL_UNIT_ESSENCE_BY_QUALITY[lot.quality]);
      expect(lot.essenceSpent).toBeGreaterThanOrEqual(0);
      expect(lot.quantity).toBeGreaterThan(0);
    }
    expect(result.lots.reduce((sum, lot) => sum + lot.essenceSpent, 0)).toBeLessThanOrEqual(
      result.essence.effectiveEssence,
    );
  });

  it('builds preview ranges by simulating the same yield engine', () => {
    const preview = buildAlchemyYieldPreview({
      materials: [{ rank: '仙品', type: 'herb', dose: 20 }],
      factors: { stability: 75, purity: 0.75 },
    });
    expect(preview.totalQuantityRange.min).toBeGreaterThan(0);
    expect(preview.totalQuantityRange.max).toBeGreaterThanOrEqual(
      preview.totalQuantityRange.min,
    );
    expect(preview.essenceLossRatioRange.min).toBeGreaterThanOrEqual(0);
    expect(preview.essenceLossRatioRange.max).toBeLessThanOrEqual(1);
    expect(preview.possibleQualities.length).toBeGreaterThan(0);
    expect(Object.values(preview.appearanceHints).reduce((sum, value) => sum + (value ?? 0), 0)).toBeCloseTo(1);
  });

  it('keeps a formula roll inside the preview generated from identical factors', () => {
    const materials = [
      { rank: '玄品' as const, type: 'herb', dose: 18 },
      { rank: '灵品' as const, type: 'aux', dose: 6 },
    ];
    const factors = {
      synergyScore: 0.72,
      conflictScore: 0.08,
      fitMultiplier: 1.09,
      stability: 82,
      purity: 0.78,
      masteryLevel: 4,
      minQuality: '灵品' as const,
    };
    const preview = buildAlchemyYieldPreview({ materials, factors });
    let state = Math.floor(0.43 * 0x7fffffff) || 1;
    const result = rollAlchemyYieldProfile({
      materials,
      factors,
      rng: () => {
        state = (state * 48271) % 0x7fffffff;
        return state / 0x7fffffff;
      },
    });

    expect(result.totalQuantity).toBeGreaterThanOrEqual(
      preview.totalQuantityRange.min,
    );
    expect(result.totalQuantity).toBeLessThanOrEqual(
      preview.totalQuantityRange.max,
    );
    expect(QUALITY_ORDER[result.primaryQuality]).toBeGreaterThanOrEqual(
      QUALITY_ORDER[preview.primaryQualityRange.min],
    );
    expect(QUALITY_ORDER[result.primaryQuality]).toBeLessThanOrEqual(
      QUALITY_ORDER[preview.primaryQualityRange.max],
    );
  });
});
