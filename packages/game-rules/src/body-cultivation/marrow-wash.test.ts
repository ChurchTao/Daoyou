import type { CultivatorCondition } from '@daoyou/game-domain/condition';
import { describe, expect, it } from 'vitest';
import {
  advanceMarrowWash,
  getMarrowWashRootBonus,
  getMarrowWashSummary,
  normalizeMarrowWashState,
} from './marrow-wash.js';

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
  it.each([
    [9, 0],
    [10, 1],
    [19, 1],
    [20, 2],
    [120, 12],
  ])('grants the automatic root bonus at Lv.%s', (level, bonus) => {
    expect(getMarrowWashRootBonus(level)).toBe(bonus);
  });
  it('preserves earned levels and legacy bonuses without a breakthrough gate', () => {
    const condition = createCondition({
      level: 30,
      progress: 999,
      realm: 0,
      breakthroughs: 0,
    });
    expect(normalizeMarrowWashState(condition)).toMatchObject({
      level: 30,
      progress: 999,
    });
    expect(
      getMarrowWashSummary(condition, { cultivatorRealm: '金丹' }),
    ).toMatchObject({ level: 30, levelCap: 35 });
  });
  it('crosses level 10 without a breakthrough', () => {
    const state = normalizeMarrowWashState(
      createCondition({ level: 9, progress: 650 }),
    );
    const result = advanceMarrowWash(state, 800, '筑基');
    expect(result.state).toMatchObject({ level: 11, progress: 70 });
    expect(result.levelUps).toEqual([10, 11]);
    expect(result.unusedProgress).toBe(0);
    expect(state.level).toBe(9);
  });
  it('reaches a non-tenfold realm cap and discards only overflow', () => {
    const state = normalizeMarrowWashState(
      createCondition({ level: 34, progress: 2150 }),
    );
    const result = advanceMarrowWash(state, 100, '金丹');
    expect(result.state).toMatchObject({ level: 35, progress: 0 });
    expect(result.levelUps).toEqual([35]);
    expect(result.unusedProgress).toBe(90);
  });
});
