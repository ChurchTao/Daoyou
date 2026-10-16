import { describe, expect, it } from 'vitest';
import { TRANSFER_BEAST_LIMIT, TRANSFER_STONE_LIMIT, transferableQuantity, transferredSectMethodLevel } from './policy.js';

describe('transfer item limits', () => {
  it('excludes material.v1 and caps talismans separately', () => {
    expect(transferableQuantity({ definitionId: 'material.v1', instanceData: null, quantity: 100 })).toBe(0);
    expect(transferableQuantity({ definitionId: 'consumable.v1', instanceData: {
      name: '符', type: '符箓', quality: '凡品', description: '', prompt: '', score: 0,
      spec: { kind: 'talisman', scenario: 'test', sessionMode: 'consume_on_action' },
    }, quantity: 20 })).toBe(10);
    expect(transferableQuantity({ definitionId: 'seed.v1', instanceData: null, quantity: 50 })).toBe(30);
  });

  it('applies arrival limits to stones, beasts and sect method damage', () => {
    expect(TRANSFER_STONE_LIMIT).toBe(15_000_000);
    expect(TRANSFER_BEAST_LIMIT).toBe(3);
    expect([1, 15, 16, 50].map(transferredSectMethodLevel)).toEqual([1, 1, 1, 35]);
  });
});
