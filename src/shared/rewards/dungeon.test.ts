import { describe, expect, it } from 'vitest';
import { findItemDefinition } from '../items/registry';
import {
  appendDungeonReward,
  dungeonRewardItemName,
  planDungeonReward,
} from './dungeon';
import { DUNGEON_REWARD_PACK, loadDungeonRewardPack } from './dungeon-pack';

describe('副本混合物品奖励', () => {
  it.each([
    [5, '炼气'],
    [25, '筑基'],
    [45, '金丹'],
    [65, '元婴'],
    [85, '化神'],
    [105, '炼虚'],
    [125, '合体'],
    [145, '大乘'],
    [165, '渡劫'],
  ])('等级%s的材料使用%s品质分布，不随图纸开放上限截断', (level, realm) => {
    const pack = structuredClone(DUNGEON_REWARD_PACK);
    pack.sources.completion.weights = { material: 1, blueprint: 0, book: 0 };
    const plan = planDungeonReward(
      1,
      'completion',
      'completion',
      level as number,
      pack,
    );
    expect(plan.materialRealm).toBe(realm);
    expect(plan.materialCount).toBe(1);
    expect(plan.items).toEqual([]);
  });

  it('库材料展示实例名称，同时保留旧固定材料奖励的名称', () => {
    expect(
      dungeonRewardItemName({
        definitionId: 'material.v1',
        quantity: 1,
        instanceData: { name: '赤阳果', type: 'herb', rank: '灵品' },
      }),
    ).toBe('赤阳果');
    expect(
      dungeonRewardItemName({
        definitionId: 'material.ore.qingxi-iron.v1',
        quantity: 1,
      }),
    ).toBe('青溪铁砂');
  });

  it('多个名额逐件抽取，不因新品类增加总量，且固定种子可复现', () => {
    const pack = structuredClone(DUNGEON_REWARD_PACK);
    pack.sources.completion.quantity = 8;
    const kinds = new Set<string>();
    let mixed = false;
    for (let seed = 0; seed < 128; seed++) {
      const result = planDungeonReward(
        seed,
        'completion',
        'completion',
        25,
        pack,
      );
      expect(result).toEqual(
        planDungeonReward(seed, 'completion', 'completion', 25, pack),
      );
      expect(
        result.materialCount +
          result.items.reduce((sum, item) => sum + item.quantity, 0),
      ).toBe(8);
      const currentKinds = result.items.map(
        (item) => findItemDefinition(item.definitionId)!.kind,
      );
      if (result.materialCount > 0) currentKinds.push('material');
      currentKinds.forEach((kind) => kinds.add(kind));
      mixed ||= new Set(currentKinds).size > 1;
    }
    expect(kinds).toEqual(new Set(['material', 'blueprint', 'beast_book']));
    expect(mixed).toBe(true);
  });

  it.each([
    [1, 10],
    [20, 10],
    [25, 30],
    [45, 50],
    [65, 70],
    [85, 90],
    [180, 90],
  ])('副本等级 %s 对应已开放图纸档位 %s', (level, expected) => {
    const pack = structuredClone(DUNGEON_REWARD_PACK);
    pack.sources.completion.weights = { material: 0, blueprint: 1, book: 0 };
    const slots = new Set<string>();
    for (let seed = 0; seed < 128; seed++) {
      const result = planDungeonReward(
        seed,
        'completion',
        'completion',
        level,
        pack,
      );
      const item = findItemDefinition(result.items[0].definitionId)!;
      expect(item.kind).toBe('blueprint');
      expect(item.level).toBe(expected);
      slots.add(item.slot!);
    }
    expect(slots.size).toBe(6);
  });

  it('调整品类权重、版本和灵印条目不改变本次是否掉落', () => {
    const pack = structuredClone(DUNGEON_REWARD_PACK);
    pack.poolVersion++;
    pack.sources.battle.weights = { material: 0, blueprint: 0, book: 1 };
    pack.books = [pack.books[0]];
    for (let seed = 0; seed < 256; seed++) {
      const before = planDungeonReward(seed, 'battle:1', 'battle', 25);
      const after = planDungeonReward(seed, 'battle:1', 'battle', 25, pack);
      expect(after.materialCount + after.items.length).toBe(
        before.materialCount + before.items.length,
      );
      if (after.items.length)
        expect(after.items[0].definitionId).toBe(pack.books[0].rewardId);
    }
  });

  it('未命中不产物，已记录的奖励重试不替换', () => {
    const pack = structuredClone(DUNGEON_REWARD_PACK);
    pack.sources.battle.chance = 0;
    expect(planDungeonReward(1, 'battle:1', 'battle', 25, pack).items).toEqual(
      [],
    );
    const before = [planDungeonReward(1, 'completion', 'completion', 25)];
    expect(
      appendDungeonReward(
        before,
        planDungeonReward(2, 'completion', 'completion', 25),
      ),
    ).toBe(before);
  });

  it('拒绝错误灵印引用、重复项、空权重和负权重', () => {
    const pack = structuredClone(DUNGEON_REWARD_PACK);
    expect(() =>
      loadDungeonRewardPack({
        ...pack,
        books: [{ rewardId: 'blueprint.head.10', weight: 1 }],
      }),
    ).toThrow();
    expect(() =>
      loadDungeonRewardPack({ ...pack, books: [pack.books[0], pack.books[0]] }),
    ).toThrow();
    pack.sources.completion.weights = { material: 0, blueprint: 0, book: 0 };
    expect(() => loadDungeonRewardPack(pack)).toThrow();
    pack.sources.completion.weights.material = -1;
    expect(() => loadDungeonRewardPack(pack)).toThrow();
  });
});
