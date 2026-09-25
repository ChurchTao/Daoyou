import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import raw from './data/dungeon.json';
import schema from './data/dungeon.schema.json';
import { planDungeonReward } from './dungeon';
import { DungeonRewardPackShape, loadDungeonRewardPack } from './dungeon-pack';

describe('副本奖励数据包', () => {
  it('Schema 同步', () =>
    expect(z.toJSONSchema(DungeonRewardPackShape, { reused: 'ref' })).toEqual(
      schema,
    ));
  it('三类来源、四档等级、128种子保持原有掉落件数', () => {
    const pack = loadDungeonRewardPack(raw);
    for (const source of Object.values(pack.sources))
      source.bonusChances = {
        originDew: 0,
        superiorOriginDew: 0,
        superiorBook: 0,
        blueprint: 0,
      };
    const rows = (['exploration', 'battle', 'completion'] as const).flatMap(
      (source) =>
        [1, 60, 120, 180].flatMap((level) =>
          Array.from({ length: 128 }, (_, seed) =>
            (() => {
              const reward = planDungeonReward(
                seed,
                `baseline-${seed}`,
                source,
                level,
                pack,
              );
              return {
                key: reward.key,
                quantity:
                  reward.materialCount +
                  reward.items.reduce((sum, item) => sum + item.quantity, 0),
              };
            })(),
          ),
        ),
    );
    expect(
      createHash('sha256').update(JSON.stringify(rows)).digest('hex'),
    ).toBe('83dd6a2ab498a603a3516716e2df8a42307847e8caadfa5690f17d5e38de3c0f');
  });
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
