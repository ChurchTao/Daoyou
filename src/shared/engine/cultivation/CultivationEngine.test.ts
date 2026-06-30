import { describe, expect, it } from 'vitest';
import type { Cultivator } from '@shared/types/cultivator';
import { resolveLiveExpCap } from '@server/utils/cultivationUtils';
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
    unallocated_attribute_points: 0,
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

function withBodyCultivation(
  cultivator: Cultivator,
  levels: {
    realm?: NonNullable<Cultivator['condition']>['tracks']['bodyCultivation']['realm'];
    skin?: number;
    sinewBone?: number;
    organs?: number;
    qiBlood?: number;
    primordialSpirit?: number;
  },
) {
  return {
    ...cultivator,
    condition: {
      ...cultivator.condition!,
      tracks: {
        ...cultivator.condition!.tracks,
        bodyCultivation: {
          version: 1 as const,
          realm: levels.realm ?? 'iron_bone',
          tracks: {
            skin: { level: levels.skin ?? 0, progress: 0 },
            sinew_bone: { level: levels.sinewBone ?? 0, progress: 0 },
            organs: { level: levels.organs ?? 0, progress: 0 },
            qi_blood: { level: levels.qiBlood ?? 0, progress: 0 },
            primordial_spirit: {
              level: levels.primordialSpirit ?? 0,
              progress: 0,
            },
          },
          milestones: {},
        },
      },
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

  it('carries overflow cultivation exp into the next stage after successful breakthrough', () => {
    const cultivator = createCultivator();
    const currentCap = resolveLiveExpCap(
      cultivator.realm,
      cultivator.realm_stage,
    );
    cultivator.cultivation_progress!.cultivation_exp = currentCap + 275;

    const result = attemptBreakthrough(cultivator, () => 0);

    expect(result.summary.success).toBe(true);
    expect(result.cultivator.realm).toBe('筑基');
    expect(result.cultivator.realm_stage).toBe('中期');
    expect(result.cultivator.cultivation_progress?.cultivation_exp).toBe(275);
    expect(result.cultivator.cultivation_progress?.exp_cap).toBe(
      resolveLiveExpCap('筑基', '中期'),
    );
  });

  it('grants natural attribute growth and fixed unallocated points after breakthrough', () => {
    const minor = createCultivator();
    minor.cultivation_progress!.cultivation_exp = 80_000;
    const minorAttributesBefore = { ...minor.attributes };

    const minorResult = attemptBreakthrough(minor, () => 0);

    expect(minorResult.summary.attributeGrowth).toEqual({});
    expect(minorResult.summary.naturalAttributeGrowth).toBe(2);
    expect(minorResult.summary.attributePointReward).toBe(10);
    expect(minorResult.cultivator.unallocated_attribute_points).toBe(10);
    expect(minorResult.cultivator.attributes).toEqual({
      vitality: minorAttributesBefore.vitality + 2,
      spirit: minorAttributesBefore.spirit + 2,
      wisdom: minorAttributesBefore.wisdom + 2,
      speed: minorAttributesBefore.speed + 2,
      willpower: minorAttributesBefore.willpower + 2,
    });

    const major = createCultivator();
    major.realm_stage = '圆满';
    major.cultivation_progress!.cultivation_exp = 80_000;
    const majorAttributesBefore = { ...major.attributes };

    const majorResult = attemptBreakthrough(major, () => 0);

    expect(majorResult.summary.naturalAttributeGrowth).toBe(4);
    expect(majorResult.summary.attributePointReward).toBe(20);
    expect(majorResult.cultivator.unallocated_attribute_points).toBe(20);
    expect(majorResult.cultivator.attributes).toEqual({
      vitality: majorAttributesBefore.vitality + 4,
      spirit: majorAttributesBefore.spirit + 4,
      wisdom: majorAttributesBefore.wisdom + 4,
      speed: majorAttributesBefore.speed + 4,
      willpower: majorAttributesBefore.willpower + 4,
    });
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

  it('uses body cultivation to reduce failed breakthrough pressure without changing success chance', () => {
    const baseCultivator = createCultivator();
    baseCultivator.realm_stage = '圆满';
    baseCultivator.cultivation_progress!.cultivation_exp = 80_000;
    baseCultivator.cultivation_progress!.breakthrough_failures = 1;
    const bodyCultivator = withBodyCultivation(createCultivator(), {
      sinewBone: 20,
      qiBlood: 20,
      primordialSpirit: 25,
    });
    bodyCultivator.realm_stage = '圆满';
    bodyCultivator.cultivation_progress!.cultivation_exp = 80_000;
    bodyCultivator.cultivation_progress!.breakthrough_failures = 1;

    const baseRolls = [0.99, 0.5, 0.5, 0.5, 0.47];
    const bodyRolls = [0.99, 0.5, 0.5, 0.5, 0.47];
    const base = attemptBreakthrough(
      baseCultivator,
      () => baseRolls.shift() ?? 0,
    );
    const body = attemptBreakthrough(
      bodyCultivator,
      () => bodyRolls.shift() ?? 0,
    );

    expect(body.summary.chance).toBe(base.summary.chance);
    expect(body.summary.exp_lost ?? 0).toBeLessThan(base.summary.exp_lost ?? 0);
    expect(Math.abs(body.summary.insight_change)).toBeLessThan(
      Math.abs(base.summary.insight_change),
    );
    expect(
      body.cultivator.cultivation_progress?.deviation_risk ?? 0,
    ).toBeLessThan(base.cultivator.cultivation_progress?.deviation_risk ?? 0);
    expect(base.cultivator.cultivation_progress?.inner_demon).toBe(true);
    expect(body.cultivator.cultivation_progress?.inner_demon).toBe(false);
  });

  it('applies dao-body breakthrough pressure carrying without changing success chance', () => {
    const dharmaBodyCultivator = withBodyCultivation(createCultivator(), {
      realm: 'dharma_body',
      skin: 25,
      sinewBone: 25,
      organs: 25,
      qiBlood: 25,
      primordialSpirit: 25,
    });
    dharmaBodyCultivator.realm_stage = '圆满';
    dharmaBodyCultivator.cultivation_progress!.cultivation_exp = 80_000;

    const daoBodyCultivator = withBodyCultivation(createCultivator(), {
      realm: 'dao_body',
      skin: 25,
      sinewBone: 25,
      organs: 25,
      qiBlood: 25,
      primordialSpirit: 25,
    });
    daoBodyCultivator.realm_stage = '圆满';
    daoBodyCultivator.cultivation_progress!.cultivation_exp = 80_000;

    const dharmaRolls = [0.99, 0.5, 0.5, 0.5, 0.5];
    const daoRolls = [0.99, 0.5, 0.5, 0.5, 0.5];
    const dharmaBody = attemptBreakthrough(
      dharmaBodyCultivator,
      () => dharmaRolls.shift() ?? 0,
    );
    const daoBody = attemptBreakthrough(
      daoBodyCultivator,
      () => daoRolls.shift() ?? 0,
    );

    expect(daoBody.summary.chance).toBe(dharmaBody.summary.chance);
    expect(daoBody.summary.exp_lost ?? 0).toBeLessThan(
      dharmaBody.summary.exp_lost ?? 0,
    );
    expect(Math.abs(daoBody.summary.insight_change)).toBeLessThan(
      Math.abs(dharmaBody.summary.insight_change),
    );
    expect(
      daoBody.cultivator.cultivation_progress?.deviation_risk ?? 0,
    ).toBeLessThan(
      dharmaBody.cultivator.cultivation_progress?.deviation_risk ?? 0,
    );
  });
});
