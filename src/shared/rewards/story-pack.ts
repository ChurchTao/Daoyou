import { z } from 'zod';
import { DropPoolSchema, type DropPool } from '../drops';
import { findItemDefinition } from '../items/registry';
import { MaterialFactsSchema } from '../items/definitions/materials';
import { formatContentPackErrors } from '../lib/content-pack-errors';
import raw from './data/story.json';

export const STORY_SPIRIT_STONE_REWARD = 'currency.spirit-stones';

const entrySchema = z
  .object({
    rewardId: z.string().trim().min(1).max(160),
    weight: z.number().finite().positive().max(1_000_000),
    quantity: z
      .object({
        min: z.number().int().min(1),
        max: z.number().int().min(1),
      })
      .strict()
      .refine((value) => value.min <= value.max, '数量上限不能小于下限'),
  })
  .strict();

const StoryRewardPackShape = z
  .object({
    formatVersion: z.literal(1),
    contentRevision: z.number().int().positive(),
    materials: z.record(z.string().trim().min(1).max(160), MaterialFactsSchema),
    payouts: z
      .array(
        z
          .object({
            id: z.string().trim().min(1).max(40),
            poolVersion: z.number().int().positive(),
            groups: z
              .array(
                z
                  .object({
                    id: z.string().trim().min(1).max(100),
                    chance: z.number().finite().min(0).max(1),
                    entries: z.array(entrySchema).min(1).max(1000),
                  })
                  .strict(),
              )
              .min(1)
              .max(100),
          })
          .strict(),
      )
      .min(1)
      .max(80),
  })
  .strict();

export type StoryRewardPack = z.infer<typeof StoryRewardPackShape>;

export function loadStoryRewardPack(data: unknown): StoryRewardPack {
  const result = StoryRewardPackShape.superRefine((pack, context) => {
    const payouts = new Set<string>();
    for (const [index, payout] of pack.payouts.entries()) {
      if (payouts.has(payout.id)) {
        context.addIssue({
          code: 'custom',
          path: ['payouts', index, 'id'],
          message: `奖励编号重复：${payout.id}`,
        });
      }
      payouts.add(payout.id);
      const pool = DropPoolSchema.safeParse({
        id: `story.${payout.id}`,
        version: payout.poolVersion,
        groups: payout.groups,
      });
      if (!pool.success) {
        context.addIssue({
          code: 'custom',
          path: ['payouts', index],
          message: '这份奖励不是有效的掉落池',
        });
        continue;
      }
      payout.groups.forEach((group, groupIndex) => {
        group.entries.forEach((entry, entryIndex) => {
          const path = [
            'payouts',
            index,
            'groups',
            groupIndex,
            'entries',
            entryIndex,
            'rewardId',
          ];
          if (entry.rewardId === STORY_SPIRIT_STONE_REWARD) {
            if (entry.quantity.max > 1_000_000) {
              context.addIssue({
                code: 'custom',
                path,
                message: '灵石单次数量过大',
              });
            }
            return;
          }
          const material = pack.materials[entry.rewardId];
          if (material) {
            if (entry.quantity.max > 99) {
              context.addIssue({
                code: 'custom',
                path,
                message: '材料数量超过堆叠上限',
              });
            }
            return;
          }
          const item = findItemDefinition(entry.rewardId);
          if (!item) {
            context.addIssue({
              code: 'custom',
              path,
              message: `奖励无法识别：${entry.rewardId}`,
            });
            return;
          }
          if (entry.quantity.max > item.stackLimit) {
            context.addIssue({
              code: 'custom',
              path,
              message: '数量超过堆叠上限',
            });
          }
        });
      });
    }
    for (const rewardId of Object.keys(pack.materials)) {
      if (rewardId === STORY_SPIRIT_STONE_REWARD) {
        context.addIssue({
          code: 'custom',
          path: ['materials', rewardId],
          message: '材料编号与灵石奖励冲突',
        });
      }
    }
  }).safeParse(data);
  if (!result.success) {
    throw new Error(
      formatContentPackErrors(
        'rewards/data/story.json',
        data,
        result.error.issues,
      ),
    );
  }
  return result.data;
}

export function storyDropPool(
  payout: StoryRewardPack['payouts'][number],
): DropPool {
  return DropPoolSchema.parse({
    id: `story.${payout.id}`,
    version: payout.poolVersion,
    groups: payout.groups,
  });
}

export const STORY_REWARD_PACK = loadStoryRewardPack(raw);
