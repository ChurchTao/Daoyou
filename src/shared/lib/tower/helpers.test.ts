import { describe, expect, it } from 'vitest';
import {
  buildTowerBlessingChoices,
  buildTowerEnemyVariantSeed,
  isTowerRealmEligible,
  packTowerLeaderboardScore,
  resolveTowerDifficulty,
  resolveTowerFloorKind,
  resolveTowerMilestoneTier,
  resolveTowerRealmStage,
  TOWER_ELIGIBLE_REALMS,
  TOWER_MAX_FLOOR,
  unpackTowerLeaderboardScore,
} from './helpers';
import { getTowerBlessingEffectPreview } from './presentation';

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

  it('maps floor kinds and realm stages deterministically', () => {
    expect(TOWER_MAX_FLOOR).toBe(20);
    expect(resolveTowerDifficulty(1)).toBe(5);
    expect(resolveTowerDifficulty(10)).toBe(50);
    expect(resolveTowerDifficulty(20)).toBe(100);

    expect(resolveTowerFloorKind(1)).toBe('normal');
    expect(resolveTowerFloorKind(5)).toBe('elite');
    expect(resolveTowerFloorKind(10)).toBe('boss');
    expect(resolveTowerFloorKind(20)).toBe('boss');

    expect(resolveTowerRealmStage(1)).toBe('中期');
    expect(resolveTowerRealmStage(4)).toBe('中期');
    expect(resolveTowerRealmStage(7)).toBe('中期');
    expect(resolveTowerRealmStage(10)).toBe('中期');
    expect(resolveTowerRealmStage(11)).toBe('中期');
  });

  it('maps milestone tiers every five floors', () => {
    expect(resolveTowerMilestoneTier(5)).toBe('C');
    expect(resolveTowerMilestoneTier(10)).toBe('B');
    expect(resolveTowerMilestoneTier(15)).toBe('A');
    expect(resolveTowerMilestoneTier(20)).toBe('S');
    expect(resolveTowerMilestoneTier(12)).toBeNull();
  });

  it('offers only useful uncapped blessings at the intended cadence', () => {
    const args = {
      runId: 'run-1',
      clearedFloor: 0,
      blessings: { physical_power: 3 },
      hasBeasts: false,
    };
    const choices = buildTowerBlessingChoices(args);
    expect(choices).toHaveLength(3);
    expect(choices.map((c) => c.id)).not.toContain('physical_power');
    expect(choices.map((c) => c.id)).not.toContain('beast_power');
    expect(buildTowerBlessingChoices({ ...args, clearedFloor: 1 })).toEqual([]);
    expect(buildTowerBlessingChoices({ ...args, clearedFloor: 20 })).toEqual(
      [],
    );
    expect(buildTowerBlessingChoices(args)).toEqual(choices);
  });
  it('previews additive combat attributes', () => {
    expect(
      getTowerBlessingEffectPreview({
        blessingId: 'physical_power',
        currentStacks: 2,
        nextStacks: 3,
      }),
    ).toMatchObject({
      currentLabel: '人物物理攻击 +16%',
      nextLabel: '人物物理攻击 +24%',
    });
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

  it('builds weekly tower enemy seeds that vary by season', () => {
    expect(
      buildTowerEnemyVariantSeed({
        seasonKey: '2026-W22@Asia/Shanghai',
        realm: '金丹',
        floor: 1,
      }),
    ).toBe('tower:2026-W22@Asia/Shanghai:金丹:1');
    expect(
      buildTowerEnemyVariantSeed({
        seasonKey: '2026-W22@Asia/Shanghai',
        realm: '金丹',
        floor: 99,
      }),
    ).toBe('tower:2026-W22@Asia/Shanghai:金丹:20');
  });
});
