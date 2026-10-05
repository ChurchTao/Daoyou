import { QUALITY_VALUES } from '@daoyou/constants/qualities';
import { DUNGEON_MATERIAL_QUALITY_CHANCE_BY_REALM } from '@daoyou/game-content/rewards/dungeon';
import { describe, expect, it } from 'vitest';
import { HUNT_REALMS } from '../hunts/config.js';
import { HUNT_MATERIAL_QUALITY_CHANCE_BY_REALM } from './hunt-material-quality.js';
import { planHuntReward } from './hunt.js';

describe('讨伐材料综合概率', () => {
  it.each(HUNT_REALMS)(
    '%s 保留品质范围和两件保底，品质越高概率越低',
    (realm) => {
      const hunt = HUNT_MATERIAL_QUALITY_CHANCE_BY_REALM[realm];
      const dungeon = DUNGEON_MATERIAL_QUALITY_CHANCE_BY_REALM[realm];
      expect(planHuntReward({ realm }, () => () => 0.5).materialCount).toBe(2);
      expect(Object.values(hunt).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
      for (const quality of QUALITY_VALUES) {
        expect(hunt[quality]).toBeGreaterThanOrEqual(0);
        expect(hunt[quality]).toBeLessThanOrEqual(1);
        expect(hunt[quality] > 0).toBe(dungeon[quality] > 0);
      }
      const chances = QUALITY_VALUES.filter((quality) => hunt[quality] > 0).map(
        (quality) => hunt[quality],
      );
      expect(chances[0]).toBeLessThan(0.45);
      for (let index = 1; index < chances.length; index++) {
        expect(chances[index]).toBeLessThan(chances[index - 1]);
        // No sudden cliff between adjacent qualities, including the lowest.
        expect(chances[index] / chances[index - 1]).toBeGreaterThanOrEqual(0.5);
      }
    },
  );
  it('渡劫最低品质约33%，仙品与神品仍各占一成以上', () => {
    const rates = HUNT_MATERIAL_QUALITY_CHANCE_BY_REALM.渡劫;
    expect(rates.真品).toBeCloseTo(0.3278, 4);
    expect(rates.地品).toBeCloseTo(0.2458, 4);
    expect(rates.天品).toBeCloseTo(0.1844, 4);
    expect(rates.仙品).toBeCloseTo(0.1383, 4);
    expect(rates.神品).toBeCloseTo(0.1037, 4);
  });
  it('境界提升时每个品质门槛的累计概率不会倒挂', () => {
    for (let i = 1; i < HUNT_REALMS.length; i++) {
      for (const quality of QUALITY_VALUES) {
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
