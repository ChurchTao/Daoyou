jest.mock('@/lib/drizzle/db', () => ({
  getExecutor: jest.fn(),
}));
jest.mock('@/lib/redis', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  },
}));
jest.mock('@/utils/aiClient', () => ({
  object: jest.fn(),
}));

import {
  buildFallbackAppraisal,
  calculateHighTierUnitPrice,
  calculateKeywordBonus,
  calculateLowTierUnitPrice,
} from './MarketRecycleService';

describe('MarketRecycleService pricing helpers', () => {
  it('calculates low tier unit price with conservative formula', () => {
    const price = calculateLowTierUnitPrice({ rank: '玄品', type: 'herb' });
    expect(price).toBeGreaterThan(380);
    expect(price).toBeLessThan(520);
  });

  it('applies keyword bonus cap and floor', () => {
    const positive = calculateKeywordBonus(['本源法则', '上古残缺']);
    expect(positive).toBeGreaterThan(0);
    expect(positive).toBeLessThanOrEqual(0.4);

    const negative = calculateKeywordBonus(['驳杂', '残缺', '杂质']);
    expect(negative).toBeGreaterThanOrEqual(-0.12);
  });

  it('calculates high tier unit price with appraisal multipliers', () => {
    const base = calculateHighTierUnitPrice(
      { rank: '真品', type: 'ore' },
      {
        rating: 'C',
        comment: '平平无奇，灵韵尚存，可作寻常炉料使用，不足以列为珍材。',
        keywords: ['普通'],
      },
    );
    const premium = calculateHighTierUnitPrice(
      { rank: '真品', type: 'ore' },
      {
        rating: 'S',
        comment: '此物内蕴本源法则，纹理浑然天成，疑有上古遗脉加持，可列绝世。',
        keywords: ['本源', '法则', '上古'],
      },
    );
    expect(premium).toBeGreaterThan(base);
  });

  it('returns fallback appraisal with stable shape', () => {
    const fallback = buildFallbackAppraisal({
      name: '古冢寒砂',
      type: 'ore',
      rank: '地品',
      quantity: 1,
    });
    expect(fallback.rating).toBe('C');
    expect(fallback.comment.length).toBeGreaterThanOrEqual(40);
    expect(Array.isArray(fallback.keywords)).toBe(true);
  });
});
