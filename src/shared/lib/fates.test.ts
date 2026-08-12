import { describe, expect, it } from 'vitest';
import type { FateEffectType, PreHeavenFate } from '@shared/types/cultivator';
import {
  evaluateFateContext,
  getAlchemySpiritStoneMultiplier,
  getMarketPurchasePriceMultiplier,
  getRefineSpiritStoneMultiplier,
  scaleFateAdjustedCost,
} from './fates';

function fate(
  effectType: FateEffectType,
  value: number,
  effectId = effectType,
): PreHeavenFate {
  return {
    name: '测试命格',
    quality: '真品',
    effects: [
      {
        id: `${effectId}:${value}`,
        effectId,
        scope: 'daily',
        polarity: value <= 1 ? 'boon' : 'burden',
        effectType,
        value,
        label: '测试效果',
        description: '测试。',
        rollMeta: {
          qualityAnchor: '真品',
          minValue: value,
          maxValue: value,
          rolledPercentile: 0,
          roundingStep: 0.01,
        },
      },
    ],
  };
}

describe('fate context', () => {
  it('aggregates cost reductions additively instead of multiplying discount multipliers', () => {
    const context = evaluateFateContext([
      fate('alchemy_spirit_stone_multiplier', 0.75, 'alchemy-a'),
      fate('alchemy_spirit_stone_multiplier', 0.75, 'alchemy-b'),
      fate('alchemy_spirit_stone_multiplier', 0.91, 'alchemy-c'),
    ]);

    expect(context.alchemySpiritStoneReduction).toBeCloseTo(0.59);
    expect(getAlchemySpiritStoneMultiplier(context)).toBeCloseTo(0.41);
  });

  it('combines system spirit-stone reductions additively with craft reductions', () => {
    const context = evaluateFateContext([
      fate('refine_spirit_stone_multiplier', 0.8),
      fate('system_spirit_stone_multiplier', 0.9),
    ]);

    expect(context.refineSpiritStoneReduction).toBeCloseTo(0.2);
    expect(context.systemSpiritStoneReduction).toBeCloseTo(0.1);
    expect(getRefineSpiritStoneMultiplier(context)).toBeCloseTo(0.7);
  });

  it('does not cap market reductions at the old 35 percent limit', () => {
    const context = evaluateFateContext([
      fate('market_purchase_price_multiplier', 0.8, 'market-a'),
      fate('market_purchase_price_multiplier', 0.7, 'market-b'),
    ]);

    expect(context.marketPurchasePriceReduction).toBeCloseTo(0.5);
    expect(context.marketPurchasePriceMultiplier).toBeCloseTo(0.5);
    expect(getMarketPurchasePriceMultiplier(context)).toBeCloseTo(0.5);
  });

  it('supports negative reductions for surcharges without producing a negative multiplier', () => {
    const context = evaluateFateContext([
      fate('alchemy_spirit_stone_multiplier', 0.8),
      fate('system_spirit_stone_multiplier', 1.1),
    ]);

    expect(getAlchemySpiritStoneMultiplier(context)).toBeCloseTo(0.9);
  });

  it('keeps every non-zero adjusted cost at one or more', () => {
    expect(scaleFateAdjustedCost(100, 0)).toBe(1);
    expect(scaleFateAdjustedCost(1, 0.01)).toBe(1);
    expect(scaleFateAdjustedCost(0, 0)).toBe(0);
  });

  it('defaults all reductions to zero and multipliers to one', () => {
    const context = evaluateFateContext([]);

    expect(context.alchemySpiritStoneReduction).toBe(0);
    expect(context.marketPurchasePriceReduction).toBe(0);
    expect(getMarketPurchasePriceMultiplier(context)).toBe(1);
  });
});
