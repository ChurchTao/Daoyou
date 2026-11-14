import { describe, expect, it } from 'vitest';
import { ExchangeSeedSchema } from './seedMigration.js';

const request = {
  requestId: '80000000-0000-4000-8000-000000000001',
  source: 'inventory',
  id: '80000000-0000-4000-8000-000000000002',
  quantity: 2,
  expectedQuantity: 3,
  revision: 0,
};

describe('legacy seed conversion request', () => {
  it('requires a complete inventory identity and bounded amount', () => {
    expect(ExchangeSeedSchema.safeParse(request).success).toBe(true);
    for (const change of [
      { revision: undefined },
      { revision: -1 },
      { quantity: 0 },
      { quantity: 4 },
      { quantity: 1000, expectedQuantity: 1000 },
      { quality: '神品' },
      { speciesId: 'world_tree' },
    ])
      expect(
        ExchangeSeedSchema.safeParse({ ...request, ...change }).success,
      ).toBe(false);
  });

  it('accepts only the legacy vault quantity boundary for vault sources', () => {
    const vault = { ...request, source: 'vault', revision: undefined };
    expect(ExchangeSeedSchema.safeParse(vault).success).toBe(true);
    expect(
      ExchangeSeedSchema.safeParse({ ...vault, revision: 0 }).success,
    ).toBe(false);
    expect(
      ExchangeSeedSchema.safeParse({ ...vault, id: 'wrong-id' }).success,
    ).toBe(false);
  });
});
