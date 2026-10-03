import { describe, expect, it } from 'vitest';
import { HUNT_REALMS } from '../hunts/config.js';
import { QUALITY_VALUES } from '../types/constants.js';
import { DUNGEON_MATERIAL_QUALITY_CHANCE_BY_REALM } from './dungeon-material-quality.js';
import { DUNGEON_REWARD_PACK } from './dungeon-pack.js';
import { planHuntReward } from './hunt.js';
import { HUNT_MATERIAL_QUALITY_CHANCE_BY_REALM } from './hunt-material-quality.js';

describe('讨伐材料综合概率', () => {
  it.each(HUNT_REALMS)(
    '%s 保留品质范围，高品质综合概率比云游通关高一成',
    (realm) => {
      const hunt = HUNT_MATERIAL_QUALITY_CHANCE_BY_REALM[realm];
      const dungeon = DUNGEON_MATERIAL_QUALITY_CHANCE_BY_REALM[realm];
      const completion = DUNGEON_REWARD_PACK.sources.completion;
      expect(completion.quantity).toBe(1);
      expect(planHuntReward({ realm }, () => () => 0.5).materialCount).toBe(2);
      expect(Object.values(hunt).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
      const lowest = QUALITY_VALUES.findIndex(
        (quality) => dungeon[quality] > 0,
      );
      for (const [index, quality] of QUALITY_VALUES.entries()) {
        expect(hunt[quality]).toBeGreaterThanOrEqual(0);
        expect(hunt[quality]).toBeLessThanOrEqual(1);
        expect(hunt[quality] > 0).toBe(dungeon[quality] > 0);
        if (index <= lowest) continue;
        const tail = QUALITY_VALUES.slice(index);
        const huntChance =
          1 - (1 - tail.reduce((sum, q) => sum + hunt[q], 0)) ** 2;
        const dungeonChance =
          ((completion.chance * completion.weights.material) /
            Object.values(completion.weights).reduce((a, b) => a + b, 0)) *
          tail.reduce((sum, q) => sum + dungeon[q], 0);
        expect(huntChance).toBeCloseTo(dungeonChance * 1.1, 12);
      }
    },
  );
  it('渡劫一次奖励的仙品以上为33%，神品为16.5%，境界提升不会倒挂', () => {
    const rates = HUNT_MATERIAL_QUALITY_CHANCE_BY_REALM.渡劫;
    expect(1 - (1 - rates.仙品 - rates.神品) ** 2).toBeCloseTo(0.33, 12);
    expect(1 - (1 - rates.神品) ** 2).toBeCloseTo(0.165, 12);
    for (let i = 1; i < HUNT_REALMS.length; i++) {
      for (const quality of ['天品', '仙品', '神品'] as const) {
        const tail = QUALITY_VALUES.slice(QUALITY_VALUES.indexOf(quality));
        const sum = (realm: (typeof HUNT_REALMS)[number]) =>
          tail.reduce(
            (n, q) => n + HUNT_MATERIAL_QUALITY_CHANCE_BY_REALM[realm][q],
            0,
          );
        expect(sum(HUNT_REALMS[i]) + 1e-12).toBeGreaterThanOrEqual(
          sum(HUNT_REALMS[i - 1]),
        );
      }
    }
  });
});
