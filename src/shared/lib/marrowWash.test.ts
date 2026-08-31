import type { CultivatorCondition } from '@shared/types/condition';
import { describe, expect, it } from 'vitest';
import {
  advanceMarrowWashTowardBreakthrough,
  breakthroughMarrowWash,
  getMarrowWashSummary,
  isMarrowWashBreakthroughRequired,
  normalizeMarrowWashState,
} from './marrowWash';

function createCondition(
  marrowWash: CultivatorCondition['tracks']['marrowWash'],
): CultivatorCondition {
  return {
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
      marrowWash,
    },
    counters: {
      longTermPillUsesByRealm: {},
      cultivationPillUsesByRealm: {},
      longevityPillUsesByRealm: {},
    },
    statuses: [],
    timestamps: {},
  };
}

describe('marrowWash', () => {
  it('normalizes dirty realm and breakthrough counts to the safest known value', () => {
    const condition = createCondition({
      version: 1,
      level: 11,
      progress: 0,
      realm: 1,
      breakthroughs: 0,
    });

    expect(normalizeMarrowWashState(condition)).toMatchObject({
      version: 1,
      level: 11,
      progress: 0,
      realm: 1,
      breakthroughs: 1,
    });
    expect(getMarrowWashSummary(condition, { cultivatorRealm: '筑基' })).toMatchObject({
      nextBreakthroughLevel: 20,
      canBreakthrough: false,
    });
  });

  it('rejects repeat breakthrough attempts from dirty persisted first-realm state', () => {
    const condition = createCondition({
      version: 1,
      level: 11,
      progress: 0,
      realm: 1,
      breakthroughs: 0,
    });

    expect(() =>
      breakthroughMarrowWash(condition, { cultivatorRealm: '筑基' }),
    ).toThrow('洗髓等级不足，达到 Lv.20 后方可破限。');
  });

  it('stops accumulated legacy progress at the next uncompleted breakthrough', () => {
    const condition = createCondition({
      version: 1,
      level: 30,
      progress: 999,
      realm: 0,
      breakthroughs: 0,
    });

    expect(normalizeMarrowWashState(condition)).toMatchObject({
      level: 10,
      progress: 0,
      realm: 0,
      breakthroughs: 0,
    });

    const result = breakthroughMarrowWash(condition, {
      cultivatorRealm: '金丹',
    });
    expect(result).toMatchObject({
      fromRealm: 0,
      toRealm: 1,
      breakthroughLevel: 10,
      condition: {
        tracks: {
          marrowWash: {
            level: 10,
            progress: 0,
            realm: 1,
            breakthroughs: 1,
          },
        },
      },
    });
  });

  it('caps pill progress at one breakthrough and blocks further progress until it is completed', () => {
    const state = normalizeMarrowWashState(
      createCondition({
        version: 1,
        level: 9,
        progress: 650,
        realm: 0,
        breakthroughs: 0,
      }),
    );

    const result = advanceMarrowWashTowardBreakthrough(state, 100);

    expect(result.state).toMatchObject({
      level: 10,
      progress: 0,
      realm: 0,
      breakthroughs: 0,
    });
    expect(result.levelUps).toEqual([10]);
    expect(result.unusedProgress).toBe(90);
    expect(isMarrowWashBreakthroughRequired(result.state)).toBe(true);
  });
});
