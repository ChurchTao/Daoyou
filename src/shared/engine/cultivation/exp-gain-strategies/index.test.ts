import { describe, expect, it } from 'vitest';
import {
  calculateSceneCultivationExp,
  calculateBattleExp,
  calculateDungeonExp,
  calculateOfflineExp,
  calculatePillExp,
  calculateRetreatBaseExp,
} from './index';

describe('cultivation exp gain strategies', () => {
  it('retreat resolves realm percent and years against the current cap', () => {
    expect(calculateRetreatBaseExp('炼气', '初期', 2, 10_000)).toBe(800);
  });

  it('offline yield resolves hours, unit cap, and random factor', () => {
    const result = calculateSceneCultivationExp('offline_yield', {
      realm: '金丹',
      realmStage: '初期',
      expCap: 1_000,
      hoursElapsed: 100,
      randomFactor: 1,
    });

    expect(result.baseExp).toBe(22);
    expect(result.trace.units).toBe(4);
    expect(calculateOfflineExp('金丹', '初期', 6, () => 0.5, 1_000)).toBe(5);
  });

  it('dungeon resolves tier and danger bonus', () => {
    expect(calculateDungeonExp('筑基', '初期', 'S', 0, 1_500)).toBe(255);

    expect(
      calculateSceneCultivationExp('dungeon', {
        realm: '筑基',
        realmStage: '初期',
        expCap: 1_000,
        result: 'perfect',
      }).baseExp,
    ).toBe(170);
  });

  it('pill resolves either quality percent or quality scalar', () => {
    expect(
      calculateSceneCultivationExp('pill', {
        realm: '筑基',
        realmStage: '初期',
        expCap: 2_000,
        quality: '真品',
      }).baseExp,
    ).toBe(40);

    expect(calculatePillExp('筑基', 1.66, '初期', 2_000)).toBe(13);
  });

  it('battle victory resolves realm diff and victory type multipliers', () => {
    expect(calculateBattleExp('筑基', '初期', 1, 'perfect', 1_000)).toBe(19);
  });

  it('daily task and event strategies resolve controlled weights', () => {
    expect(
      calculateSceneCultivationExp('daily_task', {
        realm: '炼气',
        realmStage: '初期',
        expCap: 1_000,
        difficulty: 'hard',
      }).baseExp,
    ).toBe(113);

    expect(
      calculateSceneCultivationExp('system_reward', {
        realm: '炼气',
        realmStage: '初期',
        expCap: 1_000,
        weight: 'major',
        multiplier: 10,
      }).baseExp,
    ).toBe(80);
  });
});
