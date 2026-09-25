import { formatContentPackErrors } from '@shared/lib/content-pack-errors';
import { z } from 'zod';
import { findItemDefinition } from '../items/registry';
import raw from './data/dungeon.json';

const integer = z.number().int().min(0).max(1000000);
const source = z.strictObject({
  chance: z.number().min(0).max(1),
  dailyExpFraction: z.number().min(0).max(1),
  stoneHours: z.number().min(0).max(24),
  quantity: integer.min(1).max(99),
  bonusChances: z.strictObject({
    originDew: z.number().min(0).max(1),
    superiorOriginDew: z.number().min(0).max(1),
    superiorBook: z.number().min(0).max(1),
    blueprint: z.number().min(0).max(1),
  }),
  weights: z.strictObject({
    material: integer,
    blueprint: integer,
    book: integer,
  }),
});
export const DungeonRewardPackShape = z.strictObject({
  $schema: z.string().optional(),
  formatVersion: z.literal(2),
  contentRevision: integer.min(1),
  poolVersion: integer.min(1),
  bonusPoolVersion: integer.min(1),
  superiorBooks: z.array(z.string().min(1)).min(1).max(500),
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
    if (
      pack.sources.completion.dailyExpFraction !== 0 ||
      pack.sources.completion.stoneHours !== 0
    )
      ctx.addIssue({
        code: 'custom',
        path: ['sources', 'completion'],
        message: '通关节点资源必须为零，评级奖励单独结算',
      });
    const superiorBooks = new Set<string>();
    pack.superiorBooks.forEach((id, i) => {
      if (
        findItemDefinition(id)?.kind !== 'beast_book' ||
        !id.startsWith('book.beast.advanced-') ||
        superiorBooks.has(id)
      )
        ctx.addIssue({
          code: 'custom',
          path: ['superiorBooks', i],
          message: '上品灵印引用无效或重复',
        });
      superiorBooks.add(id);
    });
    for (const [name, config] of Object.entries(pack.sources)) {
      if (
        Object.values(config.bonusChances).reduce(
          (sum, value) => sum + value,
          0,
        ) > 1
      )
        ctx.addIssue({
          code: 'custom',
          path: ['sources', name, 'bonusChances'],
          message: '额外奖励概率合计不能超过1',
        });
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
