import { describe, expect, it } from 'vitest';
import { YieldCalculator } from '../yield/YieldCalculator.js';
import { HUNT_REALMS, huntEventsAt } from '../hunts/config.js';
import { DUNGEON_MATERIAL_QUALITY_CHANCE_BY_REALM } from '@daoyou/game-content/rewards/dungeon';
import { HUNT_DROP_POOL, HuntDropPoolSchema, planHuntReward } from './hunt.js';

describe('讨伐奖励', () => {
  it('奖励档位跟随目标境界；渡劫目标不会降为金丹档奖励', () => {
    const events = huntEventsAt(Date.parse('2026-09-30T12:00:00+08:00'));
    const gold = planHuntReward(
      events.find((e) => e.realm === '金丹')!,
      () => () => 0.5,
    );
    const tribulation = planHuntReward(
      events.find((e) => e.realm === '渡劫')!,
      () => () => 0.5,
    );
    expect(tribulation.experience).toBeGreaterThan(gold.experience);
    expect(tribulation.spiritStones).toBeGreaterThan(gold.spiritStones);
    // Insight and the common item pool do not scale with realm.
    expect(tribulation.insight).toBe(gold.insight);
    expect(tribulation.items).toEqual(gold.items);
  });
  it.each(HUNT_REALMS)('%s 的三项基础资源与六小时挂机算法一致', (realm) => {
    for (const roll of [0, 0.49, 0.999999]) {
      const actual = planHuntReward({ realm }, () => () => roll);
      const expected = YieldCalculator.calculateCultivatorYield(
        { realm, realmStage: '中期', hoursElapsed: 6 },
        () => roll,
      );
      expect(actual.experience).toBe(
        expected.find((r) => r.type === 'cultivation_exp')?.value ?? 0,
      );
      expect(actual.spiritStones).toBe(
        expected.find((r) => r.type === 'spirit_stones')?.value ?? 0,
      );
      expect(actual.insight).toBe(
        expected.find((r) => r.type === 'comprehension_insight')?.value ?? 0,
      );
      expect(actual.materialCount).toBe(2);
    }
  });
  it('概率道具为空时仍有保底；灵印、灵露可同时命中', () => {
    const event = huntEventsAt(100000)[0];
    const empty = planHuntReward(event, () => () => 0.99);
    expect(empty.items).toEqual([]);
    expect(empty.materialCount).toBe(2);
    const both = planHuntReward(event, () => () => 0);
    expect(both.items).toEqual([
      { definitionId: 'book.beast.combo', quantity: 1 },
      { definitionId: 'beast.refinement.origin-dew', quantity: 1 },
    ]);
    const dewOnly = planHuntReward(
      event,
      (stream) => () => (stream.endsWith(':book') ? 0.99 : 0),
    );
    expect(dewOnly.items).toEqual([
      { definitionId: 'beast.refinement.origin-dew', quantity: 1 },
    ]);
    expect(dewOnly.experience).toBe(both.experience);
    expect(dewOnly.materialCount).toBe(both.materialCount);
  });
  it('配置拒绝未知物品或取消保底材料', () => {
    const badItem = structuredClone(HUNT_DROP_POOL);
    badItem.groups[1].entries[0].rewardId = 'missing.item';
    expect(HuntDropPoolSchema.safeParse(badItem).success).toBe(false);
    const badGuarantee = structuredClone(HUNT_DROP_POOL);
    badGuarantee.groups[0].chance = 0.9;
    expect(HuntDropPoolSchema.safeParse(badGuarantee).success).toBe(false);
  });
  it('副本材料范围覆盖全部讨伐境界且概率归一化', () => {
    for (const realm of HUNT_REALMS) {
      expect(
        Object.values(DUNGEON_MATERIAL_QUALITY_CHANCE_BY_REALM[realm]).reduce(
          (a, b) => a + b,
          0,
        ),
      ).toBeCloseTo(1);
    }
    expect(DUNGEON_MATERIAL_QUALITY_CHANCE_BY_REALM['渡劫'].凡品).toBe(0);
    expect(DUNGEON_MATERIAL_QUALITY_CHANCE_BY_REALM['金丹'].神品).toBe(0);
  });
});
