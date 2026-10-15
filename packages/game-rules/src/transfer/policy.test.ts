import { describe, expect, it } from 'vitest';
import { transferableQuantity } from './policy.js';

describe('transfer item limits', () => {
  it('excludes material.v1 and caps talismans separately', () => {
    expect(transferableQuantity({ definitionId: 'material.v1', instanceData: null, quantity: 100 })).toBe(0);
    expect(transferableQuantity({ definitionId: 'consumable.v1', instanceData: {
      name: '符', type: '符箓', quality: '凡品', description: '', prompt: '', score: 0,
      spec: { kind: 'talisman', scenario: 'test', sessionMode: 'consume_on_action' },
    }, quantity: 20 })).toBe(10);
    expect(transferableQuantity({ definitionId: 'seed.v1', instanceData: null, quantity: 50 })).toBe(30);
  });
});
