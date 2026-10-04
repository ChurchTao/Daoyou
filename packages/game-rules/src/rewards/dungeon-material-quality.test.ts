import { describe, expect, it } from 'vitest';
import { MaterialGenerator } from '../materials/generator.js';
import { QUALITY_VALUES } from '@daoyou/constants/qualities';
import { REALM_VALUES } from '@daoyou/constants/realms';
import { DUNGEON_MATERIAL_QUALITY_CHANCE_BY_REALM } from '@daoyou/game-content/rewards/dungeon';

describe('副本材料品质概率', () => {
  it('每个境界的概率之和为 1，低于品质下限的材料不会产出', () => {
    const minimumQualityIndex = [0, 0, 0, 1, 1, 2, 2, 3, 3];
    for (const [index, realm] of REALM_VALUES.entries()) {
      const chances = DUNGEON_MATERIAL_QUALITY_CHANCE_BY_REALM[realm];
      expect(
        Object.values(chances).reduce((sum, chance) => sum + chance, 0),
      ).toBeCloseTo(1);
      for (const quality of QUALITY_VALUES.slice(
        0,
        minimumQualityIndex[index],
      )) {
        expect(chances[quality]).toBe(0);
      }
    }
  });

  it('高境界的仙品及神品合计概率逐级上升', () => {
    const realms = ['炼虚', '合体', '大乘', '渡劫'] as const;
    const highQualityChances = realms.map((realm) => {
      const chances = DUNGEON_MATERIAL_QUALITY_CHANCE_BY_REALM[realm];
      return chances.仙品 + chances.神品;
    });
    [0.4, 0.45, 0.5, 0.6].forEach((expected, index) => {
      expect(highQualityChances[index]).toBeCloseTo(expected);
    });
  });

  it('渡劫材料最低真品，神品率为 30%', () => {
    const chances = DUNGEON_MATERIAL_QUALITY_CHANCE_BY_REALM.渡劫;
    expect(chances).toMatchObject({
      真品: 0.1,
      地品: 0.15,
      天品: 0.15,
      仙品: 0.3,
      神品: 0.3,
    });
    const rankAt = (roll: number) => {
      const values = [roll, 0.5, 0.5];
      return MaterialGenerator.generateRandomSkeletons(
        1,
        { qualityChanceMap: chances },
        () => values.shift() ?? 0.5,
      )[0].rank;
    };
    expect(rankAt(0)).toBe('真品');
    expect(rankAt(0.1)).toBe('地品');
    expect(rankAt(0.5)).toBe('仙品');
    expect(rankAt(0.9)).toBe('神品');
  });
});
