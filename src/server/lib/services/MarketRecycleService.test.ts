import { describe, expect, it, vi } from 'vitest';

vi.mock('@server/lib/drizzle/db', () => ({
  getExecutor: vi.fn(),
}));

vi.mock('@server/lib/redis', () => ({
  redis: {
    del: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock('@server/lib/repositories/creationProductRepository', () => ({
  deleteArtifactsByIdsAndCultivator: vi.fn(),
  findArtifactsByIdsAndCultivator: vi.fn(),
  findEquippedArtifacts: vi.fn(),
}));

import { BASE_PRICES } from '@shared/engine/material/creation/config';
import {
  calculateArtifactUnitPrice,
  calculateHighTierUnitPrice,
} from './MarketRecycleService';

describe('MarketRecycleService price caps', () => {
  it('caps high-tier material recycle price at 60% of production anchor', () => {
    const price = calculateHighTierUnitPrice(
      { rank: '神品', type: 'tcdb' },
      {
        rating: 'S',
        comment: '测试',
        keywords: ['本源', '法则'],
      },
    );

    expect(price).toBe(Math.floor(BASE_PRICES.神品 * 2.5 * 0.6));
  });

  it('caps artifact recycle price at 60% of same-quality material anchor', () => {
    const price = calculateArtifactUnitPrice({
      quality: '神品',
      score: 3000,
      slot: 'weapon',
      attributeModifiers: [{}, {}, {}, {}, {}] as any,
    });

    expect(price).toBe(Math.floor(BASE_PRICES.神品 * 0.6));
  });
});
