import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { BEAST_SKILL_FAMILIES } from '../engine/combat-v6/beasts/content';
import {
  equipmentRealm,
  isOpenEquipmentLevel,
} from '../engine/combat-v6/equipment/realm';
import { combatCharacterLevel } from '../engine/combat-v6/projection/character-level';
import { itemDefinition, ItemGrantSchema } from '../inventory';
import { TOWER_ELIGIBLE_REALMS } from '../lib/tower/helpers';
import raw from './data/tower.json';
import schema from './data/tower.schema.json';
import { planTowerReward, towerRewardPreviews } from './tower';
import { loadTowerRewardPack, TowerRewardPackShape } from './tower-pack';

describe('幻境逐层奖励', () => {
  it('编辑器Schema同步', () =>
    expect(z.toJSONSchema(TowerRewardPackShape, { reused: 'ref' })).toEqual(
      schema,
    ));
  it('20层完整覆盖，普通层按境界和层段递增，关键层不附灵石', () => {
    for (const realm of TOWER_ELIGIBLE_REALMS) {
      for (let floor = 1; floor <= 20; floor++) {
        const result = planTowerReward(floor, 8, realm);
        expect(result.spiritStones).toBe(
          floor % 5 === 0
            ? 0
            : combatCharacterLevel(realm, '初期') *
                (200 + 100 * Math.floor((floor - 1) / 5)),
        );
        expect(result.reputation).toBe(
          floor === 5 ? 30 : floor % 5 === 0 ? 50 : 0,
        );
        for (const item of result.items)
          expect(ItemGrantSchema.safeParse(item).success).toBe(true);
        if (floor % 5 !== 0) expect(result.items).toEqual([]);
      }
    }
    expect(
      towerRewardPreviews('金丹').reduce(
        (sum, row) => sum + row.spiritStones,
        0,
      ),
    ).toBe(252000);
  });
  it('关键层保底和额外奖励独立，概率0与1分别不掉和必掉', () => {
    for (const chance of [0, 1]) {
      const data = structuredClone(raw);
      for (const row of data.floors)
        for (const drop of row.drops)
          if (drop.id === 'bonus') drop.chance = chance;
      const pack = loadTowerRewardPack(data);
      expect(planTowerReward(5, 8, '金丹', pack).items).toEqual([
        { definitionId: 'beast.refinement.origin-dew', quantity: 2 },
        ...(chance
          ? [
              {
                definitionId: 'beast.refinement.superior-origin-dew',
                quantity: 1,
              },
            ]
          : []),
      ]);
      const books = planTowerReward(10, 8, '金丹', pack).items;
      expect(books).toHaveLength(chance ? 2 : 1);
      expect(pack.pools.books.entries).toContain(books[0].definitionId);
      if (chance)
        expect(pack.pools.superiorBooks.entries).toContain(
          books[1].definitionId,
        );
      const last = planTowerReward(20, 8, '金丹', pack).items;
      expect(last[0]).toEqual({
        definitionId: 'beast.refinement.superior-origin-dew',
        quantity: 1,
      });
      expect(last).toHaveLength(chance ? 2 : 1);
    }
  });
  it('普通和上品灵印池对应真实技能品级', () => {
    const advanced = new Set(
      BEAST_SKILL_FAMILIES.map((row) => `book.${row.advanced}`),
    );
    expect(raw.pools.books.entries.every((id) => !advanced.has(id))).toBe(true);
    expect(
      raw.pools.superiorBooks.entries.every((id) => advanced.has(id)),
    ).toBe(true);
  });
  it('相同种子可重放，追加奖励分布符合15%、8%、50%', () => {
    for (const [floor, chance] of [
      [5, 0.15],
      [10, 0.08],
      [20, 0.5],
    ]) {
      let bonus = 0;
      for (let seed = 1; seed <= 2000; seed++) {
        const result = planTowerReward(floor, seed, '金丹');
        if (result.items.length === 2) bonus++;
        if (seed === 42)
          expect(result).toEqual(planTowerReward(floor, seed, '金丹'));
      }
      expect(bonus / 2000).toBeGreaterThan(chance - 0.035);
      expect(bonus / 2000).toBeLessThan(chance + 0.035);
    }
  });
  it('所有境界图纸都来自已开放且不高于挑战境界的随机部位与境界', () => {
    for (const realm of TOWER_ELIGIBLE_REALMS) {
      const levels = new Set<number>();
      const slots = new Set<string>();
      for (let seed = 1; seed <= 200; seed++) {
        for (const floor of [15, 20])
          for (const grant of planTowerReward(floor, seed, realm).items) {
            const item = itemDefinition(grant.definitionId);
            if (item.kind !== 'blueprint') continue;
            expect(isOpenEquipmentLevel(item.level!)).toBe(true);
            expect(
              equipmentRealm(item.level!).requiredLevel,
            ).toBeLessThanOrEqual(combatCharacterLevel(realm, '初期'));
            levels.add(item.level!);
            slots.add(item.slot!);
          }
      }
      expect(levels.size).toBeGreaterThan(1);
      expect(slots.size).toBe(6);
    }
  });
  it('预览列出真实可掉落物品，随机图纸的范围与结算一致', () => {
    for (const realm of TOWER_ELIGIBLE_REALMS) {
      const previews = towerRewardPreviews(realm);
      expect(previews[4].drops[0]).toMatchObject({
        random: false,
        definitionIds: ['beast.refinement.origin-dew'],
      });
      expect(previews[9].drops[0].random).toBe(true);
      for (const floor of [5, 10, 15, 20]) {
        const candidates = previews[floor - 1].drops.flatMap(
          (drop) => drop.definitionIds,
        );
        for (let seed = 1; seed <= 100; seed++) {
          for (const item of planTowerReward(floor, seed, realm).items)
            expect(candidates).toContain(item.definitionId);
        }
        for (const id of candidates) {
          const item = itemDefinition(id);
          if (item.kind === 'blueprint')
            expect(
              equipmentRealm(item.level!).requiredLevel,
            ).toBeLessThanOrEqual(combatCharacterLevel(realm, '初期'));
        }
      }
    }
  });
  it('配置修改同时影响展示和结算', () => {
    const data = structuredClone(raw);
    data.floors[0].spiritStonesPerLevel = 9;
    data.floors[4].reputation = 99;
    data.floors[4].drops[0].quantity = 3;
    const pack = loadTowerRewardPack(data);
    expect(planTowerReward(1, 8, '金丹', pack).spiritStones).toBe(
      towerRewardPreviews('金丹', pack)[0].spiritStones,
    );
    expect(towerRewardPreviews('金丹', pack)[4]).toMatchObject({
      reputation: 99,
      drops: [{ quantity: 3 }, { chance: 0.15 }],
    });
    expect(planTowerReward(5, 8, '金丹', pack).items[0].quantity).toBe(3);
  });
  it('拒绝缺层、重复层、无效引用、概率与数量', () => {
    const missing = structuredClone(raw);
    missing.floors.pop();
    expect(() => loadTowerRewardPack(missing)).toThrow();
    const duplicate = structuredClone(raw);
    duplicate.floors[0].floor = 2;
    expect(() => loadTowerRewardPack(duplicate)).toThrow();
    const badPool = structuredClone(raw);
    badPool.pools.books.entries[0] = 'missing';
    expect(() => loadTowerRewardPack(badPool)).toThrow();
    const emptyEligible = structuredClone(raw);
    emptyEligible.pools.blueprints.entries = ['blueprint.weapon.90'];
    expect(() => loadTowerRewardPack(emptyEligible)).toThrow('最低挑战境界');
    const badChance = structuredClone(raw);
    badChance.floors[4].drops[1].chance = 1.1;
    expect(() => loadTowerRewardPack(badChance)).toThrow();
    const badQuantity = structuredClone(raw);
    badQuantity.floors[4].drops[0].quantity = 0;
    expect(() => loadTowerRewardPack(badQuantity)).toThrow();
    expect(() => planTowerReward(0, 8, '金丹')).toThrow();
    expect(() => planTowerReward(21, 8, '金丹')).toThrow();
  });
});
