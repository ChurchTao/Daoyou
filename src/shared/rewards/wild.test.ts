import { expect, it } from 'vitest';
import { WILD_REGIONS } from '../engine/combat-v6/wild/content';
import { ItemGrantSchema } from '../inventory';
import { BOOKS } from '../items/definitions/beast-books';
import {
  WILD_DROP_POOLS,
  WILD_INHERITANCE_POOL,
  wildItemRewards,
} from './wild';

it('所有野外只掉落传承灵印，未命中时无物品奖励', () => {
  expect(Object.keys(WILD_DROP_POOLS).sort()).toEqual(
    WILD_REGIONS.map((r) => r.nodeId).sort(),
  );
  for (const pool of Object.values(WILD_DROP_POOLS)) {
    expect(pool.groups.map((g) => g.id)).toEqual(['books']);
    const grants = wildItemRewards(pool, () => () => 0);
    expect(grants).toHaveLength(1);
    expect(ItemGrantSchema.safeParse(grants[0]).success).toBe(true);
    expect(BOOKS.some((b) => b.id === grants[0].definitionId)).toBe(true);
    expect(wildItemRewards(pool, () => () => 0.99)).toEqual([]);
  }
});
it('旧活动战局冻结的奖励池也过滤掉材料、装备、图纸和玉简', () => {
  const pool = {
    ...WILD_INHERITANCE_POOL,
    groups: [
      ...WILD_INHERITANCE_POOL.groups,
      ...[
        'material.v1',
        'equipment.head.10',
        'blueprint.head.10',
        'jade.character_manual.changchun',
      ].map((rewardId, i) => ({
        id: `old-${i}`,
        chance: 1,
        entries: [{ rewardId, weight: 1, quantity: { min: 1, max: 1 } }],
      })),
    ],
  };
  expect(wildItemRewards(pool, () => () => 0)).toEqual(
    wildItemRewards(WILD_INHERITANCE_POOL, () => () => 0),
  );
});
