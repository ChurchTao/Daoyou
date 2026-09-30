import { expect, it } from 'vitest';
import { inventoryStackIdentity } from './stack-key';
it('normalizes key order and defaults while preserving every material fact', () => {
  const facts = { name: '玄铁', type: 'ore', rank: '凡品' };
  const identity = inventoryStackIdentity('material.v1', facts);
  expect(identity).toBe('6:玄铁3:ore6:凡品0:0:');
  expect(
    inventoryStackIdentity('material.v1', {
      rank: '凡品',
      type: 'ore',
      name: ' 玄铁 ',
      element: null,
      description: '',
    }),
  ).toBe(identity);
  for (const change of [
    { description: '不同描述' },
    { name: '灵铁' },
    { rank: '灵品' },
    { type: 'aux' },
    { element: '金' },
  ])
    expect(
      inventoryStackIdentity('material.v1', { ...facts, ...change }),
    ).not.toBe(identity);
  expect(inventoryStackIdentity('blueprint.weapon.10', null)).toBe(
    'definition.v1:blueprint.weapon.10',
  );
  expect(inventoryStackIdentity('equipment.v6', {})).toBeNull();
});

it('stacks pills across batch details but keeps effects and value separate', () => {
  const pill = {
    name: '厚土蕴灵丹',
    type: '丹药' as const,
    quality: '玄品' as const,
    score: 401,
    spec: {
      kind: 'pill' as const,
      family: 'cultivation' as const,
      operations: [
        {
          type: 'gain_progress' as const,
          target: 'cultivation_exp' as const,
          value: 100,
        },
      ],
      consumeRules: {
        scene: 'out_of_battle_only' as const,
        quotaCategory: 'none' as const,
      },
      alchemyMeta: {
        source: 'formula' as const,
        sourceMaterials: ['灵草甲'],
        stability: 95,
        toxicityRating: 0,
        tags: ['cultivation'],
        version: 4 as const,
      },
    },
  };
  const key = inventoryStackIdentity('consumable.v1', pill);
  expect(
    inventoryStackIdentity('consumable.v1', {
      ...pill,
      spec: {
        ...pill.spec,
        alchemyMeta: {
          ...pill.spec.alchemyMeta,
          sourceMaterials: ['灵草乙'],
          batch: { lotQuantity: 7 },
        },
      },
    }),
  ).toBe(key);
  expect(inventoryStackIdentity('consumable.v1', { ...pill, score: 402 })).not.toBe(key);
  expect(
    inventoryStackIdentity('consumable.v1', {
      ...pill,
      spec: {
        ...pill.spec,
        operations: [{ ...pill.spec.operations[0], value: 101 }],
      },
    }),
  ).not.toBe(key);
  expect(
    inventoryStackIdentity('consumable.v1', {
      ...pill,
      spec: {
        ...pill.spec,
        alchemyMeta: { ...pill.spec.alchemyMeta, appearance: 'perfect' },
      },
    }),
  ).not.toBe(key);
  expect(
    inventoryStackIdentity('consumable.v1', {
      ...pill,
      spec: {
        ...pill.spec,
        alchemyMeta: {
          ...pill.spec.alchemyMeta,
          breakthroughTargetRealm: '元婴',
        },
      },
    }),
  ).not.toBe(key);
});
