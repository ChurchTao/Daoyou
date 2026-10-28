import { describe, expect, it } from 'vitest';
import { SeededRng } from '@daoyou/combat-core/rng';
import { findItemDefinition } from '@daoyou/game-content/items';
import { blueprintRealmWeights } from './blueprint-distribution.js';
import { REALM_STAGE_VALUES, REALM_VALUES } from '@daoyou/constants/realms';
import {
  planYieldRewards,
  YIELD_REWARD_PACK,
  YieldRewardPackSchema,
} from './yield.js';

const input = { realm: '炼气', realmStage: '初期', hoursElapsed: 24 } as const;
const constant = (value: number) => () => () => value;

describe('挂机固定总量掉落', () => {
  it.each([
    [0, 0],
    [1, 0],
    [2.99, 0],
    [3, 1],
    [23.99, 7],
    [24, 8],
    [48, 8],
  ])('%s 小时只生成 %s 个名额', (hoursElapsed, count) => {
    const plan = planYieldRewards({ ...input, hoursElapsed }, constant(0));
    expect(plan.materialCount + plan.items.length).toBe(count);
    expect(plan.count).toBe(count);
  });

  it('八个名额抽出两张图纸后只剩六份材料', () => {
    const plan = planYieldRewards(input, (stream) => {
      const slot = Number(stream.split(':')[2]);
      return () => (slot < 2 ? 0.9 : 0);
    });
    expect(plan.materialCount).toBe(6);
    expect(plan.items).toHaveLength(2);
    expect(
      plan.items.every(
        (item) =>
          findItemDefinition(item.definitionId)?.kind === 'blueprint' &&
          item.quantity === 1,
      ),
    ).toBe(true);
  });

  it('八枚灵印完全替代材料，不额外产出', () => {
    const plan = planYieldRewards(input, constant(0.99));
    expect(plan.materialCount).toBe(0);
    expect(plan.items).toHaveLength(8);
    expect(
      plan.items.every(
        (item) =>
          findItemDefinition(item.definitionId)?.kind === 'beast_book' &&
          item.quantity === 1,
      ),
    ).toBe(true);
  });

  it('每个名额有 8% 图纸，境界按权重表而不是本境一档', () => {
    const category =
      YIELD_REWARD_PACK.weights.blueprint /
      (YIELD_REWARD_PACK.weights.material +
        YIELD_REWARD_PACK.weights.blueprint +
        YIELD_REWARD_PACK.weights.book);
    expect(category).toBeCloseTo(0.08, 10);
    for (const realm of REALM_VALUES)
      for (const realmStage of REALM_STAGE_VALUES) {
        const allowed = new Set(
          blueprintRealmWeights(realm, 'yield').map((row) => row.level),
        );
        const plan = planYieldRewards(
          { ...input, realm, realmStage },
          constant(0.9),
        );
        expect(plan.items).toHaveLength(8);
        for (const item of plan.items) {
          const definition = findItemDefinition(item.definitionId)!;
          expect(definition.kind).toBe('blueprint');
          expect(allowed.has(definition.level!)).toBe(true);
          expect(definition.level).toBeLessThanOrEqual(130);
        }
      }
  });

  it('固定随机流可复现，多个种子均保持总量', () => {
    const random = (seed: number) => (stream: string) => {
      let hash = seed;
      for (const char of stream)
        hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
      const rng = new SeededRng(hash >>> 0);
      return () => rng.next();
    };
    for (let seed = 0; seed < 256; seed++) {
      const plan = planYieldRewards(input, random(seed));
      expect(plan).toEqual(planYieldRewards(input, random(seed)));
      expect(
        plan.materialCount +
          plan.items.reduce((sum, item) => sum + item.quantity, 0),
      ).toBe(8);
    }
  });

  it('拒绝未知、错误类型和重复灵印配置', () => {
    for (const rewardId of ['missing', 'blueprint.weapon.10']) {
      expect(
        YieldRewardPackSchema.safeParse({
          ...YIELD_REWARD_PACK,
          books: [{ rewardId, weight: 1 }],
        }).success,
      ).toBe(false);
    }
    expect(
      YieldRewardPackSchema.safeParse({
        ...YIELD_REWARD_PACK,
        books: [YIELD_REWARD_PACK.books[0], YIELD_REWARD_PACK.books[0]],
      }).success,
    ).toBe(false);
  });
});
