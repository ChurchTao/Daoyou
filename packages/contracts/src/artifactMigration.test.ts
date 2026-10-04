import { expect, it } from 'vitest';
import { ExchangeArtifactSchema } from './artifactMigration.js';

it('不接受客户端指定境界、评分，法兵必须选合法器形', () => {
  const base = {
    productId: '8c9fe71d-2b24-4253-8c91-cfe8cb8f1b35',
    slot: 'weapon',
  };
  expect(
    ExchangeArtifactSchema.safeParse({ ...base, weaponType: 'fan' }).success,
  ).toBe(true);
  for (const value of [
    base,
    { ...base, weaponType: 'fake' },
    { ...base, slot: 'armor', weaponType: 'sword' },
    { ...base, slot: 'armor', equipmentLevel: 90 },
    { ...base, slot: 'armor', score: 9999 },
  ])
    expect(ExchangeArtifactSchema.safeParse(value).success).toBe(false);
  expect(
    ExchangeArtifactSchema.safeParse({ ...base, slot: 'head' }).success,
  ).toBe(true);
});
