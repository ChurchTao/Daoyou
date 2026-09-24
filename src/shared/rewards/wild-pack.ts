import { z } from 'zod';
import { DropPoolSchema, type DropPool } from '../drops';
import { BOOKS } from '../items/definitions/beast-books';
import { formatContentPackErrors } from '../lib/content-pack-errors';
import raw from './data/wild.json';

const bookIds = new Set(BOOKS.map((book) => book.id));
export const WildRewardPackShape = z.strictObject({
  $schema: z.string().optional(),
  formatVersion: z.literal(2),
  contentRevision: z.number().int().positive(),
  poolId: z.string().min(1),
  poolVersion: z.number().int().positive(),
  groups: z
    .array(
      z.strictObject({
        id: z.literal('books'),
        chance: z.number().min(0).max(1),
        source: z.strictObject({
          kind: z.literal('fixed'),
          entries: z
            .array(
              z.strictObject({
                rewardId: z.string().min(1),
                weight: z.number().positive().max(1000000),
                quantity: z.strictObject({
                  min: z.literal(1),
                  max: z.literal(1),
                }),
              }),
            )
            .min(1),
        }),
      }),
    )
    .length(1),
});
export function loadWildRewardPack(data: unknown) {
  const result = WildRewardPackShape.superRefine((pack, ctx) => {
    const seen = new Set<string>();
    pack.groups[0].source.entries.forEach((entry, i) => {
      if (!bookIds.has(entry.rewardId) || seen.has(entry.rewardId))
        ctx.addIssue({
          code: 'custom',
          path: ['groups', 0, 'source', 'entries', i],
          message: '野外奖励必须是已注册且不重复的传承灵印',
        });
      seen.add(entry.rewardId);
    });
  }).safeParse(data);
  if (!result.success)
    throw new Error(
      formatContentPackErrors(
        'rewards/data/wild.json',
        data,
        result.error.issues,
      ),
    );
  return result.data;
}
export const WILD_REWARD_PACK = loadWildRewardPack(raw);
export function compileWildRewardPool(pack = WILD_REWARD_PACK): DropPool {
  return DropPoolSchema.parse({
    id: pack.poolId,
    version: pack.poolVersion,
    groups: pack.groups.map((group) => ({
      id: group.id,
      chance: group.chance,
      entries: group.source.entries,
    })),
  });
}
