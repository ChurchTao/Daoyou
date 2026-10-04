import { describe, expect, it } from 'vitest';
import {
  SECT_RANK_METHOD_CAP,
  getEffectiveSectMethodLevelCap,
  hasSectRank,
} from '../domain/index.js';

describe('宗门组织成长', () => {
  it('四种弟子身份均匀开放至180级', () => {
    expect(SECT_RANK_METHOD_CAP).toEqual({
      registered: 45,
      outer: 90,
      inner: 135,
      true: 180,
    });
  });

  it('按境界、弟子职阶和藏经阁取心法最低上限', () => {
    expect(
      getEffectiveSectMethodLevelCap({
        realmCap: 180,
        rank: 'registered',
        facilityCap: 180,
      }),
    ).toBe(45);
    expect(
      getEffectiveSectMethodLevelCap({
        realmCap: 80,
        rank: 'outer',
        facilityCap: 180,
      }),
    ).toBe(80);
    expect(
      getEffectiveSectMethodLevelCap({
        realmCap: 180,
        rank: 'inner',
        facilityCap: 110,
      }),
    ).toBe(110);
    expect(
      getEffectiveSectMethodLevelCap({
        realmCap: 180,
        rank: 'true',
        facilityCap: 145,
      }),
    ).toBe(145);
  });

  it('消费贡献不会参与职阶比较或造成降阶', () => {
    expect(hasSectRank('inner', 'outer')).toBe(true);
    expect(hasSectRank('outer', 'inner')).toBe(false);
  });
});
