import { describe, expect, it } from 'vitest';
import type {
  ConditionStatusInstance,
  ConditionStatusKey,
  CultivatorCondition,
} from '@shared/types/condition';
import {
  getConditionStatusCureTargets,
  getNextConditionStatusExpiryMs,
  NATURAL_RECOVERY_CONFIG,
  projectNaturalRecoveryResources,
} from './condition';

const BASELINE_AT = '2026-01-01T00:00:00.000Z';

function createStatus(key: ConditionStatusKey): ConditionStatusInstance {
  return {
    key,
    stacks: 1,
    source: 'battle',
    duration: { kind: 'until_removed' },
    createdAt: BASELINE_AT,
    updatedAt: BASELINE_AT,
  };
}

function createCondition(
  overrides: {
    hp?: { current: number; max?: number };
    mp?: { current: number; max?: number };
    pillToxicity?: number;
    statuses?: ConditionStatusInstance[];
    lastRecoveryAt?: string;
  } = {},
): CultivatorCondition {
  return {
    version: 1,
    resources: {
      hp: overrides.hp ?? { current: 100, max: 1_000 },
      mp: overrides.mp ?? { current: 100, max: 1_000 },
    },
    gauges: {
      pillToxicity: overrides.pillToxicity ?? 0,
    },
    tracks: {
      bodyCultivation: {
        version: 1,
        realm: 'mortal_body',
        tracks: {
          skin: { level: 0, progress: 0 },
          sinew_bone: { level: 0, progress: 0 },
          organs: { level: 0, progress: 0 },
          qi_blood: { level: 0, progress: 0 },
          primordial_spirit: { level: 0, progress: 0 },
        },
        milestones: {},
      },
      tempering: {
        vitality: { level: 0, progress: 0 },
        spirit: { level: 0, progress: 0 },
        wisdom: { level: 0, progress: 0 },
        speed: { level: 0, progress: 0 },
        willpower: { level: 0, progress: 0 },
      },
      marrowWash: {
        version: 1,
        level: 0,
        progress: 0,
        realm: 0,
        breakthroughs: 0,
      },
    },
    counters: {
      longTermPillUsesByRealm: {},
      cultivationPillUsesByRealm: {},
      longevityPillUsesByRealm: {},
      bodyCultivationPillUses: 0,
    },
    statuses: overrides.statuses ?? [],
    timestamps: {
      lastRecoveryAt:
        overrides.lastRecoveryAt === undefined
          ? BASELINE_AT
          : overrides.lastRecoveryAt,
    },
  };
}

function project(
  conditionInput: CultivatorCondition,
  options: {
    now?: string;
    maxHp?: number;
    maxMp?: number;
    toxicityPenaltyMultiplier?: number;
    naturalRecoveryMultiplier?: number;
  } = {},
) {
  return projectNaturalRecoveryResources({
    conditionInput,
    maxHp: options.maxHp ?? 1_000,
    maxMp: options.maxMp ?? 1_000,
    toxicityPenaltyMultiplier: options.toxicityPenaltyMultiplier,
    naturalRecoveryMultiplier: options.naturalRecoveryMultiplier,
    now: new Date(options.now ?? '2026-01-01T01:00:00.000Z'),
  });
}

describe('getConditionStatusCureTargets', () => {
  it.each([
    ['minor_wound', ['minor_wound']],
    ['major_wound', ['minor_wound', 'major_wound']],
    ['near_death', ['minor_wound', 'major_wound', 'near_death']],
    ['weakness', ['weakness']],
  ] as const)('resolves %s cure targets', (status, expected) => {
    expect(getConditionStatusCureTargets(status)).toEqual(expected);
  });
});

describe('projectNaturalRecoveryResources', () => {
  it('projects one hour of base hp and mp recovery', () => {
    const result = project(createCondition());

    expect(result.resources.hp).toEqual({ current: 380, max: 1_000 });
    expect(result.resources.mp).toEqual({ current: 480, max: 1_000 });
    expect(result.recovery.hp.recovered).toBe(280);
    expect(result.recovery.mp.recovered).toBe(380);
    expect(result.recovery.hp.perHour).toBe(
      1_000 * NATURAL_RECOVERY_CONFIG.hpPerHour,
    );
    expect(result.recovery.mp.perHour).toBe(
      1_000 * NATURAL_RECOVERY_CONFIG.mpPerHour,
    );
    expect(result.elapsedMs).toBe(3_600_000);
    expect(result.recoveryFactor).toBe(1);
  });

  it('applies pill toxicity and fate toxicity multipliers', () => {
    const result = project(createCondition({ pillToxicity: 60 }), {
      toxicityPenaltyMultiplier: 1.5,
    });

    expect(result.recoveryFactor).toBe(0.5);
    expect(result.resources.hp.current).toBe(240);
    expect(result.resources.mp.current).toBe(290);
  });

  it.each([
    ['minor_wound', 0.88],
    ['major_wound', 0.68],
    ['near_death', 0.42],
  ] as const)(
    'applies the %s natural recovery multiplier',
    (statusKey, multiplier) => {
      const result = project(
        createCondition({ statuses: [createStatus(statusKey)] }),
      );

      expect(result.recoveryFactor).toBe(multiplier);
      expect(result.resources.hp.current).toBe(
        100 + Math.floor(280 * multiplier),
      );
      expect(result.resources.mp.current).toBe(
        100 + Math.floor(380 * multiplier),
      );
    },
  );

  it('applies the fate natural recovery multiplier', () => {
    const result = project(createCondition(), {
      naturalRecoveryMultiplier: 1.25,
    });

    expect(result.recoveryFactor).toBe(1.25);
    expect(result.resources.hp.current).toBe(450);
    expect(result.resources.mp.current).toBe(575);
  });

  it('caps recovery and reports full resources consistently', () => {
    const result = project(
      createCondition({
        hp: { current: 950, max: 1_000 },
        mp: { current: 1_000, max: 1_000 },
      }),
    );

    expect(result.resources.hp.current).toBe(1_000);
    expect(result.recovery.hp).toMatchObject({
      current: 1_000,
      recovered: 50,
      isFull: true,
      perHour: 0,
      timeToFullMs: 0,
    });
    expect(result.recovery.mp).toMatchObject({
      current: 1_000,
      recovered: 0,
      isFull: true,
      perHour: 0,
      timeToFullMs: 0,
    });
  });

  it('preserves a full state when the runtime max increases', () => {
    const result = project(
      createCondition({
        hp: { current: 1_000, max: 1_000 },
        mp: { current: 500, max: 1_000 },
      }),
      {
        maxHp: 1_200,
        maxMp: 1_200,
        now: BASELINE_AT,
      },
    );

    expect(result.resources.hp).toEqual({ current: 1_200, max: 1_200 });
    expect(result.resources.mp).toEqual({ current: 500, max: 1_200 });
  });

  it('clamps resources when the runtime max decreases', () => {
    const result = project(
      createCondition({
        hp: { current: 900, max: 1_000 },
        mp: { current: -20, max: 1_000 },
      }),
      {
        maxHp: 800,
        maxMp: 800,
        now: BASELINE_AT,
      },
    );

    expect(result.resources.hp).toEqual({ current: 800, max: 800 });
    expect(result.resources.mp).toEqual({ current: 0, max: 800 });
  });

  it('does not accrue recovery from an invalid timestamp', () => {
    const result = project(
      createCondition({ lastRecoveryAt: 'invalid-date' }),
    );

    expect(result.timestampValid).toBe(false);
    expect(result.elapsedMs).toBe(0);
    expect(result.resources.hp.current).toBe(100);
    expect(result.resources.mp.current).toBe(100);
  });

  it('does not accrue recovery from a future timestamp', () => {
    const result = project(
      createCondition({ lastRecoveryAt: '2026-01-01T02:00:00.000Z' }),
    );

    expect(result.timestampValid).toBe(true);
    expect(result.elapsedMs).toBe(0);
    expect(result.resources.hp.current).toBe(100);
    expect(result.resources.mp.current).toBe(100);
  });

  it('projects repeatedly from the same baseline without compounding drift', () => {
    const condition = createCondition();
    const afterOneHour = project(condition);
    const afterTwoHours = project(condition, {
      now: '2026-01-01T02:00:00.000Z',
    });
    const repeatedAfterTwoHours = project(condition, {
      now: '2026-01-01T02:00:00.000Z',
    });

    expect(afterOneHour.resources.hp.current).toBe(380);
    expect(afterTwoHours.resources.hp.current).toBe(660);
    expect(afterTwoHours.resources.mp.current).toBe(860);
    expect(repeatedAfterTwoHours).toEqual(afterTwoHours);
  });

  it('reports recovery rate and projected time to full', () => {
    const result = project(createCondition());

    expect(result.recovery.hp.timeToFullMs).toBe(
      Math.ceil(((1_000 - 380) / 280) * 3_600_000),
    );
    expect(result.recovery.mp.timeToFullMs).toBe(
      Math.ceil(((1_000 - 480) / 380) * 3_600_000),
    );
  });
});

describe('getNextConditionStatusExpiryMs', () => {
  it('returns the nearest future active status expiry', () => {
    const condition = createCondition({
      statuses: [
        {
          ...createStatus('minor_wound'),
          duration: {
            kind: 'time',
            expiresAt: '2026-01-01T00:30:00.000Z',
          },
        },
        {
          ...createStatus('weakness'),
          duration: {
            kind: 'time',
            expiresAt: '2026-01-01T00:10:00.000Z',
          },
        },
      ],
    });

    expect(
      getNextConditionStatusExpiryMs(
        condition,
        new Date('2026-01-01T00:05:00.000Z'),
      ),
    ).toBe(Date.parse('2026-01-01T00:10:00.000Z'));
  });

  it('ignores expired, invalid, consumed, and permanent statuses', () => {
    const condition = createCondition({
      statuses: [
        {
          ...createStatus('minor_wound'),
          duration: {
            kind: 'time',
            expiresAt: '2025-12-31T23:59:00.000Z',
          },
        },
        {
          ...createStatus('major_wound'),
          duration: { kind: 'time', expiresAt: 'invalid-date' },
        },
        {
          ...createStatus('weakness'),
          usesRemaining: 0,
          duration: {
            kind: 'time',
            expiresAt: '2026-01-01T00:10:00.000Z',
          },
        },
        createStatus('near_death'),
      ],
    });

    expect(
      getNextConditionStatusExpiryMs(condition, new Date(BASELINE_AT)),
    ).toBeNull();
  });
});
