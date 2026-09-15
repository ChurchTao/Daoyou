import { z } from 'zod';
import { assertConsumableSpec } from '../../lib/consumables';
import { CONSUMABLE_TYPE_VALUES, QUALITY_VALUES } from '../../types/constants';
import type { Consumable } from '../../types/cultivator';

export const CONSUMABLE_ITEM = {
  id: 'consumable.v1',
  name: '消耗品',
  kind: 'consumable' as const,
  stackLimit: 99,
};

/** The same spec is used for new alchemy output and explicit vault withdrawals. */
export const ConsumableFactsSchema = z
  .object({
    name: z.string().min(1),
    type: z.enum(CONSUMABLE_TYPE_VALUES),
    quality: z.enum(QUALITY_VALUES),
    description: z.string().default(''),
    prompt: z.string().default(''),
    score: z.number().finite().default(0),
    spec: z.unknown().transform((value, ctx) => {
      try {
        return assertConsumableSpec(value);
      } catch {
        ctx.addIssue({ code: 'custom', message: '消耗品药效协议无效' });
        return z.NEVER;
      }
    }),
  })
  .strict();
export type ConsumableFacts = z.infer<typeof ConsumableFactsSchema>;

export function consumableFactsOf(item: Consumable): ConsumableFacts {
  return ConsumableFactsSchema.parse({
    name: item.name,
    type: item.type,
    quality: item.quality ?? '凡品',
    description: item.description ?? '',
    prompt: item.prompt ?? '',
    score: item.score ?? 0,
    spec: item.spec,
  });
}
