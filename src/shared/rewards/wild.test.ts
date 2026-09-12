import { expect, it } from 'vitest';
import { compileDaoEquipmentSpecialLoadoutV1 } from '../engine/combat-v6/equipment/compiler';
import { ItemGrantSchema } from '../inventory';
import { InventoryEquipmentSchema } from '../inventory/equipment';
import { QINGXI_POOL_V2, wildItemRewards } from './wild';
it('resolves all five per-session groups to legal inventory grants', () => {
  const result = wildItemRewards(
    QINGXI_POOL_V2,
    () => () => 0,
    () => 'test-equipment',
    '2026-09-07T00:00:00Z',
  );
  expect(result).toHaveLength(5);
  result.forEach((grant) =>
    expect(ItemGrantSchema.safeParse(grant).success).toBe(true),
  );
  const equipment = InventoryEquipmentSchema.parse(result[2].instanceData);
  expect(
    compileDaoEquipmentSpecialLoadoutV1({ [equipment.slot]: equipment }, 10).ok,
  ).toBe(true);
  expect(
    wildItemRewards(
      QINGXI_POOL_V2,
      () => () => 0.99,
      () => 'unused',
      '',
    ),
  ).toEqual([]);
});
it('changes scene reward ranges through configuration and preserves book weights', () => {
  const pool = {
    ...QINGXI_POOL_V2,
    groups: [
      {
        id: 'custom',
        chance: 1,
        entries: [
          {
            rewardId: 'blueprint.head.30',
            weight: 1,
            quantity: { min: 2, max: 2 },
          },
        ],
      },
    ],
  };
  expect(
    wildItemRewards(
      pool,
      () => () => 0,
      () => 'unused',
      '',
    ),
  ).toEqual([{ definitionId: 'blueprint.head.30', quantity: 2 }]);
  expect(
    QINGXI_POOL_V2.groups
      .find((g) => g.id === 'books')
      ?.entries.slice(0, 5).map((e) => e.weight),
  ).toEqual([24, 24, 24, 24, 4]);
});
