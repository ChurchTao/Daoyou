import { describe, expect, it } from 'vitest';
import {
  getEffectiveSectMethodLevelCap,
  hasSectRank,
} from '../domain';

describe('宗门组织成长', () => {
  it('按境界、弟子职阶和藏经阁取心法最低上限', () => {
    expect(getEffectiveSectMethodLevelCap({ realmCap: 80, rank: 'registered', facilityCap: 100 })).toBe(5);
    expect(getEffectiveSectMethodLevelCap({ realmCap: 80, rank: 'outer', facilityCap: 20 })).toBe(20);
    expect(getEffectiveSectMethodLevelCap({ realmCap: 35, rank: 'inner', facilityCap: 100 })).toBe(35);
    expect(getEffectiveSectMethodLevelCap({ realmCap: 120, rank: 'true', facilityCap: 60 })).toBe(60);
  });

  it('消费贡献不会参与职阶比较或造成降阶', () => {
    expect(hasSectRank('inner', 'outer')).toBe(true);
    expect(hasSectRank('outer', 'inner')).toBe(false);
  });

});
