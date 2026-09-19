import { describe, expect, it } from 'vitest';
import { DropPoolSchema, rollDrops } from './index';
const pool = DropPoolSchema.parse({
  id: 'any-business',
  version: 1,
  groups: [
    {
      id: 'one',
      chance: 0.3,
      entries: [
        { rewardId: 'opaque-A', weight: 1, quantity: { min: 1, max: 3 } },
        { rewardId: 'opaque-B', weight: 3, quantity: { min: 2, max: 2 } },
      ],
    },
  ],
});
const sequence =
  (...values: number[]) =>
  () =>
  () => {
    const next = values.shift();
    if (next === undefined) throw new Error('Unexpected RNG draw');
    return next;
  };
describe('business-independent drop pools', () => {
  it('does not impose inventory stack limits on unrelated rewards', () => {
    const large = {
      ...pool,
      groups: [
        {
          id: 'currency',
          chance: 1,
          entries: [
            {
              rewardId: 'external.points',
              weight: 1,
              quantity: { min: 1000, max: 1000 },
            },
          ],
        },
      ],
    };
    expect(rollDrops(large, sequence(0, 0)).rewards[0].quantity).toBe(1000);
  });
  it('uses exclusive probability boundaries and inclusive quantities', () => {
    expect(rollDrops(pool, sequence(0.3)).rewards).toEqual([]);
    expect(rollDrops(pool, sequence(0.299, 0.249, 0.999)).rewards).toEqual([
      { groupId: 'one', rewardId: 'opaque-A', quantity: 3 },
    ]);
    expect(rollDrops(pool, sequence(0, 0.25, 0)).rewards[0].rewardId).toBe(
      'opaque-B',
    );
  });
  it('supports guaranteed rewards and zero-probability groups', () => {
    const guaranteed = structuredClone(pool);
    guaranteed.groups[0].chance = 1;
    expect(rollDrops(guaranteed, sequence(0, 0)).rewards[0].quantity).toBe(1);
    guaranteed.groups[0].chance = 0;
    expect(rollDrops(guaranteed, sequence()).rewards).toEqual([]);
  });
  it('rejects malformed ranges, weights, probabilities and duplicate group IDs', () => {
    for (const chance of [-1, 1.1, NaN])
      expect(
        DropPoolSchema.safeParse({
          ...pool,
          groups: [{ ...pool.groups[0], chance }],
        }).success,
      ).toBe(false);
    expect(
      DropPoolSchema.safeParse({
        ...pool,
        groups: [pool.groups[0], pool.groups[0]],
      }).success,
    ).toBe(false);
    for (const entry of [
      { rewardId: 'x', weight: 0, quantity: { min: 1, max: 1 } },
      { rewardId: 'x', weight: 1, quantity: { min: 3, max: 1 } },
    ])
      expect(
        DropPoolSchema.safeParse({
          ...pool,
          groups: [{ ...pool.groups[0], entries: [entry] }],
        }).success,
      ).toBe(false);
    expect(() => rollDrops(pool, sequence(1))).toThrow();
  });
  it('does not change existing groups when another group is added', () => {
    const expanded = {
      ...pool,
      groups: [...pool.groups, { ...pool.groups[0], id: 'two' }],
    };
    const streams = () => () => 0;
    expect(rollDrops(expanded, streams).rewards[0]).toEqual(
      rollDrops(pool, streams).rewards[0],
    );
  });
});
