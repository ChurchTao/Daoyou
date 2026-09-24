import { z } from 'zod';
import { getRealmStageLevel } from '../config/realmProgression';
import { rollDrops, type DropPool } from '../drops';
import {
  equipmentRealm,
  OPEN_EQUIPMENT_LEVELS,
} from '../engine/combat-v6/equipment/realm';
import { YieldCalculator } from '../engine/yield/YieldCalculator';
import type { ItemGrant } from '../inventory';
import { BLUEPRINTS } from '../items/definitions/equipment-blueprints';
import { findItemDefinition } from '../items/registry';
import type { RealmStage, RealmType } from '../types/constants';
import raw from './data/yield.json';

const weight = z.number().finite().positive().max(1000000);
export const YieldRewardPackSchema = z
  .strictObject({
    poolId: z.string().min(1).max(100),
    poolVersion: z.number().int().positive(),
    weights: z.strictObject({
      material: weight,
      blueprint: weight,
      book: weight,
    }),
    books: z
      .array(z.strictObject({ rewardId: z.string(), weight }))
      .min(1)
      .max(1000),
  })
  .superRefine((pack, ctx) => {
    const seen = new Set<string>();
    pack.books.forEach((book, index) => {
      if (
        findItemDefinition(book.rewardId)?.kind !== 'beast_book' ||
        seen.has(book.rewardId)
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['books', index, 'rewardId'],
          message: '灵印引用无效或重复',
        });
      }
      seen.add(book.rewardId);
    });
  });

export const YIELD_REWARD_PACK = YieldRewardPackSchema.parse(raw);

/** One guaranteed, mutually exclusive reward per original material slot. */
export function planYieldRewards(
  input: { realm: RealmType; realmStage: RealmStage; hoursElapsed: number },
  random: (stream: string) => () => number,
  pack = YIELD_REWARD_PACK,
) {
  if (!Number.isFinite(input.hoursElapsed) || input.hoursElapsed < 0)
    throw new Error('Invalid yield duration');
  const count = YieldCalculator.calculateMaterialCount(
    Math.min(input.hoursElapsed, 24),
  );
  const ownerLevel = getRealmStageLevel(input.realm, input.realmStage);
  const levels = OPEN_EQUIPMENT_LEVELS.filter(
    (value) => equipmentRealm(value).requiredLevel <= ownerLevel,
  );
  const level = levels[levels.length - 1];
  const blueprints = BLUEPRINTS.filter((item) => item.level === level);
  const bookWeight = pack.books.reduce((sum, book) => sum + book.weight, 0);
  const entry = (rewardId: string, value: number) => ({
    rewardId,
    weight: value,
    quantity: { min: 1, max: 1 },
  });
  const pool: DropPool = {
    id: pack.poolId,
    version: pack.poolVersion,
    groups: [
      {
        id: 'item',
        chance: 1,
        entries: [
          entry('yield.material', pack.weights.material),
          ...blueprints.map((item) =>
            entry(item.id, pack.weights.blueprint / blueprints.length),
          ),
          ...pack.books.map((book) =>
            entry(
              book.rewardId,
              (pack.weights.book * book.weight) / bookWeight,
            ),
          ),
        ],
      },
    ],
  };
  let materialCount = 0;
  const items: ItemGrant[] = [];
  for (let slot = 0; slot < count; slot++) {
    const result = rollDrops(pool, (group) =>
      random(`${pool.id}:${pool.version}:${slot}:${group}`),
    );
    const reward = result.rewards[0];
    if (reward.rewardId === 'yield.material') materialCount++;
    else items.push({ definitionId: reward.rewardId, quantity: 1 });
  }
  return {
    poolId: pool.id,
    poolVersion: pool.version,
    count,
    materialCount,
    items,
  };
}
