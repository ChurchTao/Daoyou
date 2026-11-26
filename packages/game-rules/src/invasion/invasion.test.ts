import { describe, expect, it } from 'vitest';
import { compileExorcismEncounter } from '../dungeon/exorcism/encounter.js';
import {
  invasionBossWave,
  invasionCardDrop,
  invasionDifficulty,
  invasionEnemies,
  invasionFirstClear,
  invasionNextWave,
  invasionResourceBudget,
  invasionWaveMultiplier,
  invasionWeek,
} from './index.js';

describe('古魔入侵', () => {
  it('只在北京时间周二 14:00–16:00 开放', () => {
    const start = Date.parse('2026-12-01T14:00:00+08:00');
    expect(invasionWeek(start - 1).open).toBe(false);
    expect(invasionWeek(start)).toMatchObject({
      week: '2026-12-01',
      open: true,
    });
    expect(invasionWeek(start + 7_199_999).open).toBe(true);
    expect(invasionWeek(start + 7_200_000).open).toBe(false);
    expect(invasionWeek(start + 7_200_000).nextOpensAt).toBe(
      start + 7 * 86_400_000,
    );
  });

  it('只对五的倍数波叠加首领强度，气血保持角色次序', () => {
    expect(invasionBossWave(5)).toBe(true);
    expect(invasionWaveMultiplier(5)).toBeCloseTo(1.05 ** 4 * 1.2);
    expect(invasionWaveMultiplier(6)).toBeCloseTo(1.05 ** 5);
    for (const realm of ['炼气', '筑基', '渡劫'] as const) {
      for (const wave of [1, 5, 6, 20]) {
        const roster = invasionEnemies(realm, 4, wave, 1);
        expect(roster).toHaveLength(8);
        const [boss, guard, otherGuard, ...others] = roster.map(
          (unit) => unit.attrs.hp,
        );
        expect(boss).toBeGreaterThan(guard);
        expect(otherGuard).toBe(guard);
        expect(guard).toBeGreaterThan(others[0]);
        expect(new Set(others).size).toBe(1);
      }
    }
  });

  it('用队伍人数校准整阵气血，并以该预算计算后续波次', () => {
    const realm = '金丹';
    const { units } = compileExorcismEncounter({
      realm,
      tier: 'normal',
      stage: 1,
      bossId: 'withered_vine',
      lineageId: 'demonic',
    });
    const soloHp = units[0].attrs.hp;
    for (const [members, multiplier] of [
      [2, 1.65],
      [3, 3.5],
      [4, 5.8],
    ]) {
      for (const wave of [1, 5, 6]) {
        const partyHp = invasionEnemies(realm, members, wave, 0).reduce(
          (total, unit) => total + unit.attrs.hp,
          0,
        );
        const budget = soloHp * multiplier * invasionWaveMultiplier(wave);
        expect(Math.abs(partyHp - budget)).toBeLessThanOrEqual(4);
      }
    }
  });

  it('首领必掉卡，基础资源可一直随波数增长', () => {
    expect(invasionCardDrop(0.5, 0.02, 4)).toBeUndefined();
    expect(invasionCardDrop(0.9, 0.02, 5)).toBe('assault');
    expect(invasionCardDrop(0.4, 0.85, 4)).toBe('shield');
    const twelveHours = invasionResourceBudget('筑基', '中期', 5);
    expect(invasionResourceBudget('筑基', '中期', 50).insight).toBe(
      10 * twelveHours.insight,
    );
    expect(
      invasionResourceBudget('筑基', '中期', 6).spiritStones,
    ).toBeGreaterThan(twelveHours.spiritStones);
  });

  it('从队长的下一波开打，按最高参战境界定难度，仅连续首通计入个人进度', () => {
    const party = [
      { realm: '筑基', completedWave: 8 },
      { realm: '元婴', completedWave: 5 },
      { realm: '金丹', completedWave: 10 },
      { realm: '筑基', completedWave: 8 },
    ] as const;
    const wave = invasionNextWave(party[0].completedWave);
    expect(wave).toBe(9);
    expect(invasionDifficulty(party)).toBe('元婴');
    expect(
      party.map(({ completedWave }) => invasionFirstClear(completedWave, wave)),
    ).toEqual([true, false, false, true]);
    expect(invasionFirstClear(9, wave)).toBe(false);
  });
});
