import { describe, expect, it } from 'vitest';
import {
  buildTowerBlessingChoices,
  isTowerRealmEligible,
  packTowerLeaderboardScore,
  resolveTowerFloorKind,
  TOWER_ELIGIBLE_REALMS,
  TOWER_MAX_FLOOR,
  unpackTowerLeaderboardScore,
} from './helpers.js';

describe('tower helpers', () => {
  it('limits tower eligibility to golden core and above', () => {
    expect(TOWER_ELIGIBLE_REALMS).toEqual([
      '金丹',
      '元婴',
      '化神',
      '炼虚',
      '合体',
      '大乘',
      '渡劫',
    ]);
    expect(isTowerRealmEligible('炼气')).toBe(false);
    expect(isTowerRealmEligible('筑基')).toBe(false);
    expect(isTowerRealmEligible('金丹')).toBe(true);
    expect(isTowerRealmEligible('渡劫')).toBe(true);
  });

  it('classifies ordinary, elite and boss floors', () => {
    expect(TOWER_MAX_FLOOR).toBe(20);
    expect(resolveTowerFloorKind(1)).toBe('normal');
    expect(resolveTowerFloorKind(5)).toBe('elite');
    expect(resolveTowerFloorKind(10)).toBe('boss');
    expect(resolveTowerFloorKind(20)).toBe('boss');
  });

  it('offers only useful uncapped blessings at the intended cadence', () => {
    const args = {
      runId: 'run-1',
      clearedFloor: 0,
      blessings: { might: 3 },
      hasBeasts: false,
    };
    const choices = buildTowerBlessingChoices(args);
    expect(choices).toHaveLength(4);
    expect(choices.map((c) => c.id)).not.toContain('might');
    expect(choices.map((c) => c.id)).not.toContain('beast');
    expect(choices.map((c) => c.id)).not.toContain('beastHaste');
    expect(choices.map((c) => c.id)).not.toContain('beastHide');
    expect(buildTowerBlessingChoices({ ...args, clearedFloor: 1 })).toEqual([]);
    expect(buildTowerBlessingChoices({ ...args, clearedFloor: 20 })).toEqual(
      [],
    );
    expect(buildTowerBlessingChoices(args)).toEqual(choices);
  });

  it('packs and unpacks leaderboard scores while preserving rank tie ordering', () => {
    const seasonEndAtMs = Date.parse('2026-06-07T16:00:00.000Z');
    const earlier = packTowerLeaderboardScore(
      17,
      Date.parse('2026-06-02T12:00:00.000Z'),
      seasonEndAtMs,
    );
    const later = packTowerLeaderboardScore(
      17,
      Date.parse('2026-06-03T12:00:00.000Z'),
      seasonEndAtMs,
    );

    expect(earlier).toBeGreaterThan(later);
    expect(unpackTowerLeaderboardScore(earlier, seasonEndAtMs)).toEqual({
      highestFloor: 17,
      firstReachedAtMs: Date.parse('2026-06-02T12:00:00.000Z'),
    });
  });
});
