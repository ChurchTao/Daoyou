import { describe, expect, it } from 'vitest';
import type { Cultivator } from '@shared/types/cultivator';
import { attemptBreakthrough, performCultivation } from './CultivationEngine';

function createCultivator(): Cultivator {
  return {
    id: 'cultivator-1',
    name: '韩立',
    gender: '男',
    realm: '筑基',
    realm_stage: '初期',
    age: 30,
    lifespan: 180,
    status: 'active',
    attributes: {
      vitality: 40,
      spirit: 36,
      wisdom: 30,
      speed: 28,
      willpower: 32,
    },
    spiritual_roots: [{ element: '木', strength: 80, grade: '真灵根' }],
    pre_heaven_fates: [],
    cultivations: [],
    skills: [],
    inventory: {
      artifacts: [],
      consumables: [],
      materials: [],
    },
    equipped: {
      weapon: null,
      armor: null,
      accessory: null,
    },
    max_skills: 4,
    spirit_stones: 0,
    cultivation_progress: {
      cultivation_exp: 0,
      exp_cap: 100_000,
      comprehension_insight: 60,
      breakthrough_failures: 0,
      bottleneck_state: false,
      inner_demon: false,
      deviation_risk: 0,
    },
    condition: {
      version: 1,
      resources: {
        hp: { current: 100 },
        mp: { current: 100 },
      },
      gauges: {
        pillToxicity: 0,
      },
      tracks: {
        tempering: {
          vitality: { level: 0, progress: 0 },
          spirit: { level: 0, progress: 0 },
          wisdom: { level: 0, progress: 0 },
          speed: { level: 0, progress: 0 },
          willpower: { level: 0, progress: 0 },
        },
        marrowWash: { level: 0, progress: 0 },
      },
      counters: {
        longTermPillUsesByRealm: {},
        cultivationPillUsesByRealm: {},
        longevityPillUsesByRealm: {},
      },
      statuses: [],
      timestamps: {},
    },
  };
}

function withCultivationBoost(cultivator: Cultivator, boostPercent: number) {
  return {
    ...cultivator,
    condition: {
      ...cultivator.condition!,
      statuses: [
        {
          key: 'cultivation_boost' as const,
          stacks: 1,
          source: 'pill' as const,
          duration: { kind: 'until_removed' as const },
          usesRemaining: 1,
          payload: {
            boostPercent,
            retreatExpMultiplier: 1 + boostPercent,
          },
          createdAt: '2026-05-25T12:00:00.000Z',
          updatedAt: '2026-05-25T12:00:00.000Z',
        },
      ],
    },
  } satisfies Cultivator;
}

function withStatus(
  cultivator: Cultivator,
  status: NonNullable<Cultivator['condition']>['statuses'][number],
) {
  return {
    ...cultivator,
    condition: {
      ...cultivator.condition!,
      statuses: [status],
    },
  } satisfies Cultivator;
}

describe('CultivationEngine cultivation boost', () => {
  it('applies cultivation boost to retreat exp once and then consumes it', () => {
    const base = performCultivation(createCultivator(), 10, () => 0.5);
    const boosted = performCultivation(
      withCultivationBoost(createCultivator(), 0.5),
      10,
      () => 0.5,
    );

    expect(boosted.summary.exp_gained).toBe(
      Math.floor(base.summary.exp_gained * 1.5),
    );
    expect(boosted.summary.insight_gained).toBe(base.summary.insight_gained);
    expect(
      boosted.cultivator.condition?.statuses.some(
        (status) => status.key === 'cultivation_boost',
      ),
    ).toBe(false);
  });

  it('does not consume cultivation boost during breakthrough attempts', () => {
    const cultivator = withCultivationBoost(createCultivator(), 0.5);
    cultivator.cultivation_progress!.cultivation_exp = 80_000;

    const result = attemptBreakthrough(cultivator, () => 0.99);

    expect(
      result.cultivator.condition?.statuses.some(
        (status) => status.key === 'cultivation_boost',
      ),
    ).toBe(true);
  });

  it('reads breakthrough focus payload as a success-rate bonus', () => {
    const baseCultivator = createCultivator();
    baseCultivator.cultivation_progress!.cultivation_exp = 80_000;
    const focused = withStatus(createCultivator(), {
      key: 'breakthrough_focus',
      stacks: 1,
      source: 'pill',
      duration: { kind: 'until_removed' },
      usesRemaining: 1,
      payload: { breakthroughChanceBonus: 0.12 },
      createdAt: '2026-05-25T12:00:00.000Z',
      updatedAt: '2026-05-25T12:00:00.000Z',
    });
    focused.cultivation_progress!.cultivation_exp = 80_000;

    const base = attemptBreakthrough(baseCultivator, () => 0.99);
    const boosted = attemptBreakthrough(focused, () => 0.99);

    expect(boosted.summary.chance).toBeCloseTo(base.summary.chance + 0.12, 4);
  });

  it('uses protect meridians payload to reduce failed breakthrough exp loss', () => {
    const baseCultivator = createCultivator();
    baseCultivator.cultivation_progress!.cultivation_exp = 80_000;
    const protectedCultivator = withStatus(createCultivator(), {
      key: 'protect_meridians',
      stacks: 1,
      source: 'pill',
      duration: { kind: 'until_removed' },
      usesRemaining: 1,
      payload: { failureExpLossReductionPercent: 0.7 },
      createdAt: '2026-05-25T12:00:00.000Z',
      updatedAt: '2026-05-25T12:00:00.000Z',
    });
    protectedCultivator.cultivation_progress!.cultivation_exp = 80_000;

    const base = attemptBreakthrough(baseCultivator, () => 0.99);
    const protectedResult = attemptBreakthrough(
      protectedCultivator,
      () => 0.99,
    );

    expect(protectedResult.summary.exp_lost).toBe(
      Math.floor((base.summary.exp_lost ?? 0) * 0.3),
    );
  });

  it('clear mind prevents failed breakthroughs from creating inner demon', () => {
    const unprotected = createCultivator();
    unprotected.cultivation_progress!.cultivation_exp = 80_000;
    const clearMind = withStatus(createCultivator(), {
      key: 'clear_mind',
      stacks: 1,
      source: 'pill',
      duration: { kind: 'until_removed' },
      usesRemaining: 1,
      payload: { preventsInnerDemon: true },
      createdAt: '2026-05-25T12:00:00.000Z',
      updatedAt: '2026-05-25T12:00:00.000Z',
    });
    clearMind.cultivation_progress!.cultivation_exp = 80_000;

    const unprotectedRolls = [0.99, 0.5, 0.5, 0];
    const unprotectedResult = attemptBreakthrough(
      unprotected,
      () => unprotectedRolls.shift() ?? 0,
    );
    const rolls = [0.99, 0.5, 0.5, 0];
    const result = attemptBreakthrough(clearMind, () => rolls.shift() ?? 0);

    expect(unprotectedResult.cultivator.cultivation_progress?.inner_demon).toBe(
      true,
    );
    expect(result.summary.success).toBe(false);
    expect(result.cultivator.cultivation_progress?.inner_demon).toBe(false);
  });
});
