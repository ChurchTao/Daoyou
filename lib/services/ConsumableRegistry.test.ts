import { ConsumableRegistry } from './ConsumableRegistry';

describe('ConsumableRegistry', () => {
  it('maps marrow wash pills to long-term root-only specs', () => {
    const consumable = ConsumableRegistry.normalizeConsumable({
      name: '九转洗髓丹',
      type: '丹药',
      quality: '天品',
      quantity: 1,
    });

    expect(consumable.category).toBe('marrow_wash');
    expect(consumable.quotaKind).toBe('long_term_pill');
    expect(consumable.useSpec?.spiritualRootDelta).toBeDefined();
    expect(consumable.useSpec?.attributeDelta).toBeUndefined();
  });

  it('keeps healing and detox pills outside long-term quota counting', () => {
    const healing = ConsumableRegistry.normalizeConsumable({
      name: '回春丹',
      type: '丹药',
      quality: '灵品',
      quantity: 1,
    });
    const detox = ConsumableRegistry.normalizeConsumable({
      name: '清毒丹',
      type: '丹药',
      quality: '灵品',
      quantity: 1,
    });

    expect(healing.category).toBe('healing');
    expect(healing.quotaKind).toBeUndefined();
    expect(detox.category).toBe('detox');
    expect(detox.quotaKind).toBeUndefined();
  });

  it('maps talismans to session-lock mechanics instead of direct buffs', () => {
    const talisman = ConsumableRegistry.normalizeConsumable({
      name: '天机逆命符',
      type: '符箓',
      quality: '仙品',
      quantity: 1,
    });

    expect(talisman.category).toBe('talisman_key');
    expect(talisman.mechanicKey).toBe('fate_reshape_access');
    expect(talisman.useSpec?.talisman?.scenario).toBe('fate_reshape');
  });
});

