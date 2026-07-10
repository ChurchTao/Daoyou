import type { CultivatorCondition } from '@shared/types/condition';
import { describe, expect, it } from 'vitest';
import {
  breakthroughMarrowWash,
  getMarrowWashSummary,
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
});
