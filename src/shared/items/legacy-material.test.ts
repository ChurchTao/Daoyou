import { describe, expect, it } from 'vitest';
import { forgingBoosts } from '../forging/rules';
import { groupAlchemyBagMaterials } from '../inventory/alchemy';
import { addItems } from '../inventory/test-helpers';
import { MaterialFactsSchema } from './definitions/materials';
import { legacyMaterialUnavailableReason } from './legacy-material';

describe('legacy material connectivity', () => {
  it('preserves both manual categories in ordinary inventory without granting crafting uses', () => {
    let sequence = 0;
    const id = () => `material-${++sequence}`;
    let inventory: ReturnType<typeof addItems> = [];
    for (const type of ['gongfa_manual', 'skill_manual'] as const) {
      const facts = MaterialFactsSchema.parse({
        name: '旧藏残卷',
        type,
        rank: '凡品',
        element: '木',
        description: '保留原始记载。',
      });
      expect(legacyMaterialUnavailableReason(facts)).toBeUndefined();
      const grant = {
        definitionId: 'material.v1',
        quantity: 2,
        instanceData: facts,
      };
      inventory = addItems(inventory, grant, 'bag', false, id);
      inventory = addItems(inventory, grant, 'bag', false, id);
      expect(() => forgingBoosts(10, 10, [{ facts, quantity: 1 }])).toThrow();
    }
    expect(inventory).toHaveLength(2);
    expect(inventory.map((item) => item.quantity)).toEqual([4, 4]);
    expect(inventory.map((item) => item.instanceData)).toEqual([
      expect.objectContaining({
        type: 'gongfa_manual',
        element: '木',
        description: '保留原始记载。',
      }),
      expect.objectContaining({
        type: 'skill_manual',
        element: '木',
        description: '保留原始记载。',
      }),
    ]);
    expect(groupAlchemyBagMaterials(inventory)).toEqual([]);
  });

  it('rejects unidentified facts even if a hidden reveal exists, without rewriting them', () => {
    const old = {
      type: 'ore',
      rank: '凡品',
      details: { mystery: {}, __serverHiddenMysteryReveal: { name: '玄铁' } },
    };
    const before = structuredClone(old);
    expect(legacyMaterialUnavailableReason(old)).toContain('已弃用');
    expect(old).toEqual(before);
  });

  it('rejects historical seeds with missing or malformed growth facts', () => {
    for (const details of [undefined, {}, { seedSpec: {} }])
      expect(
        legacyMaterialUnavailableReason({
          type: 'seed',
          rank: '凡品',
          details,
        }),
      ).toContain('已弃用');
    expect(
      legacyMaterialUnavailableReason({ type: 'herb', rank: '凡品' }),
    ).toBeUndefined();
  });
});
