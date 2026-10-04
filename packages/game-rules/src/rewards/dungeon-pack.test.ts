import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  REWARDS_DUNGEON_DATA as raw,
  REWARDS_DUNGEON_SCHEMA as schema,
} from '@daoyou/game-content/authoring/rewards';
import { planDungeonReward } from './dungeon.js';
import {
  DungeonRewardPackShape,
  loadDungeonRewardPack,
} from '@daoyou/game-content/rewards/dungeon';

describe('副本奖励数据包', () => {
  it('Schema 同步', () =>
    expect(z.toJSONSchema(DungeonRewardPackShape, { reused: 'ref' })).toEqual(
      schema,
    ));
  it('材料、数量及掉落配置进入最终奖励', () => {
    const data = structuredClone(raw);
    data.sources.battle = {
      bonusChances: {
        originDew: 0,
        superiorOriginDew: 0,
        superiorBook: 0,
        blueprint: 0,
      },
      chance: 1,
      quantity: 3,
      dailyExpFraction: 0.075,
      stoneHours: 1.3,
      weights: { material: 1, blueprint: 0, book: 0 },
    };
    expect(
      planDungeonReward(1, 'fight', 'battle', 60, loadDungeonRewardPack(data)),
    ).toEqual({
      key: 'fight',
      items: [],
      materialCount: 3,
      materialRealm: '金丹',
      materialSeed: `1:fight:dungeon.battle:${data.poolVersion}:material`,
    });
  });
  it('拒绝旧固定材料池、未知来源和非法概率', () => {
    const data = structuredClone(raw);
    expect(() =>
      loadDungeonRewardPack({
        ...raw,
        materials: [{ rewardId: 'material.v1', weight: 1 }],
      }),
    ).toThrow('materials');
    expect(() =>
      loadDungeonRewardPack({
        ...raw,
        sources: { ...raw.sources, extra: raw.sources.battle },
      }),
    ).toThrow('extra');
    data.sources.battle.chance = 2;
    expect(() => loadDungeonRewardPack(data)).toThrow('chance');
  });
  it('通关节点不能再配置固定修为或灵石', () => {
    const data = structuredClone(raw);
    data.sources.completion.dailyExpFraction = 0.01;
    expect(() => loadDungeonRewardPack(data)).toThrow('评级奖励单独结算');
  });
});
