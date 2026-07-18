import { describe, expect, it } from 'vitest';
import {
  getEffectiveSectMethodLevelCap,
  getSectCraftDiscount,
  getSectFacilityBonus,
  hasSectRank,
} from '../domain';

describe('宗门组织成长', () => {
  it('按境界、弟子职阶和藏经阁取心法最低上限', () => {
    expect(getEffectiveSectMethodLevelCap({ realmCap: 80, rank: 'registered', archiveLevel: 5 })).toBe(5);
    expect(getEffectiveSectMethodLevelCap({ realmCap: 80, rank: 'outer', archiveLevel: 1 })).toBe(20);
    expect(getEffectiveSectMethodLevelCap({ realmCap: 35, rank: 'inner', archiveLevel: 5 })).toBe(35);
    expect(getEffectiveSectMethodLevelCap({ realmCap: 120, rank: 'true', archiveLevel: 3 })).toBe(60);
  });

  it('消费贡献不会参与职阶比较或造成降阶', () => {
    expect(hasSectRank('inner', 'outer')).toBe(true);
    expect(hasSectRank('outer', 'inner')).toBe(false);
  });

  it('设施加成线性成长且真传丹器折扣封顶 20%', () => {
    expect(getSectFacilityBonus('cultivation_room', 5)).toBe(0.1);
    expect(getSectFacilityBonus('spirit_vein', 5)).toBe(0.25);
    expect(getSectCraftDiscount('inner', 5)).toBe(0.1);
    expect(getSectCraftDiscount('true', 5)).toBe(0.2);
    expect(getSectCraftDiscount('true', 99)).toBe(0.2);
  });
});
