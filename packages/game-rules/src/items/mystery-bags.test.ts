import { findItemDefinition } from '@daoyou/game-content/items';
import { MYSTERY_BAG_REWARD_DATA } from '@daoyou/game-content/items/mystery-bags';
import { DAO_EQUIPMENT_SLOTS } from '@daoyou/game-domain/equipment';
import { MYSTERY_BAG_IDS } from '@daoyou/game-domain/inventory';
import { getLevelRealmStage } from '@daoyou/game-domain/progression';
import { describe, expect, it } from 'vitest';
import {
  describeMysteryBagRewards,
  loadMysteryBagRewards,
  rollMysteryBagItemGrant,
  rollMysteryBagReward,
} from './mystery-bags.js';

describe('神秘储物袋奖池', () => {
  it.each(MYSTERY_BAG_IDS)('%s 每段概率对应恰好一项奖励', (id) => {
    const pool = loadMysteryBagRewards(MYSTERY_BAG_REWARD_DATA).pools[id];
    let first = 0;
    for (const entry of pool) {
      const last = first + entry.chanceBps - 1;
      expect(rollMysteryBagReward(id, () => first)).toEqual(entry);
      expect(rollMysteryBagReward(id, () => last)).toEqual(entry);
      first = last + 1;
    }
    expect(first).toBe(10_000);
    expect(
      describeMysteryBagRewards(id).map(({ chance }) => parseFloat(chance)),
    ).toEqual(pool.map(({ chanceBps }) => chanceBps / 100));
  });

  it('拒绝概率总和有缺口或灵石数量上下限颠倒的奖池', () => {
    const data = structuredClone(MYSTERY_BAG_REWARD_DATA);
    const stones = data.pools['mystery-bag.common'][0]!;
    stones.chanceBps -= 1;
    expect(() => loadMysteryBagRewards(data)).toThrow('概率之和');
    stones.chanceBps += 1;
    stones.max = 1;
    expect(() => loadMysteryBagRewards(data)).toThrow('下限不能高于上限');
  });

  it('拒绝未知道具与能再次抽奖的储物袋', () => {
    const data = structuredClone(MYSTERY_BAG_REWARD_DATA);
    const entry = data.pools['mystery-bag.common'].find((entry) => entry.item)!;
    entry.item!.definitionId = 'missing.item';
    expect(() => loadMysteryBagRewards(data)).toThrow('未知物品定义');
    entry.item!.definitionId = 'mystery-bag.fine';
    expect(() => loadMysteryBagRewards(data)).toThrow('奖池不能包含神秘储物袋');
  });

  it.each([
    ['mystery-bag.common', [1, 3], [1, 1], [10, 2, 1, 1], ['金丹', '元婴']],
    [
      'mystery-bag.fine',
      [3, 6],
      [1, 2],
      [20, 5, 3, 1],
      ['元婴', '化神', '炼虚'],
    ],
    [
      'mystery-bag.luxurious',
      [6, 15],
      [2, 3],
      [50, 15, 9, 1],
      ['炼虚', '合体', '大乘', '渡劫'],
    ],
  ] as const)(
    '%s 按品阶结算数量和图纸境界',
    (id, dew, fruit, materials, realms) => {
      const pool = loadMysteryBagRewards(MYSTERY_BAG_REWARD_DATA).pools[id];
      for (const [definitionId, [min, max]] of [
        ['beast.refinement.superior-origin-dew', dew],
        ['beast.rejuvenation.huasheng-fruit', fruit],
      ] as const) {
        const entry = pool.find(
          (reward) =>
            reward.type === 'item' && reward.item.definitionId === definitionId,
        );
        if (entry?.type !== 'item') throw new Error('奖池缺少指定道具');
        expect(rollMysteryBagItemGrant(entry, () => 0)).toEqual({
          definitionId,
          quantity: min,
        });
        expect(rollMysteryBagItemGrant(entry, (limit) => limit - 1)).toEqual({
          definitionId,
          quantity: max,
        });
      }
      expect(
        pool
          .filter((entry) => entry.type === 'material')
          .map(({ rank, quantity }) => [rank, quantity]),
      ).toEqual(
        ['地品', '天品', '仙品', '神品'].map((rank, index) => [
          rank,
          materials[index],
        ]),
      );

      const blueprint = pool.find((entry) => entry.type === 'blueprint')!;
      const ids = Array.from(
        { length: realms.length * DAO_EQUIPMENT_SLOTS.length },
        (_, index) => {
          const grant = rollMysteryBagItemGrant(blueprint, (limit) => {
            expect(limit).toBe(realms.length * DAO_EQUIPMENT_SLOTS.length);
            return index;
          });
          expect(grant.quantity).toBe(1);
          return grant.definitionId;
        },
      );
      expect(new Set(ids).size).toBe(ids.length);
      expect(
        new Set(
          ids.map(
            (itemId) =>
              getLevelRealmStage(findItemDefinition(itemId)!.level!).realm,
          ),
        ),
      ).toEqual(new Set(realms));
    },
  );

  it('拒绝颠倒的道具数量区间与图纸境界区间', () => {
    const data = structuredClone(MYSTERY_BAG_REWARD_DATA);
    const pool = data.pools['mystery-bag.luxurious'];
    const dew = pool.find(
      (entry) =>
        entry.item?.definitionId === 'beast.refinement.superior-origin-dew',
    )!;
    dew.maxQuantity = 5;
    expect(() => loadMysteryBagRewards(data)).toThrow('道具数量上限无效');
    dew.maxQuantity = 15;
    const blueprint = pool.find((entry) => entry.type === 'blueprint')!;
    blueprint.maxRealm = '金丹';
    expect(() => loadMysteryBagRewards(data)).toThrow(
      '图纸境界范围内没有可抽取的图纸',
    );
  });
});
