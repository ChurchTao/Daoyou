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
