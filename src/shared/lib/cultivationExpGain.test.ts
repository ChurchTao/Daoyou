import { describe, expect, it } from 'vitest';
import {
  REALM_DAILY_EXP_BUDGET,
  REALM_TARGET_DAYS,
  STAGE_EXP_WEIGHT,
} from '@shared/config/cultivationExpGain';
import { EXP_CAP_TABLE } from '@shared/config/cultivationProgress';
import { calculateSceneCultivationExp } from '@shared/engine/cultivation/ExpBudgetCalculator';
import { REALM_STAGE_VALUES, REALM_VALUES } from '@shared/types/constants';
import type { RealmStage } from '@shared/types/constants';
import {
  calculateCultivationExpByCap,
  calculateCultivationExpByDailyBudget,
} from './cultivationExpGain';

describe('calculateCultivationExpByCap', () => {
  it('calculates cap percent units with floor rounding by default', () => {
    const result = calculateCultivationExpByCap({
      cap: 1_000,
      percent: 0.015,
      units: 3,
    });

    expect(result.baseExp).toBe(45);
    expect(result.rawExp).toBe(45);
    expect(result.trace.rounding).toBe('floor');
  });

  it('supports ceil and round modes', () => {
    expect(
      calculateCultivationExpByCap({
        cap: 100,
        percent: 0.015,
        rounding: 'ceil',
      }).baseExp,
    ).toBe(2);

    expect(
      calculateCultivationExpByCap({
        cap: 100,
        percent: 0.015,
        rounding: 'round',
      }).baseExp,
    ).toBe(2);
  });

  it('applies minBaseExp only for positive raw gains', () => {
    expect(
      calculateCultivationExpByCap({
        cap: 10,
        percent: 0.01,
        minBaseExp: 1,
      }).baseExp,
    ).toBe(1);

    expect(
      calculateCultivationExpByCap({
        cap: 10,
        percent: 0,
        minBaseExp: 1,
      }).baseExp,
    ).toBe(0);
  });

  it('applies maxBaseExp after rounding and min', () => {
    const result = calculateCultivationExpByCap({
      cap: 10_000,
      percent: 0.5,
      maxBaseExp: 200,
    });

    expect(result.baseExp).toBe(200);
  });

  it('clamps negative cap percent and units to zero', () => {
    expect(
      calculateCultivationExpByCap({
        cap: -1_000,
        percent: 0.1,
      }).baseExp,
    ).toBe(0);

    expect(
      calculateCultivationExpByCap({
        cap: 1_000,
        percent: -0.1,
      }).baseExp,
    ).toBe(0);

    expect(
      calculateCultivationExpByCap({
        cap: 1_000,
        percent: 0.1,
        units: -1,
      }).baseExp,
    ).toBe(0);
  });

  it('rejects non-finite numeric inputs', () => {
    expect(() =>
      calculateCultivationExpByCap({
        cap: Number.POSITIVE_INFINITY,
        percent: 0.1,
      }),
    ).toThrow('cap');

    expect(() =>
      calculateCultivationExpByCap({
        cap: 1_000,
        percent: Number.NaN,
      }),
    ).toThrow('percent');

    expect(() =>
      calculateCultivationExpByCap({
        cap: 1_000,
        percent: 0.1,
        units: Number.NEGATIVE_INFINITY,
      }),
    ).toThrow('units');
  });
});

describe('daily budget cultivation exp model', () => {
  it('calculates daily budget fraction units with floor rounding by default', () => {
    const result = calculateCultivationExpByDailyBudget({
      dailyBudget: 1_000,
      sourceDailyFraction: 0.0625,
      units: 4,
      sourceMultiplier: 1.2,
    });

    expect(result.baseExp).toBe(300);
    expect(result.rawExp).toBe(300);
    expect(result.trace.dailyBudget).toBe(1_000);
    expect(result.trace.sourceDailyFraction).toBe(0.0625);
    expect(result.trace.sourceMultiplier).toBe(1.2);
    expect(result.trace.rounding).toBe('floor');
  });

  it('keeps exp caps aligned with target days and stage weights', () => {
    for (const realm of REALM_VALUES) {
      const targetTotal =
        REALM_TARGET_DAYS[realm] * REALM_DAILY_EXP_BUDGET[realm];
      const stageCaps = EXP_CAP_TABLE[realm];
      const actualTotal = REALM_STAGE_VALUES.reduce(
        (sum, stage) => sum + stageCaps[stage],
        0,
      );

      expect(Math.abs(actualTotal - targetTotal)).toBeLessThanOrEqual(10_000);

      for (const stage of REALM_STAGE_VALUES) {
        const expectedStageCap = targetTotal * STAGE_EXP_WEIGHT[stage];
        const tolerance = expectedStageCap < 10_000 ? 500 : 5_000;
        expect(
          Math.abs(stageCaps[stage] - expectedStageCap),
        ).toBeLessThanOrEqual(tolerance);
      }
    }
  });

  it('calculates offline 24h as 15%-24% of daily budget', () => {
    const context = {
      realm: '化神' as const,
      realmStage: '初期' as RealmStage,
      hoursElapsed: 24,
    };

    expect(
      calculateSceneCultivationExp('offline_yield', {
        ...context,
        randomFactor: 0.8,
      }).baseExp,
    ).toBe(1_382);
    expect(
      calculateSceneCultivationExp('offline_yield', {
        ...context,
        randomFactor: 1,
      }).baseExp,
    ).toBe(1_728);
    expect(
      calculateSceneCultivationExp('offline_yield', {
        ...context,
        randomFactor: 1.2,
      }).baseExp,
    ).toBe(2_073);
  });

  it('calculates dungeon tier rewards and legacy result mapping from daily budget', () => {
    const context = {
      realm: '化神' as const,
      realmStage: '初期' as RealmStage,
    };

    expect(
      calculateSceneCultivationExp('dungeon', {
        ...context,
        tier: 'D',
      }).baseExp,
    ).toBe(360);
    expect(
      calculateSceneCultivationExp('dungeon', {
        ...context,
        tier: 'B',
      }).baseExp,
    ).toBe(1_260);
    expect(
      calculateSceneCultivationExp('dungeon', {
        ...context,
        tier: 'S',
      }).baseExp,
    ).toBe(2_880);
    expect(
      calculateSceneCultivationExp('dungeon', {
        ...context,
        tier: 'S',
        dangerBonus: 0.5,
      }).baseExp,
    ).toBe(3_168);

    expect(
      calculateSceneCultivationExp('dungeon', {
        ...context,
        result: 'perfect',
      }).baseExp,
    ).toBe(
      calculateSceneCultivationExp('dungeon', {
        ...context,
        tier: 'S',
      }).baseExp,
    );
    expect(
      calculateSceneCultivationExp('dungeon', {
        ...context,
        result: 'good',
      }).baseExp,
    ).toBe(
      calculateSceneCultivationExp('dungeon', {
        ...context,
        tier: 'A',
      }).baseExp,
    );
    expect(
      calculateSceneCultivationExp('dungeon', {
        ...context,
        result: 'normal',
      }).baseExp,
    ).toBe(
      calculateSceneCultivationExp('dungeon', {
        ...context,
        tier: 'B',
      }).baseExp,
    );
    expect(
      calculateSceneCultivationExp('dungeon', {
        ...context,
        result: 'failed',
      }).baseExp,
    ).toBe(180);
  });

  it('calculates battle realm and victory multipliers from daily budget', () => {
    const context = {
      realm: '化神' as const,
      realmStage: '初期' as RealmStage,
    };

    expect(
      calculateSceneCultivationExp('battle_victory', {
        ...context,
        realmDiff: 0,
        victoryType: 'normal',
      }).baseExp,
    ).toBe(72);
    expect(
      calculateSceneCultivationExp('battle_victory', {
        ...context,
        realmDiff: 1,
        victoryType: 'perfect',
      }).baseExp,
    ).toBe(115);
    expect(
      calculateSceneCultivationExp('battle_victory', {
        ...context,
        realmDiff: -1,
        victoryType: 'normal',
      }).baseExp,
    ).toBe(18);
  });

  it('keeps retreat on daily budget before existing retreat multipliers', () => {
    expect(
      calculateSceneCultivationExp('retreat', {
        realm: '化神',
        realmStage: '初期',
        years: 10,
      }).baseExp,
    ).toBe(450);
  });
});
