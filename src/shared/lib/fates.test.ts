import { describe, expect, it } from 'vitest';
import type { PreHeavenFate } from '@shared/types/cultivator';
import {
  evaluateFateContext,
  getMarketPurchasePriceMultiplier,
} from './fates';

function marketFate(value: number): PreHeavenFate {
  return {
    name: '识价命',
    quality: '真品',
    effects: [
      {
        id: `market:${value}`,
        effectId: 'market-purchase-discount',
        scope: 'daily',
        polarity: 'boon',
        effectType: 'market_purchase_price_multiplier',
        value,
        label: '坊市购买价格降低',
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
  it('aggregates and clamps market purchase price multiplier', () => {
    const context = evaluateFateContext([marketFate(0.8), marketFate(0.7)]);

    expect(context.marketPurchasePriceMultiplier).toBe(0.65);
    expect(getMarketPurchasePriceMultiplier(context)).toBe(0.65);
  });

  it('defaults market purchase price multiplier to no discount', () => {
    const context = evaluateFateContext([]);

    expect(context.marketPurchasePriceMultiplier).toBe(1);
    expect(getMarketPurchasePriceMultiplier(context)).toBe(1);
  });
});
