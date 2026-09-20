import {
  buildInfiniteTowerEnemySeed,
  resolveInfiniteTowerFloor,
  resolveInfiniteTowerReward,
} from './index';

describe('infinite tower rules', () => {
  it('maps each twenty-floor band to a realm', () => {
    expect(resolveInfiniteTowerFloor(1)).toMatchObject({
      realm: '炼气',
      localFloor: 1,
      difficulty: 5,
    });
    expect(resolveInfiniteTowerFloor(20)).toMatchObject({
      realm: '炼气',
      localFloor: 20,
      kind: 'boss',
      difficulty: 100,
    });
    expect(resolveInfiniteTowerFloor(21).realm).toBe('筑基');
    expect(resolveInfiniteTowerFloor(180).realm).toBe('渡劫');
    expect(resolveInfiniteTowerFloor(181)).toMatchObject({
      realm: '渡劫',
      realmStage: '圆满',
      difficulty: 100,
      endlessAttributeMultiplier: 1.05,
    });
  });

  it('rewards every floor and adds boss rewards', () => {
    expect(resolveInfiniteTowerReward(1)).toEqual({
      floor: 1,
      baseReward: 2_500,
      bossBonus: 0,
      totalReward: 2_500,
      itemRewards: [],
    });
    expect(resolveInfiniteTowerReward(10).bossBonus).toBe(25_000);
    expect(resolveInfiniteTowerReward(20)).toEqual({
      floor: 20,
      baseReward: 7_500,
      bossBonus: 25_000,
      totalReward: 32_500,
      itemRewards: [
        { kind: 'medium_qi_talisman', name: '中聚灵符', quantity: 1 },
      ],
    });
    expect(resolveInfiniteTowerReward(21).baseReward).toBe(5_000);
  });

  it('adds milestone talismans and stacks both rewards at common multiples', () => {
    expect(resolveInfiniteTowerReward(40).itemRewards).toEqual([
      { kind: 'medium_qi_talisman', name: '中聚灵符', quantity: 1 },
    ]);
    expect(resolveInfiniteTowerReward(50).itemRewards).toEqual([
      {
        kind: 'attribute_reset_talisman',
        name: '归元洗髓符',
        quantity: 1,
      },
    ]);
    expect(resolveInfiniteTowerReward(100).itemRewards).toEqual([
      { kind: 'medium_qi_talisman', name: '中聚灵符', quantity: 1 },
      {
        kind: 'attribute_reset_talisman',
        name: '归元洗髓符',
        quantity: 1,
      },
    ]);
  });

  it('keeps a character floor seed stable and distinct', () => {
    expect(buildInfiniteTowerEnemySeed({ cultivatorId: 'a', floor: 7 })).toBe(
      'infinite-tower:v1:a:7',
    );
    expect(
      buildInfiniteTowerEnemySeed({ cultivatorId: 'a', floor: 7 }),
    ).not.toBe(buildInfiniteTowerEnemySeed({ cultivatorId: 'b', floor: 7 }));
  });
});
