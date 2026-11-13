import { z } from 'zod';
import { BEAST_SPECIES } from '../beasts/content.js';
import { STORY_REWARD_PACK } from '../rewards/story-pack.js';
import raw from './data/gifts.json' with { type: 'json' };

/**
 * 赠礼：主线给玩家的一份东西，可以由几样拼成。
 * payout 是奖励包里的一份掉落（材料、道具、灵石），beast 是一只灵兽。
 */
const StoryGiftSchema = z
  .object({
    id: z.string().trim().min(1).max(40),
    parts: z
      .array(
        z.discriminatedUnion('type', [
          z
            .object({
              type: z.literal('payout'),
              payout: z.string().trim().min(1).max(40),
            })
            .strict(),
          z
            .object({
              type: z.literal('beast'),
              species: z.string().trim().min(1).max(80),
            })
            .strict(),
        ]),
      )
      .min(1)
      .max(6),
  })
  .strict();

export type StoryGift = z.infer<typeof StoryGiftSchema>;

const hasPayout = (id: string) =>
  STORY_REWARD_PACK.payouts.some((payout) => payout.id === id);

const gifts = new Map<string, StoryGift>();
for (const entry of raw) {
  const gift = StoryGiftSchema.parse(entry);
  if (gifts.has(gift.id) || hasPayout(gift.id))
    throw new Error(`赠礼编号重复：${gift.id}`);
  for (const part of gift.parts) {
    if (part.type === 'payout' && !hasPayout(part.payout))
      throw new Error(`赠礼里没有这份掉落：${gift.id} → ${part.payout}`);
    if (
      part.type === 'beast' &&
      !BEAST_SPECIES.some((species) => species.id === part.species)
    )
      throw new Error(`赠礼里没有这种灵兽：${gift.id} → ${part.species}`);
  }
  gifts.set(gift.id, gift);
}

/** 主线里写的一个赠礼编号拆成几样。只写了掉落编号的旧写法，当成只有这一样。 */
export function storyGiftParts(id: string): StoryGift['parts'] {
  const gift = gifts.get(id);
  if (gift) return gift.parts;
  if (hasPayout(id)) return [{ type: 'payout', payout: id }];
  throw new Error(`没有这份赠礼：${id}`);
}

export function hasStoryGift(id: string): boolean {
  return gifts.has(id) || hasPayout(id);
}
