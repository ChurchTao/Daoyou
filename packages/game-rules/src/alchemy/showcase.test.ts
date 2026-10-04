import { describe, expect, it } from 'vitest';
import { QUALITY_VALUES, type Quality } from '@daoyou/constants/qualities';
import type { PillAppearanceGrade } from '@daoyou/game-domain/consumables';
import { alchemyShowcaseSnapshot } from './showcase.js';
import { isInventoryShowcase } from '@daoyou/game-domain/items/catalog';

function pill(quality: Quality, appearance?: PillAppearanceGrade) {
  return {
    id: 'crafted-item',
    name: '回春丹',
    type: '丹药',
    quality,
    quantity: 3,
    spec: {
      kind: 'pill',
      family: 'healing',
      operations: [
        { type: 'restore_resource', resource: 'hp', mode: 'flat', value: 100 },
      ],
      consumeRules: { scene: 'out_of_battle_only', quotaCategory: 'none' },
      alchemyMeta: {
        source: 'improvised',
        sourceMaterials: [],
        stability: 100,
        toxicityRating: 0,
        tags: [],
        version: 4,
        appearance,
      },
    },
  };
}

describe('alchemy showcase', () => {
  it.each(QUALITY_VALUES)(
    'showcases perfect pills of any quality: %s',
    (quality) => {
      const output = pill(quality, 'perfect');
      const snapshot = alchemyShowcaseSnapshot([output]);
      expect(snapshot).toMatchObject({
        definitionId: 'consumable.v1',
        name: output.name,
        quantity: 3,
        instanceData: { quality, spec: output.spec },
      });
      expect(isInventoryShowcase({ version: 1, snapshot })).toBe(true);
      expect(snapshot?.instanceData).not.toHaveProperty('id');
    },
  );

  it.each(['low', 'middle', 'high', undefined] as const)(
    'does not showcase non-perfect pills even at the highest quality: %s',
    (appearance) => {
      expect(
        alchemyShowcaseSnapshot([pill('神品', appearance)]),
      ).toBeUndefined();
    },
  );

  it('checks every batch and selects the highest-quality perfect output', () => {
    const snapshot = alchemyShowcaseSnapshot([
      pill('神品', 'high'),
      pill('凡品', 'perfect'),
      pill('玄品', 'perfect'),
    ]);
    expect(snapshot?.instanceData).toMatchObject({ quality: '玄品' });
  });

  it('ignores empty or invalid output facts', () => {
    expect(alchemyShowcaseSnapshot([])).toBeUndefined();
    expect(
      alchemyShowcaseSnapshot([{ ...pill('凡品', 'perfect'), spec: null }]),
    ).toBeUndefined();
    expect(
      alchemyShowcaseSnapshot([{ ...pill('凡品', 'perfect'), quantity: 0 }]),
    ).toBeUndefined();
  });
});
