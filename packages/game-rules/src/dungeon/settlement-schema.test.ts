import { expect, it } from 'vitest';
import { createDungeonSettlementSchema } from '@daoyou/game-domain/dungeon';
import { ItemGrantSchema } from '../inventory/index.js';

const DungeonSettlementSchema = createDungeonSettlementSchema(ItemGrantSchema);

it('秘境结算保留奖励数量、个体事实及注入的 refinement', () => {
  const settlement = {
    ending_narrative: '归来',
    settlement: {
      reward_tier: 'C',
      reward_blueprints: [],
      performance_tags: [],
    },
  };
  const grant = { definitionId: 'book.beast.combo', quantity: 1 };
  expect(
    DungeonSettlementSchema.safeParse({
      ...settlement,
      inventoryRewards: [grant],
    }).success,
  ).toBe(true);
  for (const invalid of [
    { ...grant, quantity: 100 },
    { ...grant, instanceData: { level: 100 } },
    { ...grant, definitionId: 'equipment.v6', instanceData: {} },
  ]) {
    expect(
      DungeonSettlementSchema.safeParse({
        ...settlement,
        inventoryRewards: [invalid],
      }).success,
    ).toBe(false);
  }
  const restricted = createDungeonSettlementSchema(
    ItemGrantSchema.refine((item) => item.quantity <= 2),
  );
  expect(
    restricted.safeParse({
      ...settlement,
      inventoryRewards: [{ ...grant, quantity: 3 }],
    }).success,
  ).toBe(false);
});
