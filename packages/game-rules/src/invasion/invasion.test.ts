import { describe, expect, it } from 'vitest';
import { planBaixiaoClearRewards } from '../baixiao/meet.js';
import { compileExorcismEncounter } from '../dungeon/exorcism/encounter.js';
import { exorcismGradeExperience } from '../dungeon/exorcism/rewards.js';
import {
  invasionBossRewardGrade,
  invasionBossWave,
  invasionCardDrop,
  invasionDifficulty,
  invasionEnemies,
  invasionFirstClear,
  invasionLastWaveResources,
  invasionNextWave,
  invasionResourceDelta,
  invasionWaveMultiplier,
  invasionWeek,
  planInvasionReward,
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

  it('普通波保持掉卡概率，首领必掉卡', () => {
    expect(invasionCardDrop(0.5, 0.02, 4)).toBeUndefined();
    expect(invasionCardDrop(0.9, 0.02, 5)).toBe('assault');
    expect(invasionCardDrop(0.4, 0.85, 4)).toBe('shield');
  });

  it('五波合计一局同境界普通 S 级除祟资源', () => {
    const realm = '筑基';
    const seed = 19;
    const planned = planInvasionReward(realm, seed, 'S');
    const { spiritStones, insight, plans } = planBaixiaoClearRewards(
      realm,
      20,
      seed,
    );
    expect(planned).toMatchObject({ spiritStones, insight, plans });
    expect(planned.cultivationExp).toBe(
      exorcismGradeExperience('S', {
        mapRealm: realm,
        playerRealm: realm,
        difficultyTier: 'normal',
      }),
    );

    const budget = {
      cultivationExp: planned.cultivationExp,
      spiritStones,
      insight: 7,
    };
    const paidBeforeBoss = invasionResourceDelta(budget, 0, 4);
    expect(paidBeforeBoss.insight).toBe(5);
    const paidOnBoss = invasionResourceDelta(budget, 4, 5);
    expect({
      cultivationExp: paidBeforeBoss.cultivationExp + paidOnBoss.cultivationExp,
      spiritStones: paidBeforeBoss.spiritStones + paidOnBoss.spiritStones,
      insight: paidBeforeBoss.insight + paidOnBoss.insight,
    }).toEqual(budget);
  });

  it('首领道具按 B、A、A、S 分档，之后的首领沿用 S', () => {
    const realm = '筑基';
    const seed = 19;
    const groups = [
      [5, 'B', 18],
      [10, 'A', 19],
      [15, 'A', 19],
      [20, 'S', 20],
      [25, 'S', 20],
      [30, 'S', 20],
    ] as const;
    for (const [wave, grade, correct] of groups) {
      expect(invasionBossRewardGrade(wave)).toBe(grade);
      expect(planInvasionReward(realm, seed, grade).plans).toEqual(
        planBaixiaoClearRewards(realm, correct, seed).plans,
      );
    }
    for (const wave of [0, 1, 4, 6, 19, 21]) {
      expect(invasionBossRewardGrade(wave)).toBeNull();
    }
  });

  it('补结多波时只展示最后一波实际入账，资源上限优先截去后面的波次', () => {
    const budget = { cultivationExp: 503, spiritStones: 2502, insight: 7 };
    const earlier = invasionResourceDelta(budget, 0, 4);
    expect(invasionLastWaveResources(budget, earlier)).toEqual(
      invasionResourceDelta(budget, 4, 5),
    );
    expect(
      invasionLastWaveResources(
        { cultivationExp: 500, spiritStones: 2200, insight: 4 },
        earlier,
      ),
    ).toEqual({ cultivationExp: 98, spiritStones: 199, insight: 0 });
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
