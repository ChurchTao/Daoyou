import { REALM_VALUES, REALM_STAGE_VALUES } from '@shared/types/constants';
import { describe, expect, it } from 'vitest';
import {
  getBreakthroughAttributeGrowthReward,
  getRealmDamagePressureMultiplier,
  getRealmEffectChanceMultiplier,
  getRealmStageAttributeBudget,
  getRealmStageNaturalAttributeValue,
  getRealmStageRank,
  getRealmStageLevel,
  getLevelRealmStage,
  getRealmStageUnallocatedAttributeBudget,
} from './realmProgression';

describe('realmProgression', () => {
  it('calculates fixed attribute budgets by realm and stage', () => {
    expect(getRealmStageAttributeBudget('炼气', '初期')).toBe(115);
    expect(getRealmStageAttributeBudget('筑基', '初期')).toBe(335);
    expect(getRealmStageAttributeBudget('金丹', '初期')).toBe(555);
    expect(getRealmStageAttributeBudget('渡劫', '初期')).toBe(1875);
    expect(getRealmStageAttributeBudget('渡劫', '圆满')).toBe(2040);
  });

  it('splits attribute budget into natural values and allocatable points', () => {
    expect(getRealmStageNaturalAttributeValue('炼气', '初期')).toBe(15);
    expect(getRealmStageUnallocatedAttributeBudget('炼气', '初期')).toBe(25);

    expect(getRealmStageNaturalAttributeValue('筑基', '初期')).toBe(35);
    expect(getRealmStageUnallocatedAttributeBudget('筑基', '初期')).toBe(125);

    expect(getRealmStageNaturalAttributeValue('渡劫', '圆满')).toBe(190);
    expect(getRealmStageUnallocatedAttributeBudget('渡劫', '圆满')).toBe(900);
  });

  it('calculates realm stage rank and breakthrough rewards', () => {
    expect(getRealmStageRank('炼气', '初期')).toBe(0);
    expect(getRealmStageRank('筑基', '初期')).toBe(4);
    expect(getBreakthroughAttributeGrowthReward(
      { realm: '炼气', stage: '初期' },
      { realm: '炼气', stage: '中期' },
    )).toEqual({ naturalPerAttribute: 5, attributePointReward: 25 });
    expect(getBreakthroughAttributeGrowthReward(
      { realm: '炼气', stage: '圆满' },
      { realm: '筑基', stage: '初期' },
    )).toEqual({ naturalPerAttribute: 5, attributePointReward: 25 });
  });

  it('conserves the level budget across all 36 stages and 35 breakthroughs', () => {
    const stages = REALM_VALUES.flatMap((realm) =>
      REALM_STAGE_VALUES.map((stage) => ({ realm, stage })),
    );
    let natural = 15;
    let free = 25;
    stages.forEach((current, index) => {
      if (index > 0) {
        const reward = getBreakthroughAttributeGrowthReward(stages[index - 1], current);
        expect(reward).toEqual({ naturalPerAttribute: 5, attributePointReward: 25 });
        natural += reward.naturalPerAttribute;
        free += reward.attributePointReward;
      }
      expect(getRealmStageLevel(current.realm, current.stage)).toBe((index + 1) * 5);
      expect(getRealmStageNaturalAttributeValue(current.realm, current.stage)).toBe(natural);
      expect(getRealmStageUnallocatedAttributeBudget(current.realm, current.stage)).toBe(free);
    });
    expect({ natural, free }).toEqual({ natural: 190, free: 900 });
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

describe('等级境界展示', () => {
  it('全部人物小境界可往返映射', () => {
    for (const realm of REALM_VALUES) {
      for (const stage of REALM_STAGE_VALUES) {
        expect(getLevelRealmStage(getRealmStageLevel(realm, stage))).toEqual({
          realm,
          stage,
          label: `${realm}${stage}`,
        });
      }
    }
  });

  it.each([
    [0, '炼气初期'],
    [5, '炼气初期'],
    [6, '炼气中期'],
    [10, '炼气中期'],
    [20, '炼气圆满'],
    [21, '筑基初期'],
    [50, '金丹中期'],
    [90, '化神中期'],
    [130, '合体中期'],
    [180, '渡劫圆满'],
  ])('将 %s 映射为 %s，并向上取到可满足门槛的境界', (level, label) => {
    expect(getLevelRealmStage(level).label).toBe(label);
  });
});
