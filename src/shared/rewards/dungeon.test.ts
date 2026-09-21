import { describe, expect, it } from 'vitest';
import { findItemDefinition } from '../items/registry';
import {
  appendDungeonReward,
  dungeonRewardItemName,
  planDungeonReward,
} from './dungeon';
import { DUNGEON_REWARD_PACK, loadDungeonRewardPack } from './dungeon-pack';

const originalPack = structuredClone(DUNGEON_REWARD_PACK);
for (const source of Object.values(originalPack.sources)) {
  source.bonusChances = {
    originDew: 0,
    superiorOriginDew: 0,
    superiorBook: 0,
    blueprint: 0,
  };
}

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
    const pack = structuredClone(originalPack);
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

  it('库材料展示实例名称', () => {
    expect(
      dungeonRewardItemName({
        definitionId: 'material.v1',
        quantity: 1,
        instanceData: { name: '赤阳果', type: 'herb', rank: '灵品' },
      }),
    ).toBe('赤阳果');
  });

  it('多个名额逐件抽取，不因新品类增加总量，且固定种子可复现', () => {
    const pack = structuredClone(originalPack);
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
    const pack = structuredClone(originalPack);
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
    const pack = structuredClone(originalPack);
    pack.poolVersion++;
    pack.sources.battle.weights = { material: 0, blueprint: 0, book: 1 };
    pack.books = [pack.books[0]];
    for (let seed = 0; seed < 256; seed++) {
      const before = planDungeonReward(
        seed,
        'battle:1',
        'battle',
        25,
        originalPack,
      );
      const after = planDungeonReward(seed, 'battle:1', 'battle', 25, pack);
      expect(after.materialCount + after.items.length).toBe(
        before.materialCount + before.items.length,
      );
      if (after.items.length)
        expect(after.items[0].definitionId).toBe(pack.books[0].rewardId);
    }
  });

  it('未命中不产物，已记录的奖励重试不替换', () => {
    const pack = structuredClone(originalPack);
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
    const pack = structuredClone(originalPack);
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

describe('秘境额外养成奖励', () => {
  it('五轮探索、两场胜利与完成的总期望符合目标', () => {
    const sources = DUNGEON_REWARD_PACK.sources;
    const counts = { exploration: 5, battle: 2, completion: 1 };
    const totals = {
      originDew: 0,
      superiorOriginDew: 0,
      superiorBook: 0,
      blueprint: 0,
    };
    const upper = new Set(DUNGEON_REWARD_PACK.superiorBooks);
    const bookWeight = DUNGEON_REWARD_PACK.books.reduce(
      (sum, item) => sum + item.weight,
      0,
    );
    const upperWeight = DUNGEON_REWARD_PACK.books
      .filter((item) => upper.has(item.rewardId))
      .reduce((sum, item) => sum + item.weight, 0);
    for (const source of ['exploration', 'battle', 'completion'] as const) {
      const config = sources[source];
      for (const category of Object.keys(totals) as (keyof typeof totals)[])
        totals[category] += counts[source] * config.bonusChances[category];
      const weight = Object.values(config.weights).reduce(
        (sum, value) => sum + value,
        0,
      );
      const slots = counts[source] * config.chance * config.quantity;
      totals.blueprint += (slots * config.weights.blueprint) / weight;
      totals.superiorBook +=
        (((slots * config.weights.book) / weight) * upperWeight) / bookWeight;
    }
    expect(totals.originDew).toBeCloseTo(0.5, 10);
    expect(totals.superiorOriginDew).toBeCloseTo(0.2, 10);
    expect(totals.blueprint).toBeCloseTo(0.75, 10);
    expect(totals.superiorBook).toBeCloseTo(0.09, 3);
  });

  it.each(['exploration', 'battle', 'completion'] as const)(
    '%s奖励最多额外一件，原奖励、资源和材料种子不变',
    (source) => {
      const seen = new Set<string>();
      let missed = false;
      for (let seed = 0; seed < 4096; seed++) {
        const before = planDungeonReward(
          seed,
          source,
          source,
          65,
          originalPack,
        );
        const after = planDungeonReward(seed, source, source, 65);
        expect(after).toEqual(planDungeonReward(seed, source, source, 65));
        expect({ ...after, items: [] }).toEqual({ ...before, items: [] });
        const remainder = new Map(
          after.items.map((item) => [item.definitionId, item.quantity]),
        );
        for (const item of before.items) {
          expect(remainder.get(item.definitionId)).toBeGreaterThanOrEqual(
            item.quantity,
          );
          remainder.set(
            item.definitionId,
            remainder.get(item.definitionId)! - item.quantity,
          );
        }
        const bonus = [...remainder].filter(([, quantity]) => quantity > 0);
        expect(
          bonus.reduce((sum, [, quantity]) => sum + quantity, 0),
        ).toBeLessThanOrEqual(1);
        missed ||= bonus.length === 0;
        for (const [id] of bonus) {
          const definition = findItemDefinition(id)!;
          if (definition.kind === 'blueprint') {
            expect(definition.level).toBe(70);
            seen.add('blueprint');
          } else if (definition.kind === 'beast_book') {
            expect(DUNGEON_REWARD_PACK.superiorBooks).toContain(id);
            seen.add('superiorBook');
          } else seen.add(id);
        }
      }
      expect(missed).toBe(true);
      expect(seen).toEqual(
        new Set([
          'blueprint',
          'superiorBook',
          'beast.refinement.origin-dew',
          'beast.refinement.superior-origin-dew',
        ]),
      );
    },
  );

  it('原奖励未命中时仍可获得额外奖励；相同物品合并数量', () => {
    const pack = structuredClone(originalPack);
    pack.sources.battle.chance = 0;
    pack.sources.battle.bonusChances.originDew = 1;
    expect(planDungeonReward(1, 'fight', 'battle', 25, pack).items).toEqual([
      { definitionId: 'beast.refinement.origin-dew', quantity: 1 },
    ]);
    pack.sources.battle.chance = 1;
    pack.sources.battle.weights = { material: 0, blueprint: 0, book: 1 };
    pack.sources.battle.bonusChances = {
      originDew: 0,
      superiorOriginDew: 0,
      superiorBook: 1,
      blueprint: 0,
    };
    pack.books = [{ rewardId: pack.superiorBooks[0], weight: 1 }];
    pack.superiorBooks = [pack.superiorBooks[0]];
    expect(planDungeonReward(1, 'fight', 'battle', 25, pack).items).toEqual([
      { definitionId: pack.superiorBooks[0], quantity: 2 },
    ]);
  });

  it('拒绝超额概率、普通灵印、未知引用和重复上品条目', () => {
    const pack = structuredClone(DUNGEON_REWARD_PACK);
    pack.sources.battle.bonusChances.originDew = 1;
    expect(() => loadDungeonRewardPack(pack)).toThrow('额外奖励概率');
    for (const superiorBooks of [
      ['book.beast.combo'],
      ['missing'],
      [pack.superiorBooks[0], pack.superiorBooks[0]],
    ])
      expect(() =>
        loadDungeonRewardPack({ ...DUNGEON_REWARD_PACK, superiorBooks }),
      ).toThrow('上品灵印');
  });
});
