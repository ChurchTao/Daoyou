import { describe, expect, it } from 'vitest';
import { EnemyGenerator } from '@shared/engine/enemyGenerator';
import {
  buildTowerEnemyVariantSeed,
  buildTowerBlessingChoices,
  isTowerRealmEligible,
  packTowerLeaderboardScore,
  resolveTowerDifficulty,
  resolveTowerFloorKind,
  resolveTowerMilestoneTier,
  resolveTowerRealmStage,
  TOWER_MAX_FLOOR,
  TOWER_ELIGIBLE_REALMS,
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

    expect(resolveTowerRealmStage(1)).toBe('初期');
    expect(resolveTowerRealmStage(4)).toBe('中期');
    expect(resolveTowerRealmStage(7)).toBe('后期');
    expect(resolveTowerRealmStage(10)).toBe('圆满');
    expect(resolveTowerRealmStage(11)).toBe('初期');
  });

  it('maps milestone tiers every five floors', () => {
    expect(resolveTowerMilestoneTier(5)).toBe('C');
    expect(resolveTowerMilestoneTier(10)).toBe('B');
    expect(resolveTowerMilestoneTier(15)).toBe('A');
    expect(resolveTowerMilestoneTier(20)).toBe('S');
    expect(resolveTowerMilestoneTier(12)).toBeNull();
  });

  it('forces recovery blessings when hp or mp is low', () => {
    const choices = buildTowerBlessingChoices({
      runId: 'run-1',
      clearedFloor: 18,
      blessings: {
        vitality_surge: 5,
      },
      currentHp: 40,
      maxHp: 100,
      currentMp: 20,
      maxMp: 100,
    });

    expect(choices.map((choice) => choice.id)).toContain('breathing_technique');
    expect(choices.map((choice) => choice.id)).toContain('meridian_cycle');
    expect(choices.length).toBeLessThanOrEqual(3);
  });

  it('projects blessing effect previews with concrete recovery values', () => {
    expect(
      getTowerBlessingEffectPreview({
        blessingId: 'breathing_technique',
        currentStacks: 2,
        nextStacks: 3,
        currentHp: 120,
        maxHp: 320,
      }),
    ).toEqual({
      currentLabel: '战前回复 20% 缺失气血（约 40 点）',
      nextLabel: '战前回复 30% 缺失气血（约 60 点）',
      formulaLabel: '公式：每层战前回复 10% 缺失气血。 上限 3 层。',
    });

    expect(
      getTowerBlessingEffectPreview({
        blessingId: 'balanced_dao',
        currentStacks: 1,
        nextStacks: 2,
      }),
    ).toEqual({
      currentLabel: '五维主属性 +5%',
      nextLabel: '五维主属性 +10%',
      formulaLabel: '公式：每层五维主属性同步 +5%。 上限 3 层。',
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

  it('uses variantSeed to create distinct enemy variants for the same realm floor', () => {
    const generator = new EnemyGenerator();
    const base = {
      realm: '金丹' as const,
      realmStage: '初期' as const,
      race: '人族' as const,
      difficulty: 5,
      isBoss: false,
    };

    const first = generator.buildDraft({
      ...base,
      variantSeed: 'tower:2026-W22@Asia/Shanghai:金丹:1',
    });
    const second = generator.buildDraft({
      ...base,
      variantSeed: 'tower:2026-W23@Asia/Shanghai:金丹:1',
    });

    expect(first.cultivator.id).not.toBe(second.cultivator.id);
    expect(first.balance.variantKey).not.toBe(second.balance.variantKey);
  });
});
