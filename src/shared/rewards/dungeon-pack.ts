import { formatContentPackErrors } from '@shared/lib/content-pack-errors';
import { z } from 'zod';
import { findItemDefinition } from '../items/registry';
import raw from './data/dungeon.json';

const integer = z.number().int().min(0).max(1000000);
const source = z.strictObject({
  chance: z.number().min(0).max(1),
  experience: integer,
  stones: integer,
  quantity: integer.min(1).max(99),
  weights: z.strictObject({
    material: integer,
    blueprint: integer,
    book: integer,
  }),
});
export const DungeonRewardPackShape = z.strictObject({
  $schema: z.string().optional(),
  formatVersion: z.literal(1),
  contentRevision: integer.min(1),
  poolVersion: integer.min(1),
  books: z
    .array(
      z.strictObject({ rewardId: z.string().min(1), weight: integer.min(1) }),
    )
    .min(1)
    .max(500),
  sources: z.strictObject({
    exploration: source,
    battle: source,
    completion: source,
  }),
});
export function loadDungeonRewardPack(data: unknown) {
  const result = DungeonRewardPackShape.superRefine((pack, ctx) => {
    for (const [name, config] of Object.entries(pack.sources)) {
      if (Object.values(config.weights).every((value) => value === 0))
        ctx.addIssue({
          code: 'custom',
          path: ['sources', name, 'weights'],
          message: '至少启用一种奖励品类',
        });
    }
    const books = new Set<string>();
    pack.books.forEach((item, i) => {
      if (
        findItemDefinition(item.rewardId)?.kind !== 'beast_book' ||
        books.has(item.rewardId)
      )
        ctx.addIssue({
          code: 'custom',
          path: ['books', i, item.rewardId],
          message: '灵印引用不存在或重复',
        });
      books.add(item.rewardId);
    });
  }).safeParse(data);
  if (!result.success)
    throw new Error(
      formatContentPackErrors(
        'rewards/data/dungeon.json',
        data,
        result.error.issues,
      ),
    );
  return result.data;
}
export const DUNGEON_REWARD_PACK = loadDungeonRewardPack(raw);
