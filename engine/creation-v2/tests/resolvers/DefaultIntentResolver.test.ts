import { DefaultIntentResolver } from '@/engine/creation-v2/resolvers/DefaultIntentResolver';
import type { MaterialFingerprint } from '@/engine/creation-v2/types';

function createFingerprint(materialName: string): MaterialFingerprint {
  return {
    materialName,
    materialType: 'ore',
    rank: '玄品',
    quantity: 1,
    explicitTags: [],
    semanticTags: [],
    recipeTags: [],
    energyValue: 10,
    rarityWeight: 3,
  };
}

describe('DefaultIntentResolver', () => {
  const resolver = new DefaultIntentResolver();

  it('应保留调用方显式指定的 artifact 槽位并记录来源', () => {
    const intent = resolver.resolve(
      {
        productType: 'artifact',
        requestedSlot: 'accessory',
        materials: [],
      },
      [createFingerprint('灵纹玉佩')],
    );

    expect(intent.slotBias).toBe('accessory');
    expect(intent.slotBiasSource).toBe('requested');
    expect(intent.trace?.[0]?.ruleId).toBe('intent.slot_bias');
  });

  it('应按材料关键词推断 armor 槽位并记录 trace', () => {
    const intent = resolver.resolve(
      {
        productType: 'artifact',
        materials: [],
      },
      [createFingerprint('玄甲铁片')],
    );

    expect(intent.slotBias).toBe('armor');
    expect(intent.slotBiasSource).toBe('inferred_keyword_armor');
    expect(intent.trace?.[0]?.details?.source).toBe('inferred_keyword_armor');
  });

  it('应按材料关键词推断 accessory 槽位并记录 trace', () => {
    const intent = resolver.resolve(
      {
        productType: 'artifact',
        materials: [],
      },
      [createFingerprint('回风灵佩')],
    );

    expect(intent.slotBias).toBe('accessory');
    expect(intent.slotBiasSource).toBe('inferred_keyword_accessory');
    expect(intent.trace?.[0]?.details?.source).toBe('inferred_keyword_accessory');
  });

  it('未匹配到关键词时应回退到 weapon 并留下审计信息', () => {
    const intent = resolver.resolve(
      {
        productType: 'artifact',
        materials: [],
      },
      [createFingerprint('寒铁矿')],
    );

    expect(intent.slotBias).toBe('weapon');
    expect(intent.slotBiasSource).toBe('default_weapon_fallback');
    expect(intent.trace?.[0]?.details?.source).toBe('default_weapon_fallback');
  });
});