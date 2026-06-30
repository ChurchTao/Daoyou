import { describe, expect, it } from 'vitest';
import {
  getBreakthroughAttributeGrowthReward,
  getRealmDamagePressureMultiplier,
  getRealmEffectChanceMultiplier,
  getRealmStageAttributeBudget,
  getRealmStageNaturalAttributeValue,
  getRealmStageRank,
  getRealmStageUnallocatedAttributeBudget,
} from './realmProgression';

describe('realmProgression', () => {
  it('calculates fixed attribute budgets by realm and stage', () => {
    expect(getRealmStageAttributeBudget('炼气', '初期')).toBe(50);
    expect(getRealmStageAttributeBudget('筑基', '初期')).toBe(150);
    expect(getRealmStageAttributeBudget('金丹', '初期')).toBe(250);
    expect(getRealmStageAttributeBudget('渡劫', '初期')).toBe(850);
    expect(getRealmStageAttributeBudget('渡劫', '圆满')).toBe(910);
  });

  it('splits attribute budget into natural values and allocatable points', () => {
    expect(getRealmStageNaturalAttributeValue('炼气', '初期')).toBe(10);
    expect(getRealmStageUnallocatedAttributeBudget('炼气', '初期')).toBe(0);

    expect(getRealmStageNaturalAttributeValue('筑基', '初期')).toBe(20);
    expect(getRealmStageUnallocatedAttributeBudget('筑基', '初期')).toBe(50);

    expect(getRealmStageNaturalAttributeValue('渡劫', '圆满')).toBe(96);
    expect(getRealmStageUnallocatedAttributeBudget('渡劫', '圆满')).toBe(430);
  });

  it('calculates realm stage rank and breakthrough rewards', () => {
    expect(getRealmStageRank('炼气', '初期')).toBe(0);
    expect(getRealmStageRank('筑基', '初期')).toBe(4);
    expect(getBreakthroughAttributeGrowthReward(
      { realm: '炼气', stage: '初期' },
      { realm: '炼气', stage: '中期' },
    )).toEqual({ naturalPerAttribute: 2, attributePointReward: 10 });
    expect(getBreakthroughAttributeGrowthReward(
      { realm: '炼气', stage: '圆满' },
      { realm: '筑基', stage: '初期' },
    )).toEqual({ naturalPerAttribute: 4, attributePointReward: 20 });
  });

  it('applies realm damage pressure with caps', () => {
    expect(getRealmDamagePressureMultiplier(0)).toBe(1);
    expect(getRealmDamagePressureMultiplier(1)).toBe(1.08);
    expect(getRealmDamagePressureMultiplier(-1)).toBe(0.94);
    expect(getRealmDamagePressureMultiplier(4)).toBe(1.4);
    expect(getRealmDamagePressureMultiplier(-4)).toBe(0.68);
    expect(getRealmDamagePressureMultiplier(12)).toBe(2.15);
    expect(getRealmDamagePressureMultiplier(20)).toBe(2.2);
    expect(getRealmDamagePressureMultiplier(-12)).toBe(0.26);
    expect(getRealmDamagePressureMultiplier(-20)).toBe(0.25);
  });

  it('applies realm effect chance pressure with caps', () => {
    expect(getRealmEffectChanceMultiplier(0)).toBe(1);
    expect(getRealmEffectChanceMultiplier(4)).toBe(1.16);
    expect(getRealmEffectChanceMultiplier(20)).toBe(1.35);
    expect(getRealmEffectChanceMultiplier(-4)).toBe(0.8);
    expect(getRealmEffectChanceMultiplier(-20)).toBe(0.55);
  });
});
